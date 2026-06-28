import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';

jest.mock('../../utils/withAuth', () => (Component) => Component);
jest.mock('@vladmandic/face-api', () => ({
  nets: {
    tinyFaceDetector: { loadFromUri: () => Promise.reject(new Error('mocked')) },
    faceLandmark68Net: { loadFromUri: () => Promise.reject(new Error('mocked')) },
    faceRecognitionNet: { loadFromUri: () => Promise.reject(new Error('mocked')) },
  },
  TinyFaceDetectorOptions: function () { this.inputSize = 320; this.scoreThreshold = 0.5; },
  euclideanDistance: () => 0.5,
}));

const mockSocket = { on: null, emit: null, off: null, connect: null, disconnect: null, id: 'mock-socket-id' };
function initMockSocket() {
  mockSocket.on = jest.fn(() => mockSocket);
  mockSocket.emit = jest.fn(() => mockSocket);
  mockSocket.off = jest.fn(() => mockSocket);
  mockSocket.connect = jest.fn(() => mockSocket);
  mockSocket.disconnect = jest.fn();
  return mockSocket;
}
initMockSocket();

jest.mock('socket.io-client', () => {
  const io = (url, opts) => mockSocket;
  io.connect = (url, opts) => mockSocket;
  return io;
});

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockTrack = { stop: jest.fn(), getSettings: () => ({}), enabled: true };
const mockStream = { getTracks: () => [mockTrack, mockTrack], getVideoTracks: () => [mockTrack], getAudioTracks: () => [mockTrack] };
const mockGetUserMedia = jest.fn().mockResolvedValue(mockStream);

function getSocketHandler(eventName) {
  const call = mockSocket.on.mock.calls.find(c => c[0] === eventName);
  return call ? call[1] : null;
}

async function triggerSocketConnect() {
  await waitFor(() => {
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });
  const connectHandler = getSocketHandler('connect');
  if (connectHandler) act(() => connectHandler());
}

function fireSocketEvent(eventName, ...args) {
  const handler = getSocketHandler(eventName);
  if (handler) act(() => handler(...args));
}

let originalFetch;

global.RTCPeerConnection = jest.fn(() => ({
  createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: '' }),
  createAnswer: jest.fn().mockResolvedValue({ type: 'answer', sdp: '' }),
  setLocalDescription: jest.fn().mockResolvedValue(),
  setRemoteDescription: jest.fn().mockResolvedValue(),
  addStream: jest.fn(),
  addTrack: jest.fn(),
  close: jest.fn(),
  onicecandidate: null,
  oniceconnectionstatechange: null,
  onconnectionstatechange: null,
  ontrack: null,
  iceConnectionState: 'new',
  connectionState: 'new',
}));
global.RTCSessionDescription = jest.fn();
global.RTCIceCandidate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockGetUserMedia.mockResolvedValue(mockStream);
  initMockSocket();

  originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ success: true, data: null }),
  });

  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia, getDisplayMedia: jest.fn().mockResolvedValue(mockStream) },
    writable: true, configurable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue() },
    writable: true, configurable: true,
  });

  HTMLVideoElement.prototype.play = jest.fn().mockResolvedValue(undefined);
  window.localStream = mockStream;

  delete window.location;
  window.location = {
    ...window.location,
    pathname: '/test-room-123', protocol: 'http:', hostname: 'localhost',
    href: 'http://localhost/test-room-123', origin: 'http://localhost',
  };

  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

import VideoMeetComponent from '../VideoMeet';

