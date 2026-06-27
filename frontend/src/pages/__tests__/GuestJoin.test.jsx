import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GuestJoin from '../GuestJoin';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function renderPage() {
  render(<MemoryRouter><GuestJoin /></MemoryRouter>);
}

describe('GuestJoin', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders heading and join button', () => {
    renderPage();
    expect(screen.getByText('MeetSync AI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join' })).toBeInTheDocument();
  });

  test('navigates to meeting on join button click', async () => {
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), 'abc123');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(mockNavigate).toHaveBeenCalledWith('/abc123');
  });

  test('extracts code from URL input', async () => {
    renderPage();
    await userEvent.type(screen.getByRole('textbox'), 'https://meetsync.ai/room99');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(mockNavigate).toHaveBeenCalledWith('/room99');
  });

  test('does not navigate on empty input', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('navigates on Enter keypress', async () => {
    renderPage();
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'meet42{enter}');
    expect(mockNavigate).toHaveBeenCalledWith('/meet42');
  });
});
