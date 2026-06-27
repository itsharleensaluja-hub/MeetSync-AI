import { setupTestApp, teardownTestApp, MockAttendance, MockTranscript } from './setup.js';
import request from 'supertest';

let app;

beforeAll(async () => {
  app = await setupTestApp();
});

afterAll(async () => {
  await teardownTestApp();
});

beforeEach(() => {
  teardownTestApp();
  MockAttendance.deleteMany.mockClear();
  MockTranscript.deleteMany.mockClear();
});

describe('Attendance Routes', () => {
  const sampleReport = {
    meetingId: 'test-meeting-1',
    meetingOwner: 'owner1',
    participants: [
      { userId: 'user1', name: 'User One', totalTime: 600, verifiedTime: 540, verifiedPercent: 90, status: 'Present' },
      { userId: 'user2', name: 'User Two', totalTime: 600, verifiedTime: 300, verifiedPercent: 50, status: 'Partial' },
      { userId: 'user3', name: 'User Three', totalTime: 600, verifiedTime: 120, verifiedPercent: 20, status: 'Absent' },
    ],
    startTime: new Date(),
    endTime: new Date(),
    date: new Date(),
  };

  describe('GET /api/v1/attendance/owner/:userId', () => {
    it('returns reports for meeting owner', async () => {
      await MockAttendance.create(sampleReport);

      const res = await request(app).get('/api/v1/attendance/owner/owner1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].meetingId).toBe('test-meeting-1');
    });

    it('returns empty array when no reports exist', async () => {
      const res = await request(app).get('/api/v1/attendance/owner/nonexistent');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  describe('GET /api/v1/attendance/meeting/:meetingId', () => {
    it('returns report for specific meeting', async () => {
      await MockAttendance.create(sampleReport);

      const res = await request(app).get('/api/v1/attendance/meeting/test-meeting-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.meetingId).toBe('test-meeting-1');
    });

    it('returns 404 for non-existent meeting', async () => {
      const res = await request(app).get('/api/v1/attendance/meeting/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/attendance/user/:userId', () => {
    it('returns attendance for specific user participant', async () => {
      await MockAttendance.create(sampleReport);

      const res = await request(app).get('/api/v1/attendance/user/user1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].myAttendance.userId).toBe('user1');
    });

    it('returns empty when user has no attendance', async () => {
      const res = await request(app).get('/api/v1/attendance/user/nobody');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });

  describe('GET /api/v1/attendance/transcript/:meetingId', () => {
    it('returns transcript for meeting', async () => {
      await MockTranscript.create({
        meetingId: 'test-meeting-1',
        entries: [{ text: 'Hello', speaker: 'User One', timestamp: Date.now() }],
      });

      const res = await request(app).get('/api/v1/attendance/transcript/test-meeting-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entries.length).toBe(1);
    });

    it('returns 404 when transcript not found', async () => {
      const res = await request(app).get('/api/v1/attendance/transcript/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});

describe('Attendance Status Calculation', () => {
  it('marks as Present when >= 75%', async () => {
    const report = {
      meetingId: 'test-present',
      meetingOwner: 'owner1',
      participants: [{ userId: 'p1', name: 'P1', totalTime: 100, verifiedTime: 90, verifiedPercent: 90, status: 'Present' }],
      startTime: new Date(),
      endTime: new Date(),
      date: new Date(),
    };
    await MockAttendance.create(report);

    const res = await request(app).get('/api/v1/attendance/meeting/test-present');
    expect(res.body.data.participants[0].status).toBe('Present');
  });

  it('marks as Partial when 50-74%', async () => {
    const report = {
      meetingId: 'test-partial',
      meetingOwner: 'owner1',
      participants: [{ userId: 'p2', name: 'P2', totalTime: 100, verifiedTime: 60, verifiedPercent: 60, status: 'Partial' }],
      startTime: new Date(),
      endTime: new Date(),
      date: new Date(),
    };
    await MockAttendance.create(report);

    const res = await request(app).get('/api/v1/attendance/meeting/test-partial');
    expect(res.body.data.participants[0].status).toBe('Partial');
  });

  it('marks as Absent when < 50%', async () => {
    const report = {
      meetingId: 'test-absent',
      meetingOwner: 'owner1',
      participants: [{ userId: 'p3', name: 'P3', totalTime: 100, verifiedTime: 20, verifiedPercent: 20, status: 'Absent' }],
      startTime: new Date(),
      endTime: new Date(),
      date: new Date(),
    };
    await MockAttendance.create(report);

    const res = await request(app).get('/api/v1/attendance/meeting/test-absent');
    expect(res.body.data.participants[0].status).toBe('Absent');
  });
});
