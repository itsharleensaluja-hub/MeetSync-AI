import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';

jest.mock('../../utils/withAuth', () => (Component) => Component);

import HistoryPage from '../history';

const mockGetHistory = jest.fn();

function renderPage() {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ getHistoryOfUser: mockGetHistory }}>
        <HistoryPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('History', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows empty state when no meetings', async () => {
    mockGetHistory.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(mockGetHistory).toHaveBeenCalled();
    });
  });

  test('displays meetings on mount', async () => {
    mockGetHistory.mockResolvedValue([
      { meetingCode: 'abc123', date: '2024-06-01T10:00:00Z' },
      { meetingCode: 'def456', date: '2024-06-02T14:00:00Z' },
    ]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/abc123/)).toBeInTheDocument();
      expect(screen.getByText(/def456/)).toBeInTheDocument();
    });
  });
});
