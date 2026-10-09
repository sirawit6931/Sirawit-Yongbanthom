// backend/__tests__/adminTenseRoutes.test.js
// Tests for Admin Tense Sets API (GET /:id, mode preservation on PUT/POST)
// Run with: node --test __tests__/adminTenseRoutes.test.js

const test   = require('node:test');
const assert = require('node:assert/strict');
const http   = require('node:http');
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

const adminTenseRoutes = require('../routes/adminTenseRoutes');

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
  app.use('/api/admin/tense-sets', adminTenseRoutes);
  return app;
}

function authHeaders() {
  return { authorization: 'Bearer valid.token', 'Content-Type': 'application/json' };
}

function makeValidTenseItems(n = 10) {
  const items = [];
  for (let i = 1; i <= n; i++) {
    items.push({
      mode: i % 2 === 0 ? 'fillBlank' : 'reorder',
      targetSentence: `Sentence number ${i}`,
      sentenceTH: `ประโยคที่ ${i}`,
      scrambledWords: ['Sentence', 'number', String(i)],
      missingWord: String(i),
      correctAnswer: `Sentence number ${i}`,
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    });
  }
  return items;
}


test('GET /api/admin/tense-sets/:id returns 200 with data when doc exists', async () => {
  state.docs = [
    {
      col: 'exercises',
      id: 'tex001',
      data: {
        title: 'Present Simple 1',
        category: 'tense',
        level: 'A1',
        tenseTag: 'Present',
        status: 'published',
        items: makeValidTenseItems(10),
      },
    },
  ];

  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/tense-sets/tex001', {
      headers: authHeaders(),
    });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/json/);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.id, 'tex001');
    assert.equal(body.data.title, 'Present Simple 1');
    assert.equal(body.data.items.length, 10);
  } finally {
    await stopTestServer(server);
  }
});

test('GET /api/admin/tense-sets/:id returns 404 JSON (NOT HTML) when not found', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/tense-sets/nonexistent-id', {
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

test('GET /api/admin/tense-sets/:id returns 401 without bearer token', async () => {
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/tense-sets/tex001');
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
  } finally {
    await stopTestServer(server);
  }
});

test('PUT /api/admin/tense-sets/:id preserves item mode on save', async () => {
  state.docs = [
    {
      col: 'exercises',
      id: 'tex002',
      data: {
        title: 'Old Title',
        category: 'tense',
        level: 'A1',
        tenseTag: 'Past',
        status: 'draft',
        items: makeValidTenseItems(10),
      },
    },
  ];

  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const items = makeValidTenseItems(10);
    items[0].mode = 'fillBlank';
    items[1].mode = 'listenRepeat';
    items[2].mode = 'reorder';

    const res = await fetch(baseUrl + '/api/admin/tense-sets/tex002', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'Updated Title',
        tenseTag: 'Past',
        status: 'published',
        items,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.items[0].mode, 'fillBlank');
    assert.equal(body.data.items[1].mode, 'listenRepeat');
    assert.equal(body.data.items[2].mode, 'reorder');

    const saved = state.docs.find((d) => d.id === 'tex002');
    assert.equal(saved.data.items[0].mode, 'fillBlank');
    assert.equal(saved.data.items[1].mode, 'listenRepeat');
    assert.equal(saved.data.items[2].mode, 'reorder');
  } finally {
    await stopTestServer(server);
  }
});

test('POST /api/admin/tense-sets supports tenseTag (Present/Past/Future) and ttsSystem', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const items = makeValidTenseItems(10);
    items[0].tenseIndicator = 'Future';
    items[0].ttsVoice = 'male';

    const res = await fetch(baseUrl + '/api/admin/tense-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'Future Simple Set 1',
        tenseTag: 'Future',
        ttsSystem: 'male',
        status: 'published',
        items,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.tenseTag, 'Future');
    assert.equal(body.data.ttsSystem, 'male');
    assert.equal(body.data.items[0].tenseIndicator, 'Future');
    assert.equal(body.data.items[0].ttsVoice, 'male');
  } finally {
    await stopTestServer(server);
  }
});

test('tenseIndicator falls back to tenseTag when invalid', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const items = makeValidTenseItems(10);
    items[0].tenseIndicator = 'InvalidTenseName';

    const res = await fetch(baseUrl + '/api/admin/tense-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'Present Set Fallback Test',
        tenseTag: 'Present',
        ttsSystem: 'female',
        items,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.items[0].tenseIndicator, 'Present');
  } finally {
    await stopTestServer(server);
  }
});

test('POST /api/admin/tense-sets generates dual-write legacy fields for User app compatibility', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const items = makeValidTenseItems(10);
    items[0].mode = 'fillBlank';
    items[0].targetSentence = 'She _____ to school every day.';
    items[0].correctAnswer = 'goes';

    const res = await fetch(baseUrl + '/api/admin/tense-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'Present Simple Dual Write',
        tenseTag: 'Present',
        ttsSystem: 'female',
        items,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);

    const first = body.data.items[0];
    // Legacy fields exist
    assert.equal(first.answer, 'goes');
    assert.equal(first.sentence, 'She ___ to school every day.'); // normalized to 3 underscores
    assert.equal(first.speakText, 'She goes to school every day.');
    assert.ok(Array.isArray(first.orderWords));
    assert.deepEqual(first.orderWords, ['She', 'goes', 'to', 'school', 'every', 'day.']);
    assert.ok(Array.isArray(first.choices));
    assert.ok(first.choices.includes('goes'));
    assert.equal(first.tenseType, 'Present Simple');
  } finally {
    await stopTestServer(server);
  }
});

