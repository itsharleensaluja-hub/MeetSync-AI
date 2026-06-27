import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AttendanceHistory from '../AttendanceHistory';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeReports() {
  return {
    success: true,
    count: 2,
    data: [
      { _id: 'r1', meetingId: 'm1', meetingOwner: 'owner1', date: '2024-06-01T10:00:00Z', startTime: '2024-06-01T10:00:00Z', endTime: '2024-06-01T11:00:00Z', participants: [{ userId: 'u1', name: 'Alice', totalTime: 600, verifiedTime: 540, verifiedPercent: 90, status: 'Present' }, { userId: 'u2', name: 'Bob', totalTime: 600, verifiedTime: 300, verifiedPercent: 50, status: 'Partial' }] },
      { _id: 'r2', meetingId: 'm2', meetingOwner: 'owner1', date: '2024-06-02T14:00:00Z', startTime: '2024-06-02T14:00:00Z', endTime: '2024-06-02T15:30:00Z', participants: [{ userId: 'u1', name: 'Alice', totalTime: 900, verifiedTime: 810, verifiedPercent: 90, status: 'Present' }] },
    ]
  };
}

function renderPage() {
  render(<MemoryRouter><AttendanceHistory /></MemoryRouter>);
}

describe('AttendanceHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders name input when no owner stored', () => {
    renderPage();
    expect(screen.getByText('My Meeting Attendance Reports')).toBeInTheDocument();
    expect(screen.getByText('View')).toBeInTheDocument();
  });

  test('fetches and displays reports on name submit', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(makeReports()) });
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), 'owner1');
    await userEvent.click(screen.getByText('View'));
    await waitFor(() => {
      expect(screen.getByText(/m1/)).toBeInTheDocument();
      expect(screen.getByText(/m2/)).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/attendance/owner/owner1')
    );
  });

  test('auto-loads from localStorage on mount', async () => {
    localStorage.setItem('meetingOwnerName', 'storedOwner');
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(makeReports()) });
    renderPage();
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/attendance/owner/storedOwner')
      );
    });
  });

  test('shows error on fetch failure', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), 'owner1');
    await userEvent.click(screen.getByText('View'));
    await waitFor(() => {
      expect(screen.getByText(/Failed to connect/i)).toBeInTheDocument();
    });
  });
});
