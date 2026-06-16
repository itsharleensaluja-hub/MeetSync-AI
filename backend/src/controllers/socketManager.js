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
import ActionItem from "../models/actionItem.model.js";

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

// waitingRoom: { 'meeting-code': [{ socketId, userId, userName }] }
// Users waiting for host approval before entering the meeting
let waitingRoom = {};

/**
 * Extract structured summary from transcript entries.
 * Uses multi-language keyword detection to highlight decisions and action items.
 */
function extractSummary(entries) {
    if (!entries || entries.length === 0) {
        return { executiveSummary: 'Not enough transcript data to generate a summary.', keyDiscussionPoints: [], decisionsTaken: [], actionItems: [], risks: [], nextSteps: [] };
    }

    const seen = new Set();
    const unique = [];
    entries.forEach(e => {
        const key = (e.text || '').toLowerCase().slice(0, 60);
        if (!seen.has(key)) { seen.add(key); unique.push({ speaker: e.speaker || 'Speaker', text: e.text, ts: e.timestamp || 0 }); }
    });

    if (unique.length === 0) {
        return { executiveSummary: 'All transcript entries were duplicates. No unique content to summarize.', keyDiscussionPoints: [], decisionsTaken: [], actionItems: [], risks: [], nextSteps: [] };
    }

    const allSentences = [];
    unique.forEach(e => {
        (e.text.match(/[^.!?]+[.!?]+/g) || [e.text]).forEach(s => {
            const t = s.trim();
            if (t.length > 15) allSentences.push({ text: t, speaker: e.speaker });
        });
    });

    if (allSentences.length === 0) {
        return { executiveSummary: 'No meaningful sentences found in transcript.', keyDiscussionPoints: [], decisionsTaken: [], actionItems: [], risks: [], nextSteps: [] };
    }

    const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','must','to','of','in','for','on','with','at','by','from','as','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','here','there','when','where','why','how','all','each','every','both','few','more','most','other','some','such','no','nor','not','only','own','same','so','than','too','very','just','because','but','and','or','if','while','that','this','these','those','it','its','i','me','my','we','our','you','your','he','him','his','she','her','they','them','their','what','which','who','whom','about','also','well','like','really','actually','basically','okay','yeah','yes','no','oh','uh','um','ah','sort','kind','bit','lot','thing','stuff','maybe','probably','anyway','right','alright','ok','hello','hi','hey','thanks','thank','welcome','please','sure','great','good','nice','quite','pretty']);

    const wordInDocs = {};
    allSentences.forEach(s => {
        const words = new Set(s.text.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w)));
        words.forEach(w => { wordInDocs[w] = (wordInDocs[w] || 0) + 1; });
    });

    const totalSent = allSentences.length;
    const decisionRe = /\b(decided|agreed|approved|confirmed|finalized|consensus|voted|settled|concluded|resolved|committed|selected|chosen|aligned|on the same page|we('ll| are) going with|let'?s go with|we landed on)\b/i;
    const taskRe = /\b(will|going to|plan to|need to|has to|must|should|responsible for|assigned to|tasked with|owner|action item|follow up|to-do|todo|take care of|handle|work on|look into|investigate|prepare|create|set up|schedule|send|share|draft|write|update|fix|implement|build|develop|test|deploy|release|submit|review|approve|reach out|coordinate|organize|lead)\b/i;
    const riskRe = /\b(risk|concern|issue|problem|blocker|challenge|difficulty|worry|caution|caveat|downside|drawback|limitation|constraint|bottleneck|delay|uncertainty|dependenc|open question|open item)\b/i;
    const contextRe = /\b(discuss|topic|agenda|purpose|goal|objective|present|propose|suggest|recommend|update|progress|status|report)\b/i;
    const closingRe = /\b(conclude|summary|wrap up|key takeaway|next step|moving forward|going forward|upcoming|follow-up)\b/i;
    const questionRe = /\?/;

    const scored = allSentences.map((s, i) => {
        let score = 0;
        const words = s.text.split(/\s+/);
        const contentWords = words.filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()));
        if (i < 3) score += 2;
        if (i >= totalSent - 2) score += 1.5;
        contentWords.forEach(w => { const freq = wordInDocs[w.toLowerCase()] || 0; if (freq >= 2) score += 0.3; });
        if (words.length >= 10 && words.length <= 35) score += 1.5;
        else if (words.length > 5 && words.length < 50) score += 0.5;
        if (contextRe.test(s.text)) score += 2;
        if (closingRe.test(s.text)) score += 2;
        const hasDecision = decisionRe.test(s.text);
        if (hasDecision) score += 5;
        const hasTask = taskRe.test(s.text) && !questionRe.test(s.text);
        if (hasTask) score += 3;
        if (questionRe.test(s.text)) score -= 2;
        const hasRisk = riskRe.test(s.text);
        return { text: s.text, speaker: s.speaker, score, hasDecision, hasTask, hasRisk };
    });

    const clusters = [];
    const assigned = new Set();
    const sorted = [...scored].sort((a, b) => b.score - a.score);
    sorted.forEach(s => {
        if (assigned.has(s.text)) return;
        const sWords = new Set(s.text.toLowerCase().split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w)));
        if (sWords.size === 0) { assigned.add(s.text); return; }
        const cluster = { sentences: [s], words: sWords };
        assigned.add(s.text);
        sorted.forEach(s2 => {
            if (assigned.has(s2.text)) return;
            const s2Words = new Set(s2.text.toLowerCase().split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w)));
            const overlap = [...sWords].filter(w => s2Words.has(w)).length;
            const union = new Set([...sWords, ...s2Words]).size;
            if (union > 0 && overlap / union > 0.12) {
                cluster.sentences.push(s2);
                assigned.add(s2.text);
                s2Words.forEach(w => sWords.add(w));
            }
        });
        clusters.push(cluster);
    });
    scored.forEach(s => {
        if (!assigned.has(s.text)) {
            const sWords = new Set(s.text.toLowerCase().split(/\s+/).filter(w => w.length > 4 && !stopWords.has(w)));
            if (sWords.size > 0) { clusters.push({ sentences: [s], words: sWords }); assigned.add(s.text); }
        }
    });

    clusters.sort((a, b) => {
        const aAvg = a.sentences.reduce((sum, s) => sum + s.score, 0) / a.sentences.length;
        const bAvg = b.sentences.reduce((sum, s) => sum + s.score, 0) / b.sentences.length;
        return bAvg - aAvg;
    });

    const topClusterWords = clusters.slice(0, 3).map(c => {
        const freqWords = [...c.words].filter(w => (wordInDocs[w] || 0) >= 2).sort((a, b) => (wordInDocs[b] || 0) - (wordInDocs[a] || 0)).slice(0, 3);
        return freqWords.length > 0 ? freqWords.join(', ') : null;
    }).filter(Boolean);

    const decisionCount = scored.filter(s => s.hasDecision).length;
    const taskCount = scored.filter(s => s.hasTask).length;
    const speakerNames = [...new Set(unique.map(e => e.speaker))].filter(Boolean);

    let executiveSummary = '';
    if (topClusterWords.length > 0) {
        executiveSummary = 'The meeting covered ' + topClusterWords.join(', ') + '. ';
    } else {
        const topSentences = scored.sort((a, b) => b.score - a.score).slice(0, 2);
        executiveSummary = topSentences.map(s => s.text).join(' ') + ' ';
    }
    if (decisionCount > 0) executiveSummary += decisionCount + ' decision' + (decisionCount > 1 ? 's were' : ' was') + ' reached. ';
    if (taskCount > 0) executiveSummary += taskCount + ' action item' + (taskCount > 1 ? 's were' : ' was') + ' identified. ';
    if (speakerNames.length > 1) executiveSummary += speakerNames.length + ' participant' + (speakerNames.length > 1 ? 's' : '') + ' contributed (' + speakerNames.join(', ') + ').';

    const keyDiscussionPoints = clusters.slice(0, 5).map(c => c.sentences.sort((a, b) => b.score - a.score)[0].text).filter(Boolean);
    const decisionsTaken = [...new Set(scored.filter(s => s.hasDecision).sort((a, b) => b.score - a.score).map(s => s.text))].slice(0, 8);
    const actionItems = [...new Set(scored.filter(s => s.hasTask).sort((a, b) => b.score - a.score).map(s => s.text))].slice(0, 8);
    const risks = [...new Set(scored.filter(s => s.hasRisk).sort((a, b) => b.score - a.score).map(s => s.text))].slice(0, 5);

    const lastThird = scored.slice(-Math.max(5, Math.ceil(scored.length / 3)));
    const nextStepSet = new Set();
    lastThird.filter(s => s.hasTask || closingRe.test(s.text)).forEach(s => nextStepSet.add(s.text));
    scored.filter(s => s.hasTask).forEach(s => nextStepSet.add(s.text));
    const nextSteps = [...nextStepSet].slice(0, 5);

    return {
        executiveSummary: executiveSummary.trim() || 'Meeting transcript processed.',
        keyDiscussionPoints,
        decisionsTaken,
        actionItems,
        risks,
        nextSteps
    };
}
async function saveActionItems(meetingId, summary) {
    if (summary.actionItems && summary.actionItems.length > 0) {
        try {
            const docs = summary.actionItems
                .filter(t => t && t.trim())
                .map(task => ({
                    meetingId,
                    task: task.trim(),
                    status: 'pending'
                }));
            if (docs.length > 0) {
                await ActionItem.insertMany(docs);
                console.log(`âœ… Saved ${docs.length} action items for meeting ${meetingId}`);
            }
        } catch (err) {
            console.error('Failed to save action items:', err.message);
        }
    }
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

            // WAITING ROOM: if room already has an owner and participants,
            // put this user in the waiting room instead of admitting them directly
            if (meetingOwners[path] && connections[path].length > 0) {
                if (!waitingRoom[path]) waitingRoom[path] = [];
                waitingRoom[path].push({ socketId: socket.id, userId, userName });
                console.log(`â³ User ${userName} (${userId}) added to waiting room for meeting: ${path}`);

                // Notify the meeting owner
                const ownerUserId = meetingOwners[path];
                const ownerUser = connections[path].find(u => u.userId === ownerUserId);
                if (ownerUser) {
                    io.to(ownerUser.socketId).emit('join-request', { socketId: socket.id, userId, userName });
                    console.log(`ðŸ”” Join request sent to owner for: ${userName}`);
                }

                // Tell the user they're waiting for approval
                io.to(socket.id).emit('waiting-for-approval');
                return;
            }

            // Set meeting owner - use isOwner flag from client, fall back to first-join
            if (isOwner && !meetingOwners[path]) {
                meetingOwners[path] = userId;
                io.to(socket.id).emit('you-are-owner');
                console.log(`ðŸ‘‘ Meeting owner set: ${userName} (${userId}) for meeting: ${path}`);
            } else if (connections[path].length === 0 && !meetingOwners[path]) {
                meetingOwners[path] = userId;
                io.to(socket.id).emit('you-are-owner');
                console.log(`ðŸ‘‘ Meeting owner (first-join fallback): ${userName} (${userId}) for meeting: ${path}`);
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

            console.log(`âœ… User ${userName} (${userId}) joined meeting: ${path}. Total users: ${connections[path].length}`);

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

        // EVENT: Owner approves a waiting user
        socket.on("approve-join", ({ meetingId, requesterSocketId }) => {
            const waiters = waitingRoom[meetingId];
            if (!waiters) return;
            const idx = waiters.findIndex(w => w.socketId === requesterSocketId);
            if (idx === -1) return;
            const [waiter] = waiters.splice(idx, 1);

            // Join the approved socket to the room
            const requesterSocket = io.sockets.sockets.get(requesterSocketId);
            if (!requesterSocket) {
                console.warn(`âš ï¸ Cannot approve ${waiter.userName} â€” socket ${requesterSocketId} is stale/disconnected`);
                return;
            }
            requesterSocket.join(meetingId);

            // Add to connections (same logic as join-call)
            connections[meetingId].push({
                socketId: waiter.socketId,
                userId: waiter.userId,
                userName: waiter.userName,
                totalTime: 0,
                verifiedTime: 0
            });

            timeOnline[waiter.socketId] = new Date();

            // Notify everyone including the approved user
            const allSocketIds = connections[meetingId].map(u => u.socketId);
            for (let a = 0; a < connections[meetingId].length; a++) {
                io.to(connections[meetingId][a].socketId).emit("user-joined", waiter.socketId, allSocketIds);
            }

            // Update participant list
            const roomParticipants = connections[meetingId].map(u => ({
                socketId: u.socketId, userId: u.userId, userName: u.userName,
                hasRaisedHand: (raisedHands[meetingId] || []).some(r => r.socketId === u.socketId),
            }));
            io.to(meetingId).emit("participant-list", roomParticipants);

            // Send chat history to the approved user
            if (messages[meetingId] !== undefined) {
                for (let a = 0; a < messages[meetingId].length; ++a) {
                    io.to(waiter.socketId).emit("chat-message", messages[meetingId][a]['data'],
                        messages[meetingId][a]['sender'], messages[meetingId][a]['socket-id-sender']);
                }
            }

            console.log(`âœ… ${waiter.userName} approved and joined meeting: ${meetingId}`);
        });

        // EVENT: Owner rejects a waiting user
        socket.on("reject-join", ({ meetingId, requesterSocketId }) => {
            const waiters = waitingRoom[meetingId];
            if (!waiters) return;
            const idx = waiters.findIndex(w => w.socketId === requesterSocketId);
            if (idx === -1) return;
            waiters.splice(idx, 1);
            io.to(requesterSocketId).emit('join-rejected', { message: 'Host declined your request to join.' });
            console.log(`âŒ Join request rejected for socket: ${requesterSocketId}`);
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
                console.log(`âš ï¸ No room found for verified-update: ${meetingId}`);
                return;
            }

            const user = room.find(u => u.userId === userId);
            if (user) {
                user.totalTime += 10;
                user.verifiedTime += verifiedDelta;
                if (userName) user.userName = userName; // Update userName if provided
                console.log(`âœ“ Updated ${user.userName} (${userId}): totalTime=${user.totalTime}s, verifiedTime=${user.verifiedTime}s (delta=${verifiedDelta})`);
                
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
                console.log(`âš ï¸ User ${userId} not found in room ${meetingId}`);
            }
        });

        // End meeting & generate report
        socket.on("end-meeting", async ({ meetingId }) => {
            console.log(`ðŸ“Š Generating attendance report for meeting: ${meetingId}`);
            const room = connections[meetingId];
            const owner = meetingOwners[meetingId];
            const startTime = meetingStartTimes[meetingId];
            
            if (!room || room.length === 0) {
                console.log(`âš ï¸ No room found or empty room for: ${meetingId}`);
                return;
            }

            if (!owner) {
                console.log(`âš ï¸ No meeting owner found for: ${meetingId}`);
            }

            console.log(`ðŸ“‹ Room has ${room.length} participants:`, room.map(u => ({ userId: u.userId, userName: u.userName, totalTime: u.totalTime, verifiedTime: u.verifiedTime })));

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
                console.log("âœ… Attendance report saved to database:", report);
                
                // Emit to all sockets in the meeting room
                io.to(meetingId).emit("attendance-report", report);
                console.log(`ðŸ“¤ Attendance report emitted to room: ${meetingId}`);

                // Send special notification to meeting owner
                if (owner) {
                    const ownerUser = room.find(u => u.userId === owner);
                    if (ownerUser) {
                        io.to(ownerUser.socketId).emit("owner-attendance-report", {
                            ...report,
                            message: "As the meeting owner, here is the final attendance report"
                        });
                        console.log(`ðŸ‘‘ Special owner report sent to: ${owner}`);
                    }
                }

                // Optional: Clean up face data
                await Face.deleteMany({ meetingId });
                console.log(`ðŸ—‘ï¸ Face data cleaned up for meeting: ${meetingId}`);

                // Clean up meeting tracking data
                delete meetingOwners[meetingId];
                delete meetingStartTimes[meetingId];
                delete waitingRoom[meetingId];
            } catch (err) {
                console.error("âŒ Error saving attendance:", err);
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
            console.log(`ðŸ“Š Poll created in ${meetingId}: "${question}"`);
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
            console.log(`ðŸ—³ï¸ Vote cast in ${meetingId} on poll "${poll.question}"`);
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
            console.log(`ðŸ“ Decision recorded in ${meetingId}: "${text}" by ${proposedBy}`);
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
            console.log(`âœ‹ Hand ${raised ? 'raised' : 'lowered'} by ${userName} in ${meetingId}`);
        });

        // ==================== TRANSCRIPT & SUMMARY ====================

        // Relay live transcript entry to all participants
        socket.on("transcript-entry", ({ meetingId, text, speaker, lang, timestamp }) => {
            socket.to(meetingId).emit("transcript-entry", { text, speaker, lang, timestamp });
            console.log(`ðŸ“ Transcript [${meetingId}] ${speaker}: ${text.substring(0, 60)}`);
        });

        // Generate AI summary from transcript entries
        socket.on("generate-summary", async ({ meetingId, transcriptEntries }) => {
            console.log(`ðŸ¤– Generating AI summary for meeting: ${meetingId}`);

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
                                content: `You are a professional meeting summarizer. Given the transcript below, produce a JSON object with exactly these fields:
{
  "executiveSummary": "A concise 2-3 sentence professional summary capturing the meeting purpose, key outcomes, and any decisions made.",
  "keyDiscussionPoints": ["Specific topic discussed", "Use complete sentences", "Capture actual discussion content"],
  "decisionsTaken": ["Clear decision that was made", "Include who decided if mentioned"],
  "actionItems": ["Specific task with responsible person if mentioned", "e.g. 'John will prepare the Q3 report'"],
  "risks": ["Risk or concern raised", "Leave empty array if none"],
  "nextSteps": ["Follow-up action or next meeting plan", "Include timeline if mentioned"]
}
Requirements:
- Use professional, clear language
- Each bullet point should be a complete sentence
- Be specific — use names, numbers, and details from the transcript
- If a field has no items, return an empty array
- Never invent or fabricate information not present in the transcript. Transcript:`
                            },
                            { role: "user", content: transcript }
                        ],
                        response_format: { type: "json_object" },
                        temperature: 0.2,
                        max_tokens: 2048
                    });

                    const summary = JSON.parse(response.choices[0].message.content);
                    io.to(meetingId).emit("summary-generated", summary);
                    console.log(`ðŸ“‹ GPT summary generated for ${meetingId}: ${summary.executiveSummary?.substring(0, 80)}...`);
                    await saveActionItems(meetingId, summary);
                    return;
                } catch (err) {
                    console.error('GPT summary error, falling back to keyword extraction:', err.message);
                }
            }

            const summary = extractSummary(transcriptEntries);
            io.to(meetingId).emit("summary-generated", summary);
            console.log(`ðŸ“‹ Keyword summary generated for ${meetingId}: ${summary.executiveSummary?.substring(0, 80)}...`);
            await saveActionItems(meetingId, summary);
        });

        // Fetch action items for a meeting
        socket.on("get-action-items", async ({ meetingId }) => {
            try {
                const items = await ActionItem.find({ meetingId }).sort({ createdAt: -1 });
                socket.emit("action-items-list", items);
            } catch (err) {
                console.error('Failed to fetch action items:', err.message);
                socket.emit("action-items-list", []);
            }
        });

        // Toggle action item completion status
        socket.on("toggle-action-item", async ({ id, meetingId }) => {
            try {
                const item = await ActionItem.findById(id);
                if (!item) return;
                item.status = item.status === 'pending' ? 'completed' : 'pending';
                await item.save();
                io.to(meetingId).emit("action-item-updated", item);
            } catch (err) {
                console.error('Failed to toggle action item:', err.message);
            }
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
                        delete waitingRoom[k];
                    }
                    break;
                }
            }

            // Also remove from waiting room if they disconnected while waiting
            for (const [k, w] of Object.entries(waitingRoom)) {
                const wIdx = w.findIndex(u => u.socketId === socket.id);
                if (wIdx !== -1) {
                    w.splice(wIdx, 1);
                    if (w.length === 0) delete waitingRoom[k];
                    break;
                }
            }
        });
    });

    return io;
}

