// backend/__tests__/adminListeningReadingRoutes.test.js
// Tests for Admin Listening & Reading (Dialogue) Sets API
// Run with: node --test __tests__/adminListeningReadingRoutes.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');

function installFirebaseMock() {
  const state = {
    verifyIdToken: async (token) => {
      if (token === 'valid.token') {
        return { uid: 'u1', email: 'admin@example.com', admin: true };
      }
      throw new Error('invalid token');
    },
    docs: [],
    nextDocId: 1,
  };

  const fakeAuth = {
    verifyIdToken: (token) => state.verifyIdToken(token),
  };

  function makeDocChain(collectionName, docId) {
    return {
      get: async () => {
        const existing = state.docs.find((d) => d.col === collectionName && d.id === docId);
        return {
          exists: !!existing,
          data: () => (existing ? existing.data : {}),
          id: existing ? existing.id : docId,
        };
      },
      update: async (fields) => {
        const rec = state.docs.find((d) => d.col === collectionName && d.id === docId);
        if (!rec) throw new Error('document ' + docId + ' not found');
        Object.assign(rec.data, fields);
        return rec;
      },
      delete: async () => {
        const idx = state.docs.findIndex((d) => d.col === collectionName && d.id === docId);
        if (idx !== -1) state.docs.splice(idx, 1);
      },
    };
  }

  const fakeDb = {
    collection: (name) => ({
      doc: (id) => makeDocChain(name, id),
      where: (field, op, val) => ({
        get: async () => {
          const matched = state.docs.filter((d) => d.col === name && d.data[field] === val);
          return {
            empty: matched.length === 0,
            docs: matched.map((m) => ({ id: m.id, data: () => m.data })),
          };
        },
      }),
      add: async (data) => {
        const id = 'auto_' + (state.nextDocId++);
        const rec = { col: name, id, data: { ...data } };
        state.docs.push(rec);
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

const adminListeningReadingRoutes = require('../routes/adminListeningReadingRoutes');

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
  app.use('/api/admin/listening-reading-sets', adminListeningReadingRoutes);
  return app;
}

function authHeaders() {
  return { authorization: 'Bearer valid.token', 'Content-Type': 'application/json' };
}


// เพย์โหลดตัวอย่างที่ถูกต้อง — บทสนทนา 3 ชุด (ชุดละ 2 บรรทัด + คำถาม 1 ข้อ)
function makeValidLRPayload() {
  return {
    title: 'การฟังและการดู Tense ชุดที่ 1',
    description: 'บทสนทนาสั้นในชีวิตประจำวัน',
    level: 'A2',
    status: 'published',
    speakerA: { name: 'Hanny', ttsVoice: 'male' },
    speakerB: { name: 'Jame', ttsVoice: 'female' },
    dialogues: [
      {
        lines: [
          { speaker: 'A', text: 'Hello' },
          { speaker: 'B', text: 'Hi' },
        ],
        question: {
          prompt: 'บทสนทนานี้พูดเกี่ยวกับอะไร',
          options: ['โรงเรียน', 'ทักทายทำความรู้จัก', 'อาหาร', 'กีฬา'],
          correctIndex: 1,
        },
      },
      {
        lines: [
          { speaker: 'A', text: 'What is your name?' },
          { speaker: 'B', text: 'My name is Jame' },
        ],
        question: {
          prompt: 'ใครเป็นผู้พูดคนแรก',
          options: ['Hanny', 'Jame', 'Tom', 'Sara'],
          correctIndex: 0,
        },
      },
      {
        lines: [
          { speaker: 'A', text: 'Where are you from?' },
          { speaker: 'B', text: 'I am from Thailand' },
        ],
        question: {
          prompt: 'ผู้พูดมาจากไหน',
          options: ['ไทย', 'ญี่ปุ่น', 'จีน', 'เกาหลี'],
          correctIndex: 0,
        },
      },
    ],
  };
}

test('POST /api/admin/listening-reading-sets -> 201 creates doc with 3 dialogues', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(makeValidLRPayload()),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.category, 'listening');
    assert.equal(body.data.title, 'การฟังและการดู Tense ชุดที่ 1');
    assert.equal(body.data.dialogues.length, 3);
    assert.equal(body.data.dialogues[0].lines.length, 2);
    assert.equal(body.data.dialogues[0].question.correctIndex, 1);
    assert.equal(body.data.speakerA.ttsVoice, 'male');
    assert.equal(body.data.speakerB.ttsVoice, 'female');
  } finally {
    await stopTestServer(server);
  }
});

test('GET /api/admin/listening-reading-sets returns list of sets', async () => {
  state.docs = [
    {
      col: 'exercises',
      id: 'lrx001',
      data: { title: 'ชุดที่ 1', category: 'listening', level: 'A1', status: 'published' },
    },
  ];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets', {
      headers: authHeaders(),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.count, 1);
    assert.equal(body.data[0].id, 'lrx001');
  } finally {
    await stopTestServer(server);
  }
});

test('GET /api/admin/listening-reading-sets/:id returns 200 with data when doc exists', async () => {
  state.docs = [
    {
      col: 'exercises',
      id: 'lrx002',
      data: {
        title: 'ชุดที่ 2',
        category: 'listening',
        level: 'A2',
        status: 'draft',
        questions: [],
      },
    },
  ];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets/lrx002', {
      headers: authHeaders(),
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, 'lrx002');
    assert.equal(body.data.title, 'ชุดที่ 2');
  } finally {
    await stopTestServer(server);
  }
});

