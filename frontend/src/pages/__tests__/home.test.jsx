import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';

jest.mock('../../utils/withAuth', () => (Component) => Component);

import HomeComponent from '../home';

const mockAddToUserHistory = jest.fn().mockResolvedValue(undefined);
const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderPage() {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ addToUserHistory: mockAddToUserHistory }}>
        <HomeComponent />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('HomeComponent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders create meeting button', () => {
    renderPage();
    expect(screen.getByText('Create Meeting')).toBeInTheDocument();
  });

  test('renders join input and button', () => {
    renderPage();
    expect(screen.getByText('Join')).toBeInTheDocument();
  });

  test('creates meeting code on button click', async () => {
    renderPage();
    await userEvent.click(screen.getByText('Create Meeting'));
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByText('Start Meeting')).toBeInTheDocument();
  });

  test('copies link to clipboard', async () => {
    renderPage();
    await userEvent.click(screen.getByText('Create Meeting'));
    await userEvent.click(screen.getByText('Copy'));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled();
    });
  });

  test('starts meeting and navigates', async () => {
    renderPage();
    await userEvent.click(screen.getByText('Create Meeting'));
    await userEvent.click(screen.getByText('Start Meeting'));
    await waitFor(() => {
      expect(mockAddToUserHistory).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/[a-z0-9]{8}$/));
    });
  });

  test('joins via text input', async () => {
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), 'myroom');
    await userEvent.click(screen.getByText('Join'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/myroom');
    });
  });

  test('joins on Enter in input', async () => {
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), 'roomx{enter}');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/roomx');
    });
  });

  test('shows History and Analytics buttons', () => {
    renderPage();
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  test('navigates to history on click', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('RestoreIcon'));
    expect(mockNavigate).toHaveBeenCalledWith('/history');
  });

  test('navigates to analytics on click', async () => {
    renderPage();
    await userEvent.click(screen.getByTestId('BarChartIcon'));
    expect(mockNavigate).toHaveBeenCalledWith('/attendance-analytics');
  });

  test('clears token and navigates to /auth on Logout', async () => {
    renderPage();
    localStorage.setItem('token', 'some-token');
    const logoutBtn = screen.getByText('Logout').closest('button');
    await userEvent.click(logoutBtn);
    expect(localStorage.getItem('token')).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith('/auth');
  });
});
