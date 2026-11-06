// frontend/__tests__/confirmModal.test.js
// ทดสอบ pure helper ของ `frontend/utils/confirmDialog.js`
// (component ConfirmModal.js ทำหน้าที่ re-export ค่าเหล่านี้ออกไปให้หน้าจอใช้)
//
// ทำไมต้องเทสที่ utils/ ไม่ใช่ components/:
//   jest ของโปรเจกต์ parse โมเดูล react-native ไม่ได้ (ไม่มี setup file) — ถ้า import
//   ไฟล์ component ที่ import react-native จะ fail ตอน transform ทั้ง ๆ ที่เทสแค่ helper
//   (pattern เดียวกับ utils/responsive.js ที่แยก logic ออกจาก ResponsiveContainer)
// Run with: npm test (jest --runInBand)
import {
  resolveAccentColor,
  DEFAULT_ACCENT,
  EXERCISE_EXIT_TEXTS,
  SIGN_OUT_TEXTS,
} from '../utils/confirmDialog';

describe('resolveAccentColor', () => {
  test('ส่ง hex ถูกต้อง → ใช้สีนั้นตรง ๆ', () => {
    expect(resolveAccentColor('#5B4FCF')).toBe('#5B4FCF');
    expect(resolveAccentColor('#34C759')).toBe('#34C759');
    expect(resolveAccentColor('#FF9500')).toBe('#FF9500');
  });

  test('ยอมรับตัวพิมพ์เล็ก/ใหญ่ผสม และช่องว่างหัวท้าย', () => {
    expect(resolveAccentColor('  #ff9500  ')).toBe('#ff9500');
    expect(resolveAccentColor('#aBcDeF')).toBe('#aBcDeF');
  });

  test('ไม่ส่งค่า / ส่งค่าไม่ถูกประเภท → ใช้ DEFAULT_ACCENT', () => {
    expect(resolveAccentColor()).toBe(DEFAULT_ACCENT);
    expect(resolveAccentColor(undefined)).toBe(DEFAULT_ACCENT);
    expect(resolveAccentColor(null)).toBe(DEFAULT_ACCENT);
    expect(resolveAccentColor(123)).toBe(DEFAULT_ACCENT);
    expect(resolveAccentColor({ hex: '#fff' })).toBe(DEFAULT_ACCENT);
  });

  test('รูปแบบที่ไม่ใช่ hex 6 หลัก → fallback', () => {
    expect(resolveAccentColor('')).toBe(DEFAULT_ACCENT);
    expect(resolveAccentColor('   ')).toBe(DEFAULT_ACCENT);
    expect(resolveAccentColor('#FFF')).toBe(DEFAULT_ACCENT);       // 3 หลักไม่รับ
    expect(resolveAccentColor('#12345')).toBe(DEFAULT_ACCENT);     // 5 หลักไม่รับ
    expect(resolveAccentColor('#1234567')).toBe(DEFAULT_ACCENT);   // 7 หลักไม่รับ
    expect(resolveAccentColor('5B4FCF')).toBe(DEFAULT_ACCENT);     // ไม่มี # ไม่รับ
    expect(resolveAccentColor('rgb(91,79,207)')).toBe(DEFAULT_ACCENT);
    expect(resolveAccentColor('#GGGGGG')).toBe(DEFAULT_ACCENT);    // ไม่ใช่ hex digit
  });

  test('DEFAULT_ACCENT ตรงกับ PRIMARY ของหน้าจอหลัก (#5B4FCF)', () => {
    expect(DEFAULT_ACCENT).toBe('#5B4FCF');
  });

  test('ค่าที่ return เป็น hex ที่ React Native ใช้ได้เสมอ (ขึ้นต้นด้วย #)', () => {
    const samples = ['#5B4FCF', '', null, undefined, 'bad', '#FFF', 42];
    samples.forEach((s) => {
      expect(resolveAccentColor(s)).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});

describe('EXERCISE_EXIT_TEXTS', () => {
  test('มี key ครบทั้ง 4 ฟิลด์ที่หน้าจอเรียกใช้', () => {
    expect(EXERCISE_EXIT_TEXTS).toHaveProperty('title');
    expect(EXERCISE_EXIT_TEXTS).toHaveProperty('message');
    expect(EXERCISE_EXIT_TEXTS).toHaveProperty('confirm');
    expect(EXERCISE_EXIT_TEXTS).toHaveProperty('cancel');
  });

  test('title/confirm/cancel เป็น string ไม่ว่าง (message ว่างได้ตามดีไซน์)', () => {
    ['title', 'confirm', 'cancel'].forEach((k) => {
      expect(typeof EXERCISE_EXIT_TEXTS[k]).toBe('string');
      expect(EXERCISE_EXIT_TEXTS[k].trim().length).toBeGreaterThan(0);
    });
    // message ว่าง = ConfirmModal จะไม่ render บล็อกข้อความ (เหลือหัวข้อ + ปุ่มเท่านั้น)
    expect(EXERCISE_EXIT_TEXTS.message).toBe('');
  });

  test('ข้อความย่อลงเหลือหัวข้อ + ปุ่ม "ยืนยัน" (ไม่ต้องเตือนเรื่องความคืบหน้า)', () => {
    expect(EXERCISE_EXIT_TEXTS.message).toBe('');
    expect(EXERCISE_EXIT_TEXTS.confirm).toBe('ยืนยัน');
    expect(EXERCISE_EXIT_TEXTS.cancel).toBe('ยกเลิก');
    expect(EXERCISE_EXIT_TEXTS.title).toBe('ยืนยันการออกจากแบบฝึกหัด');
  });

  test('frozen — แก้ค่าทับไม่ได้ (กันแก้โดยไม่ได้ตั้งใจแล้วเพี้ยนทุกหน้าจอ)', () => {
    expect(Object.isFrozen(EXERCISE_EXIT_TEXTS)).toBe(true);
  });
});

describe('SIGN_OUT_TEXTS', () => {
  test('มี key ครบและไม่ว่าง', () => {
    expect(SIGN_OUT_TEXTS).toHaveProperty('title');
    expect(SIGN_OUT_TEXTS).toHaveProperty('message');
    expect(SIGN_OUT_TEXTS).toHaveProperty('confirm');
    expect(SIGN_OUT_TEXTS).toHaveProperty('cancel');
    Object.values(SIGN_OUT_TEXTS).forEach((v) => {
      expect(typeof v).toBe('string');
      expect(v.trim().length).toBeGreaterThan(0);
    });
  });

  test('ข้อความคงเดิมจากที่ ProfileScreen ใช้', () => {
    expect(SIGN_OUT_TEXTS.title).toBe('ออกจากระบบ');
    expect(SIGN_OUT_TEXTS.message).toBe('คุณต้องการออกจากระบบหรือไม่?');
  });

  test('frozen', () => {
    expect(Object.isFrozen(SIGN_OUT_TEXTS)).toBe(true);
  });
});
