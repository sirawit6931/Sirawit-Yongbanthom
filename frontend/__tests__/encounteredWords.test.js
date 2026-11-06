// frontend/__tests__/encounteredWords.test.js
// ทดสอบ utility นับ "คำศัพท์ที่เจอ" (อิงคลัง vocabulary ของแอดมิน, ทุกหมวด)
// Run with: npm test (jest --runInBand)

const {
  normalizeWord,
  tokenizeEnglish,
  buildVocabLookup,
  extractExerciseTextParts,
  countEncounteredWords,
} = require('../utils/encounteredWords');

// ── normalize ────────────────────────────────────────────────────────────────

describe('normalizeWord / tokenizeEnglish', () => {
  test('trim + lowercase + ตัดวรรคตอนหัวท้าย', () => {
    expect(normalizeWord('  Played! ')).toBe('played');
    expect(normalizeWord("don't")).toBe("don't");
    expect(normalizeWord('...Yesterday?')).toBe('yesterday');
  });

  test('ค่าว่าง/ไม่ใช่ string → ข้อความว่าง', () => {
    expect(normalizeWord(null)).toBe('');
    expect(normalizeWord(undefined)).toBe('');
    expect(normalizeWord(123)).toBe('123');
  });

  test('tokenize: แยกคำ + lowercase + กรองช่องว่าง', () => {
    expect(tokenizeEnglish('They played football yesterday.')).toEqual([
      'they', 'played', 'football', 'yesterday',
    ]);
    expect(tokenizeEnglish('')).toEqual([]);
    expect(tokenizeEnglish(null)).toEqual([]);
  });
});

// ── lookup คลัง ───────────────────────────────────────────────────────────────

describe('buildVocabLookup — สร้าง lookup จากคลังแอดมิน', () => {
  const docs = [
    { id: 'v1', wordEN: 'Play', wordTH: 'เล่น' },
    { id: 'v2', wordEN: '  football ', wordTH: 'ฟุตบอล' },
    { id: 'v3', wordEN: '', wordTH: 'ว่าง' },
    null,
  ];

  test('key เป็น normalized wordEN, ข้ามค่าว่าง/ไม่ใช่ object', () => {
    const map = buildVocabLookup(docs);
    expect(map.size).toBe(2);
    expect(map.get('play').id).toBe('v1');
    expect(map.get('football').wordEN).toBe('football');
  });

  test('input ไม่ใช่ array → map ว่าง', () => {
    expect(buildVocabLookup(null).size).toBe(0);
    expect(buildVocabLookup(undefined).size).toBe(0);
  });
});

// ── ดึงข้อความตามหมวด ─────────────────────────────────────────────────────────

describe('extractExerciseTextParts — ดึงข้อความครบ 3 หมวด', () => {
  test('หมวด vocab: wordEN', () => {
    const ex = { id: 'e1', items: [{ wordEN: 'apple', wordTH: 'แอปเปิ้ล' }] };
    expect(extractExerciseTextParts(ex)).toContain('apple');
  });

  test('หมวด tense: ประโยค + choices + answer', () => {
    const ex = {
      id: 'e2',
      items: [{
        sentence: 'They ___ football yesterday.',
        speakText: 'They play football yesterday.',
        choices: ['play', 'played', 'will play'],
        answer: 'played',
      }],
    };
    const parts = extractExerciseTextParts(ex);
    expect(parts).toEqual(expect.arrayContaining([
      'They ___ football yesterday.', 'They play football yesterday.',
      'play', 'played', 'will play', 'played',
    ]));
  });

  test('หมวด listening: บทสนทนา + question', () => {
    const ex = {
      id: 'e3',
      dialogues: [{
        lines: [{ speaker: 'A', text: 'Do you like football?' }],
        question: { prompt: 'What sport?', options: ['football', 'tennis'], answer: 'football' },
      }],
    };
    const parts = extractExerciseTextParts(ex);
    expect(parts).toEqual(expect.arrayContaining([
      'Do you like football?', 'What sport?', 'football', 'tennis',
    ]));
  });

  test('input ผิดรูป → array ว่าง', () => {
    expect(extractExerciseTextParts(null)).toEqual([]);
    expect(extractExerciseTextParts({})).toEqual([]);
  });
});

// ── นับคำที่เจอ ───────────────────────────────────────────────────────────────

describe('countEncounteredWords — นับเฉพาะชุดที่จบแล้ว + เฉพาะคำในคลัง', () => {
  const vocabulary = [
    { id: 'v1', wordEN: 'play', wordTH: 'เล่น' },
    { id: 'v2', wordEN: 'football', wordTH: 'ฟุตบอล' },
    { id: 'v3', wordEN: 'yesterday', wordTH: 'เมื่อวาน' },
    { id: 'v4', wordEN: 'apple', wordTH: 'แอปเปิ้ล' },
    { id: 'v5', wordEN: 'look at', wordTH: 'มองดู' },
  ];
  const exercises = [
    { id: 'e1', category: 'vocab', items: [{ wordEN: 'apple', wordTH: 'แอปเปิ้ล' }] },
    {
      id: 'e2', category: 'tense',
      items: [{ sentence: 'They ___ football yesterday.', choices: ['play', 'played'], answer: 'played' }],
    },
    {
      id: 'e3', category: 'listening',
      dialogues: [{ lines: [{ speaker: 'A', text: 'Look at the football!' }], question: { prompt: 'x', options: [], answer: '' } }],
    },
    { id: 'e4', category: 'vocab', items: [{ wordEN: 'banana', wordTH: 'กล้วย' }] }, // คำนอกคลัง
  ];

  test('นับเฉพาะชุดที่จบแล้ว (อยู่ใน progressMap)', () => {
    const { count } = countEncounteredWords({
      vocabulary, exercises, progressMap: { e1: { passed: true }, e2: { passed: false } },
    });
    // e1→apple, e2→play(จาก choices), football(จากประโยค), yesterday; played ไม่อยู่ในคลัง (v1)
    expect(count).toBe(4);
  });

  test('ทำซ้ำหลายชุด + วลีหลายคำ → dedupe', () => {
    const { words } = countEncounteredWords({
      vocabulary, exercises, progressMap: { e1: {}, e2: {}, e3: {} },
    });
    const keys = words.map((w) => w.wordEN).sort();
    // apple, play, football, yesterday + วลี 'look at' = 5 (banana นอกคลังไม่นับ)
    expect(keys).toEqual(['apple', 'football', 'look at', 'play', 'yesterday']);
  });

  test('ไม่มีสถิติ → 0', () => {
    expect(countEncounteredWords({ vocabulary, exercises, progressMap: {} }).count).toBe(0);
  });

  test('คลังว่าง/ไม่ส่ง input → 0 ไม่ crash', () => {
    expect(countEncounteredWords({ vocabulary: [], exercises, progressMap: { e1: {} } }).count).toBe(0);
    expect(countEncounteredWords({}).count).toBe(0);
  });
});
