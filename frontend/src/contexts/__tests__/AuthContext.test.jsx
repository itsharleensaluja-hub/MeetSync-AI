import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, AuthContext } from '../AuthContext';
import { useContext } from 'react';

var mockAxiosInst;

jest.mock('axios', () => {
  mockAxiosInst = { post: jest.fn(), get: jest.fn() };
  return {
    create: () => mockAxiosInst,
    default: { create: () => mockAxiosInst },
  };
});

beforeEach(() => {
  mockAxiosInst?.post?.mockReset();
  mockAxiosInst?.get?.mockReset();
  localStorage.clear();
});

function TestConsumer({ fn, args, onResult }) {
  const ctx = useContext(AuthContext);
  const handleClick = async () => {
    try {
      const r = await ctx[fn](...args);
      onResult?.({ ok: true, data: r });
    } catch (e) {
      onResult?.({ ok: false, error: e });
    }
  };
  return <button onClick={handleClick}>go</button>;
}

function renderProvider(fn, args) {
  const result = {};
  let resolve;
  const p = new Promise(r => { resolve = r; });
  render(
    <MemoryRouter>
      <AuthProvider>
        <TestConsumer fn={fn} args={args} onResult={r => { Object.assign(result, r); resolve(); }} />
      </AuthProvider>
    </MemoryRouter>
  );
  return { result, click: () => userEvent.click(screen.getByText('go')), wait: () => p };
}

describe('AuthContext', () => {
  test('handleRegister calls API with credentials', async () => {
    mockAxiosInst.post.mockResolvedValue({ status: 201, data: { message: 'User created' } });
    const { click, wait } = renderProvider('handleRegister', ['Alice', 'alice', 'secret']);
    click();
    await wait();
    expect(mockAxiosInst.post).toHaveBeenCalledWith('/register', { name: 'Alice', username: 'alice', password: 'secret' });
  });

  test('handleRegister rejects on API error', async () => {
    mockAxiosInst.post.mockRejectedValue({ response: { data: { message: 'Duplicate' } } });
    const { click, wait, result } = renderProvider('handleRegister', ['B', 'dup', 'pw']);
    click();
    await wait();
    expect(result.ok).toBe(false);
  });

  test('handleLogin stores token on success', async () => {
    mockAxiosInst.post.mockResolvedValue({ status: 200, data: { token: 'abc123' } });
    const { click, wait } = renderProvider('handleLogin', ['alice', 'secret']);
    click();
    await wait();
    expect(localStorage.getItem('token')).toBe('abc123');
  });

  test('handleLogin throws on wrong password', async () => {
    mockAxiosInst.post.mockRejectedValue({ response: { data: { message: 'Wrong password' } } });
    const { click, wait, result } = renderProvider('handleLogin', ['alice', 'bad']);
    click();
    await wait();
    expect(result.ok).toBe(false);
  });

  test('getHistoryOfUser calls API with auth header', async () => {
    localStorage.setItem('token', 'tok123');
    mockAxiosInst.get.mockResolvedValue({ data: [] });
    const { click, wait } = renderProvider('getHistoryOfUser', []);
    click();
    await wait();
    expect(mockAxiosInst.get).toHaveBeenCalledWith('/get_all_activity', {
      headers: { Authorization: 'tok123' },
    });
  });

  test('addToUserHistory sends token and meeting code', async () => {
    localStorage.setItem('token', 'tok456');
    mockAxiosInst.post.mockResolvedValue({ data: 'ok' });
    const { click, wait } = renderProvider('addToUserHistory', ['meet99']);
    click();
    await wait();
    expect(mockAxiosInst.post).toHaveBeenCalledWith('/add_to_activity', {
      token: 'tok456',
      meeting_code: 'meet99',
    });
  });
});
