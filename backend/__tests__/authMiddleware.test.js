// backend/__tests__/authMiddleware.test.js
// M1.1 — tests สำหรับ requireAdmin + admin routes
//
// รันด้วย Node built-in test runner (ไม่ต้องติดตั้ง Jest):
//   npm test          (ใน backend/) → node --test __tests__/
//
// กลยุทธ์: mock `../config/firebase` (adminAuth + db) ผ่าน require.cache injection
// ก่อน require middleware/router เพื่อไม่ให้ initializeApp จริง / เรียก network
const test   = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');
const { once } = require('node:events');

// ─── mock firebase config ───────────────────────────────────────────────────────
function installFirebaseMock() {
  const state = {
    verifyIdToken: async () => { throw new Error('verifyIdToken not configured'); },
    adminsDocExists: false,
    adminsDocData: { name: 'Test Admin', role: 'admin' },
    adminsLookupError: null,
  };

  const fakeAuth = {
    verifyIdToken: (token) => state.verifyIdToken(token),
  };

  const fakeDb = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          if (name === 'admins') {
            if (state.adminsLookupError) throw state.adminsLookupError;
            return {
              exists: state.adminsDocExists,
              data: () => (state.adminsDocExists ? state.adminsDocData : {}),
            };
          }
          return { exists: false, data: () => ({}) };
        },
      }),
      where: () => ({
        get: async () => ({ empty: true, docs: [] }),
      }),
    }),
  };

  const resolved = require.resolve('../config/firebase.js');
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: { adminAuth: fakeAuth, db: fakeDb },
  };

  return { state, fakeAuth, fakeDb };
}

const { state } = installFirebaseMock();

// require หลัง mock เสร็จ → middleware/router จะได้ adminAuth/db ตัว mock
const { requireAdmin, extractBearerToken } = require('../middleware/authMiddleware');
const adminExerciseRoutes = require('../routes/adminExerciseRoutes');

// ─── helpers ────────────────────────────────────────────────────────────────────
function makeReq(headers = {}) {
  return { headers };
}

function makeRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

function makeNext() {
  const next = (err) => { next.called = true; next.err = err ?? null; };
  next.called = false;
  next.err = null;
  return next;
}

async function startTestServer(app) {
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function stopTestServer(server) {
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

function buildTestApp() {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/admin/exercises', adminExerciseRoutes);
  return app;
}

// ─── unit tests: extractBearerToken ────────────────────────────────────────────
test('extractBearerToken: คืน token จาก "Bearer <token>"', () => {
  assert.equal(extractBearerToken(makeReq({ authorization: 'Bearer abc.def' })), 'abc.def');
});

test('extractBearerToken: คืน null เมื่อไม่มี header', () => {
  assert.equal(extractBearerToken(makeReq({})), null);
});

test('extractBearerToken: คืน null เมื่อไม่ใช่ Bearer', () => {
  assert.equal(extractBearerToken(makeReq({ authorization: 'Basic abc' })), null);
});

test('extractBearerToken: คืน null เมื่อ token ว่างหลัง Bearer', () => {
  assert.equal(extractBearerToken(makeReq({ authorization: 'Bearer   ' })), null);
});

// ─── unit tests: requireAdmin ──────────────────────────────────────────────────
test('requireAdmin: ไม่มี token → 401', async () => {
  state.verifyIdToken = async () => { throw new Error('should not be called'); };
  const req = makeReq();
  const res = makeRes();
  const next = makeNext();

  await requireAdmin(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.success, false);
  assert.equal(next.called, false);
});

test('requireAdmin: token ไม่ถูกต้อง/หมดอายุ → 401', async () => {
  state.verifyIdToken = async () => { throw new Error('invalid token'); };
  const req = makeReq({ authorization: 'Bearer bad.token' });
  const res = makeRes();
  const next = makeNext();

  await requireAdmin(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.called, false);
});

test('requireAdmin: token ถูกแต่ไม่ใช่ admin → 403', async () => {
  state.verifyIdToken = async () => ({ uid: 'u1', email: 'user@example.com' });
  state.adminsDocExists = false;
  const req = makeReq({ authorization: 'Bearer valid.token' });
  const res = makeRes();
  const next = makeNext();

  await requireAdmin(req, res, next);

  assert.equal(res.statusCode, 403);
  assert.equal(next.called, false);
});

test('requireAdmin: custom claim admin=true → next() + req.user', async () => {
  state.verifyIdToken = async () => ({ uid: 'u1', email: 'admin@example.com', admin: true });
  const req = makeReq({ authorization: 'Bearer valid.token' });
  const res = makeRes();
  const next = makeNext();

  await requireAdmin(req, res, next);

  assert.equal(next.called, true);
  assert.equal(next.err, null);
  assert.equal(req.user.admin, true);
  assert.equal(req.user.uid, 'u1');
});

test('requireAdmin: มี doc ใน admins collection → next() + req.user', async () => {
  state.verifyIdToken = async () => ({ uid: 'u1', email: 'admin@example.com' });
  state.adminsDocExists = true;
  state.adminsDocData = { name: 'Test Admin', role: 'superadmin' };
  const req = makeReq({ authorization: 'Bearer valid.token' });
  const res = makeRes();
  const next = makeNext();

  await requireAdmin(req, res, next);

  assert.equal(next.called, true);
  assert.equal(req.user.uid, 'u1');
  assert.equal(req.user.name, 'Test Admin');
  assert.equal(req.user.role, 'superadmin');
});

// ─── integration tests: /api/admin/exercises ───────────────────────────────────
test('GET /api/admin/exercises โดยไม่ส่ง token → 401', async () => {
  const { server, baseUrl } = await startTestServer(buildTestApp());
  try {
    const res = await fetch(`${baseUrl}/api/admin/exercises`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
  } finally {
    await stopTestServer(server);
  }
});

test('POST /api/admin/exercises/generate โดยไม่ส่ง token → 401', async () => {
  const { server, baseUrl } = await startTestServer(buildTestApp());
  try {
    const res = await fetch(`${baseUrl}/api/admin/exercises/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'A1', size: 5 }),
    });
    assert.equal(res.status, 401);
  } finally {
    await stopTestServer(server);
  }
});

test('GET /api/admin/exercises ด้วย token ไม่ถูกต้อง → 401', async () => {
  state.verifyIdToken = async () => { throw new Error('invalid token'); };
  const { server, baseUrl } = await startTestServer(buildTestApp());
  try {
    const res = await fetch(`${baseUrl}/api/admin/exercises`, {
      headers: { authorization: 'Bearer bad.token' },
    });
    assert.equal(res.status, 401);
  } finally {
    await stopTestServer(server);
  }
});

test('GET /api/admin/exercises ด้วย token ถูกแต่ไม่ใช่ admin → 403', async () => {
  state.verifyIdToken = async () => ({ uid: 'u1', email: 'user@example.com' });
  state.adminsDocExists = false;
  const { server, baseUrl } = await startTestServer(buildTestApp());
  try {
    const res = await fetch(`${baseUrl}/api/admin/exercises`, {
      headers: { authorization: 'Bearer valid.token' },
    });
    assert.equal(res.status, 403);
  } finally {
    await stopTestServer(server);
  }
});


