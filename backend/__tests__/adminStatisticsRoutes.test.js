// backend/__tests__/adminStatisticsRoutes.test.js
// Tests for Admin Statistics API (GET /api/admin/statistics)
// Run with: node --test __tests__/adminStatisticsRoutes.test.js
//
// กลยุทธ์: mock ../config/firebase (adminAuth + db) ผ่าน require.cache injection
// ก่อน require router เพื่อไม่ให้ initializeApp จริง / เรียก network
const test   = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');
const { once } = require('node:events');

function installFirebaseMock() {
  const state = {
    verifyIdToken: async (token) => {
      if (token === 'valid.token') return state.decoded;
      throw new Error('invalid token');
    },
    // ไม่มี admin claim → requireAdmin จะ lookup collection admins แทน
    decoded: { uid: 'u1', email: 'someone@example.com' },
    adminsDocExists: false,
    statRows: [],    // [{ id, data }]
    statsError: null,
    lastLimit: null,
  };

  const fakeAuth = { verifyIdToken: (token) => state.verifyIdToken(token) };

  // ดึง seconds จาก Timestamp รูปแบบต่าง ๆ (ใช้ sort เลียนแบบ Firestore orderBy)
  function tsSeconds(ts) {
    if (ts == null) return 0;
    if (typeof ts.toDate === 'function') return Math.floor(ts.toDate().getTime() / 1000);
    if (typeof ts === 'object') return Number(ts.seconds ?? ts._seconds ?? 0);
    return 0;
  }

  const fakeDb = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          const isAdminDoc = name === 'admins' && id === String(state.decoded.email || '').toLowerCase();
          return {
            exists: isAdminDoc ? state.adminsDocExists : false,
            data: () => (state.adminsDocExists ? { name: 'Test Admin', role: 'admin' } : {}),
          };
        },
      }),
      orderBy: (field) => ({
        limit: (n) => ({
          get: async () => {
            if (name !== 'statistics') return { docs: [] };
            if (state.statsError) throw state.statsError;
            state.lastLimit = n;
            // เลียนแบบ Firestore: เอกสารที่ไม่มี field ที่ orderBy จะถูกตัดออก
            const rows = state.statRows
              .filter((r) => r.data && r.data[field] !== undefined)
              .sort((a, b) => tsSeconds(b.data[field]) - tsSeconds(a.data[field]))
              .slice(0, n);
            return { docs: rows.map((r) => ({ id: r.id, data: () => r.data })) };
          },
        }),
      }),
      where: () => ({ get: async () => ({ empty: true, docs: [] }) }),
    }),
  };

  const resolved = require.resolve('../config/firebase.js');
  require.cache[resolved] = {
    id: resolved,
    filename: resolved,
    loaded: true,
    exports: { adminAuth: fakeAuth, db: fakeDb },
  };

  return { state };
}

const { state } = installFirebaseMock();

const adminStatisticsRoutes = require('../routes/adminStatisticsRoutes');

async function startTestServer(app) {
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { server, baseUrl: 'http://127.0.0.1:' + port };
}

async function stopTestServer(server) {
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

function makeApp() {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/admin/statistics', adminStatisticsRoutes);
  return app;
}

function authHeaders() {
  return { authorization: 'Bearer valid.token', 'Content-Type': 'application/json' };
}

function asAdmin() {
  state.decoded = { uid: 'a1', email: 'admin01@gmail.com', admin: true };
  state.adminsDocExists = false;
  state.statsError = null;
}

test('GET /api/admin/statistics ไม่มี token → 401', async () => {
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/statistics');
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
  } finally {
    await stopTestServer(server);
  }
});

test('GET /api/admin/statistics token ที่ไม่ใช่ admin → 403', async () => {
  state.decoded = { uid: 'u2', email: 'member@example.com' };
  state.adminsDocExists = false;
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/statistics', { headers: authHeaders() });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /admin/i);
  } finally {
    await stopTestServer(server);
  }
});

test('GET /api/admin/statistics admin → 200 เรียงล่าสุดก่อน + createdAt เป็น { seconds }', async () => {
  asAdmin();
  state.statRows = [
    { id: 'old', data: { email: 'a@x.com', createdAt: { _seconds: 100, _nanoseconds: 0 }, score: 1 } },
    { id: 'new', data: { email: 'b@x.com', createdAt: { _seconds: 300, _nanoseconds: 0 }, score: 2 } },
  ];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/statistics', { headers: authHeaders() });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.count, 2);
    // เรียงใหม่สุดก่อน
    assert.equal(body.data[0].id, 'new');
    assert.equal(body.data[1].id, 'old');
    // Admin SDK {_seconds} ถูก normalize เป็น { seconds } ให้ frontend อ่านได้
    assert.deepEqual(body.data[0].createdAt, { seconds: 300 });
    assert.equal(body.data[0].email, 'b@x.com');
  } finally {
    await stopTestServer(server);
  }
});

test('GET /api/admin/statistics?limit=1 → จำกัดจำนวน row ตามพารามิเตอร์', async () => {
  asAdmin();
  state.statRows = [
    { id: 's1', data: { createdAt: { _seconds: 100 } } },
    { id: 's2', data: { createdAt: { _seconds: 200 } } },
    { id: 's3', data: { createdAt: { _seconds: 300 } } },
  ];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/statistics?limit=1', { headers: authHeaders() });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(state.lastLimit, 1);
    assert.equal(body.count, 1);
    assert.equal(body.data[0].id, 's3');
  } finally {
    await stopTestServer(server);
  }
});

test('GET /api/admin/statistics Firestore error → 500 { success:false }', async () => {
  asAdmin();
  state.statRows = [];
  state.statsError = new Error('firestore unavailable');
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/statistics', { headers: authHeaders() });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /firestore unavailable/);
  } finally {
    await stopTestServer(server);
  }
});
