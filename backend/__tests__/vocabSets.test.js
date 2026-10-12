// backend/__tests__/vocabSets.test.js
// ตรวจโครงสร้างชุดแบบฝึกหัดคำศัพท์ 10 ชุด ก่อนเขียนลง Firestore
// Run with: node --test __tests__/vocabSets.test.js
//
// สิ่งที่การันตี (กันข้อมูลผิดพลาดถูกเขียนลง Firestore):
//   1. ทุกชุดมีคำ 4-15 ข้อ (กฎของ adminVocabularyRoutes MIN_ITEMS/MAX_ITEMS)
//   2. ครบทั้ง 4 รูปแบบฝึก: matching / spelling / listenRepeat / fillblank
//   3. ประโยคทุกอันมีคำนั้นอยู่ข้างใน (API บังคับ — adminVocabularyRoutes validatePayload)
//   4. FIB: คำและประโยคไม่ซ้ำกัน
//   5. คำทุกคำมีอยู่ในคลังคำศัพท์จริง *ระดับเดียวกัน*
//   6. distractors ไม่มีคำตอบเดียวกับคำนั้น
//   7. FIB distractors (ถ้ามี): array ≤2 ช่อง, ไม่ซ้ำ, ไม่เท่าคำตอบถูก, อยู่ในคลังระดับเดียวกัน
//   8. API (adminVocabularyRoutes): เก็บ distractors ลง Firestore แบบ dedup + จำกัดสูงสุด 2 ช่อง
//      — ครอบคลุม Step 4 Dynamic Distractors ของ VocabSet Wizard

const test   = require('node:test');
const assert = require('node:assert/strict');

const {
  VOCAB_SETS,
  splitStagePlan,
  buildAllVocabSetDocs,
  buildVocabSetDoc,
  sampleDistinct,
  mulberry32,
} = require('../scripts/vocabSetsData');

const VOCAB_POOL = require('../data/oxford_vocabulary.json');
const DOCS = buildAllVocabSetDocs(VOCAB_POOL);

// ─── โครงสร้างพื้นฐาน ───────────────────────────────────────────────────────
test('มีครบ 10 ชุด แบ่ง 5 A1 / 5 A2 และ id ไม่ซ้ำ', () => {
  assert.equal(VOCAB_SETS.length, 10);
  assert.equal(DOCS.length, 10);

  assert.equal(DOCS.filter((d) => d.level === 'A1').length, 5);
  assert.equal(DOCS.filter((d) => d.level === 'A2').length, 5);

  const ids = DOCS.map((d) => d.id);
  assert.equal(new Set(ids).size, 10, 'id ต้องไม่ซ้ำกัน');
});

test('ทุกชุดมีคำ 10 หรือ 15 ข้อ และอยู่ในกรอบ 4-15 ที่ API อนุญาต', () => {
  DOCS.forEach((d) => {
    assert.ok([10, 15].includes(d.items.length),
      `${d.id} ต้องมี 10 หรือ 15 ข้อ (ได้ ${d.items.length})`);
    assert.ok(d.items.length >= 4 && d.items.length <= 15,
      `${d.id} นอกกรอบ MIN_ITEMS..MAX_ITEMS`);
  });
});

test('ทุกชุดมี field มาตรฐานที่หน้าจอ/API ต้องการ', () => {
  DOCS.forEach((d) => {
    assert.equal(d.category, 'vocab');
    assert.equal(d.status, 'published');
    assert.equal(d.sourceVersion, 2);
    assert.equal(d.vocabularyLevel, d.level);
    assert.ok(d.title && d.title.length > 0);
    assert.ok(d.description && d.description.length > 0);
    assert.ok(['male', 'female'].includes(d.ttsSystem));
    assert.equal(d.totalQuestions,
      1 + d.questionStats.spelling + d.questionStats.listenRepeat + d.questionStats.fillBlank);
  });
});

