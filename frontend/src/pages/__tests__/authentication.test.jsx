import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import Authentication from '../authentication';

const mockRegister = jest.fn();
const mockLogin = jest.fn();

function renderPage() {
  render(
    <MemoryRouter>
      <AuthContext.Provider value={{ handleRegister: mockRegister, handleLogin: mockLogin }}>
        <Authentication />
      </AuthContext.Provider>
    </MemoryRouter>
  );
}

describe('Authentication', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders Welcome Back by default', () => {
    renderPage();
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });

  test('switches to Create Account on Sign Up toggle click', async () => {
    renderPage();
    await userEvent.click(screen.getAllByText('Sign Up')[0]);
    expect(screen.getAllByText('Create Account').length).toBe(2);
  });

  test('calls handleLogin on Sign In', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderPage();
    const textboxes = screen.getAllByRole('textbox');
    await userEvent.type(textboxes[0], 'testuser');
    await userEvent.type(screen.getByLabelText(/^Password/), 'pass123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'pass123');
    });
  });

  test('calls handleRegister on Create Account', async () => {
    mockRegister.mockResolvedValue('User created');
    renderPage();
    await userEvent.click(screen.getAllByText('Sign Up')[0]);
    const textboxes = screen.getAllByRole('textbox');
    await userEvent.type(textboxes[0], 'Alice');
    await userEvent.type(textboxes[1], 'alice');
    await userEvent.type(screen.getByLabelText(/^Password/), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('Alice', 'alice', 'secret');
    });
  });

  test('displays error message on auth failure', async () => {
    mockLogin.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
    renderPage();
    const textboxes = screen.getAllByRole('textbox');
    await userEvent.type(textboxes[0], 'bad');
    await userEvent.type(screen.getByLabelText(/^Password/), 'bad');
    await userEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
