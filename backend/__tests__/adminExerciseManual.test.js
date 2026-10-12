// backend/__tests__/adminExerciseManual.test.js
// M2.4 - tests for Manual Exercise CRUD (POST / + PUT /:id with items[])
// Run with Node built-in test runner:
//   npm test          (in backend/) -> node --test __tests__/

const test   = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');
const { once } = require('node:events');

// --- mock firebase config (same strategy as authMiddleware.test.js) ---------
// We mock `../config/firebase` before requiring the router so no real network
// calls / initializeApp happen.

function installFirebaseMock() {
  const state = {
    verifyIdToken: async () => ({ uid: 'u1', email: 'admin@example.com', admin: true }),
    adminsDocExists: true,
    createdDocs: [],       // stored docs for exercises collection
    nextDocId: 1,
  };

  const fakeAuth = {
    verifyIdToken: (token) => state.verifyIdToken(token),
  };

  // In-memory Firestore mock supporting: collection(name).doc(id).get/update,
  // and collection(name).add(data)
  function makeDocChain(collectionName, docId) {
    return {
      get: async () => {
        const existing = state.createdDocs.find((d) => d.col === collectionName && d.id === docId);
        return {
          exists: !!existing,
          data: () => (existing ? existing.data : {}),
          id: existing ? existing.id : docId,
        };
      },
      update: async (fields) => {
        const rec = state.createdDocs.find((d) => d.col === collectionName && d.id === docId);
        if (!rec) throw new Error('document ' + docId + ' not found');
        Object.assign(rec.data, fields);
        return rec;
      },
    };
  }

  const fakeDb = {
    collection: (name) => ({
      doc: (id) => makeDocChain(name, id),
      where: () => ({ get: async () => ({ empty: true, docs: [] }) }),
      get: async () => ({ empty: true, docs: [] }),
      add: async (data) => {
        const id = 'auto_' + (state.nextDocId++);
        const rec = { col: name, id, data: { ...data } };
        state.createdDocs.push(rec);
        return {
          id,
          get: async () => ({ exists: true, data: () => rec.data, id }),
        };
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

// require AFTER mock is installed
const adminExerciseRoutes = require('../routes/adminExerciseRoutes');

// --- helpers ---------------------------------------------------------------
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
  app.use('/api/admin/exercises', adminExerciseRoutes);
  return app;
}

function authHeaders() {
  return { authorization: 'Bearer valid.token', 'Content-Type': 'application/json' };
}

function validManualPayload() {
  return {
    title: 'Manual vocab set A1',
    description: 'created manually',
    category: 'vocab',
    level: 'A1',
    ttsSystem: 'female',
    status: 'draft',
    items: [
      // spec (6.1.5) + SCHEMA.md: vocab ต้องมี 10–15 ข้อต่อชุด — fixture จึงต้องมีอย่างน้อย 10 ข้อ
      // (3 ข้อเดิมใน index 0–2 ยังคงไว้ให้ assertions เดิมใช้ได้)
      { wordEN: 'apple', wordTH: 'แอปเปิล', sentence: 'I eat an apple.', sentenceTH: 'ฉันกินแอปเปิล', distractors: ['banana', 'mango'] },
      { wordEN: 'dog', wordTH: 'สุนัข', sentence: 'The dog runs.', sentenceTH: 'สุนัขวิ่ง', distractors: [] },
      { wordEN: 'cat', wordTH: 'แมว', sentence: '', sentenceTH: '', distractors: ['dog'] },
      { wordEN: 'book', wordTH: 'หนังสือ', sentence: 'This is a book.', sentenceTH: 'นี่คือหนังสือ', distractors: ['pen'] },
      { wordEN: 'school', wordTH: 'โรงเรียน', sentence: 'I go to school.', sentenceTH: 'ฉันไปโรงเรียน', distractors: ['home', 'park'] },
      { wordEN: 'water', wordTH: 'น้ำ', sentence: 'Drink water.', sentenceTH: 'ดื่มน้ำ', distractors: [] },
      { wordEN: 'house', wordTH: 'บ้าน', sentence: 'My house is big.', sentenceTH: 'บ้านของฉันหลังใหญ่', distractors: ['home'] },
      { wordEN: 'tree', wordTH: 'ต้นไม้', sentence: 'The tree is tall.', sentenceTH: 'ต้นไม้สูง', distractors: ['plant', 'leaf'] },
      { wordEN: 'car', wordTH: 'รถยนต์', sentence: 'The car is red.', sentenceTH: 'รถยนต์สีแดง', distractors: [] },
      { wordEN: 'bird', wordTH: 'นก', sentence: 'A bird sings.', sentenceTH: 'นกกำลังร้องเพลง', distractors: ['fish'] },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════════
// POST /api/admin/exercises - create manual exercise with custom items[]
// ══════════════════════════════════════════════════════════════════════════

test('POST /api/admin/exercises with manual payload -> 201 creates doc with items[]', async () => {
  state.createdDocs = [];
  state.nextDocId = 1;
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/exercises', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(validManualPayload()),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.id);
    assert.equal(body.data.title, 'Manual vocab set A1');
    assert.equal(body.data.category, 'vocab');
    assert.equal(body.data.level, 'A1');
    assert.equal(body.data.source, 'manual');
    assert.ok(Array.isArray(body.data.items));
    assert.equal(body.data.items.length, 10);
    assert.deepEqual(body.data.items[0].distractors, ['banana', 'mango']);
    assert.deepEqual(body.data.items[2].distractors, ['dog']);
    assert.equal(state.createdDocs.length, 1);
  } finally {
    await stopTestServer(server);
  }
});

test('POST /api/admin/exercises without token -> 401', async () => {
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validManualPayload()),
    });
    assert.equal(res.status, 401);
  } finally {
    await stopTestServer(server);
  }
});

test('POST /api/admin/exercises with empty items -> 422', async () => {
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const payload = validManualPayload();
    payload.items = [];
    const res = await fetch(baseUrl + '/api/admin/exercises', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);
  } finally {
    await stopTestServer(server);
  }
});

test('POST /api/admin/exercises with invalid level -> 422', async () => {
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const payload = validManualPayload();
    payload.level = 'B2';
    const res = await fetch(baseUrl + '/api/admin/exercises', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 422);
  } finally {
    await stopTestServer(server);
  }
});

