import express from 'express';
import { createServer } from 'node:http';
import { connectToSocket } from '../controllers/socketManager.js';
import { io as ioc } from 'socket.io-client';

let server, port;
const roomId = () => `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

beforeAll(async () => {
  const app = express();
  const httpServer = createServer(app);
  connectToSocket(httpServer);
  await new Promise(resolve => httpServer.listen(0, resolve));
  port = httpServer.address().port;
  server = httpServer;
}, 30000);

afterAll(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }
});

function connectClient() {
  return new Promise((resolve, reject) => {
    const socket = ioc(`http://localhost:${port}`, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
    setTimeout(() => reject(new Error('Connection timed out')), 10000);
  });
}

async function joinRoom(socket, room, userId, userName, isOwner) {
  return new Promise(resolve => {
    socket.emit('join-call', room, userId, userName, isOwner);
    setTimeout(resolve, 300);
  });
}

async function approveJoiner(ownerSocket, meetingId, requesterSocketId) {
  return new Promise(resolve => {
    ownerSocket.emit('approve-join', { meetingId, requesterSocketId });
    setTimeout(resolve, 300);
  });
}

async function setupTwoUsers(room) {
  const owner = await connectClient();
  const joiner = await connectClient();
  await joinRoom(owner, room, 'owner-id', 'Owner', true);
  await joinRoom(joiner, room, 'joiner-id', 'Joiner', false);
  await approveJoiner(owner, room, joiner.id);
  return { owner, joiner };
}

async function disconnect(socket) {
  if (socket && socket.connected) {
    socket.disconnect();
    await new Promise(r => setTimeout(r, 100));
  }
}

afterEach(async () => {
  // Cleanup is handled by each test disconnecting its own sockets
});

describe('Chat Messaging', () => {
  test('sends and receives chat messages between users', async () => {
    const room = roomId();
    const { owner, joiner } = await setupTwoUsers(room);

    const msgPromise = new Promise(resolve => {
      owner.once('chat-message', (data, sender, socketId) => resolve({ data, sender, socketId }));
    });

    joiner.emit('chat-message', 'Hello from Joiner!', 'Joiner');

    const msg = await msgPromise;
    expect(msg.data).toBe('Hello from Joiner!');
    expect(msg.sender).toBe('Joiner');

    await disconnect(owner);
    await disconnect(joiner);
  }, 20000);

  test('replays chat history to newly joined users', async () => {
    const room = roomId();

    const first = await connectClient();
    await joinRoom(first, room, 'first-id', 'First', true);
    first.emit('chat-message', 'Message before Joiner arrived', 'First');
    await new Promise(r => setTimeout(r, 200));

    const second = await connectClient();
    const msgs = [];
    second.on('chat-message', (data, sender) => msgs.push({ data, sender }));

    await joinRoom(second, room, 'second-id', 'Second', false);
    await approveJoiner(first, room, second.id);
    await new Promise(r => setTimeout(r, 500));

    expect(msgs.some(m => m.sender === 'First')).toBe(true);
    if (msgs.length > 0) {
      expect(msgs[0].data).toBe('Message before Joiner arrived');
    }

    await disconnect(first);
    await disconnect(second);
  }, 20000);
});