// ─── การันตีครบทั้ง 4 รูปแบบฝึก ────────────────────────────────────────────
test('ทุกชุดครบทั้ง 4 รูปแบบฝึก (matching/spelling/listenRepeat/fillblank)', () => {
  DOCS.forEach((d) => {
    assert.equal(d.questionStats.matching, 1, `${d.id} ต้องมี matching 1 ด่าน`);
    assert.ok(d.questionStats.spelling >= 1,     `${d.id} ต้องมีด่านสะกดคำ`);
    assert.ok(d.questionStats.listenRepeat >= 1, `${d.id} ต้องมีด่านฟัง-พูดตาม`);
    assert.ok(d.questionStats.fillBlank >= 1,    `${d.id} ต้องมีด่านเติมช่องว่าง`);
  });
});

test('อาร์เรย์ของแต่ละด่านตรงกับ questionStats', () => {
  DOCS.forEach((d) => {
    assert.equal(d.spellingWords.length, d.questionStats.spelling, `${d.id} spellingWords`);
    assert.equal(d.listenRepeatWords.length, d.questionStats.listenRepeat, `${d.id} listenRepeatWords`);
    assert.equal(d.fillInBlankSentences.length, d.questionStats.fillBlank, `${d.id} fillInBlankSentences`);
  });
});

test('คำในด่านย่อยมาจากชุดเดียวกัน (ไม่มีคำนอกชุด)', () => {
  DOCS.forEach((d) => {
    const inSet = new Set(d.items.map((i) => i.wordEN));
    [...d.spellingWords, ...d.listenRepeatWords, ...d.fillInBlankSentences].forEach((w) => {
      assert.ok(inSet.has(w.wordEN), `${d.id}: "${w.wordEN}" ไม่อยู่ในชุด`);
    });
  });
});

test('คำทุกคำในชุดถูกใช้ในด่านย่อยอย่างน้อย 1 ด่าน (ไม่มีคำตกหลุด)', () => {
  DOCS.forEach((d) => {
    const used = new Set([
      ...d.spellingWords.map((w) => w.wordEN),
      ...d.listenRepeatWords.map((w) => w.wordEN),
      ...d.fillInBlankSentences.map((w) => w.wordEN),
    ]);
    d.items.forEach((i) => {
      assert.ok(used.has(i.wordEN), `${d.id}: "${i.wordEN}" ไม่ถูกใช้ในด่านไหนเลย`);
    });
  });
});

test('splitStagePlan รวมคำได้ครบและไม่มีด่านที่เป็น 0 (ขนาด 4, 10 และ 15)', () => {
  [4, 10, 15].forEach((n) => {
    const p = splitStagePlan(n);
    assert.equal(p.spelling + p.listenRepeat + p.fillBlank, n);
    assert.ok(p.spelling >= 1 && p.listenRepeat >= 1 && p.fillBlank >= 1,
      `n=${n} มีด่านที่เป็น 0`);
  });
});

// ─── กัน validation ของ backend API ────────────────────────────────────────
test('ทุก items มี wordEN และ wordTH ไม่ว่าง', () => {
  DOCS.forEach((d) => {
    d.items.forEach((i, idx) => {
      assert.ok(i.wordEN && i.wordEN.trim(), `${d.id} ข้อ ${idx + 1} ขาด wordEN`);
      assert.ok(i.wordTH && i.wordTH.trim(), `${d.id} ข้อ ${idx + 1} ขาด wordTH`);
    });
  });
});

test('ทุก sentence มีคำของตัวเอง (เงื่อนไข validate ของ API)', () => {
  DOCS.forEach((d) => {
    d.items.forEach((i) => {
      assert.ok(i.sentence.toLowerCase().includes(i.wordEN.toLowerCase()),
        `${d.id}: ประโยค "${i.sentence}" ไม่มีคำว่า "${i.wordEN}"`);
    });
  });
});

test('ทุก items มี distractors ครบ 2 คำ และไม่ซ้ำกับคำตอบตัวเอง', () => {
  DOCS.forEach((d) => {
    d.items.forEach((i) => {
      assert.equal(i.distractors.length, 2, `${d.id}/${i.wordEN} ต้องมี 2 distractors`);
      assert.ok(!i.distractors.includes(i.wordEN), `${d.id}/${i.wordEN} distractor ซ้ำคำตอบ`);
      assert.equal(new Set(i.distractors).size, 2, `${d.id}/${i.wordEN} distractor ซ้ำกัน`);
    });
  });
});

