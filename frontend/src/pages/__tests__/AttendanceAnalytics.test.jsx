import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AttendanceAnalytics from '../AttendanceAnalytics';

const mockFetch = jest.fn();
global.fetch = mockFetch;

function makeReports() {
  return {
    success: true,
    count: 2,
    data: [
      { meetingId: 'm1', meetingOwner: 'owner1', date: '2024-06-01T10:00:00Z', startTime: '2024-06-01T10:00:00Z', endTime: '2024-06-01T11:00:00Z', participants: [
        { userId: 'u1', name: 'Alice', totalTime: 600, verifiedTime: 540, verifiedPercent: 90, status: 'Present' },
        { userId: 'u2', name: 'Bob', totalTime: 600, verifiedTime: 300, verifiedPercent: 50, status: 'Partial' },
      ]},
      { meetingId: 'm2', meetingOwner: 'owner1', date: '2024-06-02T14:00:00Z', startTime: '2024-06-02T14:00:00Z', endTime: '2024-06-02T15:30:00Z', participants: [
        { userId: 'u1', name: 'Alice', totalTime: 900, verifiedTime: 810, verifiedPercent: 90, status: 'Present' },
      ]},
    ]
  };
}

function renderPage() {
  render(<MemoryRouter><AttendanceAnalytics /></MemoryRouter>);
}

describe('AttendanceAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders heading when no owner stored', () => {
    renderPage();
    expect(screen.getByText('Attendance Analytics')).toBeInTheDocument();
  });

  test('fetches and displays analytics', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(makeReports()) });
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), 'owner1');
    await userEvent.click(screen.getByText('View'));
    await waitFor(() => {
      expect(screen.getByText(/Total Meetings/i)).toBeInTheDocument();
    });
  });

  test('shows error on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), 'owner1');
    await userEvent.click(screen.getByText('View'));
    await waitFor(() => {
      expect(screen.getByText('Failed to connect to server')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });
});
