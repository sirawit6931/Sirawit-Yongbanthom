// frontend/__tests__/tenseMode.test.js
// ทดสอบการแปลง item.mode (แอดมิน) → โหมดหน้าจอผู้เรียน
// Run with: npm test (jest --runInBand)

const { resolveTenseUserMode, TENSE_UI_MODE } = require('../utils/tenseMode');

// ── mapping ตามที่ผู้ดูแลตั้งในแอดมิน (ความจริงเดียว) ──────────────────────────

describe('resolveTenseUserMode — อ่าน item.mode จากแอดมิน', () => {
  test('fillBlank → multipleChoice (เติมคำในช่องว่าง)', () => {
    expect(resolveTenseUserMode({ mode: 'fillBlank' })).toBe(TENSE_UI_MODE.FILL_BLANK);
  });

  test('reorder → wordOrdering (เรียงประโยค)', () => {
    expect(resolveTenseUserMode({ mode: 'reorder' })).toBe(TENSE_UI_MODE.REORDER);
  });

  test('listenRepeat → listenRepeat (ฟังและพูดตาม)', () => {
    expect(resolveTenseUserMode({ mode: 'listenRepeat' })).toBe(TENSE_UI_MODE.LISTEN_REPEAT);
  });

  test('item.mode สำคัญกว่ารูปแบบข้อมูลอื่นเสมอ (ข้อ 2 ที่เป็น fillBlank ต้องไม่กลายเป็นเรียงประโยค)', () => {
    // ข้อนี้คือบั๊กจริงที่พบ: เดิม user app ใช้เลขคี่/คู่ → ข้อ 2 เล่นผิดโหมด
    expect(resolveTenseUserMode({
      mode: 'fillBlank',
      sentence: 'She ___ an apple for lunch.',
      orderWords: ['She', '___', 'an', 'apple'],
      speakText: 'She ___ an apple for lunch.',
    })).toBe(TENSE_UI_MODE.FILL_BLANK);

    expect(resolveTenseUserMode({
      mode: 'reorder',
      sentence: 'She eats an apple for lunch.',
      orderWords: ['She', 'eats', 'an', 'apple'],
    })).toBe(TENSE_UI_MODE.REORDER);
  });
});

// ── fallback สำหรับชุดเก่าที่ยังไม่มี field mode ───────────────────────────────────
// ต้อง mirror กฎ derive ของแอดมิน (adminApp.js: normalizeTenseItemForEdit) เด๊ะ

describe('resolveTenseUserMode — fallback ชุดเก่า (ไม่มี mode)', () => {
  test('ประโยคมีช่องว่าง ___ → multipleChoice', () => {
    expect(resolveTenseUserMode({ sentence: 'He ___ playing football.' }))
      .toBe(TENSE_UI_MODE.FILL_BLANK);
    expect(resolveTenseUserMode({ targetSentence: 'She _____ to school.' }))
      .toBe(TENSE_UI_MODE.FILL_BLANK);
  });

  test('มี orderWords → wordOrdering', () => {
    expect(resolveTenseUserMode({
      sentence: 'She eats an apple.',
      orderWords: ['She', 'eats', 'an', 'apple'],
    })).toBe(TENSE_UI_MODE.REORDER);
  });

  test('มีแค่ speakText → listenRepeat', () => {
    expect(resolveTenseUserMode({ speakText: 'I go to school.' }))
      .toBe(TENSE_UI_MODE.LISTEN_REPEAT);
  });

  test('mode ค่าผิด/ว่าง → ไม่ crash และให้ default ที่ derive ได้', () => {
    expect(resolveTenseUserMode({ mode: '', sentence: 'It ___ raining.' }))
      .toBe(TENSE_UI_MODE.FILL_BLANK);
    expect(resolveTenseUserMode({ mode: 'bogusMode', orderWords: ['a', 'b'] }))
      .toBe(TENSE_UI_MODE.REORDER);
    expect(resolveTenseUserMode({ mode: null, speakText: 'I go.' }))
      .toBe(TENSE_UI_MODE.LISTEN_REPEAT);
  });

  test('input ที่ไม่มีข้อมูลเลย → ไม่ crash (ค่า default reorder ของระบบ)', () => {
    expect(resolveTenseUserMode(null)).toBe(TENSE_UI_MODE.REORDER);
    expect(resolveTenseUserMode(undefined)).toBe(TENSE_UI_MODE.REORDER);
    expect(resolveTenseUserMode({})).toBe(TENSE_UI_MODE.REORDER);
  });

  test('orderWords เป็นค่าว่าง/ไม่ใช่ array → ไม่ crash', () => {
    expect(resolveTenseUserMode({ sentence: 'Hello world.', orderWords: [] }))
      .toBe(TENSE_UI_MODE.REORDER);
    expect(resolveTenseUserMode({ sentence: 'Hello world.', orderWords: null, speakText: 'Hello world.' }))
      .toBe(TENSE_UI_MODE.LISTEN_REPEAT);
  });
});