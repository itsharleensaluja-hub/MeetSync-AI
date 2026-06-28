import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';

// --- Mocks ---

jest.mock('../../utils/withAuth', () => (Component) => Component);

// Use plain arrow functions (NOT jest.fn()) so clearAllMocks cannot reset implementation
jest.mock('@vladmandic/face-api', () => ({
  nets: {
    tinyFaceDetector: { loadFromUri: () => Promise.reject(new Error('mocked')) },
    faceLandmark68Net: { loadFromUri: () => Promise.reject(new Error('mocked')) },
    faceRecognitionNet: { loadFromUri: () => Promise.reject(new Error('mocked')) },
  },
  TinyFaceDetectorOptions: function () { this.inputSize = 320; this.scoreThreshold = 0.5; },
  euclideanDistance: () => 0.5,
}));

// The component calls io.connect(), not io()
// Use a mutable holder so beforeEach can re-create mock methods after clearAllMocks
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

const mockPipelineFn = jest.fn();
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockResolvedValue(mockPipelineFn),
}));

let recognition;
let recognitionCtor;

function buildRecognition() {
  return {
    continuous: false, interimResults: false, lang: '',
    start: jest.fn(), stop: jest.fn(), abort: jest.fn(),
    addEventListener: jest.fn(), removeEventListener: jest.fn(), dispatchEvent: jest.fn(),
    onaudiostart: null, onresult: null, onerror: null, onend: null,
    onspeechstart: null, onsoundstart: null, onnomatch: null,
  };
}

async function triggerSocketConnect() {
  await waitFor(() => {
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
  });
  const connectHandler = mockSocket.on.mock.calls.find(c => c[0] === 'connect')?.[1];
  if (connectHandler) act(() => connectHandler());
}

beforeEach(() => {
  jest.clearAllMocks();

  // Re-assert mock implementations (clearAllMocks may reset these on some Jest versions)
  mockGetUserMedia.mockResolvedValue(mockStream);
  mockPipelineFn.mockResolvedValue({ text: 'hello world' });

  // Re-init socket mock methods after clearAllMocks
  initMockSocket();

  recognition = buildRecognition();
  recognitionCtor = jest.fn(() => recognition);
  window.SpeechRecognition = recognitionCtor;
  window.webkitSpeechRecognition = recognitionCtor;

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
  window.MediaRecorder = jest.fn(() => ({
    start: jest.fn(), stop: jest.fn(), requestData: jest.fn(),
    state: 'recording', mimeType: 'audio/webm', ondataavailable: null, onerror: null,
  }));

  window.AudioContext = jest.fn(() => ({
    decodeAudioData: jest.fn().mockResolvedValue({ getChannelData: () => new Float32Array(16000) }),
    close: jest.fn(),
  }));
  window.webkitAudioContext = undefined;

  delete window.location;
  window.location = {
    ...window.location,
    pathname: '/test-room-123', protocol: 'http:', hostname: 'localhost',
    href: 'http://localhost/test-room-123', origin: 'http://localhost',
  };

  sessionStorage.clear();
  localStorage.clear();
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
  await userEvent.type(screen.getByPlaceholderText('Your display name'), 'Test User');
  await userEvent.click(screen.getByText('Enter Meeting Room'));
}

async function enableCaptions() {
  await joinMeeting();
  await waitFor(() => expect(screen.getByTitle('Show Subtitles')).toBeInTheDocument());
  await userEvent.click(screen.getByTitle('Show Subtitles'));
}

function fireRecognitionResult(isFinal, transcript, confidence = 0.9) {
  const event = { resultIndex: 0, results: [[{ transcript, confidence }]] };
  event.results[0].isFinal = isFinal;
  if (recognition.onresult) recognition.onresult(event);
}

function fireRecognitionError(error) {
  if (recognition.onerror) recognition.onerror({ error });
}

function fireRecognitionEnd() {
  if (recognition.onend) recognition.onend();
}

// ====================================================================
// TESTS
// ====================================================================

// --- A. Toggle Captions ---
describe('toggleCaptions()', () => {
  test('toggles showCaptions on and starts transcription', async () => {
    renderVideoMeet();
    await enableCaptions();
    expect(recognitionCtor).toHaveBeenCalled();
    expect(recognition.start).toHaveBeenCalled();
  });

  test('second click hides captions and stops transcription', async () => {
    renderVideoMeet();
    await enableCaptions();
    await userEvent.click(screen.getByTitle('Hide Subtitles'));
    expect(screen.getByTitle('Show Subtitles')).toBeInTheDocument();
    expect(recognition.stop).toHaveBeenCalled();
  });
});

// --- B. Web Speech --- onresult ---
describe('startWebSpeech() - onresult', () => {
  test('final result with high confidence adds transcript entry', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionResult(true, 'Hello world', 0.95);
    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'transcript-entry',
      expect.objectContaining({ text: 'Hello world', meetingId: 'test-room-123' })
    );
  });

  test('final result with confidence=0 still accepted', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionResult(true, 'Zero confidence', 0);
    await waitFor(() => {
      expect(screen.getByText('Zero confidence')).toBeInTheDocument();
    });
  });

  test('final result with low confidence (<0.2) is skipped', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionResult(true, 'low conf', 0.15);
    await new Promise(r => setTimeout(r, 100));
    expect(screen.queryByText('low conf')).not.toBeInTheDocument();
  });

  test('interim result sets interim text (debounced)', async () => {
    jest.useFakeTimers();
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionResult(false, 'interim text');
    await act(() => { jest.advanceTimersByTime(400); });
    await waitFor(() => {
      expect(screen.queryByText('interim text')).toBeInTheDocument();
    });
    jest.useRealTimers();
  });
});