test('PUT /api/admin/tense-sets/:id updates legacy choices and speakText when target/answer modified', async () => {
  state.docs = [
    {
      col: 'exercises',
      id: 'tex_legacy',
      data: {
        title: 'Legacy Set 1',
        category: 'tense',
        level: 'A1',
        tenseTag: 'Present',
        status: 'published',
        items: [
          {
            tenseType: 'Present Simple',
            tenseColor: '#5B4FCF',
            exampleEN: 'She goes to school every day.',
            exampleTH: 'เธอไปโรงเรียนทุกวัน',
            sentenceTH: 'ฉันไปโรงเรียนทุกวัน',
            sentence: 'I ___ to school every day.',
            answer: 'go',
            choices: ['go', 'went', 'going'],
            orderWords: ['I', 'go', 'to', 'school', 'every', 'day'],
            speakText: 'I go to school every day.',
            targetSentence: 'I ___ to school every day.',
            correctAnswer: 'go',
            mode: 'fillBlank',
          },
          ...makeValidTenseItems(9),
        ],
      },
    },
  ];

  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const existing = state.docs[0].data.items.slice();
    // Admin แก้ answer จาก 'go' -> 'walk'
    existing[0].targetSentence = 'I ___ to school every day.';
    existing[0].correctAnswer = 'walk';
    existing[0].missingWord = 'walk';

    const res = await fetch(baseUrl + '/api/admin/tense-sets/tex_legacy', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'Legacy Set 1 (Updated)',
        tenseTag: 'Present',
        items: existing,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    const first = body.data.items[0];
    assert.equal(first.answer, 'walk');
    assert.equal(first.speakText, 'I walk to school every day.');
    assert.ok(first.choices.includes('walk'));
    assert.equal(first.exampleEN, 'She goes to school every day.'); // preserved
    assert.equal(first.tenseColor, '#5B4FCF');                     // preserved
  } finally {
    await stopTestServer(server);
  }
});

// ── จำนวนข้อ: ชุด Tense บันทึกได้กี่ข้อก็ได้ (ต้องมีอย่างน้อย 1 ข้อ) ──

test('POST /api/admin/tense-sets accepts only 5 items (no 10-15 limit)', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/tense-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'Tense Set With 5 Items',
        tenseTag: 'Present',
        ttsSystem: 'female',
        items: makeValidTenseItems(5),
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 5);
  } finally {
    await stopTestServer(server);
  }
});

test('POST /api/admin/tense-sets accepts more than 15 items (no upper limit)', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/tense-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'Tense Set With 20 Items',
        tenseTag: 'Past',
        ttsSystem: 'male',
        items: makeValidTenseItems(20),
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 20);
  } finally {
    await stopTestServer(server);
  }
});

test('PUT /api/admin/tense-sets/:id updates a set that has only 5 items', async () => {
  state.docs = [
    {
      col: 'exercises',
      id: 'tex_small',
      data: {
        title: 'Small Set',
        category: 'tense',
        level: 'A1',
        tenseTag: 'Present',
        ttsSystem: 'female',
        status: 'published',
        items: makeValidTenseItems(5),
      },
    },
  ];

  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const existing = state.docs[0].data.items.slice();
    existing[1].targetSentence = 'She is reading a book.';
    existing[1].correctAnswer = 'She is reading a book.';

    const res = await fetch(baseUrl + '/api/admin/tense-sets/tex_small', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'Small Set (Updated)',
        tenseTag: 'Present',
        items: existing,
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 5);
    assert.equal(body.data.items[1].speakText, 'She is reading a book.');
  } finally {
    await stopTestServer(server);
  }
});

test('POST /api/admin/tense-sets rejects an empty items array (0 items)', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/tense-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title: 'Empty Set', tenseTag: 'Present', items: [] }),
    });

    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(String(body.error || ''), /อย่างน้อย 1 ข้อ/);
  } finally {
    await stopTestServer(server);
  }
});

// ── เสียงอ่านกำหนดรายข้อใน Step 2 แล้ว: ชุดไม่ต้องส่ง ttsSystem ระดับชุด (ไม่มีช่องกรอก) ──

test('POST /api/admin/tense-sets works without ttsSystem (no set-level voice field)', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/tense-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'No Set Level Voice',
        tenseTag: 'Present',
        items: makeValidTenseItems(3),
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.ttsSystem, 'female'); // backend default
    body.data.items.forEach((it) => assert.equal(it.ttsVoice, 'female'));
  } finally {
    await stopTestServer(server);
  }
});

