// backend/__tests__/vocabSets.test.js
// ตรวจโครงสร้างชุดแบบฝึกหัดคำศัพท์ 10 ชุด ก่อนเขียนลง Firestore
// Run with: node --test __tests__/vocabSets.test.js
//
// สิ่งที่การันตี (กันข้อมูลผิดพลาดถูกเขียนลง Firestore):
//   1. ทุกชุดมีคำ 4-15 ข้อ (กฎของ adminVocabularyRoutes MIN_ITEMS/MAX_ITEMS)
//   2. ครบทั้ง 4 รูปแบบฝึก: matching / spelling / listenRepeat / fillblank
//   3. ประโยคทุกอันมีคำนั้นอยู่ข้างใน (API บังคับ — adminVocabularyRoutes.js:74)
//   4. FIB: คำและประโยคไม่ซ้ำกัน
//   5. คำทุกคำมีอยู่ในคลังคำศัพท์จริง *ระดับเดียวกัน*
//   6. distractors ไม่มีคำตอบเดียวกับคำนั้น

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