// --- C. Web Speech --- onerror ---
describe('startWebSpeech() - onerror', () => {
  test('no-speech error is ignored', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionError('no-speech');
    await waitFor(() => {
      expect(screen.queryByText(/Subtitles on/)).not.toBeInTheDocument();
    });
  });

  test('aborted error is ignored', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionError('aborted');
    await new Promise(r => setTimeout(r, 100));
    expect(screen.queryByText(/Speech recognition error/)).not.toBeInTheDocument();
  });

  test('1-2 network errors increments counter but does not fallback', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionError('network');
    fireRecognitionError('network');
    expect(recognitionCtor).toHaveBeenCalledTimes(1);
  });

  test('3 network errors triggers fallback to Transformers.js', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionError('network');
    fireRecognitionError('network');
    fireRecognitionError('network');
    expect(recognition.stop).toHaveBeenCalled();
    await waitFor(() => {
      expect(window.MediaRecorder).toHaveBeenCalled();
    });
  });

  test('other error sets transcriptError and stops recording', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionError('not-allowed');
    await waitFor(() => {
      expect(screen.getByText('Subtitles unavailable')).toBeInTheDocument();
    });
  });
});

// --- D. Web Speech --- onend / auto-restart ---
describe('startWebSpeech() - onend / auto-restart', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  test('onend auto-restarts when isRecording is true', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionEnd();
    act(() => { jest.advanceTimersByTime(200); });
    expect(recognition.start).toHaveBeenCalledTimes(2);
  });

  test('onend does NOT restart when recognition instance is stale', async () => {
    renderVideoMeet();
    await enableCaptions();
    await userEvent.click(screen.getByTitle('Hide Subtitles'));
    const oldCalls = recognition.start.mock.calls.length;
    fireRecognitionEnd();
    expect(recognition.start).toHaveBeenCalledTimes(oldCalls);
  });
});

// --- E. Manual Entry ---
describe('addManualEntry()', () => {
  test('adds manual entry to transcript and emits via socket', async () => {
    renderVideoMeet();
    await joinMeeting();
    await userEvent.click(screen.getByText('Transcript'));
    const input = screen.getByPlaceholderText('Type transcript entry manually...');
    await userEvent.type(input, 'Manual note');
    await userEvent.click(screen.getByText('Add'));
    await waitFor(() => {
      expect(screen.getByText('Manual note')).toBeInTheDocument();
    });
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'transcript-entry',
      expect.objectContaining({ text: 'Manual note', lang: 'manual' })
    );
  });

  test('empty text does nothing', async () => {
    renderVideoMeet();
    await joinMeeting();
    await userEvent.click(screen.getByText('Transcript'));
    await userEvent.click(screen.getByText('Add'));
    expect(screen.getByText(/No transcript yet/)).toBeInTheDocument();
  });

  test('Enter key also submits', async () => {
    renderVideoMeet();
    await joinMeeting();
    await userEvent.click(screen.getByText('Transcript'));
    const input = screen.getByPlaceholderText('Type transcript entry manually...');
    await userEvent.type(input, 'Enter entry{enter}');
    await waitFor(() => {
      expect(screen.getByText('Enter entry')).toBeInTheDocument();
    });
  });
});

// --- F. AI Summary ---
describe('requestSummary()', () => {
  test('generate button is disabled when transcript is empty', async () => {
    renderVideoMeet();
    await joinMeeting();
    await userEvent.click(screen.getByText('Transcript'));
    const btn = screen.getByText('Generate AI Summary');
    expect(btn).toBeDisabled();
  });

  test('generate button emits event when transcript exists', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionResult(true, 'Test meeting content', 0.95);
    await userEvent.click(screen.getByText('Transcript'));
    await waitFor(async () => {
      const btn = screen.getByText('Generate AI Summary');
      expect(btn).not.toBeDisabled();
      await userEvent.click(btn);
    });
    expect(mockSocket.emit).toHaveBeenCalledWith(
      'generate-summary',
      expect.objectContaining({ meetingId: 'test-room-123' })
    );
  });
});

