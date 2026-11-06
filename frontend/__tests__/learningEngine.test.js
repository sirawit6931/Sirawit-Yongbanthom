// frontend/__tests__/learningEngine.test.js
//
// Property-based + unit tests สำหรับ `frontend/utils/learningEngine.js`:
//   - Property 1-3: shuffleStages — structure / matching-first / permutation completeness
//   - Property 4:   buildFillBlankChoices — choices integrity (correct once, own pool only)
//   - Property 5-6: buildQuizSession / sampleWithoutReplacement — no dup, size bound, level filter
//   - Unit: normalizeExerciseItem mapping, filterUsableItems, deterministic RNG
//   - Dynamic distractors (VocabSet Step 4): admin distractors ≤5 ช่อง ผ่าน buildQuizSession/makeCard
//
// learningEngine.js เป็น pure module (ไม่ import RN/Firebase) จึง import โดยตรง

const fc = require('fast-check');
const le = require('../utils/learningEngine');

const {
  shuffleStages,
  buildFillBlankChoices,
  buildQuizSession,
  sampleWithoutReplacement,
  pickDistractors,
  normalizeExerciseItem,
  filterUsableItems,
  shuffle,
} = le;

// deterministic stub RNG: linear-congruential ใน [0,1)
function makeSeqRng(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s % 100000) / 100000;
  };
}

// ─────────────────── stages sequencer ───────────────────
describe('learningEngine — stages sequencer', () => {
  test('Property 1: shuffleStages returns length 4 with all stages, no duplicates', () => {
    const expected = new Set(['matching', 'spelling', 'fillblank', 'pronunciation']);
    fc.assert(
      fc.property(fc.constant(null), () => {
        const result = shuffleStages();
        expect(result).toHaveLength(4);
        expect(new Set(result)).toEqual(expected);
      }),
      { numRuns: 100 }
    );
  });

  test('Property 2: result[0] is always matching', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        expect(shuffleStages()[0]).toBe('matching');
      }),
      { numRuns: 200 }
    );
  });

  test('Property 3: all 6 permutations of tail appear over 600 runs (no locked-out ordering)', () => {
    const seen = new Set();
    for (let i = 0; i < 600; i++) seen.add(shuffleStages().slice(1).join(','));
    expect(seen.size).toBe(6);
  });

  test('shuffleStages respects an injected rng (deterministic under same seed)', () => {
    expect(shuffleStages(makeSeqRng(1))).toEqual(shuffleStages(makeSeqRng(1)));
  });

  test('shuffle does not mutate its input array', () => {
    const input = Object.freeze([1, 2, 3, 4, 5]);
    const out = shuffle(input, makeSeqRng(3));
    expect(out).toHaveLength(5);
    expect([...new Set(out)].length).toBe(5);
  });
});

// ─────────────── choices integrity (FillBlank) ───────────────
describe('learningEngine — choices integrity (FillBlank)', () => {
  test('Property 4a: choices always contain the correct wordEN exactly once', () => {
    const item = { wordEN: 'apple', distractors: ['bag', 'cat', 'dog'] };
    fc.assert(
      fc.property(fc.constant(item), () => {
        expect(buildFillBlankChoices(item).filter((c) => c === 'apple')).toHaveLength(1);
      }),
      { numRuns: 50 }
    );
  });

  test('Property 4b: choices never contain wordEN values from other items', () => {
    const item = { wordEN: 'apple', distractors: ['bag', 'cat'] };
    const otherWords = new Set(['dog', 'egg', 'fish']);
    fc.assert(
      fc.property(fc.constant(item), () => {
        for (const c of buildFillBlankChoices(item)) expect(otherWords.has(c)).toBe(false);
      }),
      { numRuns: 50 }
    );
  });

  test('Property 4c: choices is a permutation of correct + up-to-5 distractors', () => {
    const item = { wordEN: 'x', distractors: ['a', 'b', 'c', 'd', 'e', 'f'] };
    fc.assert(
      fc.property(fc.constant(item), () => {
        expect(new Set(buildFillBlankChoices(item))).toEqual(new Set(['x', 'a', 'b', 'c', 'd', 'e']));
      }),
      { numRuns: 50 }
    );
  });

  test('keeps up to 5 custom distractors (dynamic)', () => {
    const item = { wordEN: 'apple', distractors: ['b1', 'b2', 'b3', 'b4', 'b5'] };
    expect(new Set(buildFillBlankChoices(item))).toEqual(new Set(['apple', 'b1', 'b2', 'b3', 'b4', 'b5']));
  });

  test('handles empty distractors without crashing', () => {
    expect(buildFillBlankChoices({ wordEN: 'only' })).toEqual(['only']);
  });
});
// ─────────────────── sampling ───────────────────
describe('learningEngine — sampling', () => {
  test('no duplicate ids in sampleWithoutReplacement', () => {
    const pool = Array.from({ length: 30 }, (_, i) => `w${i}`);
    for (let k = 0; k < 50; k++) {
      const sample = sampleWithoutReplacement(pool, 10);
      expect(new Set(sample).size).toBe(10);
    }
  });

  test('returns all items (shuffled) when size >= pool length', () => {
    const pool = ['a', 'b', 'c'];
    const sample = sampleWithoutReplacement(pool, 10);
    expect(sample).toHaveLength(3);
    expect([...sample].sort()).toEqual(['a', 'b', 'c']);
  });

  test('pickDistractors excludes the target and returns requested count', () => {
    const pool = [{ wordEN: 'a' }, { wordEN: 'b' }, { wordEN: 'c' }, { wordEN: 'd' }];
    for (let k = 0; k < 50; k++) {
      const dist = pickDistractors(pool, 'a', 2);
      expect(dist).toHaveLength(2);
      expect(dist.includes('a')).toBe(false);
    }
  });

  test('returns empty when pool too small or size 0', () => {
    expect(pickDistractors([{ wordEN: 'a' }], 'a', 2)).toEqual([]);
    expect(sampleWithoutReplacement(['x'], 0)).toEqual([]);
  });
});

