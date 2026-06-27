import { jest } from '@jest/globals';
import express from 'express';
import cors from 'cors';

const crypto = await import('crypto');

// ── In-memory store per model ──────────────────────
function makeStore() {
  const items = [];
  return {
    items,
    add: (item) => { items.push(item); },
    removeAll: () => { items.length = 0; },
  };
}

// ── Mock model factory ─────────────────────────────
function createMockModel(store) {
  function Instance(data) {
    Object.assign(this, data || {});
  }
  Instance.prototype.save = function () {
    if (!this._id) {
      this._id = crypto.randomUUID();
      store.add(this);
    }
    return Promise.resolve(this);
  };

  function fn(data) { return new Instance(data); }
  fn.prototype = Instance.prototype;

  function deepMatch(item, keyParts, value) {
    let cur = item;
    for (let i = 0; i < keyParts.length; i++) {
      if (cur == null) return false;
      if (Array.isArray(cur)) {
        const rest = keyParts.slice(i);
        return cur.some(el => deepMatch(el, rest, value));
      }
      cur = cur[keyParts[i]];
    }
    return cur === value;
  }

  function matchQuery(item, query) {
    return Object.keys(query).every(key => {
      if (key.startsWith('$')) return true;
      return deepMatch(item, key.split('.'), query[key]);
    });
  }

  fn.find = jest.fn().mockImplementation((query = {}) => {
    let results = [...store.items];
    if (query && typeof query === 'object' && Object.keys(query).length > 0) {
      if (query.$or) {
        results = results.filter(item =>
          query.$or.some(cond => matchQuery(item, cond))
        );
      } else {
        results = results.filter(item => matchQuery(item, query));
      }
    }
    const q = { results, _sortField: null, _sortDir: 1, _limitVal: null };
    q.sort = function (s) {
      const field = Object.keys(s)[0];
      this._sortField = field;
      this._sortDir = s[field] === -1 ? -1 : 1;
      return this;
    };
    q.limit = function (n) { this._limitVal = n; return this; };
    q.then = function (resolve) {
      let r = [...this.results];
      if (this._sortField) {
        r.sort((a, b) => (a[this._sortField] > b[this._sortField] ? 1 : -1) * this._sortDir);
      }
      if (this._limitVal) r = r.slice(0, this._limitVal);
      resolve(r);
    };
    return q;
  });

  fn.findOne = jest.fn().mockImplementation((query = {}) => {
    let results = [...store.items];
    results = results.filter(item => matchQuery(item, query));
    const q = { results };
    q.sort = function () { return this; };
    q.then = function (resolve) {
      resolve(this.results[0] || null);
    };
    return q;
  });

  fn.findById = jest.fn().mockImplementation((id) => {
    const item = store.items.find(item => item._id === id);
    return Promise.resolve(item || null);
  });

  fn.create = jest.fn().mockImplementation((data) => {
    if (Array.isArray(data)) {
      return Promise.resolve(data.map(d => {
        const inst = new Instance(d);
        inst._id = crypto.randomUUID();
        store.add(inst);
        return inst;
      }));
    }
    const inst = new Instance(data);
    inst._id = crypto.randomUUID();
    store.add(inst);
    return Promise.resolve(inst);
  });

  fn.deleteMany = jest.fn().mockImplementation(() => {
    store.removeAll();
    return Promise.resolve({ deletedCount: 0 });
  });

  fn.store = store;
  return fn;
}

// ── Create stores and mock models ──────────────────
const stores = {};
export const MockUser = createMockModel(stores['users'] = makeStore());
export const MockMeeting = createMockModel(stores['meetings'] = makeStore());
export const MockAttendance = createMockModel(stores['attendances'] = makeStore());
export const MockTranscript = createMockModel(stores['transcripts'] = makeStore());
export const MockActionItem = createMockModel(stores['actionItems'] = makeStore());

// ── Mock model modules ─────────────────────────────
jest.unstable_mockModule('../models/user.model.js', () => ({ User: MockUser }));
jest.unstable_mockModule('../models/meeting.model.js', () => ({ Meeting: MockMeeting }));
jest.unstable_mockModule('../models/attendance.model.js', () => ({ Attendance: MockAttendance }));
jest.unstable_mockModule('../models/transcript.model.js', () => ({ Transcript: MockTranscript }));
jest.unstable_mockModule('../models/actionItem.model.js', () => ({ default: MockActionItem }));

// ── Reset helper ───────────────────────────────────
export function resetStore() {
  Object.values(stores).forEach(s => s.removeAll());
}

// ── App factory ────────────────────────────────────
export async function setupTestApp() {
  resetStore();
  const { default: userRoutes } = await import('../routes/users.routes.js');
  const { default: attendanceRoutes } = await import('../routes/attendance.routes.js');
  const { default: actionItemRoutes } = await import('../routes/actionItem.routes.js');

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '40kb' }));
  app.use(express.urlencoded({ limit: '40kb', extended: true }));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
  });

  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/attendance', attendanceRoutes);
  app.use('/api/v1/action-items', actionItemRoutes);

  return app;
}

export async function teardownTestApp() {
  resetStore();
}