test('GET /api/admin/listening-reading-sets/:id returns 404 JSON (NOT HTML) when not found', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets/nonexistent-id', {
      headers: authHeaders(),
    });
    assert.equal(res.status, 404);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /ไม่พบชุด/);
  } finally {
    await stopTestServer(server);
  }
});
test('PUT /api/admin/listening-reading-sets/:id updates set and preserves voices', async () => {
  state.docs = [
    {
      col: 'exercises',
      id: 'lrx003',
      data: {
        title: 'ชื่อเดิม',
        category: 'listening',
        level: 'A1',
        status: 'draft',
        speakerA: { name: 'Ann', ttsVoice: 'female' },
        speakerB: { name: 'Bob', ttsVoice: 'male' },
      },
    },
  ];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const payload = makeValidLRPayload();
    payload.title = 'ชื่อใหม่';
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets/lrx003', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.title, 'ชื่อใหม่');
    assert.equal(body.data.speakerA.name, 'Hanny');
    assert.equal(body.data.speakerA.ttsVoice, 'male');
    assert.equal(body.data.dialogues.length, 3);
  } finally {
    await stopTestServer(server);
  }
});

test('PUT /api/admin/listening-reading-sets/:id returns 404 when not found', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets/nonexistent-id', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(makeValidLRPayload()),
    });
    assert.equal(res.status, 404);
    const body = await res.json();
    assert.equal(body.success, false);
  } finally {
    await stopTestServer(server);
  }
});

test('DELETE /api/admin/listening-reading-sets/:id removes the set', async () => {
  state.docs = [
    {
      col: 'exercises',
      id: 'lrx004',
      data: { title: 'ชุดที่จะลบ', category: 'listening', status: 'draft' },
    },
  ];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets/lrx004', {
      method: 'DELETE',
      headers: authHeaders(),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(state.docs.length, 0);
  } finally {
    await stopTestServer(server);
  }
});

test('DELETE /api/admin/listening-reading-sets/:id returns 404 when not found', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets/nonexistent-id', {
      method: 'DELETE',
      headers: authHeaders(),
    });
    assert.equal(res.status, 404);
  } finally {
    await stopTestServer(server);
  }
});

test('POST returns 422 when title is missing', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const payload = makeValidLRPayload();
    payload.title = '';
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets', {
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

test('POST returns 422 when a dialogue has fewer than 2 lines (per doc ภาพที่ 3-64)', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const payload = makeValidLRPayload();
    payload.dialogues[0].lines = [{ speaker: 'A', text: 'Hello' }];
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /2 บรรทัด/);
  } finally {
    await stopTestServer(server);
  }
});

test('POST returns 422 when dialogues count exceeds 3', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const payload = makeValidLRPayload();
    payload.dialogues.push({
      lines: [{ speaker: 'A', text: 'One' }, { speaker: 'B', text: 'Two' }],
      question: { prompt: 'เพิ่ม', options: ['a', 'b'], correctIndex: 0 },
    });
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /ไม่เกิน 3/);
  } finally {
    await stopTestServer(server);
  }
});

test('POST returns 422 when a dialogue question has fewer than 2 options', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const payload = makeValidLRPayload();
    payload.dialogues[0].question.options = ['คำตอบเดียว'];
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.error, /บทสนทนาที่ 1/);
  } finally {
    await stopTestServer(server);
  }
});

test('POST falls back to default voices and clamps correctIndex when out of range', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const payload = makeValidLRPayload();
    payload.speakerA.ttsVoice = 'robot';
    payload.speakerB.ttsVoice = 'robot';
    payload.dialogues[0].question.correctIndex = 99;
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.speakerA.ttsVoice, 'male');
    assert.equal(body.data.speakerB.ttsVoice, 'female');
    assert.equal(body.data.dialogues[0].question.correctIndex, 0);
  } finally {
    await stopTestServer(server);
  }
});

test('POST accepts legacy dialogue[] + questions[] and converts to dialogues[]', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const legacy = {
      title: 'ชุดเก่า',
      level: 'A1',
      status: 'draft',
      speakerA: { name: 'A', ttsVoice: 'male' },
      speakerB: { name: 'B', ttsVoice: 'female' },
      dialogue: [
        { speaker: 'A', text: 'Hi' },
        { speaker: 'B', text: 'Hello' },
      ],
      questions: [
        { prompt: 'q1', options: ['a', 'b'], correctIndex: 0 },
        { prompt: 'q2', options: ['c', 'd'], correctIndex: 1 },
      ],
    };
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(legacy),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.dialogues.length, 2);
    assert.equal(body.data.dialogues[0].lines.length, 2);
    assert.equal(body.data.dialogues[0].question.prompt, 'q1');
    assert.equal(body.data.dialogues[1].question.prompt, 'q2');
  } finally {
    await stopTestServer(server);
  }
});

test('GET /api/admin/listening-reading-sets returns 401 without bearer token', async () => {
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/listening-reading-sets');
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
  } finally {
    await stopTestServer(server);
  }
});
