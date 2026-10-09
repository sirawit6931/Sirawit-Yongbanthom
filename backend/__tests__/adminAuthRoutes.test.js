// backend/__tests__/adminAuthRoutes.test.js
// Phase 4 — tests สำหรับ Admin Authentication (username/password → session token)
//
// รันด้วย Node built-in test runner (ไม่ต้องติดตั้งอะไรเพิ่ม):
//   npm test          (ใน backend/) → node --test
//
// กลยุทธ์: mock `../config/firebase` (adminAuth + db) ผ่าน require.cache injection
// ก่อน require routes/middleware — ไม่เรียก initializeApp จริง / ไม่ยิง network
//
// ครอบคลุม (ตามแผน Phase 4):
//   - login default creds → 200 + token ที่ verifyAdminToken ผ่าน
//   - login จาก password / passwordHash / query username ใน Firestore admins → 200
//   - รหัสผ่านผิด → 401 / ขาด field → 400 / ผิดเกินลิมิต → 429
//   - /api/admin/login เรียกได้โดยไม่มี token แต่ /api/admin/exercises → 401
//   - session token ที่ sign ใหม่ → requireAdmin ผ่าน / ถูกดัดแปลง → 401
//   - Firebase ID token path เดิมยังทำงาน (backward-compatible กับโมบายล์)
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');
const crypto = require('crypto');
const { once } = require('node:events');

// env คงที่สำหรับ test — กันค่าจากเครื่องมารบกวนผลลัพธ์
process.env.ADMIN_USERNAME = 'admin01';
process.env.ADMIN_PASSWORD = 'admin01';
process.env.ADMIN_SESSION_SECRET = 'test-secret-admin-auth';

