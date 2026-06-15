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
import OpenAI from "openai";

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
// raisedHands: { 'meeting-code': [{ socketId, userId, userName }] }
let raisedHands = {};

/**
 * Extract structured summary from transcript entries.
 * Uses multi-language keyword detection to highlight decisions and action items.
 */
function extractSummary(entries) {
    if (!entries || entries.length === 0) {
        return { executiveSummary: 'Not enough transcript data to generate a summary.', keyDiscussionPoints: [], decisionsTaken: [], actionItems: [], risks: [], nextSteps: [] };
    }

    // Combine all text and split into sentences (handles multiple languages)
    const fullText = entries.map(e => e.text).join(' ');
    const sentences = fullText
        .split(/(?<=[.!?।？！。])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 10);

    if (sentences.length === 0) {
        return { executiveSummary: 'Not enough transcript data to generate a summary.', keyDiscussionPoints: [], decisionsTaken: [], actionItems: [], risks: [], nextSteps: [] };
    }

    // Multi-language decision detection patterns
    const decisionPatterns = [
        /decided|agreed|approved|confirmed|finalized|consensus|voted|we('| a)ll go with|settled on|let's do it|good to go/i,
        /निर्णय|सहमत|मंजूर|तय/i,
        /decid[ii]|acord[oó]|aprobad[o]|confirmad[o]/i,
        /d[cé]cid[ée]|convenu|approuv[ée]/i,
        /entschieden|vereinbart|zugestimmt|genehmigt/i,
        /决定|同意|批准|确认|通过/i,
        /決定|同意|承認/i,
        /decidiu|acordou|aprovado/i,
        /решили|согласовали|утвердили/i,
        /قرر|وافق|تمت\s*الموافقة/i
    ];

    // Multi-language task/action detection patterns
    const taskPatterns = [
        /action\s*item|assigned\s*to|will\s*handle|will\s*take\s*care|task\s*for|responsible\s*for|to[\s-]?do|follow\s*up|need\s*to|will\s*work\s*on|going\s*to|i('| a)m going|plan\s*to/i,
        /जिम्मेदारी|कार्य|काम/i,
        /tarea|asignad[o]|responsable/i,
        /t[âa]che|assign[ée]|responsable/i,
        /aufgabe|zugewiesen|verantwortlich/i,
        /任务|分配给|负责|需要|要做的/i,
        /タスク|担当|責任/i,
        /tarefa|atribu[ií]d[oa]|respons[áa]vel/i,
        /задача|назначено|ответственный/i,
        /مهمة|مسؤول/i
    ];

    // Score each sentence
    const wordFreq = {};
    sentences.forEach(s => {
        const words = s.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
    });

    const scored = sentences.map((s, i) => {
        let score = 0;
        // Position bonus (earlier = more important to meeting context)
        score += Math.max(0, 5 - i * 0.5);
        // Word frequency bonus (common topics)
        const words = s.toLowerCase().split(/\s+/);
        words.forEach(w => { if (wordFreq[w] > 1) score += 0.5; });
        // Decision keyword bonus
        const hasDecision = decisionPatterns.some(p => p.test(s));
        if (hasDecision) score += 3;
        // Task keyword bonus
        const hasTask = taskPatterns.some(p => p.test(s));
        if (hasTask) score += 3;

        return { text: s, score, hasDecision, hasTask };
    });

    // Deduplicate and rank
    const ranked = scored.sort((a, b) => b.score - a.score);
    const unique = [];
    const seen = new Set();
    ranked.forEach(s => {
        const key = s.text.substring(0, 40);
        if (!seen.has(key)) { seen.add(key); unique.push(s); }
    });

    const overview = unique.slice(0, 3).map(s => s.text).join(' ');
    const decisions = [...new Set(unique.filter(s => s.hasDecision).map(s => s.text))];
    const actionItems = [...new Set(unique.filter(s => s.hasTask).map(s => s.text))];

    // Extract key topics from recurring bigrams
    const bigrams = {};
    sentences.forEach(s => {
        const words = s.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        for (let i = 0; i < words.length - 1; i++) {
            const bg = `${words[i]} ${words[i + 1]}`;
            bigrams[bg] = (bigrams[bg] || 0) + 1;
        }
    });
    const keyTopics = Object.entries(bigrams)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([text]) => text.charAt(0).toUpperCase() + text.slice(1));

    return { executiveSummary: overview, keyDiscussionPoints: keyTopics, decisionsTaken: decisions, actionItems, risks: [], nextSteps: [] };
}

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

            // Send full participant list to everyone in the room
            const roomParticipants = (connections[path] || []).map(u => ({
                socketId: u.socketId,
                userId: u.userId,
                userName: u.userName,
                hasRaisedHand: (raisedHands[path] || []).some(r => r.socketId === u.socketId),
            }));
            io.to(path).emit("participant-list", roomParticipants);

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

            console.log(`📋 Room has ${room.length} participants:`, room.map(u => ({ userId: u.userId, userName: u.userName, totalTime: u.totalTime, verifiedTime: u.verifiedTime })));

            const ownerUser = room.find(u => u.userId === owner);
            const ownerName = ownerUser ? ownerUser.userName : 'unknown';

            const report = { 
                meetingId,
                meetingOwner: ownerName,
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

        // Send a reaction (emoji)
        socket.on("send-reaction", ({ meetingId, emoji, from }) => {
            io.to(meetingId).emit("reaction-received", { emoji, from, id: Date.now() });
        });

        // Hand raise / lower
        socket.on("raise-hand", ({ meetingId, userId, userName, raised }) => {
            if (!raisedHands[meetingId]) raisedHands[meetingId] = [];
            if (raised) {
                if (!raisedHands[meetingId].find(u => u.userId === userId)) {
                    raisedHands[meetingId].push({ socketId: socket.id, userId, userName });
                }
            } else {
                raisedHands[meetingId] = raisedHands[meetingId].filter(u => u.userId !== userId);
                if (raisedHands[meetingId].length === 0) delete raisedHands[meetingId];
            }
            io.to(meetingId).emit("hand-raise-update", raisedHands[meetingId] || []);
            // Update participant list with new hand raise state
            const updatedList = (connections[meetingId] || []).map(u => ({
                socketId: u.socketId,
                userId: u.userId,
                userName: u.userName,
                hasRaisedHand: (raisedHands[meetingId] || []).some(r => r.socketId === u.socketId),
            }));
            io.to(meetingId).emit("participant-list", updatedList);
            console.log(`✋ Hand ${raised ? 'raised' : 'lowered'} by ${userName} in ${meetingId}`);
        });

        // ==================== TRANSCRIPT & SUMMARY ====================

        // Relay live transcript entry to all participants
        socket.on("transcript-entry", ({ meetingId, text, speaker, lang, timestamp }) => {
            io.to(meetingId).emit("transcript-entry", { text, speaker, lang, timestamp });
            console.log(`📝 Transcript [${meetingId}] ${speaker}: ${text.substring(0, 60)}`);
        });

        // Generate AI summary from transcript entries
        socket.on("generate-summary", async ({ meetingId, transcriptEntries }) => {
            console.log(`🤖 Generating AI summary for meeting: ${meetingId}`);

            const openaiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key_here"
                ? process.env.OPENAI_API_KEY
                : null;

            if (openaiKey && transcriptEntries && transcriptEntries.length > 0) {
                try {
                    const openai = new OpenAI({ apiKey: openaiKey });
                    const transcript = transcriptEntries
                        .map(e => `[${e.speaker || 'Speaker'}]: ${e.text}`)
                        .join('\n');

                    const response = await openai.chat.completions.create({
                        model: "gpt-3.5-turbo",
                        messages: [
                            {
                                role: "system",
                                content: `You are a meeting summarizer. Given the transcript below, produce a JSON object with exactly these fields:
{
  "executiveSummary": "2-3 sentence high-level summary of the entire meeting",
  "keyDiscussionPoints": ["Bullet point of a main topic discussed", "..."],
  "decisionsTaken": ["Decision that was made during the meeting", "..."],
  "actionItems": ["Task assigned, include owner if mentioned", "..."],
  "risks": ["Risk or concern raised during discussion", "..."],
  "nextSteps": ["Follow-up action or next meeting plan", "..."]
}
If any field has no items, return an empty array for that field. Transcript:`
                            },
                            { role: "user", content: transcript }
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.3,
                        max_tokens: 2048
                    });

                    const summary = JSON.parse(response.choices[0].message.content);
                    io.to(meetingId).emit("summary-generated", summary);
                    console.log(`📋 GPT summary generated for ${meetingId}: ${summary.executiveSummary?.substring(0, 80)}...`);
                    return;
                } catch (err) {
                    console.error('GPT summary error, falling back to keyword extraction:', err.message);
                }
            }

            const summary = extractSummary(transcriptEntries);
            io.to(meetingId).emit("summary-generated", summary);
            console.log(`📋 Keyword summary generated for ${meetingId}: ${summary.executiveSummary?.substring(0, 80)}...`);
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

                    // Remove from raised hands
                    if (raisedHands[k]) {
                        raisedHands[k] = raisedHands[k].filter(u => u.socketId !== socket.id);
                        if (raisedHands[k].length === 0) delete raisedHands[k];
                        io.to(k).emit("hand-raise-update", raisedHands[k] || []);
                    }

                    // Emit updated participant list
                    if (v.length > 0) {
                        const remaining = v.map(u => ({
                            socketId: u.socketId,
                            userId: u.userId,
                            userName: u.userName,
                            hasRaisedHand: (raisedHands[k] || []).some(r => r.socketId === u.socketId),
                        }));
                        io.to(k).emit("participant-list", remaining);
                    }

                    // Clean empty room
                    if (v.length === 0) {
                        delete connections[k];
                        delete messages[k];
                        delete raisedHands[k];
                    }
                    break;
                }
            }
        });
    });

    return io;
}

