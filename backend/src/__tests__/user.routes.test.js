import { setupTestApp, teardownTestApp, MockUser, MockMeeting } from './setup.js';
import request from 'supertest';

let app;

beforeAll(async () => {
  app = await setupTestApp();
});

afterAll(async () => {
  await teardownTestApp();
});

beforeEach(() => {
  MockUser.deleteMany.mockClear();
  MockMeeting.deleteMany.mockClear();
});

describe('POST /api/v1/users/register', () => {
  it('registers a new user successfully', async () => {
    const res = await request(app)
      .post('/api/v1/users/register')
      .send({ name: 'Test User', username: 'testuser', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('User Registered');
  });

  it('rejects duplicate username', async () => {
    await request(app)
      .post('/api/v1/users/register')
      .send({ name: 'Test User', username: 'testuser', password: 'password123' });

    const res = await request(app)
      .post('/api/v1/users/register')
      .send({ name: 'Test User 2', username: 'testuser', password: 'password456' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('User already exists');
  });

  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/users/register')
      .send({ name: 'Test User' });

    expect(res.status).toBe(500);
  });
});

describe('POST /api/v1/users/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/v1/users/register')
      .send({ name: 'Test User', username: 'testuser', password: 'password123' });
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app)
      .post('/api/v1/users/login')
      .send({ username: 'testuser', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/users/login')
      .send({ username: 'testuser', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid Username or password');
  });

  it('rejects non-existent user', async () => {
    const res = await request(app)
      .post('/api/v1/users/login')
      .send({ username: 'nonexistent', password: 'password123' });

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('User Not Found');
  });

  it('rejects missing credentials', async () => {
    const res = await request(app)
      .post('/api/v1/users/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Please Provide');
  });
});

describe('GET /api/v1/users/get_all_activity', () => {
  it('returns empty array for new user', async () => {
    await request(app)
      .post('/api/v1/users/register')
      .send({ name: 'Test User', username: 'testuser', password: 'password123' });

    const loginRes = await request(app)
      .post('/api/v1/users/login')
      .send({ username: 'testuser', password: 'password123' });

    const res = await request(app)
      .get('/api/v1/users/get_all_activity')
      .set('Authorization', loginRes.body.token);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns unauthorized without token', async () => {
    const res = await request(app)
      .get('/api/v1/users/get_all_activity');

    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/users/add_to_activity', () => {
  it('adds meeting to history', async () => {
    await request(app)
      .post('/api/v1/users/register')
      .send({ name: 'Test User', username: 'testuser', password: 'password123' });

    const loginRes = await request(app)
      .post('/api/v1/users/login')
      .send({ username: 'testuser', password: 'password123' });

    const res = await request(app)
      .post('/api/v1/users/add_to_activity')
      .send({ token: loginRes.body.token, meeting_code: 'abc123' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Added code to history');
  });
});
