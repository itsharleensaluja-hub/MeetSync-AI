import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import withAuth from '../withAuth';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

function Dummy() { return <div>dummy</div>; }
const Protected = withAuth(Dummy);

describe('withAuth', () => {
  afterEach(() => { localStorage.clear(); jest.clearAllMocks(); });

  test('renders wrapped component when token exists', () => {
    localStorage.setItem('token', 'valid-token');
    render(<MemoryRouter><Protected /></MemoryRouter>);
    expect(screen.getByText('dummy')).toBeInTheDocument();
  });

  test('calls navigate to /auth when no token', () => {
    render(<MemoryRouter initialEntries={['/home']}><Protected /></MemoryRouter>);
    expect(mockNavigate).toHaveBeenCalledWith('/auth');
  });
});
