import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from '../landing';

const renderPage = () => render(<MemoryRouter><LandingPage /></MemoryRouter>);

describe('LandingPage', () => {
  test('renders brand name', () => {
    renderPage();
    expect(screen.getByText('MeetSync AI')).toBeInTheDocument();
  });

  test('renders hero heading', () => {
    renderPage();
    expect(screen.getByText(/Smart Meetings/i)).toBeInTheDocument();
  });

  test('renders Join as Guest link', () => {
    renderPage();
    expect(screen.getByText('Join as Guest')).toBeInTheDocument();
  });

  test('renders Register and Login buttons', () => {
    renderPage();
    expect(screen.getByText('Register')).toBeInTheDocument();
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  test('renders Get Started link', () => {
    renderPage();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });
});