test('FIB: คำและประโยคไม่ซ้ำกัน (API throw ถ้าซ้ำ)', () => {
  DOCS.forEach((d) => {
    const words = d.fillInBlankSentences.map((f) => f.wordEN.toLowerCase());
    assert.equal(new Set(words).size, words.length, `${d.id} FIB มีคำซ้ำ`);

    const sents = d.fillInBlankSentences.map((f) => f.sentence.toLowerCase());
    assert.equal(new Set(sents).size, sents.length, `${d.id} FIB มีประโยคซ้ำ`);
  });
});

// ─── Dynamic distractors ของข้อเติมช่องว่าง (Step 4) ────────────────────────
// contract เดียวกับ cleanDistractors() ใน adminVocabularyRoutes.js:
// array ≤5 ช่อง / ไม่ซ้ำ (case-insensitive) / ไม่เท่าคำตอบถูก / อยู่ในคลังระดับเดียวกัน
test('FIB distractors (ถ้ามี) อยู่ในกรอบ: ≤5 ช่อง ไม่ซ้ำ ไม่เท่าคำตอบถูก อยู่ในคลังระดับเดียวกัน', () => {
  DOCS.forEach((d) => {
    const sameLevel = new Set(
      VOCAB_POOL.filter((v) => v.cefrLevel === d.level).map((v) => v.wordEN)
    );
    d.fillInBlankSentences.forEach((f) => {
      const dists = f.distractors ?? [];
      assert.ok(Array.isArray(dists), `${d.id}/${f.wordEN} FIB distractors ต้องเป็น array`);
      assert.ok(dists.length <= 2, `${d.id}/${f.wordEN} FIB distractors เกิน 2 ช่อง (${dists.length})`);
      assert.equal(
        new Set(dists.map((x) => String(x).toLowerCase())).size,
        dists.length,
        `${d.id}/${f.wordEN} FIB distractors ซ้ำกัน`
      );
      dists.forEach((dw) => {
        assert.notEqual(
          String(dw).toLowerCase(),
          f.wordEN.toLowerCase(),
          `${d.id}/${f.wordEN} FIB distractor เท่ากับคำตอบถูก`
        );
        assert.ok(sameLevel.has(dw), `${d.id}/${f.wordEN}: FIB distractor "${dw}" ไม่ได้ระดับ ${d.level}`);
      });
    });
  });
});

test('ทุก FIB sentence มีคำที่เติม (เงื่อนไข validate ของ API)', () => {
  DOCS.forEach((d) => {
    d.fillInBlankSentences.forEach((f) => {
      assert.ok(f.sentence.toLowerCase().includes(f.wordEN.toLowerCase()),
        `${d.id}: FIB "${f.sentence}" ไม่มีคำว่า "${f.wordEN}"`);
    });
  });
});

// ─── ยืนยันว่าคำมาจากคลังคำศัพท์จริง ───────────────────────────────────────
test('คำทุกคำมีอยู่ใน oxford_vocabulary.json ที่ระดับเดียวกันจริง', () => {
  DOCS.forEach((d) => {
    d.items.forEach((i) => {
      const hit = VOCAB_POOL.find((v) => v.wordEN === i.wordEN && v.cefrLevel === d.level);
      assert.ok(hit, `${d.id}: ไม่พบ "${i.wordEN}" ระดับ ${d.level} ในคลังคำศัพท์`);
      assert.equal(i.wordId, hit.id, `${d.id}/${i.wordEN}: wordId ไม่ตรงคลัง`);
      assert.equal(i.wordTH, hit.wordTH, `${d.id}/${i.wordEN}: wordTH ไม่ตรงคลัง`);
    });
  });
});

test('ทุกชุดอยู่ในขอบเขต CEFR A1-A2 เท่านั้น', () => {
  DOCS.forEach((d) => {
    assert.ok(['A1', 'A2'].includes(d.level), `${d.id} ระดับนอกขอบเขต`);
    d.items.forEach((i) => {
      assert.ok(['A1', 'A2'].includes(i.level), `${d.id}/${i.wordEN} item ระดับนอกขอบเขต`);
    });
  });
});

test('คำศัพท์ไม่ซ้ำกันภายในชุดเดียวกัน', () => {
  DOCS.forEach((d) => {
    const words = d.items.map((i) => i.wordEN);
    assert.equal(new Set(words).size, words.length, `${d.id} มีคำซ้ำภายในชุด`);
  });
});