// ─────────────── quiz session generation (vocab) ───────────────
describe('learningEngine — quiz session generation (vocab)', () => {
  const vocabPool = Array.from({ length: 50 }, (_, i) => ({
    id: `word_${i}`,
    wordEN: `word${i}`,
    wordTH: `แปล${i}`,
    cefrLevel: i < 25 ? 'A1' : 'A2',
  }));

  test('buildQuizSession returns exactly N items (N = target size)', () => {
    const session = buildQuizSession({ exercise: { category: 'vocab', level: 'A1' }, vocabPool, size: 10 });
    expect(session.items).toHaveLength(10);
    const session15 = buildQuizSession({ exercise: { category: 'vocab', level: 'A1' }, vocabPool, size: 15 });
    expect(session15.items).toHaveLength(15);
  });

  test('first item is a matching card with up to 10 pairs (10 available in pool)', () => {
    const session = buildQuizSession({ exercise: { category: 'vocab', level: 'A1' }, vocabPool, size: 10 });
    const first = session.items[0];
    expect(first.isMatchingCard).toBe(true);
    expect(first.matchingPairs).toHaveLength(10);
    for (const pair of first.matchingPairs) {
      expect(pair.wordEN).toBeTruthy();
      expect(pair.wordTH).toBeTruthy();
    }
  });

  test('small dataset (<10 pairs) → matching uses all available pairs dynamically', () => {
    const smallPool = Array.from({ length: 7 }, (_, i) => ({
      id: `small_${i}`, wordEN: `w${i}`, wordTH: `แปล${i}`, cefrLevel: 'A1',
    }));
    const session = buildQuizSession({ exercise: { category: 'vocab', level: 'A1' }, vocabPool: smallPool, size: 10 });
    const first = session.items[0];
    expect(first.isMatchingCard).toBe(true);
    // 7 คู่จาก dataset → ได้ 7 คู่พอดี ไม่ error
    expect(first.matchingPairs).toHaveLength(7);
    expect(session.items).toHaveLength(7); // 1 matching + 6 individual
  });

  test('dataset >10 pairs → matching capped at 10 pairs', () => {
    const bigPool = Array.from({ length: 20 }, (_, i) => ({
      id: `big_${i}`, wordEN: `w${i}`, wordTH: `แปล${i}`, cefrLevel: 'A1',
    }));
    const session = buildQuizSession({ exercise: { category: 'vocab', level: 'A1' }, vocabPool: bigPool, size: 15 });
    expect(session.items[0].matchingPairs).toHaveLength(10);
  });

  test('remaining items are individual question cards with questionType', () => {
    const session = buildQuizSession({ exercise: { category: 'vocab', level: 'A1' }, vocabPool, size: 10 });
    const individual = session.items.slice(1);
    expect(individual).toHaveLength(9);
    const validTypes = new Set(['spelling', 'pronunciation', 'fillblank']);
    for (const card of individual) {
      expect(card.isMatchingCard).toBe(false);
      expect(validTypes.has(card.questionType)).toBe(true);
      expect(card.wordEN).toBeTruthy();
      expect(card.wordTH).toBeTruthy();
    }
  });

  test('Property 5: respects CEFR level filter (A1 pool only)', () => {
    const session = buildQuizSession({ exercise: { category: 'vocab', level: 'A1' }, vocabPool, size: 20 });
    // matching pairs + individual cards all come from A1 pool
    const allWords = [
      ...session.items[0].matchingPairs,
      ...session.items.slice(1).map((c) => ({ wordEN: c.wordEN, cefrLevel: c.cefrLevel })),
    ];
    for (const it of allWords) {
      const src = vocabPool.find((v) => v.wordEN === it.wordEN);
      expect(src.cefrLevel).toBe('A1');
    }
  });

  test('every generated item has its own wordEN present once in fill-blank choices', () => {
    const session = buildQuizSession({ exercise: { category: 'vocab', level: 'A2' }, vocabPool, size: 8 });
    for (const it of session.items.slice(1).filter((c) => c.questionType === 'fillblank')) {
      expect(buildFillBlankChoices(it).includes(it.wordEN)).toBe(true);
    }
  });

  test('tense/listening categories pass through existing items (capped by size)', () => {
    const ex = { category: 'tense', level: 'A2', items: [{ id: 't1' }, { id: 't2' }, { id: 't3' }] };
    const session = buildQuizSession({ exercise: ex, size: 2 });
    expect(session.items).toHaveLength(2);
  });

  test('unknown category produces empty items (no crash)', () => {
    expect(buildQuizSession({ exercise: { category: 'math' }, vocabPool }).items).toEqual([]);
  });
});