test('per-item ttsVoice wins over the set-level fallback when ttsSystem is absent', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const items = makeValidTenseItems(3);
    items[0].ttsVoice = 'male';
    items[1].ttsVoice = 'male';
    items[2].ttsVoice = 'female';

    const res = await fetch(baseUrl + '/api/admin/tense-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title: 'Per Item Voice', tenseTag: 'Present', items }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.data.ttsSystem, 'female');
    assert.equal(body.data.items[0].ttsVoice, 'male');
    assert.equal(body.data.items[1].ttsVoice, 'male');
    assert.equal(body.data.items[2].ttsVoice, 'female');
  } finally {
    await stopTestServer(server);
  }
});

test('PUT without ttsSystem keeps existing set-level value and per-item voices', async () => {
  state.docs = [
    {
      col: 'exercises',
      id: 'tex_voice',
      data: {
        title: 'Voice Set',
        category: 'tense',
        level: 'A1',
        tenseTag: 'Present',
        ttsSystem: 'male',
        status: 'draft',
        items: makeValidTenseItems(3),
      },
    },
  ];

  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const items = state.docs[0].data.items.slice();
    items[0].ttsVoice = 'female';

    const res = await fetch(baseUrl + '/api/admin/tense-sets/tex_voice', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ title: 'Voice Set (Updated)', tenseTag: 'Present', items }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.ttsSystem, 'male'); // คงเดิม เพราะไม่ได้ส่งมา
    assert.equal(body.data.items[0].ttsVoice, 'female');
  } finally {
    await stopTestServer(server);
  }
});
// ── คำตอบที่ผิด (distractors) 2 ช่อง → choices สำหรับ Multiple Choice ใน User app ──

test('POST fillBlank keeps 2 wrong answers as choices with the correct answer', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const items = makeValidTenseItems(3);
    items[0].mode = 'fillBlank';
    items[0].targetSentence = 'She _____ to school every day.';
    items[0].correctAnswer = 'goes';
    items[0].missingWord = 'goes';
    items[0].distractors = ['go', 'going'];
    delete items[0].choices;

    const res = await fetch(baseUrl + '/api/admin/tense-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title: 'Fill Blank With Distractors', tenseTag: 'Present', items }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    const first = body.data.items[0];
    assert.deepEqual(first.distractors, ['go', 'going']);
    assert.deepEqual(first.choices, ['goes', 'go', 'going']);
    assert.equal(first.answer, 'goes');
  } finally {
    await stopTestServer(server);
  }
});

test('POST drops distractors equal to the correct answer or duplicated', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const items = makeValidTenseItems(2);
    items[0].mode = 'fillBlank';
    items[0].targetSentence = 'He _____ football every day.';
    items[0].correctAnswer = 'plays';
    items[0].missingWord = 'plays';
    items[0].distractors = ['plays', 'play', ' Play ', 'run'];

    const res = await fetch(baseUrl + '/api/admin/tense-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title: 'Sanitize Distractors', tenseTag: 'Present', items }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    const first = body.data.items[0];
    // 'plays' (ซ้ำคำตอบถูก) ถูกตัด, ' Play ' ซ้ำกับ 'play' (ไม่สนตัวพิมพ์) → เหลือ play
    assert.deepEqual(first.distractors, ['play', 'run']);
    assert.deepEqual(first.choices, ['plays', 'play', 'run']);
  } finally {
    await stopTestServer(server);
  }
});

test('POST without distractors keeps legacy choices behaviour (backward compatible)', async () => {
  state.docs = [];
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const items = makeValidTenseItems(2);
    items[0].mode = 'fillBlank';
    items[0].targetSentence = 'She will ___ you tomorrow.';
    items[0].correctAnswer = 'call';
    items[0].missingWord = 'call';
    items[0].choices = ['will', 'did', 'does']; // ชุดเก่า: ไม่มี distractors

    const res = await fetch(baseUrl + '/api/admin/tense-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title: 'Legacy Choices', tenseTag: 'Future', items }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    const first = body.data.items[0];
    assert.deepEqual(first.distractors, []);
    assert.deepEqual(first.choices, ['call', 'will', 'did', 'does']);
  } finally {
    await stopTestServer(server);
  }
});

test('PUT updates choices when wrong answers are edited', async () => {
  state.docs = [
    {
      col: 'exercises',
      id: 'tex_dist',
      data: {
        title: 'Distractor Set',
        category: 'tense',
        level: 'A1',
        tenseTag: 'Past',
        status: 'draft',
        items: makeValidTenseItems(2),
      },
    },
  ];

  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const items = state.docs[0].data.items.slice();
    items[0].mode = 'fillBlank';
    items[0].targetSentence = 'She _____ to school yesterday.';
    items[0].correctAnswer = 'went';
    items[0].missingWord = 'went';
    items[0].distractors = ['go', 'gone'];

    const res = await fetch(baseUrl + '/api/admin/tense-sets/tex_dist', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ title: 'Distractor Set (Updated)', tenseTag: 'Past', items }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.data.items[0].distractors, ['go', 'gone']);
    assert.deepEqual(body.data.items[0].choices, ['went', 'go', 'gone']);
  } finally {
    await stopTestServer(server);
  }
});