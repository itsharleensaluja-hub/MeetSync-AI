import { setupTestApp, teardownTestApp, MockActionItem } from './setup.js';
import request from 'supertest';

let app;

beforeAll(async () => {
  app = await setupTestApp();
});

afterAll(async () => {
  await teardownTestApp();
});

beforeEach(() => {
  MockActionItem.deleteMany.mockClear();
});

describe('Action Items Routes', () => {
  describe('GET /api/v1/action-items/meeting/:meetingId', () => {
    it('returns action items for a meeting', async () => {
      await MockActionItem.create([
        { meetingId: 'meeting1', task: 'Task 1', status: 'pending' },
        { meetingId: 'meeting1', task: 'Task 2', status: 'completed' },
      ]);

      const res = await request(app).get('/api/v1/action-items/meeting/meeting1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data.length).toBe(2);
    });

    it('returns empty array when no items exist', async () => {
      const res = await request(app).get('/api/v1/action-items/meeting/empty-meeting');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  describe('PATCH /api/v1/action-items/:id/toggle', () => {
    it('toggles pending to completed', async () => {
      const item = await MockActionItem.create({ meetingId: 'meeting1', task: 'Task 1', status: 'pending' });

      const res = await request(app).patch(`/api/v1/action-items/${item._id}/toggle`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
    });

    it('toggles completed to pending', async () => {
      const item = await MockActionItem.create({ meetingId: 'meeting1', task: 'Task 1', status: 'completed' });

      const res = await request(app).patch(`/api/v1/action-items/${item._id}/toggle`);
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('pending');
    });

    it('returns 404 for non-existent item', async () => {
      const fakeId = '000000000000000000000000';
      const res = await request(app).patch(`/api/v1/action-items/${fakeId}/toggle`);
      expect(res.status).toBe(404);
    });
  });
});