test('distractors ทั้งหมดมีอยู่ในคลังคำศัพท์ระดับเดียวกัน', () => {
  DOCS.forEach((d) => {
    const sameLevel = new Set(
      VOCAB_POOL.filter((v) => v.cefrLevel === d.level).map((v) => v.wordEN)
    );
    d.items.forEach((i) => {
      i.distractors.forEach((dw) => {
        assert.ok(sameLevel.has(dw), `${d.id}/${i.wordEN}: distractor "${dw}" ไม่ได้ระดับ ${d.level}`);
      });
    });
  });
});

// ─── ความคงที่ (deterministic) ─────────────────────────────────────────────
test('buildVocabSetDoc ให้ผลเดิมทุกครั้งที่รัน (distractors ไม่พลิกเล่น)', () => {
  const a = buildVocabSetDoc(VOCAB_SETS[0], VOCAB_POOL);
  const b = buildVocabSetDoc(VOCAB_SETS[0], VOCAB_POOL);
  assert.deepEqual(a, b);
});

test('buildVocabSetDoc รับ pool ว่างได้โดยไม่พัง (ไม่มีคำในคลัง → wordTH/wordId ว่าง)', () => {
  const doc = buildVocabSetDoc(VOCAB_SETS[0], []);
  assert.equal(doc.items.length, VOCAB_SETS[0].words.length);
  assert.ok(doc.items.every((i) => i.wordTH === '' && i.wordId.startsWith('vs_')));
});

test('sampleDistinct ไม่สแกนคำใน exclude และไม่เกินจำนวนที่ขอ', () => {
  const rng = mulberry32(7);
  const out = sampleDistinct(['a', 'b', 'c', 'd'], 2, ['a'], rng);
  assert.equal(out.length, 2);
  assert.ok(!out.includes('a'));
  assert.equal(new Set(out).size, 2);

  assert.equal(sampleDistinct(['a', 'b'], 5, [], rng).length, 2); // ขอมากกว่าที่มี
  assert.deepEqual(sampleDistinct(['a', 'b'], 0, [], rng), []);   // ขอ 0
});

// ─── API: adminVocabularyRoutes — dynamic distractors (dedup + cap 2) ────────
// ยืนยันพฤติกรรมที่ Step 4 (VocabSet Wizard) พึ่งพา: เก็บ distractors ลง Firestore
// พร้อม dedup และจำกัดสูงสุด 2 ช่อง — mock firebase แบบเดียวกับ adminExerciseManual.test.js
// (node --test รันคนละ process ต่อไฟล์ → require.cache ไม่รั่วข้ามไฟล์ทดสอบ)
const http   = require('node:http');
const { once } = require('node:events');