// ─── mock firebase config ─────────────────────────────────────────────────────
function installFirebaseMock() {
  const state = {
    verifyIdToken: async () => { throw new Error('verifyIdToken not configured'); },
    adminDocs: {},        // doc id -> data (ทางเข้าที่ 1: doc id = username)
    adminWhereDocs: [],   // docs สำหรับ query where('username','==',...) (ทางเข้าที่ 2)
    adminsLookupError: null,
    createCustomToken: async (uid) => `mock.ct.${uid}`,
  };

  const fakeAuth = {
    verifyIdToken: (token) => state.verifyIdToken(token),
    createCustomToken: (uid, claims) => state.createCustomToken(uid, claims),
  };

  const fakeDb = {
    collection: (name) => ({
      doc: (id) => ({
        get: async () => {
          if (name !== 'admins') return { exists: false, data: () => ({}) };
          if (state.adminsLookupError) throw state.adminsLookupError;
          const data = state.adminDocs[id];
          return data
            ? { exists: true, data: () => ({ ...data }) }
            : { exists: false, data: () => ({}) };
        },
      }),
      where: (field, _op, value) => {
        const matched = state.adminWhereDocs.filter((d) => d[field] === value);
        const result = {
          empty: matched.length === 0,
          docs: matched.map((d) => ({ id: d.id, data: () => ({ ...d }) })),
        };
        const chain = { limit: () => chain, get: async () => result };
        return chain;
      },
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

// require หลัง mock เสร็จ → routes/middleware ได้ fake ตัวเดียวกัน
const adminAuthRoutes      = require('../routes/adminAuthRoutes');
const { requireAdmin }     = require('../middleware/authMiddleware');
const { signAdminToken, verifyAdminToken } = require('../utils/adminSessionToken');
const adminExerciseRoutes  = require('../routes/adminExerciseRoutes');

// ─── helpers ──────────────────────────────────────────────────────────────────
function makeReq(headers = {}) { return { headers }; }
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

// app ประกอบด้วย global guard + authRoutes + exercises router แบบเดียวกับ server.js
function buildTestApp() {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/admin', (req, res, next) => {
    if (req.path === '/login' || req.path === '/bootstrap') return next();
    return requireAdmin(req, res, next);
  });
  app.use('/api/admin', adminAuthRoutes);
  app.use('/api/admin/exercises', adminExerciseRoutes);
  return app;
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

// รัน fn(baseUrl) ด้วย server ชั่วคราว (เปิด/ปิดต่อ test กัน state รั่ว)
async function withServer(fn) {
  const { server, baseUrl } = await startTestServer(buildTestApp());
  try {
    return await fn(baseUrl);
  } finally {
    await stopTestServer(server);
  }
}

async function postJson(baseUrl, path, body, headers = {}) {
  const res = await fetch(baseUrl + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// reset state ทุก test — กัน throttle/doc รั่วข้าม test case
beforeEach(() => {
  adminAuthRoutes.__resetLoginThrottle();
  state.adminDocs = {};
  state.adminWhereDocs = [];
  state.adminsLookupError = null;
  state.verifyIdToken = async () => { throw new Error('verifyIdToken not configured'); };
});

// ─── unit tests: requireAdmin + session token ────────────────────────────────
test('requireAdmin: session token ที่ sign ใหม่ → next() + req.user.authType=session', async () => {
  const token = signAdminToken({ username: 'admin01', role: 'admin', name: 'Admin 01' });
  const req = makeReq({ authorization: 'Bearer ' + token });
  const res = makeRes();
  const next = makeNext();

  await requireAdmin(req, res, next);

  assert.equal(next.called, true);
  assert.equal(next.err, null);
  assert.equal(req.user.admin, true);
  assert.equal(req.user.username, 'admin01');
  assert.equal(req.user.role, 'admin');
  assert.equal(req.user.authType, 'session');
});

test('requireAdmin: session token ถูกดัดแปลง → 401 + ไม่เรียก next()', async () => {
  const token = signAdminToken({ username: 'admin01' });
  const last = token.slice(-1);
  const tampered = token.slice(0, -1) + (last === 'A' ? 'B' : 'A');
  const req = makeReq({ authorization: 'Bearer ' + tampered });
  const res = makeRes();
  const next = makeNext();

  await requireAdmin(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.equal(next.called, false);
});

test('requireAdmin: Firebase ID token (admin claim) → next() — backward-compatible กับโมบายล์', async () => {
  state.verifyIdToken = async (t) => {
    if (t !== 'valid.fb.token') throw new Error('invalid token');
    return { uid: 'fb-uid-1', email: 'admin@example.com', admin: true };
  };
  const req = makeReq({ authorization: 'Bearer valid.fb.token' });
  const res = makeRes();
  const next = makeNext();

  await requireAdmin(req, res, next);

  assert.equal(next.called, true);
  assert.equal(req.user.admin, true);
  assert.equal(req.user.uid, 'fb-uid-1');
});

test('requireAdmin: req.user ตั้งไว้แล้ว (โดย global guard) → next() ทันทีโดยไม่ verify ซ้ำ', async () => {
  const req = makeReq(); // ไม่มี Authorization header เลย
  req.user = { admin: true, authType: 'session' };
  const res = makeRes();
  const next = makeNext();

  await requireAdmin(req, res, next);

  assert.equal(next.called, true);
  assert.equal(res.statusCode, null); // ไม่ถูกปฏิเสธ
});

// ─── POST /api/admin/login ───────────────────────────────────────────────────
test('login ด้วย default creds → 200 + token ที่ verifyAdminToken ผ่าน', async () => {
  await withServer(async (baseUrl) => {
    const { status, data } = await postJson(baseUrl, '/api/admin/login', {
      username: 'admin01', password: 'admin01',
    });

    assert.equal(status, 200);
    assert.equal(data.success, true);
    assert.equal(data.username, 'admin01');
    assert.ok(data.token, 'ต้องมี session token');

    const payload = verifyAdminToken(data.token);
    assert.ok(payload, 'verifyAdminToken ต้องผ่าน');
    assert.equal(payload.admin, true);
    assert.equal(payload.username, 'admin01');
    assert.ok(payload.exp > Math.floor(Date.now() / 1000), 'ยังไม่หมดอายุ');

    assert.equal(data.customToken, 'mock.ct.admin01', 'customToken จาก uid (id ของ doc/default)');
  });
});

test('login จาก password ใน Firestore admins (doc id) → 200 (ชื่อ/role/uid จาก doc)', async () => {
  state.adminDocs['teacher01'] = {
    username: 'teacher01',
    password: 'S3cret!pw',
    name: 'ครูใจดี',
    role: 'superadmin',
    uid: 'uid-teacher01',
  };

  await withServer(async (baseUrl) => {
    const ok = await postJson(baseUrl, '/api/admin/login', {
      username: 'teacher01', password: 'S3cret!pw',
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.success, true);
    assert.equal(ok.data.name, 'ครูใจดี');
    assert.equal(ok.data.role, 'superadmin');
    assert.equal(ok.data.customToken, 'mock.ct.uid-teacher01');

    // doc มีรหัสผ่าน → default password ใช้ไม่ได้ (doc "ชนะ" เสมอ)
    const wrong = await postJson(baseUrl, '/api/admin/login', {
      username: 'teacher01', password: 'admin01',
    });
    assert.equal(wrong.status, 401);
  });
});

test('login จาก passwordHash (sha256hex) ใน Firestore → 200 / รหัสผิด → 401', async () => {
  const hash = crypto.createHash('sha256').update('hash-pw-99', 'utf8').digest('hex');
  state.adminDocs['hashadmin'] = { passwordHash: hash, name: 'Hash Admin', role: 'admin' };

  await withServer(async (baseUrl) => {
    const ok = await postJson(baseUrl, '/api/admin/login', {
      username: 'hashadmin', password: 'hash-pw-99',
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.name, 'Hash Admin');

    const bad = await postJson(baseUrl, '/api/admin/login', {
      username: 'hashadmin', password: 'wrong',
    });
    assert.equal(bad.status, 401);
  });
});

test('login จาก field username (query fallback เมื่อ doc id ไม่ใช่ username) → 200', async () => {
  state.adminWhereDocs = [
    { id: 'kru01@local.admin', username: 'kru01', password: 'pw-kru', name: 'ครูหนึ่ง', role: 'admin' },
  ];

  await withServer(async (baseUrl) => {
    const ok = await postJson(baseUrl, '/api/admin/login', {
      username: 'kru01', password: 'pw-kru',
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.success, true);
    assert.equal(ok.data.name, 'ครูหนึ่ง');
  });
});

test('login รหัสผ่านผิด (default creds) → 401', async () => {
  await withServer(async (baseUrl) => {
    const r = await postJson(baseUrl, '/api/admin/login', {
      username: 'admin01', password: 'wrong-pass',
    });
    assert.equal(r.status, 401);
    assert.equal(r.data.success, false);
  });
});

test('login ขาด username/password → 400', async () => {
  await withServer(async (baseUrl) => {
    const cases = [{}, { username: 'admin01' }, { password: 'admin01' }, { username: '', password: '' }];
    for (const body of cases) {
      const r = await postJson(baseUrl, '/api/admin/login', body);
      assert.equal(r.status, 400, `body ${JSON.stringify(body)} ต้องได้ 400`);
      assert.equal(r.data.success, false);
    }
  });
});

test('login ผิดเกิน 5 ครั้งใน 5 นาที → 429 (จนรหัสถูกต้อง)', async () => {
  await withServer(async (baseUrl) => {
    for (let i = 1; i <= 5; i++) {
      const r = await postJson(baseUrl, '/api/admin/login', {
        username: 'admin01', password: `wrong-${i}`,
      });
      assert.equal(r.status, 401, `ครั้งที่ ${i} ต้องได้ 401`);
    }
    const sixth = await postJson(baseUrl, '/api/admin/login', {
      username: 'admin01', password: 'wrong-6',
    });
    assert.equal(sixth.status, 429, 'ครั้งที่ 6 ต้องติด throttle');

    // ต่อให้กรอกรหัสถูกต้องก็ยังถูกบล็อกจนกว่าจะพ้นหน้าต่าง 5 นาที
    const lockedCorrect = await postJson(baseUrl, '/api/admin/login', {
      username: 'admin01', password: 'admin01',
    });
    assert.equal(lockedCorrect.status, 429);
  });
});

test('/api/admin/login เรียกได้โดยไม่มี token แต่ /api/admin/exercises → 401', async () => {
  await withServer(async (baseUrl) => {
    const login = await postJson(baseUrl, '/api/admin/login', {
      username: 'admin01', password: 'admin01',
    });
    assert.equal(login.status, 200, 'login ต้องไม่ถูก global guard บล็อก');

    const noToken = await fetch(baseUrl + '/api/admin/exercises');
    assert.equal(noToken.status, 401, 'route ที่คุ้มครองต้อง 401 เมื่อไม่มี token');

    const badToken = await fetch(baseUrl + '/api/admin/exercises', {
      headers: { Authorization: 'Bearer not.a.token' },
    });
    assert.equal(badToken.status, 401);
  });
});

// ─── POST /api/admin/session ─────────────────────────────────────────────────
test('/api/admin/session ด้วย session token จาก login → 200 + customToken ใหม่', async () => {
  await withServer(async (baseUrl) => {
    const login = await postJson(baseUrl, '/api/admin/login', {
      username: 'admin01', password: 'admin01',
    });
    assert.equal(login.status, 200);

    const sess = await postJson(baseUrl, '/api/admin/session', {}, {
      Authorization: 'Bearer ' + login.data.token,
    });
    assert.equal(sess.status, 200);
    assert.equal(sess.data.success, true);
    assert.equal(sess.data.customToken, 'mock.ct.admin01');
  });
});

test('/api/admin/session ด้วย session token ถูกดัดแปลง → 401', async () => {
  await withServer(async (baseUrl) => {
    const login = await postJson(baseUrl, '/api/admin/login', {
      username: 'admin01', password: 'admin01',
    });
    const token = login.data.token;
    const tampered = token.slice(0, -1) + (token.slice(-1) === 'A' ? 'B' : 'A');

    const sess = await postJson(baseUrl, '/api/admin/session', {}, {
      Authorization: 'Bearer ' + tampered,
    });
    assert.equal(sess.status, 401);
  });
});

test('/api/admin/session ด้วย Firebase ID token (fallback เดิม) → 200 — โมบายล์ไม่พัง', async () => {
  state.verifyIdToken = async (t) => {
    if (t !== 'valid.fb.token') throw new Error('invalid token');
    return { uid: 'fb-uid-1', email: 'admin@example.com', admin: true };
  };

  await withServer(async (baseUrl) => {
    const sess = await postJson(baseUrl, '/api/admin/session', {}, {
      Authorization: 'Bearer valid.fb.token',
    });
    assert.equal(sess.status, 200);
    assert.equal(sess.data.customToken, 'mock.ct.fb-uid-1');

    const bad = await postJson(baseUrl, '/api/admin/session', {}, {
      Authorization: 'Bearer invalid.fb.token',
    });
    assert.equal(bad.status, 401);
  });
});


