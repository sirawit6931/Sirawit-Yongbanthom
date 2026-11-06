// frontend/__tests__/speechVerify.test.js
// ทดสอบ utility ตรวจเสียงพูด (ใช้ในด่าน "ฟังและพูดตาม" ของหมวด Tense)
// Run with: npm test (jest --runInBand)

const {
  normalizeText,
  verifyWordSpeech,
  verifySentenceSpeech,
  SENTENCE_COVERAGE_THRESHOLD,
} = require('../utils/speechVerify');

describe('normalizeText — ปรับข้อความให้เป็นมาตรฐาน', () => {
  test('lowercase + trim', () => {
    expect(normalizeText('  Hello  ')).toBe('hello');
  });

  test('ตัดเครื่องหมายวรรคตอน แต่คง apostrophe และ hyphen', () => {
    expect(normalizeText('Hello, World!')).toBe('hello world');
    expect(normalizeText("don't")).toBe("don't");
    expect(normalizeText('well-known')).toBe('well-known');
  });

  test('ยุบช่องว่างซ้ำให้เหลือช่องเดียว', () => {
    expect(normalizeText('he   go    to  school')).toBe('he go to school');
  });

  test('รองรับค่า null/undefined แบบไม่ crash', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });
});

describe('verifyWordSpeech — ตรวจคำเดี่ยว', () => {
  test('ตรงกันหลัง normalize (มี punctuation/case ต่าง)', () => {
    expect(verifyWordSpeech('Apple!', 'apple')).toBe(true);
    expect(verifyWordSpeech('bag', 'bag')).toBe(true);
  });

  test('ไม่ตรง → false', () => {
    expect(verifyWordSpeech('bag', 'big')).toBe(false);
    expect(verifyWordSpeech('', 'bag')).toBe(false);
  });
});

describe('verifySentenceSpeech — ตรวจประโยค', () => {
  test('ตรงเป๊ะ (มี punctuation) → ผ่าน', () => {
    expect(verifySentenceSpeech('He goes to school.', 'he goes to school')).toBe(true);
  });

  test('Speech Recognition ผันคำต่างเล็กน้อย (go → goes) → ผ่าน', () => {
    expect(verifySentenceSpeech('he go to school', 'he goes to school')).toBe(true);
  });

  test('มีคำฟุ่มเฟือย (um/now) แต่ครบทุกคำเป้าหมาย → ผ่าน', () => {
    expect(verifySentenceSpeech('um he goes to school now', 'he goes to school')).toBe(true);
  });

  test('พูดได้ไม่ครบ 80% ของคำ → ไม่ผ่าน', () => {
    expect(verifySentenceSpeech('school', 'he goes to school every day')).toBe(false);
  });

  test('ประโยคคนละเรื่อง → ไม่ผ่าน', () => {
    expect(verifySentenceSpeech('I like apples', 'he goes to school')).toBe(false);
  });

  test('transcript ว่าง → ไม่ผ่าน', () => {
    expect(verifySentenceSpeech('', 'he goes to school')).toBe(false);
  });

  test('ปรับ threshold ได้ตามต้องการ', () => {
    // พูดได้ 3/4 คำ = 75% → ผ่านเมื่อ threshold 0.7, ไม่ผ่านเมื่อ threshold 0.8
    const spoken = 'he goes to';
    expect(verifySentenceSpeech(spoken, 'he goes to school', 0.7)).toBe(true);
    expect(verifySentenceSpeech(spoken, 'he goes to school', 0.8)).toBe(false);
  });

  test('ค่า threshold เริ่มต้นคือ 0.8', () => {
    expect(SENTENCE_COVERAGE_THRESHOLD).toBe(0.8);
  });
});