// --- G. Captions Overlay UI ---
describe('Captions Overlay UI', () => {
  test('shows last transcript entry text in overlay', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionResult(true, 'Showing in overlay', 0.9);
    await waitFor(() => {
      expect(screen.getByText('Showing in overlay')).toBeInTheDocument();
    });
  });

  test('shows "Listening..." when recording without transcript', async () => {
    renderVideoMeet();
    await enableCaptions();
    await waitFor(() => {
      expect(screen.getByText('Listening...')).toBeInTheDocument();
    });
  });

  test('shows "Subtitles unavailable" when error state', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionError('not-allowed');
    await waitFor(() => {
      expect(screen.getByText('Subtitles unavailable')).toBeInTheDocument();
    });
  });
});

// --- H. Transcript Tab UI ---
describe('Transcript Tab UI', () => {
  test('shows empty state when no transcript', async () => {
    renderVideoMeet();
    await joinMeeting();
    await userEvent.click(screen.getByText('Transcript'));
    expect(screen.getByText(/No transcript yet/)).toBeInTheDocument();
  });

  test('shows error banner when transcriptError is set', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionError('not-allowed');
    await userEvent.click(screen.getByText('Transcript'));
    await waitFor(() => {
      expect(screen.getByText(/Speech recognition error/)).toBeInTheDocument();
    });
  });

  test('entry count increments', async () => {
    renderVideoMeet();
    await enableCaptions();
    fireRecognitionResult(true, 'First entry', 0.9);
    await userEvent.click(screen.getByText('Transcript'));
    await waitFor(() => {
      expect(screen.getByText('1 entries')).toBeInTheDocument();
    });
    fireRecognitionResult(true, 'Second entry', 0.9);
    await waitFor(() => {
      expect(screen.getByText('2 entries')).toBeInTheDocument();
    });
  });

  test('language selector is disabled while recording', async () => {
    renderVideoMeet();
    await enableCaptions();
    await userEvent.click(screen.getByText('Transcript'));
    const select = screen.getByDisplayValue('English (India)');
    expect(select).toBeDisabled();
  });

  test('start/stop button toggles recording', async () => {
    renderVideoMeet();
    await joinMeeting();
    await userEvent.click(screen.getByText('Transcript'));
    await userEvent.click(screen.getByText('⚪ Start'));
    await waitFor(() => {
      expect(screen.getByText('🔴 Stop')).toBeInTheDocument();
    });
  });
});

// --- I. Socket Event Handlers ---
describe('Socket event handlers', () => {
  test('handles incoming transcript-entry', async () => {
    renderVideoMeet();
    await joinMeeting();
    await triggerSocketConnect();
    await userEvent.click(screen.getByText('Transcript'));
    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('transcript-entry', expect.any(Function));
    });
    const handler = mockSocket.on.mock.calls.find(c => c[0] === 'transcript-entry')?.[1];
    act(() => {
      handler({ text: 'Remote entry', speaker: 'Remote User', lang: 'en', timestamp: Date.now() });
    });
    await waitFor(() => {
      expect(screen.getByText('Remote entry')).toBeInTheDocument();
    });
  });

  test('handles incoming summary-generated', async () => {
    renderVideoMeet();
    await joinMeeting();
    await triggerSocketConnect();
    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('summary-generated', expect.any(Function));
    });
    const handler = mockSocket.on.mock.calls.find(c => c[0] === 'summary-generated')?.[1];
    const summary = { executiveSummary: 'Meeting summary text' };
    act(() => { handler(summary); });
    await waitFor(() => {
      expect(screen.getByText('Meeting summary text')).toBeInTheDocument();
    });
    expect(mockSocket.emit).toHaveBeenCalledWith('get-action-items', { meetingId: 'test-room-123' });
  });

  test('handles incoming action-item-updated', async () => {
    renderVideoMeet();
    await joinMeeting();
    await triggerSocketConnect();
    await waitFor(() => {
      expect(mockSocket.on).toHaveBeenCalledWith('action-item-updated', expect.any(Function));
    });
  });
});

// --- J. HTTPS Guard ---
describe('startTranscription() - HTTPS guard', () => {
  test('blocks on remote HTTP and shows error', async () => {
    window.location = { ...window.location, protocol: 'http:', hostname: 'example.com' };
    renderVideoMeet();
    await joinMeeting();
    await userEvent.click(screen.getByTitle('Show Subtitles'));
    await waitFor(() => {
      expect(screen.getByText('Subtitles unavailable')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Transcript'));
    expect(screen.getByText(/requires HTTPS/)).toBeInTheDocument();
  });

  test('allows on localhost HTTP', async () => {
    window.location = { ...window.location, protocol: 'http:', hostname: 'localhost' };
    renderVideoMeet();
    await enableCaptions();
    expect(recognitionCtor).toHaveBeenCalled();
  });

  test('allows on HTTPS', async () => {
    window.location = { ...window.location, protocol: 'https:', hostname: 'example.com' };
    renderVideoMeet();
    await enableCaptions();
    expect(recognitionCtor).toHaveBeenCalled();
  });
});
