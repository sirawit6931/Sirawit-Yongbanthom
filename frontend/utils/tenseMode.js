// frontend/utils/tenseMode.js
// แปลง "รูปแบบฝึก" ที่ผู้ดูแลกำหนดในแอดมิน (item.mode) → โหมดหน้าจอของ User app
//
// เหตุผล: เดิม TenseExerciseScreen กำหนดโหมดจากเลขข้อ (คี่ = เติมคำ, คู่ = เรียงประโยค)
// ทำให้ไม่ตรงกับที่แอดมินตั้งไว้ → ย้ายมาใช้ item.mode เป็นความจริงเดียว
//
// schema แอดมิน (backend/routes/adminTenseRoutes.js):
//   'fillBlank'    → เติมคำในช่องว่าง (Multiple Choice)
//   'reorder'      → เรียงประโยค (Word Ordering)
//   'listenRepeat' → ฟังและพูดตาม (Listen & Repeat)

export const TENSE_UI_MODE = {
  FILL_BLANK: 'multipleChoice',
  REORDER: 'wordOrdering',
  LISTEN_REPEAT: 'listenRepeat',
};

const ADMIN_MODE_TO_UI_MODE = {
  fillBlank: TENSE_UI_MODE.FILL_BLANK,
  reorder: TENSE_UI_MODE.REORDER,
  listenRepeat: TENSE_UI_MODE.LISTEN_REPEAT,
};

/**
 * ตัดสินโหมดหน้าจอของผู้เรียนจาก item
 * - ถ้ามี item.mode ที่ถูกต้อง → ใช้ตามนั้น (ความจริงเดียว ตรงกับแอดมิน)
 * - ชุดเก่าที่ยังไม่มี mode → derive จากข้อมูล ด้วยกฎเดียวกับแอดมิน
 *   (adminApp.js: normalizeTenseItemForEdit)
 *     ประโยคมีช่องว่าง ___ → fillBlank
 *     มี orderWords          → reorder
 *     มีแค่ speakText        → listenRepeat
 *     อื่น ๆ                 → reorder (ค่า default ของระบบ)
 *
 * @param {object} item รายการโจทย์จาก Firestore
 * @returns {'multipleChoice' | 'wordOrdering' | 'listenRepeat'}
 */
export function resolveTenseUserMode(item) {
  if (!item || typeof item !== 'object') return TENSE_UI_MODE.REORDER;

  if (ADMIN_MODE_TO_UI_MODE[item.mode]) return ADMIN_MODE_TO_UI_MODE[item.mode];

  // ── fallback สำหรับชุดเก่าที่ไม่มี field mode (ต้อง mirror กฎของแอดมินเป๊ะ) ──
  const sentence = String(item.sentence || item.targetSentence || '');
  const hasBlank = /_{2,}/.test(sentence);
  if (hasBlank) return TENSE_UI_MODE.FILL_BLANK;

  const orderWords = Array.isArray(item.orderWords) ? item.orderWords : [];
  if (orderWords.length > 0) return TENSE_UI_MODE.REORDER;

  if (item.speakText) return TENSE_UI_MODE.LISTEN_REPEAT;

  return TENSE_UI_MODE.REORDER;
}