function installFirebaseMock() {
  const state = {
    verifyIdToken: async () => ({ uid: 'u1', email: 'admin@example.com', admin: true }),
    createdDocs: [],
    nextDocId: 1,
  };
  const fakeAuth = { verifyIdToken: (token) => state.verifyIdToken(token) };

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
      delete: async () => {
        const idx = state.createdDocs.findIndex((d) => d.col === collectionName && d.id === docId);
        if (idx >= 0) state.createdDocs.splice(idx, 1);
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
        return { id, get: async () => ({ exists: true, data: () => rec.data, id }) };
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

// require AFTER mock ถูกติดตั้ง — ห้าม require route ก่อนหน้านี้
const adminVocabularyRoutes = require('../routes/adminVocabularyRoutes');

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
  app.use('/api/admin/vocabulary-sets', adminVocabularyRoutes);
  return app;
}

function authHeaders() {
  return { authorization: 'Bearer valid.token', 'Content-Type': 'application/json' };
}

function baseItems() {
  return [
    { wordEN: 'apple',  wordTH: 'แอปเปิ้ล' },
    { wordEN: 'banana', wordTH: 'กล้วย' },
    { wordEN: 'orange', wordTH: 'ส้ม' },
    { wordEN: 'grape',  wordTH: 'องุ่น' },
  ];
}

test('POST: FIB distractors ถูก dedup + ตัดเท่าคำตอบถูก + จำกัด 2 ช่อง ก่อนเขียนลง Firestore', async () => {
  state.createdDocs = [];
  state.nextDocId = 1;
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/vocabulary-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'ชุดทดสอบ dynamic distractors',
        level: 'A1',
        ttsSystem: 'female',
        playbackSpeed: 1.0,
        status: 'draft',
        items: baseItems(),
        fillInBlankSentences: [{
          wordEN: 'apple',
          wordTH: 'แอปเปิ้ล',
          sentence: 'I eat an apple every day.',
          sentenceTH: 'ฉันกินแอปเปิ้ลทุกวัน',
          // มีค่าว่าง + ซ้ำ (case-insensitive) + เท่าคำตอบถูก + เกิน 2 ช่อง
          distractors: ['banana', 'banana', ' Banana ', '', 'CAT', 'cat', 'dog', 'egg', 'fish', 'apple', 'grape'],
        }],
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);

    const stored = state.createdDocs.find((d) => d.col === 'exercises');
    assert.ok(stored, 'ต้องมีเอกสารถูกสร้างใน collection exercises');
    const fib = stored.data.fillInBlankSentences[0];
    assert.ok(Array.isArray(fib.distractors), 'FIB ต้องเก็บ distractors เป็น array');
    // trim → ตัดว่าง → dedup (เก็บ casing ตัวแรก) → cap 2 เก็บ 'banana','CAT' (ตัด 'dog'/'egg'/... ที่เกิน)
    assert.deepEqual(fib.distractors, ['banana', 'CAT']);
  } finally {
    await stopTestServer(server);
  }
});

test('POST: FIB ไม่ส่ง distractors → เก็บเป็น [] (array เสมอ ไม่ใช่ undefined)', async () => {
  state.createdDocs = [];
  state.nextDocId = 50;
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const res = await fetch(baseUrl + '/api/admin/vocabulary-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'ชุดทดสอบ FIB ไม่มี distractors',
        level: 'A1',
        ttsSystem: 'female',
        playbackSpeed: 1.0,
        status: 'draft',
        items: baseItems(),
        fillInBlankSentences: [{
          wordEN: 'banana',
          wordTH: 'กล้วย',
          sentence: 'I like banana very much.',
          sentenceTH: 'ฉันชอบกล้วยมาก',
        }],
      }),
    });
    assert.equal(res.status, 201);
    const stored = state.createdDocs.find((d) => d.col === 'exercises');
    const fib = stored.data.fillInBlankSentences[0];
    assert.ok(Array.isArray(fib.distractors), 'ต้องมี field distractors เสมอ');
    assert.equal(fib.distractors.length, 0);
  } finally {
    await stopTestServer(server);
  }
});

test('POST: items distractors ถูก dedup + ตัดเท่าคำตอบถูก + จำกัด 2 ช่อง', async () => {
  state.createdDocs = [];
  state.nextDocId = 100;
  const { server, baseUrl } = await startTestServer(makeApp());
  try {
    const items = baseItems();
    items[0] = {
      ...items[0],
      distractors: ['bag', 'bag', 'APPLE', '', 'cat', 'dog', 'egg', 'fish', 'goat', 'hat'],
    };
    const res = await fetch(baseUrl + '/api/admin/vocabulary-sets', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'ชุดทดสอบ items distractors',
        level: 'A1',
        ttsSystem: 'female',
        playbackSpeed: 1.0,
        status: 'draft',
        items,
      }),
    });
    assert.equal(res.status, 201);
    const stored = state.createdDocs.find((d) => d.col === 'exercises');
    const apple = stored.data.items.find((i) => i.wordEN === 'apple');
    // 'APPLE' = คำตอบถูก → ถูกตัด, 'bag' ซ้ำ → เหลือตัวเดียว, cap 2 เก็บ 'bag','cat' (ตัด 'dog'/'egg'/... ที่เกิน)
    assert.deepEqual(apple.distractors, ['bag', 'cat']);
    // คำอื่นที่ไม่ส่ง distractors → []
    const banana = stored.data.items.find((i) => i.wordEN === 'banana');
    assert.deepEqual(banana.distractors, []);
  } finally {
    await stopTestServer(server);
  }
});
