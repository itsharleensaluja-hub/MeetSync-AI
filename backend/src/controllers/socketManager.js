/**
 * SOCKET MANAGER - socketManager.js
 * This file handles all real-time WebSocket communication for video calls:
 * - User joining/leaving calls
 * - WebRTC signaling (peer-to-peer connection setup)
 * - Chat messages during video calls
 * - Tracking active connections per meeting room
 * - NEW: Verified Smart Attendance with face recognition
 */

import { Face } from "../models/face.model.js";
import { Attendance } from "../models/attendance.model.js";

import { Server } from "socket.io";

// DATA STRUCTURES TO TRACK ACTIVE CALLS
// connections: { 'meeting-code': [{socketId, userId, totalTime, verifiedTime}] }
let connections = {}; // CHANGED: now stores objects, not just socket IDs

// messages: { 'meeting-code': [{sender, data, socket-id-sender}, ...] }
let messages = {}; // Stores chat messages for each meeting room

// timeOnline: { 'socket-id': Date }
let timeOnline = {}; // Tracks when each user joined (for analytics)

// meetingOwners: { 'meeting-code': 'ownerId' }
let meetingOwners = {}; // Tracks who created each meeting

// meetingStartTimes: { 'meeting-code': Date }
let meetingStartTimes = {}; // Tracks when each meeting started

// polls: { 'meeting-code': [{ id, question, options: [{text, votes:[]}], creator, active }] }
let polls = {};
// decisions: { 'meeting-code': [{ id, text, proposedBy, timestamp }] }
let decisions = {};

