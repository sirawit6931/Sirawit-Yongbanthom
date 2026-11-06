// frontend/utils/speechVerify.js
// Utility กลางสำหรับตรวจผลการออกเสียง (Speech Recognition) — ใช้ร่วมได้ทุกหมวดแบบฝึกหัด
// แยกออกมาเป็น pure function เพื่อให้ทดสอบด้วย Jest ได้ง่าย และไม่ผูกกับหน้าจอใดหน้าจอหนึ่ง
//
// หมายเหตุ: ด่าน "ฟังและพูดตาม" ของหมวดคำศัพท์ (VocabExerciseScreen) ยังใช้ logic inline เดิมอยู่
// ไฟล์นี้ถูกสร้างสำหรับด่าน "ฟังและพูดตาม" ของหมวด Tense (TenseExerciseScreen) โดยเฉพาะ
// เพื่อไม่ให้กระทบหน้าจอคำศัพท์ที่ผ่านการทดสอบแล้ว

/**
 * normalizeText — ปรับข้อความให้อยู่ในรูปมาตรฐานก่อนเปรียบเทียบ
 * - lowercase + trim
 * - ตัดเครื่องหมายวรรคตอนออก แต่คงตัวอักษร ตัวเลข ช่องว่าง apostrophe และ hyphen
 *   (เพื่อให้ "Hello!" ตรงกับ "hello" และ "don't" ไม่ถูกตัดเป็น "dont")
 *
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'’-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * verifyWordSpeech — ตรวจคำเดี่ยว (ใช้เทียบเท่าด่านคำศัพท์เดิม)
 * ผ่านเมื่อข้อความที่ได้ยิน (normalize แล้ว) เท่ากับคำเป้าหมายเป๊ะ
 *
 * @param {string} spokenText ข้อความที่ Speech Recognition ถอดออกมา
 * @param {string} targetWord คำเป้าหมาย
 * @returns {boolean}
 */
export function verifyWordSpeech(spokenText, targetWord) {
  return normalizeText(spokenText) === normalizeText(targetWord);
}

// ค่าเริ่มต้น: ยอมรับเมื่อพูดได้ครบอย่างน้อย 80% ของคำในประโยคเป้าหมาย
export const SENTENCE_COVERAGE_THRESHOLD = 0.8;

// คำหนึ่งนับว่า "ตรง" กับอีกคำเมื่อ:
//   1) เหมือนกันเป๊ะ หลัง normalize, หรือ
//   2) คำที่สั้นกว่าเป็น prefix ของคำที่ยาวกว่า และผลต่างความยาวไม่เกิน 2 ตัวอักษร
//      (รองรับรูปพหูพจน์/ผันกริยาที่ Speech Recognition มักคืนต่างจากประโยคที่แสดง
//       เช่น go → goes, school → schools โดยไม่หลวมจนเกินไป)
function tokenMatches(targetToken, spokenToken) {
  if (targetToken === spokenToken) return true;
  const shorter = targetToken.length <= spokenToken.length ? targetToken : spokenToken;
  const longer = shorter === targetToken ? spokenToken : targetToken;
  if (shorter.length < 2) return false;
  if (!longer.startsWith(shorter)) return false;
  return longer.length - shorter.length <= 2;
}

/**
 * verifySentenceSpeech — ตรวจประโยคทั้งประโยค (ใช้ในด่านฟังและพูดตามของหมวด Tense)
 * ผ่านเมื่อ:
 *   - ประโยคที่ได้ยิน (normalize แล้ว) เท่ากับประโยคเป้าหมายเป๊ะ (เร็ว/แม่นสุด), หรือ
 *   - สัดส่วนคำในประโยคเป้าหมายที่ปรากฏในเสียงพูด ≥ threshold (ค่าเริ่มต้น 0.8)
 *
 * การคิดแบบ word-coverage ช่วยลด false-negative จาก noise ของ Speech Recognition
 * (ตัดคำ เลือกคำพ้องเสียง หรือมีคำฟุ่มเฟือย เช่น "um", "uh") ส่วนคำเกินมาไม่ทำให้ตก
 * เพราะตัวหารคือจำนวนคำของประโยคเป้าหมาย
 *
 * @param {string} spokenText ข้อความที่ Speech Recognition ถอดออกมา
 * @param {string} targetSentence ประโยคเป้าหมายเต็ม (ไม่มีช่องว่าง)
 * @param {number} [threshold=0.8] สัดส่วนคำขั้นต่ำที่ต้องตรง
 * @returns {boolean}
 */
export function verifySentenceSpeech(spokenText, targetSentence, threshold = SENTENCE_COVERAGE_THRESHOLD) {
  const spoken = normalizeText(spokenText);
  const target = normalizeText(targetSentence);
  if (!spoken || !target) return false;
  if (spoken === target) return true;

  const targetTokens = target.split(' ').filter(Boolean);
  if (targetTokens.length === 0) return false;

  // นับคำที่ได้ยินแบบ multiset เพื่อรองรับคำซ้ำในประโยค
  const spokenTokens = spoken.split(' ').filter(Boolean);
  const used = new Array(spokenTokens.length).fill(false);

  let matched = 0;
  for (const targetToken of targetTokens) {
    const idx = spokenTokens.findIndex((spokenToken, i) => !used[i] && tokenMatches(targetToken, spokenToken));
    if (idx !== -1) {
      used[idx] = true;
      matched += 1;
    }
  }

  return matched / targetTokens.length >= threshold;
}