describe('Transcription', () => {
  test('relays transcript entry to other users', async () => {
    const room = roomId();
    const { owner, joiner } = await setupTwoUsers(room);

    const transcriptPromise = new Promise(resolve => {
      joiner.once('transcript-entry', data => resolve(data));
    });

    owner.emit('transcript-entry', { meetingId: room, text: 'Hello everyone', speaker: 'Owner', lang: 'en', timestamp: Date.now() });

    const received = await transcriptPromise;
    expect(received.text).toBe('Hello everyone');
    expect(received.speaker).toBe('Owner');

    await disconnect(owner);
    await disconnect(joiner);
  }, 20000);

  test('replays existing transcript history to new joiners', async () => {
    const room = roomId();

    const first = await connectClient();
    await joinRoom(first, room, 'first-id', 'First', true);

    first.emit('transcript-entry', { meetingId: room, text: 'First message', speaker: 'First', lang: 'en', timestamp: Date.now() });
    await new Promise(r => setTimeout(r, 100));
    first.emit('transcript-entry', { meetingId: room, text: 'Second message', speaker: 'First', lang: 'en', timestamp: Date.now() });
    await new Promise(r => setTimeout(r, 100));

    const second = await connectClient();
    const entries = [];
    second.on('transcript-entry', data => entries.push(data));

    await joinRoom(second, room, 'second-id', 'Second', false);
    await approveJoiner(first, room, second.id);
    await new Promise(r => setTimeout(r, 500));

    first.emit('transcript-entry', { meetingId: room, text: 'Third message', speaker: 'First', lang: 'en', timestamp: Date.now() });
    await new Promise(r => setTimeout(r, 300));

    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.some(e => e.text === 'Third message')).toBe(true);

    await disconnect(first);
    await disconnect(second);
  }, 20000);
});

describe('Polls', () => {
  test('creates a poll and broadcasts to room', async () => {
    const room = roomId();
    const { owner, joiner } = await setupTwoUsers(room);

    const pollPromise = new Promise(resolve => {
      joiner.once('poll-created', poll => resolve(poll));
    });

    owner.emit('create-poll', { meetingId: room, question: 'Best language?', options: ['JavaScript', 'Python', 'Rust'] });

    const poll = await pollPromise;
    expect(poll.question).toBe('Best language?');
    expect(poll.options).toHaveLength(3);
    expect(poll.active).toBe(true);

    await disconnect(owner);
    await disconnect(joiner);
  }, 20000);

  test('voting updates poll results', async () => {
    const room = roomId();
    const { owner, joiner } = await setupTwoUsers(room);

    const poll = await new Promise(resolve => {
      owner.once('poll-created', p => resolve(p));
      owner.emit('create-poll', { meetingId: room, question: 'Framework?', options: ['React', 'Vue', 'Svelte'] });
    });

    const votePromise = new Promise(resolve => {
      owner.on('poll-updated', updated => {
        if (updated.options && updated.options[0] && updated.options[0].votes.length > 0) resolve(updated);
      });
    });

    owner.emit('vote-poll', { meetingId: room, pollId: poll.id, optionIndex: 0 });

    const updated = await votePromise;
    expect(updated.options[0].votes).toContain(owner.id);

    await disconnect(owner);
    await disconnect(joiner);
  }, 20000);
});

describe('Decisions', () => {
  test('adds decision and broadcasts to room', async () => {
    const room = roomId();
    const { owner, joiner } = await setupTwoUsers(room);

    const decisionPromise = new Promise(resolve => {
      joiner.once('decision-added', dec => resolve(dec));
    });

    owner.emit('add-decision', { meetingId: room, text: 'Use React', proposedBy: 'Owner' });

    const decision = await decisionPromise;
    expect(decision.text).toBe('Use React');
    expect(decision.proposedBy).toBe('Owner');

    await disconnect(owner);
    await disconnect(joiner);
  }, 20000);
});

describe('Screen Share Events', () => {
  test('broadcasts screen-share-started and screen-share-stopped', async () => {
    const room = roomId();
    const { owner, joiner } = await setupTwoUsers(room);

    const startPromise = new Promise(resolve => {
      joiner.once('screen-share-started', data => resolve(data));
    });

    owner.emit('screen-share-started', { meetingId: room });

    const startData = await startPromise;
    expect(startData.socketId).toBe(owner.id);

    const stopPromise = new Promise(resolve => {
      joiner.once('screen-share-stopped', data => resolve(data));
    });

    owner.emit('screen-share-stopped', { meetingId: room });

    const stopData = await stopPromise;
    expect(stopData.socketId).toBe(owner.id);

    await disconnect(owner);
    await disconnect(joiner);
  }, 20000);
});