// ─────────────── normalize & filter ───────────────
describe('learningEngine — normalize & filter', () => {
  test('normalizeExerciseItem maps legacy fields', () => {
    const n = normalizeExerciseItem({ id: 'x1', word: 'Dog', translation: 'สุนัข', sentence: 'Hi' });
    expect(n.wordId).toBe('x1');
    expect(n.wordEN).toBe('Dog');
    expect(n.wordTH).toBe('สุนัข');
    expect(n.sentence).toBe('Hi');
    expect(n.distractors).toEqual([]);
  });

  test('normalizeExerciseItem keeps canonical fields', () => {
    const n = normalizeExerciseItem({ wordId: 'y', wordEN: 'a', wordTH: 'b', distractors: ['c'] });
    expect(n.wordId).toBe('y');
    expect(n.distractors).toEqual(['c']);
  });

  test('filterUsableItems drops items missing wordEN/wordTH', () => {
    const items = [
      { wordId: '1', wordEN: 'ok', wordTH: 'ดี' },
      { wordId: '2', wordEN: '   ', wordTH: 'x' },
      { wordId: '3', wordEN: 'y' }, // no wordTH
      null,
    ];
    const usable = filterUsableItems(items);
    expect(usable).toHaveLength(1);
    expect(usable[0].wordId).toBe('1');
  });

  test('Property 6: usable items all have non-empty trimmed wordEN/wordTH', () => {
    const items = Array.from({ length: 20 }, (_, i) => (i % 3 === 0
      ? { wordId: `i${i}`, wordEN: '', wordTH: 'ดี' }
      : { wordId: `i${i}`, wordEN: `w${i}`, wordTH: `แปล${i}` }));
    for (const it of filterUsableItems(items)) {
      expect(it.wordEN.trim().length).toBeGreaterThan(0);
      expect(it.wordTH.trim().length).toBeGreaterThan(0);
    }
  });
});
// ─────────────── M1.3 call-style overload ───────────────
describe('learningEngine — buildQuizSession array overload (service M1.3)', () => {
  const pool = [
    { id: 'v1', wordEN: 'apple',  wordTH: 'แอปเปิ้ล', cefrLevel: 'A1' },
    { id: 'v2', wordEN: 'bag',    wordTH: 'กระเป๋า',   cefrLevel: 'A1' },
    { id: 'v3', wordEN: 'cat',    wordTH: 'แมว',       cefrLevel: 'A1' },
    { id: 'v4', wordEN: 'dog',    wordTH: 'สุนัข',     cefrLevel: 'A1' },
    { id: 'v5', wordEN: 'egg',    wordTH: 'ไข่',       cefrLevel: 'A1' },
    { id: 'v6', wordEN: 'fish',   wordTH: 'ปลา',       cefrLevel: 'A1' },
    { id: 'v7', wordEN: 'goat',   wordTH: 'แพะ',       cefrLevel: 'A1' },
    { id: 'v8', wordEN: 'hat',    wordTH: 'หมวก',      cefrLevel: 'A1' },
    { id: 'v9', wordEN: 'ice',    wordTH: 'น้ำแข็ง',    cefrLevel: 'A1' },
    { id: 'v10', wordEN: 'juice', wordTH: 'น้ำผลไม้',   cefrLevel: 'A1' },
  ];

  test('supports buildQuizSession(vocabPool, { targetSize }) — items respect size', () => {
    const { items } = buildQuizSession(pool, { targetSize: 10 });
    expect(items).toHaveLength(10);
    expect(items[0].isMatchingCard).toBe(true);
    expect(items[0].matchingPairs).toHaveLength(10);
    const ids = items.map((it) => it.wordId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const it of items) {
      expect(it.wordEN).toBeTruthy();
      expect(it.wordTH).toBeTruthy();
    }
  });

  test('remaining items are individual question cards with questionType', () => {
    const { items } = buildQuizSession(pool, { targetSize: 10 });
    const individual = items.slice(1);
    expect(individual).toHaveLength(9);
    const types = new Set(individual.map((it) => it.questionType));
    expect(types).toEqual(new Set(['spelling', 'pronunciation', 'fillblank']));
  });

  test('distractors per individual card exclude its own wordEN', () => {
    const { items } = buildQuizSession(pool, { targetSize: 10 });
    const individual = items.slice(1);
    for (const it of individual) {
      expect(Array.isArray(it.distractors)).toBe(true);
      expect(it.distractors.includes(it.wordEN)).toBe(false);
      expect(it.distractors.length).toBeLessThanOrEqual(2);
    }
  });

  test('omitting targetSize defaults to 10 (pool smaller → returns whole pool)', () => {
    const { items } = buildQuizSession(pool);
    expect(items).toHaveLength(10);
  });
});