export const connectToSocket = (server) => {
    // Initialize Socket.io server with CORS configuration
    const io = new Server(server, {
        cors: {
            origin: [
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                'https://meettrack-ai.onrender.com',
                'https://meettrack-ai-1.onrender.com',
                process.env.FRONTEND_URL
            ].filter(Boolean),
            methods: ["GET", "POST"],
            allowedHeaders: ["*"],
            credentials: true
        },
        transports: ['websocket', 'polling'], // Ensure both transports work
        allowEIO3: true, // Compatibility
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // EVENT: When a user connects to the server
    io.on("connection", (socket) => {
        console.log("SOMETHING CONNECTED:", socket.id);

        // EVENT: User joins a video call meeting
        socket.on("join-call", (path, userId, userName, isOwner) => {
            // Create a new room if it doesn't exist
            if (connections[path] === undefined) {
                connections[path] = [];
                meetingStartTimes[path] = new Date();
            }

            // Set meeting owner - use isOwner flag from client, fall back to first-join
            if (isOwner && !meetingOwners[path]) {
                meetingOwners[path] = userId;
                io.to(socket.id).emit('you-are-owner');
                console.log(`👑 Meeting owner set: ${userName} (${userId}) for meeting: ${path}`);
            } else if (connections[path].length === 0 && !meetingOwners[path]) {
                meetingOwners[path] = userId;
                io.to(socket.id).emit('you-are-owner');
                console.log(`👑 Meeting owner (first-join fallback): ${userName} (${userId}) for meeting: ${path}`);
            }

            // Join the socket to a room with the meeting code
            socket.join(path);

            // Add user to connections array with tracking data
            connections[path].push({
                socketId: socket.id,
                userId: userId || null,
                userName: userName || 'Anonymous',
                totalTime: 0,
                verifiedTime: 0
            });

            // Track when this user joined
            timeOnline[socket.id] = new Date();

            console.log(`✅ User ${userName} (${userId}) joined meeting: ${path}. Total users: ${connections[path].length}`);

            // Notify all existing users in the room that a new user joined
            for (let a = 0; a < connections[path].length; a++) {
                io.to(connections[path][a].socketId).emit("user-joined", socket.id, connections[path].map(u => u.socketId));
            }

            // Send all previous chat messages to the newly joined user
            if (messages[path] !== undefined) {
                for (let a = 0; a < messages[path].length; ++a) {
                    io.to(socket.id).emit("chat-message", messages[path][a]['data'],
                        messages[path][a]['sender'], messages[path][a]['socket-id-sender']);
                }
            }
        });

        // WebRTC signaling
        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        // Chat message
        socket.on("chat-message", (data, sender) => {
            const [matchingRoom, found] = Object.entries(connections)
                .reduce(([room, isFound], [roomKey, roomValue]) => {
                    if (!isFound && roomValue.some(u => u.socketId === socket.id)) {
                        return [roomKey, true];
                    }
                    return [room, isFound];
                }, ['', false]);

            if (found === true) {
                if (messages[matchingRoom] === undefined) {
                    messages[matchingRoom] = [];
                }

                messages[matchingRoom].push({ 'sender': sender, "data": data, "socket-id-sender": socket.id });
                console.log("message", matchingRoom, ":", sender, data);

                connections[matchingRoom].forEach((elem) => {
                    io.to(elem.socketId).emit("chat-message", data, sender, socket.id);
                });
            }
        });

        // ==================== NEW: ATTENDANCE EVENTS ====================

        // Register face descriptor
        socket.on("register-face", async ({ meetingId, userId, descriptor }) => {
            try {
                await new Face({ userId, meetingId, descriptor }).save();

                // Update userId in connections
                const room = connections[meetingId];
                if (room) {
                    const user = room.find(u => u.socketId === socket.id);
                    if (user) user.userId = userId;
                }

                socket.emit("face-registered");
                console.log(`Face registered for user: ${userId} in meeting: ${meetingId}`);
            } catch (err) {
                console.error("Face register error:", err);
            }
        });

        // Verified presence update every 10s
        socket.on("verified-update", ({ meetingId, userId, userName, verifiedDelta }) => {
            const room = connections[meetingId];
            if (!room) {
                console.log(`⚠️ No room found for verified-update: ${meetingId}`);
                return;
            }

            const user = room.find(u => u.userId === userId);
            if (user) {
                user.totalTime += 10;
                user.verifiedTime += verifiedDelta;
                if (userName) user.userName = userName; // Update userName if provided
                console.log(`✓ Updated ${user.userName} (${userId}): totalTime=${user.totalTime}s, verifiedTime=${user.verifiedTime}s (delta=${verifiedDelta})`);
                
                // Send live attendance update to owner
                const owner = meetingOwners[meetingId];
                if (owner) {
                    const ownerUser = room.find(u => u.userId === owner);
                    if (ownerUser) {
                        io.to(ownerUser.socketId).emit('live-attendance', {
                            participants: room.map(u => ({
                                userId: u.userId,
                                userName: u.userName || 'Anonymous',
                                totalTime: u.totalTime,
                                verifiedTime: u.verifiedTime
                            }))
                        });
                    }
                }
            } else {
                console.log(`⚠️ User ${userId} not found in room ${meetingId}`);
            }
        });

        // End meeting & generate report
        socket.on("end-meeting", async ({ meetingId }) => {
            console.log(`📊 Generating attendance report for meeting: ${meetingId}`);
            const room = connections[meetingId];
            const owner = meetingOwners[meetingId];
            const startTime = meetingStartTimes[meetingId];
            
            if (!room || room.length === 0) {
                console.log(`⚠️ No room found or empty room for: ${meetingId}`);
                return;
            }

            if (!owner) {
                console.log(`⚠️ No meeting owner found for: ${meetingId}`);
            }

            console.log(`📋 Room has ${room.length} participants:`, room.map(u => ({ userId: u.userId, totalTime: u.totalTime, verifiedTime: u.verifiedTime })));

            const report = { 
                meetingId,
                meetingOwner: owner || 'unknown',
                startTime: startTime || new Date(),
                endTime: new Date(),
                participants: [],
                decisions: decisions[meetingId] || []
            };

            // Clean up polls and decisions after generating report
            delete polls[meetingId];
            delete decisions[meetingId];

            room.forEach(user => {
                const percent = user.totalTime > 0 ? Math.round((user.verifiedTime / user.totalTime) * 100) : 0;
                
                // Calculate status based on requirements:
                // Present: >= 75%
                // Partial: >= 50% and < 75%
                // Absent: < 50%
                let status;
                if (percent >= 75) {
                    status = 'Present';
                } else if (percent >= 50) {
                    status = 'Partial';
                } else {
                    status = 'Absent';
                }

                report.participants.push({
                    userId: user.userId || 'Unknown',
                    name: user.userName || user.userId || 'Unknown',
                    totalTime: user.totalTime,
                    verifiedTime: user.verifiedTime,
                    verifiedPercent: percent,
                    status
                });
            });

            try {
                await new Attendance(report).save();
                console.log("✅ Attendance report saved to database:", report);
                
                // Emit to all sockets in the meeting room
                io.to(meetingId).emit("attendance-report", report);
                console.log(`📤 Attendance report emitted to room: ${meetingId}`);

                // Send special notification to meeting owner
                if (owner) {
                    const ownerUser = room.find(u => u.userId === owner);
                    if (ownerUser) {
                        io.to(ownerUser.socketId).emit("owner-attendance-report", {
                            ...report,
                            message: "As the meeting owner, here is the final attendance report"
                        });
                        console.log(`👑 Special owner report sent to: ${owner}`);
                    }
                }

                // Optional: Clean up face data
                await Face.deleteMany({ meetingId });
                console.log(`🗑️ Face data cleaned up for meeting: ${meetingId}`);

                // Clean up meeting tracking data
                delete meetingOwners[meetingId];
                delete meetingStartTimes[meetingId];
            } catch (err) {
                console.error("❌ Error saving attendance:", err);
            }
        });

        // ==================== POLL EVENTS ====================

        // Create a new poll
        socket.on("create-poll", ({ meetingId, question, options }) => {
            if (!polls[meetingId]) polls[meetingId] = [];
            const poll = {
                id: Date.now().toString(),
                question,
                options: options.map(text => ({ text, votes: [] })),
                creator: socket.id,
                active: true
            };
            polls[meetingId].push(poll);
            io.to(meetingId).emit("poll-created", poll);
            console.log(`📊 Poll created in ${meetingId}: "${question}"`);
        });

        // Vote on a poll
        socket.on("vote-poll", ({ meetingId, pollId, optionIndex }) => {
            const meetingPolls = polls[meetingId];
            if (!meetingPolls) return;
            const poll = meetingPolls.find(p => p.id === pollId);
            if (!poll) return;

            // Remove previous vote from this user in any option
            poll.options.forEach(opt => {
                opt.votes = opt.votes.filter(v => v !== socket.id);
            });

            // Add new vote
            poll.options[optionIndex].votes.push(socket.id);

            io.to(meetingId).emit("poll-updated", poll);
            console.log(`🗳️ Vote cast in ${meetingId} on poll "${poll.question}"`);
        });

        // Add a decision
        socket.on("add-decision", ({ meetingId, text, proposedBy }) => {
            if (!decisions[meetingId]) decisions[meetingId] = [];
            const decision = {
                id: Date.now().toString(),
                text,
                proposedBy,
                timestamp: new Date().toISOString()
            };
            decisions[meetingId].push(decision);
            io.to(meetingId).emit("decision-added", decision);
            console.log(`📝 Decision recorded in ${meetingId}: "${text}" by ${proposedBy}`);
        });

        // ==================== END NEW EVENTS ====================

        // User disconnects
        socket.on("disconnect", () => {
            var diffTime = Math.abs(timeOnline[socket.id] - new Date());

            for (const [k, v] of Object.entries(connections)) {
                const index = v.findIndex(u => u.socketId === socket.id);
                if (index !== -1) {
                    // Notify others
                    v.forEach(u => {
                        if (u.socketId !== socket.id) {
                            io.to(u.socketId).emit('user-left', socket.id);
                        }
                    });

                    // Remove user
                    v.splice(index, 1);

                    // Clean empty room
                    if (v.length === 0) {
                        delete connections[k];
                        delete messages[k];
                    }
                    break;
                }
            }
        });
    });

    return io;
}

