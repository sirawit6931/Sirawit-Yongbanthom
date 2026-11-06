// frontend/utils/confirmDialog.js
// ตัวเลือกสี/ข้อความของ `components/ConfirmModal.js` — แยกเป็น pure logic ไว้ที่นี่
// เพื่อให้ unit test import ได้ตรง ๆ (ตาม pattern ของ utils/responsive.js)
//
// ทำไมต้องแยกออกมาจาก component:
//   jest ของโปรเจกต์นี้ parse โมเดูล react-native ไม่ได้ → ถ้า test import ไฟล์ที่
//   import react-native จะ fail ตอน transform ไม่ว่าจะเทส helper หรือเปล่า
//   ดังนั้น component จะ import จากไฟล์นี้แทนประกาศเอง
//
// ไฟล์นี้ห้าม import react-native / react ด้วยเด็ดขาด

// โทนสีหลักเริ่มต้น — ตรงกับ PRIMARY ของหน้าจอส่วนใหญ่
export const DEFAULT_ACCENT = '#5B4FCF';

/**
 * ตรวจ/เลือกสีที่ใช้ accent ของกล่องยืนยัน
 * - ถ้าไม่ส่งมา หรือส่งค่าที่ไม่ใช่ hex 6 หลัก → ใช้ DEFAULT_ACCENT แทน
 *   (กันก้อน Modal กลายเป็นไม่มีสีถ้า screen ลืมส่งสีเข้ามา)
 * @param {string} color สีที่ต้องการ
 * @returns {string} hex ที่ใช้งานได้จริง
 */
export function resolveAccentColor(color) {
  if (typeof color !== 'string') return DEFAULT_ACCENT;
  const trimmed = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : DEFAULT_ACCENT;
}

// ─── ข้อความสำเร็จรูป ───────────────────────────────────────────────────────
// แยกไว้ตรงนี้ให้หน้าจอเรียกจากจุดเดียวกัน ข้อความจึงไม่ข้ามกันและแก้ทีเดียวจบ

// ออกจากแบบฝึกหัด (VocabExercise / TenseExercise / ListeningExercise)
// — ถ้าแก้ ให้แก้ที่นี่เดียวครบทุกหน้า
// message เว้นว่างไว้ตามที่ออกแบบ → ConfirmModal จะไม่ render บล็อกข้อความเลย
// (กล่องจึงเหลือแค่หัวข้อ + ปุ่ม ยกเลิก / ยืนยัน)
export const EXERCISE_EXIT_TEXTS = Object.freeze({
  title: 'ยืนยันการออกจากแบบฝึกหัด',
  message: '',
  confirm: 'ยืนยัน',
  cancel: 'ยกเลิก',
});

// ออกจากระบบ (ProfileScreen)
export const SIGN_OUT_TEXTS = Object.freeze({
  title: 'ออกจากระบบ',
  message: 'คุณต้องการออกจากระบบหรือไม่?',
  confirm: 'ตกลง',
  cancel: 'ยกเลิก',
});