// ─────────────── ttsVoice propagation (Hybrid Voice: Vocab) ───────────────
// ทุกการ์ดต้องมี ttsVoice เพื่อส่งต่อเข้า speakEnglish(text, voice)
// ลำดับความสำคัญ: per-item (w.ttsVoice) → เพศเสียงของชุด (ex.ttsSystem) → '' (โทนปกติ)
describe('learningEngine — ttsVoice propagation', () => {
  const pool = [
    { wordId: 'w1', wordEN: 'apple', wordTH: 'แอปเปิ้ล', level: 'A1', ttsVoice: 'female' },
    { wordId: 'w2', wordEN: 'book',  wordTH: 'หนังสือ', level: 'A1', ttsVoice: 'male' },
    { wordId: 'w3', wordEN: 'cat',   wordTH: 'แมว',     level: 'A1' }, // ไม่มี voice → ใช้ของชุด
  ];

  test('normalizeExerciseItem keeps ttsVoice and defaults to an empty string', () => {
    const withVoice = normalizeExerciseItem({ wordId: 'x', wordEN: 'a', wordTH: 'b', ttsVoice: 'male' });
    expect(withVoice.ttsVoice).toBe('male');

    const withoutVoice = normalizeExerciseItem({ wordId: 'y', wordEN: 'a', wordTH: 'b' });
    expect(withoutVoice.ttsVoice).toBe('');
  });

  test('matching pairs carry the per-item ttsVoice (or the set voice as fallback)', () => {
    const { items } = buildQuizSession({
      exercise: { category: 'vocab', level: 'A1', ttsSystem: 'female' },
      vocabPool: pool,
      size: 3,
      rng: makeSeqRng(3),
    });
    const pairs = items[0].matchingPairs;
    expect(pairs.length).toBe(3);
    for (const p of pairs) {
      expect(['female', 'male']).toContain(p.ttsVoice);
    }
  });

  test('per-item ttsVoice wins over exercise.ttsSystem', () => {
    const { items } = buildQuizSession({
      exercise: { category: 'vocab', level: 'A1', ttsSystem: 'female' },
      vocabPool: [{ wordId: 'm1', wordEN: 'dog', wordTH: 'สุนัข', level: 'A1', ttsVoice: 'male' }],
      size: 1,
      rng: makeSeqRng(9),
    });
    expect(items[0].matchingPairs.every((p) => p.ttsVoice === 'male')).toBe(true);
  });

  test('spelling cards without per-word voice fall back to exercise.ttsSystem', () => {
    const { items } = buildQuizSession({
      exercise: { category: 'vocab', level: 'A1', ttsSystem: 'male' },
      vocabPool: pool,
      size: 3,
      rng: makeSeqRng(5),
      spellingWords: [{ wordEN: 'apple', wordTH: 'แอปเปิ้ล' }],
    });
    const spelling = items.slice(1).filter((c) => c.questionType === 'spelling');
    expect(spelling.length).toBeGreaterThan(0);
    for (const c of spelling) expect(c.ttsVoice).toBe('male');
  });

  test('auto-generated cards (no admin config) also carry the set voice', () => {
    const voiceLessPool = [
      { wordId: 'a1', wordEN: 'apple', wordTH: 'แอปเปิ้ล', level: 'A1' },
      { wordId: 'a2', wordEN: 'book',  wordTH: 'หนังสือ', level: 'A1' },
      { wordId: 'a3', wordEN: 'cat',   wordTH: 'แมว',     level: 'A1' },
    ];
    const { items } = buildQuizSession({
      exercise: { category: 'vocab', level: 'A1', ttsSystem: 'male' },
      vocabPool: voiceLessPool,
      size: 3,
      rng: makeSeqRng(13),
    });
    const individual = items.slice(1);
    expect(individual.length).toBeGreaterThan(0);
    for (const c of individual) expect(c.ttsVoice).toBe('male');
  });

  test('falls back to an empty ttsVoice (neutral pitch) when the set has no ttsSystem', () => {
    const { items } = buildQuizSession({
      exercise: { category: 'vocab', level: 'A1' },
      vocabPool: [{ wordId: 'n1', wordEN: 'egg', wordTH: 'ไข่', level: 'A1' }],
      size: 1,
      rng: makeSeqRng(11),
    });
    expect(items[0].matchingPairs[0].ttsVoice).toBe('');
  });
});