test('POST /api/admin/exercises with item missing wordTH -> 422', async () => {
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const payload = validManualPayload();
    payload.items[1].wordTH = '   ';
    const res = await fetch(baseUrl + '/api/admin/exercises', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 422);
  } finally {
    await stopTestServer(server);
  }
});

test('POST dynamic distractors: keeps up to 5, drops dup + correct answer', async () => {
  state.createdDocs = [];
  state.nextDocId = 1;
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const payload = validManualPayload();
    // ข้อแรก: ส่งมา 6 ช่อง มีซ้ำคำตอบถูก (APPLE) + ซ้ำกันเอง (banana) → เหลือ habit/hair/half/banana/mango
    payload.items[0].distractors = ['habit', 'hair', 'APPLE', 'banana', 'banana', 'half', 'mango'];
    // ข้อสอง: ว่าง [] → ต้องผ่านและได้ [] (สุ่มอัตโนมัติตอนสอบ)
    payload.items[1].distractors = [];
    const res = await fetch(baseUrl + '/api/admin/exercises', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.items[0].distractors, ['habit', 'hair', 'banana', 'half', 'mango']);
    assert.deepEqual(body.data.items[1].distractors, []);
  } finally {
    await stopTestServer(server);
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PUT /api/admin/exercises/:id - update items[] + metadata
// ══════════════════════════════════════════════════════════════════════════

test('PUT /api/admin/exercises/:id replaces items[] and title -> 200', async () => {
  state.createdDocs = [];
  state.nextDocId = 100;
  state.createdDocs.push({
    col: 'exercises',
    id: 'manual_1',
    data: {
      title: 'Old title',
      category: 'vocab',
      level: 'A1',
      items: [{ wordEN: 'apple', wordTH: 'apfel' }],
    },
  });

  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/exercises/manual_1', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'Updated title',
        category: 'vocab',
        level: 'A1',
        items: [
          // PUT ตรวจด้วย validator เดียวกับ POST (ต้อง 10–15 ข้อ) — วาง orange ไว้ index 2 ให้ assertion เดิม
          { wordEN: 'apple', wordTH: 'แอปเปิล' },
          { wordEN: 'banana', wordTH: 'กล้วย' },
          { wordEN: 'orange', wordTH: 'ส้ม' },
          { wordEN: 'grape', wordTH: 'องุ่น' },
          { wordEN: 'mango', wordTH: 'มะม่วง' },
          { wordEN: 'lemon', wordTH: 'มะนาว' },
          { wordEN: 'peach', wordTH: 'ลูกพีช' },
          { wordEN: 'melon', wordTH: 'แตงโม' },
          { wordEN: 'berry', wordTH: 'เบอร์รี' },
          { wordEN: 'kiwi', wordTH: 'กีวี' },
        ],
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.title, 'Updated title');
    assert.equal(body.data.items.length, 10);
    assert.equal(body.data.items[2].wordEN, 'orange');
  } finally {
    await stopTestServer(server);
  }
});

test('PUT /api/admin/exercises/:id with empty items -> 422 (cannot wipe items)', async () => {
  state.createdDocs = [];
  state.nextDocId = 200;
  state.createdDocs.push({
    col: 'exercises',
    id: 'manual_2',
    data: { title: 'Exists', category: 'vocab', level: 'A1', items: [] },
  });
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/exercises/manual_2', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ items: [] }),
    });
    assert.equal(res.status, 422);
  } finally {
    await stopTestServer(server);
  }
});

test('PUT /api/admin/exercises/:id for missing doc -> 404', async () => {
  state.createdDocs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/exercises/not_exist', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ title: 'x' }),
    });
    assert.equal(res.status, 404);
  } finally {
    await stopTestServer(server);
  }
});

test('PUT /api/admin/exercises/:id publish only (status) still works -> 200', async () => {
  state.createdDocs = [];
  state.nextDocId = 300;
  state.createdDocs.push({
    col: 'exercises',
    id: 'manual_3',
    data: { title: 'Draft', category: 'vocab', level: 'A1', status: 'draft', items: [] },
  });
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/exercises/manual_3', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ status: 'published' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'published');
  } finally {
    await stopTestServer(server);
  }
});