function renderVideoMeet() {
  return render(
    <MemoryRouter initialEntries={['/test-room-123']}>
      <AuthContext.Provider value={{ userId: 'test-user-123' }}>
        <VideoMeetComponent />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

async function joinMeeting() {
  const input = screen.getByPlaceholderText('Your display name');
  await userEvent.type(input, 'Test User');
  const btn = screen.getByText('Enter Meeting Room');
  await userEvent.click(btn);
  await triggerSocketConnect();
}

describe('Waiting Room / Join Requests', () => {
  test('shows waiting for host text on waiting-for-approval event', async () => {
    renderVideoMeet();
    await joinMeeting();
    fireSocketEvent('waiting-for-approval');
    await waitFor(() => {
      expect(screen.getByText('Waiting for Host')).toBeInTheDocument();
    });
  });

  test('clears waiting state on user-joined', async () => {
    renderVideoMeet();
    await joinMeeting();
    fireSocketEvent('waiting-for-approval');
    await waitFor(() => {
      expect(screen.getByText('Waiting for Host')).toBeInTheDocument();
    });
    fireSocketEvent('user-joined', 'mock-socket-id', ['mock-socket-id']);
    await waitFor(() => {
      expect(screen.queryByText('Waiting for Host')).not.toBeInTheDocument();
    });
  });

  test('owner sees join request notifications', async () => {
    renderVideoMeet();
    await joinMeeting();
    fireSocketEvent('you-are-owner');
    fireSocketEvent('join-request', { socketId: 'new-socket', userId: 'new-user', userName: 'New User' });
    await waitFor(() => {
      expect(screen.getByText(/New User/i)).toBeInTheDocument();
    });
  });
});

describe('Chat Messaging', () => {
  test('sends chat message via socket', async () => {
    renderVideoMeet();
    await joinMeeting();
    const chatTab = screen.getByText('Chat');
    await userEvent.click(chatTab);
    const input = screen.getByPlaceholderText(/type a message/i);
    await userEvent.type(input, 'Hello everyone');
    await userEvent.keyboard('{Enter}');
    expect(mockSocket.emit).toHaveBeenCalledWith('chat-message', 'Hello everyone', 'Test User');
  });

  test('receives and displays incoming chat messages', async () => {
    renderVideoMeet();
    await joinMeeting();
    const chatTab = screen.getByText('Chat');
    await userEvent.click(chatTab);
    fireSocketEvent('chat-message', 'Hi from peer!', 'PeerUser', 'peer-socket-id');
    await waitFor(() => {
      expect(screen.getByText('Hi from peer!')).toBeInTheDocument();
    });
    expect(screen.getByText('PeerUser')).toBeInTheDocument();
  });
});

describe('Polls', () => {
  test('shows poll-created event in polls tab', async () => {
    renderVideoMeet();
    await joinMeeting();
    await userEvent.click(screen.getByTitle('Polls'));
    const poll = { id: 'poll-1', question: 'Best framework?', options: [{ text: 'React', votes: [] }, { text: 'Vue', votes: [] }], active: true, creator: 'Owner' };
    fireSocketEvent('poll-created', poll);
    await waitFor(() => {
      expect(screen.getByText('Best framework?')).toBeInTheDocument();
    });
  });

  test('shows poll question after poll-updated', async () => {
    renderVideoMeet();
    await joinMeeting();
    await userEvent.click(screen.getByTitle('Polls'));
    const poll = { id: 'poll-2', question: 'Language?', options: [{ text: 'JS', votes: [] }, { text: 'Python', votes: [] }], active: true, creator: 'Owner' };
    fireSocketEvent('poll-created', poll);
    const updated = { ...poll, options: [{ text: 'JS', votes: ['mock-socket-id'] }, { text: 'Python', votes: [] }] };
    fireSocketEvent('poll-updated', updated);
    await waitFor(() => {
      expect(screen.getByText('Language?')).toBeInTheDocument();
    });
  });
});

describe('Decisions', () => {
  test('shows added decision in polls tab', async () => {
    renderVideoMeet();
    await joinMeeting();
    await userEvent.click(screen.getByTitle('Polls'));
    const decision = { id: 'dec-1', text: 'Use React for frontend', proposedBy: 'Alice', timestamp: Date.now() };
    fireSocketEvent('decision-added', decision);
    await waitFor(() => {
      expect(screen.getByText('Use React for frontend')).toBeInTheDocument();
    });
  });
});

describe('Thread Memory', () => {
  test('shows thread memory card in lobby from fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { title: 'Previous Meeting', summary: 'Discussed architecture', previousMeetingCount: 1 } }),
    });
    renderVideoMeet();
    await waitFor(() => {
      expect(screen.getByText(/Previous Meeting/)).toBeInTheDocument();
    });
  });

  test('shows previous meeting count badge', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { title: 'Previous Meeting', summary: 'Discussed architecture', previousMeetingCount: 3 } }),
    });
    renderVideoMeet();
    await waitFor(() => {
      expect(screen.getByText(/From 3 past meetings/i)).toBeInTheDocument();
    });
  });
});

describe('Hand Raise Interaction', () => {
  test('emits raise-hand event on toggle', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => expect(screen.getByTitle('Raise Hand')).toBeInTheDocument());
    await userEvent.click(screen.getByTitle('Raise Hand'));
    expect(mockSocket.emit).toHaveBeenCalledWith('raise-hand', expect.objectContaining({ raised: true }));
    await userEvent.click(screen.getByTitle('Lower Hand'));
    expect(mockSocket.emit).toHaveBeenCalledWith('raise-hand', expect.objectContaining({ raised: false }));
  });
});

describe('Reactions Interaction', () => {
  test('shows reaction overlay when reaction-received fires', async () => {
    renderVideoMeet();
    await joinMeeting();
    const reaction = { id: 'r1', emoji: '👍', from: 'Peer', socketId: 'peer-socket' };
    fireSocketEvent('reaction-received', reaction);
    await waitFor(() => {
      expect(screen.getByText('👍')).toBeInTheDocument();
    });
  });
});