// ─────────── dynamic admin distractors (engine รองรับสูงสุด 5 ช่อง) ───────────
// makeCard (เส้นทาง admin-configured) ต้อง: dedup → ตัดเท่าคำตอบถูก → cap 5
// (ปัจจุบัน VocabSet Step 4 ส่งมา ≤2 ส่วน Manual Exercise ยังตั้งได้ถึง 5)
// และสุ่มเสริมจาก pool ให้ครบ 2 เฉพาะเมื่อ admin ตั้งมา < 2 เท่านั้น
describe('learningEngine — dynamic admin distractors (max 5)', () => {
  const pool = [
    { id: 'v1', wordEN: 'apple',  wordTH: 'แอปเปิ้ล', cefrLevel: 'A1' },
    { id: 'v2', wordEN: 'bag',    wordTH: 'กระเป๋า',   cefrLevel: 'A1' },
    { id: 'v3', wordEN: 'cat',    wordTH: 'แมว',       cefrLevel: 'A1' },
    { id: 'v4', wordEN: 'dog',    wordTH: 'สุนัข',     cefrLevel: 'A1' },
    { id: 'v5', wordEN: 'egg',    wordTH: 'ไข่',        cefrLevel: 'A1' },
    { id: 'v6', wordEN: 'fish',   wordTH: 'ปลา',       cefrLevel: 'A1' },
    { id: 'v7', wordEN: 'goat',   wordTH: 'แพะ',        cefrLevel: 'A1' },
    { id: 'v8', wordEN: 'hat',    wordTH: 'หมวก',      cefrLevel: 'A1' },
    { id: 'v9', wordEN: 'ice',    wordTH: 'น้ำแข็ง',   cefrLevel: 'A1' },
    { id: 'v10', wordEN: 'juice', wordTH: 'น้ำผลไม้',  cefrLevel: 'A1' },
  ];

  // adminConfigured = มี questionStats → สร้างการ์ดตรงตาม config (ไม่สุ่มชนิดคำถาม)
  const sessionWith = ({ fib = [], spelling = [] }) => buildQuizSession({
    exercise: {
      category: 'vocab',
      level: 'A1',
      ttsSystem: 'female',
      questionStats: { matching: 1, spelling: spelling.length, listenRepeat: 0, fillBlank: fib.length },
    },
    vocabPool: pool,
    size: 1 + spelling.length + fib.length,
    rng: makeSeqRng(5),
    spellingWords: spelling,
    fillInBlankSentences: fib,
  });

  const firstOfType = (items, type) => items.find((c) => c.questionType === type);

  test('FIB ที่ admin ตั้งครบ 5 ช่อง → ใช้ของ admin ทั้งหมด ไม่สุ่มเสริม', () => {
    const { items } = sessionWith({
      fib: [{
        wordEN: 'apple',
        wordTH: 'แอปเปิ้ล',
        sentence: 'I eat an apple every day.',
        sentenceTH: 'ฉันกินแอปเปิ้ลทุกวัน',
        distractors: ['bag', 'cat', 'dog', 'egg', 'fish'],
      }],
    });
    const card = firstOfType(items, 'fillblank');
    expect(card).toBeTruthy();
    expect(card.distractors).toHaveLength(5);
    expect(new Set(card.distractors)).toEqual(new Set(['bag', 'cat', 'dog', 'egg', 'fish']));
    expect(card.distractors).not.toContain('apple');
  });

  test('ตัดคำตอบถูกออกจาก distractors แล้วสุ่มเสริมให้ครบ 2 (admin ตั้ง 1 ช่อง)', () => {
    const { items } = sessionWith({
      fib: [{
        wordEN: 'apple',
        wordTH: 'แอปเปิ้ล',
        sentence: 'I eat an apple every day.',
        sentenceTH: 'ฉันกินแอปเปิ้ลทุกวัน',
        distractors: ['apple', 'bag'],
      }],
    });
    const card = firstOfType(items, 'fillblank');
    expect(card.distractors).toHaveLength(2);
    expect(card.distractors).toContain('bag');
    expect(card.distractors).not.toContain('apple');
    // ตัวเสริมต้องมาจาก pool และไม่ซ้ำกับของ admin
    for (const d of card.distractors) {
      if (d !== 'bag') expect(pool.some((w) => w.wordEN === d)).toBe(true);
    }
  });

  test('admin ไม่ตั้ง distractors → สุ่มเสริมจาก pool ครบ 2 ช่อง (ไม่รวมคำตอบถูก)', () => {
    const { items } = sessionWith({
      fib: [{
        wordEN: 'apple',
        wordTH: 'แอปเปิ้ล',
        sentence: 'I eat an apple every day.',
        sentenceTH: 'ฉันกินแอปเปิ้ลทุกวัน',
        distractors: [],
      }],
    });
    const card = firstOfType(items, 'fillblank');
    expect(card.distractors).toHaveLength(2);
    expect(new Set(card.distractors).size).toBe(2);
    expect(card.distractors).not.toContain('apple');
    for (const d of card.distractors) expect(pool.some((w) => w.wordEN === d)).toBe(true);
  });

  test('distractors เกิน 5 ช่อง → ถูกตัดเหลือ 5 (slice ก่อนสุ่มเสริม)', () => {
    const { items } = sessionWith({
      fib: [{
        wordEN: 'apple',
        wordTH: 'แอปเปิ้ล',
        sentence: 'I eat an apple every day.',
        sentenceTH: 'ฉันกินแอปเปิ้ลทุกวัน',
        distractors: ['bag', 'cat', 'dog', 'egg', 'fish', 'goat', 'hat'],
      }],
    });
    const card = firstOfType(items, 'fillblank');
    expect(card.distractors).toHaveLength(5);
    expect(new Set(card.distractors)).toEqual(new Set(['bag', 'cat', 'dog', 'egg', 'fish']));
  });

  test('การ์ด spelling ของด่านอื่นก็ใช้ admin distractors ได้ (max 5)', () => {
    const { items } = sessionWith({
      spelling: [{ wordEN: 'bag', wordTH: 'กระเป๋า', distractors: ['cat', 'dog', 'egg', 'fish', 'goat', 'hat'] }],
    });
    const card = firstOfType(items, 'spelling');
    expect(card).toBeTruthy();
    expect(card.distractors).toHaveLength(5);
    expect(new Set(card.distractors)).toEqual(new Set(['cat', 'dog', 'egg', 'fish', 'goat']));
    expect(card.distractors).not.toContain('bag');
  });

  test('buildFillBlankChoices กับ distractors ครบ 5 ช่อง → choices รวม 6 ตัวและมีคำตอบถูก 1 ครั้ง', () => {
    const choices = buildFillBlankChoices(
      { wordEN: 'apple', distractors: ['bag', 'cat', 'dog', 'egg', 'fish'] },
      makeSeqRng(2)
    );
    expect(choices).toHaveLength(6);
    expect(choices.filter((c) => c === 'apple')).toHaveLength(1);
    expect(new Set(choices).size).toBe(6);
  });
});