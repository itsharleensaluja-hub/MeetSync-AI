import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';

// --- Mocks ---

jest.mock('../../utils/withAuth', () => (Component) => Component);
jest.mock('@vladmandic/face-api', () => ({
  nets: {
    tinyFaceDetector: { loadFromUri: jest.fn().mockResolvedValue() },
    faceLandmark68Net: { loadFromUri: jest.fn().mockResolvedValue() },
    faceRecognitionNet: { loadFromUri: jest.fn().mockResolvedValue() },
  },
  TinyFaceDetectorOptions: function () { this.inputSize = 320; this.scoreThreshold = 0.5; },
  euclideanDistance: jest.fn(() => 0.5),
}));

const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  off: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  id: 'mock-socket-id',
};

jest.mock('socket.io-client', () => {
  return jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    off: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    id: 'mock-socket-id',
  }));
});

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockTrack = {
  stop: jest.fn(),
  getSettings: () => ({}),
  enabled: true,
};

const mockStream = {
  getTracks: () => [mockTrack, mockTrack],
  getVideoTracks: () => [mockTrack],
  getAudioTracks: () => [mockTrack],
};

const mockGetUserMedia = jest.fn().mockResolvedValue(mockStream);
const mockDisplayMedia = jest.fn().mockResolvedValue(mockStream);

let mockRecognitionInstance;

function createMockRecognition() {
  return {
    continuous: false,
    interimResults: false,
    lang: 'en-IN',
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    onaudiostart: null,
    onresult: null,
    onerror: null,
    onend: null,
    onspeechstart: null,
    onsoundstart: null,
    onnomatch: null,
  };
}

beforeEach(() => {
  jest.clearAllMocks();

  mockRecognitionInstance = createMockRecognition();
  window.SpeechRecognition = jest.fn(() => mockRecognitionInstance);
  window.webkitSpeechRecognition = jest.fn(() => mockRecognitionInstance);

  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: mockGetUserMedia,
      getDisplayMedia: mockDisplayMedia,
    },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: jest.fn().mockResolvedValue() },
    writable: true,
    configurable: true,
  });

  window.localStream = mockStream;

  delete window.location;
  window.location = {
    ...window.location,
    pathname: '/test-room-123',
    protocol: 'http:',
    hostname: 'localhost',
    href: 'http://localhost/test-room-123',
    origin: 'http://localhost',
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
  const input = screen.getByPlaceholderText('Your display name');
  await userEvent.type(input, 'Test User');
  const btn = screen.getByText('Enter Meeting Room');
  await userEvent.click(btn);
}

describe('Lobby / Pre-Join', () => {
  test('shows lobby with meeting title', () => {
    renderVideoMeet();
    expect(screen.getByText('Join Your Meeting')).toBeInTheDocument();
  });

  test('shows room code from URL', () => {
    renderVideoMeet();
    const elements = screen.getAllByText(/test-room-123/);
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  test('shows username input', () => {
    renderVideoMeet();
    expect(screen.getByPlaceholderText('Your display name')).toBeInTheDocument();
  });

  test('shows enter meeting button', () => {
    renderVideoMeet();
    expect(screen.getByText('Enter Meeting Room')).toBeInTheDocument();
  });

  test('allows typing username', async () => {
    renderVideoMeet();
    const input = screen.getByPlaceholderText('Your display name');
    await userEvent.type(input, 'Test User');
    expect(input).toHaveValue('Test User');
  });

  test('join button is disabled when username is empty', () => {
    renderVideoMeet();
    const btn = screen.getByText('Enter Meeting Room').closest('button');
    expect(btn).toBeDisabled();
  });
});

describe('Meeting UI - Controls', () => {
  test('shows meeting controls after joining', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.queryByText('Join Your Meeting')).not.toBeInTheDocument();
    });
  });

  test('shows mic toggle button', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.getByTitle(/Mute Microphone/i)).toBeInTheDocument();
    });
  });

  test('shows camera toggle button', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.getByTitle('Toggle Video')).toBeInTheDocument();
    });
  });

  test('shows leave meeting button', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.getByText('Leave')).toBeInTheDocument();
    });
  });

  // Screen share is conditionally rendered based on async navigator.mediaDevices.getDisplayMedia
  // availability; skipped in unit tests since it depends on browser API detection at runtime.
});

describe('Meeting UI - Captions / Subtitles', () => {
  test('captions toggle button exists after joining', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.getByTitle('Show Subtitles')).toBeInTheDocument();
    });
  });

  test('captions overlay does not show by default', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.queryByText(/Listening/)).not.toBeInTheDocument();
    });
  });

  test('clicking captions button starts transcription', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.getByTitle('Show Subtitles')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByTitle('Show Subtitles'));
    expect(window.SpeechRecognition).toHaveBeenCalled();
  });

  test('second click hides captions', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => expect(screen.getByTitle('Show Subtitles')).toBeInTheDocument());
    await userEvent.click(screen.getByTitle('Show Subtitles'));
    await waitFor(() => expect(screen.getByTitle('Hide Subtitles')).toBeInTheDocument());
    await userEvent.click(screen.getByTitle('Hide Subtitles'));
    await waitFor(() => expect(screen.getByTitle('Show Subtitles')).toBeInTheDocument());
  });
});

describe('Meeting UI - Hand Raise', () => {
  test('hand raise button exists after joining', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.getByTitle('Raise Hand')).toBeInTheDocument();
    });
  });

  test('clicking hand raise toggles state', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => expect(screen.getByTitle('Raise Hand')).toBeInTheDocument());
    await userEvent.click(screen.getByTitle('Raise Hand'));
    expect(screen.getByTitle('Lower Hand')).toBeInTheDocument();
  });
});

describe('Meeting UI - Reactions', () => {
  test('reactions button exists after joining', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.getByTitle('Reactions')).toBeInTheDocument();
    });
  });
});

describe('Meeting UI - Sidebar', () => {
  test('sidebar toggle button exists', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.getByTitle('Toggle Sidebar')).toBeInTheDocument();
    });
  });

  test('sidebar tabs render after joining', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.getByText('Chat')).toBeInTheDocument();
      expect(screen.getByText('Attendance')).toBeInTheDocument();
      expect(screen.getByText('Transcript')).toBeInTheDocument();
      expect(screen.getByText('Info')).toBeInTheDocument();
      expect(screen.getByText('Tasks')).toBeInTheDocument();
    });
  });
});

describe('Meeting UI - Polls', () => {
  test('polls button exists after joining', async () => {
    renderVideoMeet();
    await joinMeeting();
    await waitFor(() => {
      expect(screen.getByTitle('Polls')).toBeInTheDocument();
    });
  });
});
