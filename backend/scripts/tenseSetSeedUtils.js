// backend/scripts/tenseSetSeedUtils.js
// ══════════════════════════════════════════════════════════════════════════════
// Helper ร่วมสำหรับ script seed ชุดแบบฝึกหัด Tense
//   - buildLegacyFields : sync schema ใหม่ → schema เก่า (mirror ของ
//                         adminTenseRoutes.syncLegacyTenseFields)
//                         เพื่อให้ User app (TenseExerciseScreen) เล่นได้ทันที
//   - validateTenseSetDoc : ตรวจ payload ก่อนเขียน Firestore (ตาม rule ของ
//                         adminTenseRoutes: mode/tag/level ถูกต้อง, fillBlank ต้องมี
//                         ช่องว่าง + คำตอบผิด 2 คำ ไม่ซ้ำคำตอบถูก)
//   - writeSetToFirestore : set(..., { merge: true }) รันซ้ำได้ปลอดภัย
// ══════════════════════════════════════════════════════════════════════════════
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }       = require('firebase-admin/firestore');

const VALID_MODES  = ['reorder', 'fillBlank', 'listenRepeat'];
const VALID_TAGS   = ['Present', 'Past', 'Future'];
const VALID_LEVELS = ['A1', 'A2'];
const TENSE_COLORS = { Present: '#5B4FCF', Past: '#FF9500', Future: '#007AFF' };

/**
 * สร้าง legacy fields จาก item schema ใหม่ (mirror adminTenseRoutes.syncLegacyTenseFields)
 * @param {object} item — { mode, targetSentence, sentenceTH, correctAnswer, distractors,
 *                          tenseIndicator, ttsVoice }
 * @returns {object} legacy fields สำหรับ merge ทับ item
 */
function buildLegacyFields(item) {
  const answer = item.correctAnswer || item.missingWord || '';
  const target = item.targetSentence;

  // speakText: ประโยคเต็ม — แทนที่ช่องว่าง _____ ด้วยคำตอบ (กัน ___ ตกค้าง)
  const speakText = target
    .replace(/_{2,}/g, answer)
    .replace(/\s+/g, ' ')
    .trim();

  // sentence: fillBlank → normalize เป็น ___ 3 ตัว / โหมดอื่น → ประโยคตามปกติ
  const sentence =
    item.mode === 'fillBlank'
      ? target.replace(/_{2,}/g, '___')
      : answer && answer !== target && target.includes(answer)
        ? target.replace(answer, '___')
        : target;

  // orderWords: คำเรียงตามลำดับจริง (User app ใช้คิดเฉลยโหมดเรียงประโยค)
  const orderWords = speakText.split(/\s+/).filter(Boolean);

  // choices: fillBlank → [คำตอบถูก, ...คำตอบผิด] / โหมดอื่น → app fallback เอง
  const choices =
    item.mode === 'fillBlank'
      ? [...new Set([answer, ...item.distractors])].slice(0, 4)
      : [];

  return {
    tenseType: `${item.tenseIndicator} Simple`,
    tenseColor: TENSE_COLORS[item.tenseIndicator] || '#5B4FCF',
    exampleEN: speakText,
    exampleTH: item.sentenceTH,
    sentence,
    sentenceTH: item.sentenceTH,
    answer,
    choices,
    orderWords,
    speakText,
  };
}

/**
 * ตรวจ doc ชุด Tense ก่อนเขียน Firestore — คืน array ข้อผิดพลาด ([] = ผ่าน)
 * rule ตรงกับ adminTenseRoutes.validatePayload
 * @param {object} doc — { title, level, tenseTag, ttsSystem, status, items }
 */
function validateTenseSetDoc(doc) {
  const errors = [];

  if (!doc.title || !doc.title.trim()) errors.push('title ว่าง');
  if (!VALID_LEVELS.includes(doc.level)) errors.push(`level ไม่ถูกต้อง: ${doc.level}`);
  if (!VALID_TAGS.includes(doc.tenseTag)) errors.push(`tenseTag ไม่ถูกต้อง: ${doc.tenseTag}`);
  if (!['male', 'female'].includes(doc.ttsSystem)) errors.push(`ttsSystem ไม่ถูกต้อง: ${doc.ttsSystem}`);
  if (!['published', 'draft'].includes(doc.status)) errors.push(`status ไม่ถูกต้อง: ${doc.status}`);
  if (!Array.isArray(doc.items) || doc.items.length < 1) errors.push('ต้องมีอย่างน้อย 1 ข้อ');

  (Array.isArray(doc.items) ? doc.items : []).forEach((it, idx) => {
    const no = `ข้อ ${idx + 1}`;
    if (!VALID_MODES.includes(it.mode)) errors.push(`${no}: mode ไม่ถูกต้อง (${it.mode})`);
    if (!it.targetSentence || !it.targetSentence.trim()) errors.push(`${no}: ไม่มี targetSentence`);
    if (!it.sentenceTH || !it.sentenceTH.trim()) errors.push(`${no}: ไม่มี sentenceTH`);
    if (!VALID_TAGS.includes(it.tenseIndicator)) errors.push(`${no}: tenseIndicator ไม่ถูกต้อง`);
    if (!['male', 'female'].includes(it.ttsVoice)) errors.push(`${no}: ttsVoice ไม่ถูกต้อง`);
    if (!it.correctAnswer || !it.correctAnswer.trim()) errors.push(`${no}: ไม่มี correctAnswer`);

    if (it.mode === 'fillBlank') {
      if (!/_{2,}/.test(it.targetSentence)) {
        errors.push(`${no}: fillBlank ต้องมีช่องว่าง _____ ใน targetSentence`);
      }
      const wrongs = (it.distractors || []).map((d) => String(d || '').trim());
      if (wrongs.length !== 2 || !wrongs[0] || !wrongs[1]) {
        errors.push(`${no}: fillBlank ต้องมีคำตอบผิด 2 คำ`);
      } else {
        const ans = it.correctAnswer.trim().toLowerCase();
        if (wrongs.some((w) => w.toLowerCase() === ans)) {
          errors.push(`${no}: คำตอบผิดต้องไม่เท่ากับคำตอบถูก`);
        }
        if (wrongs[0].toLowerCase() === wrongs[1].toLowerCase()) {
          errors.push(`${no}: คำตอบผิดทั้ง 2 คำห้ามซ้ำกัน`);
        }
      }
    }
  });

  return errors;
}

/**
 * เตรียม doc สุดท้าย: merge legacy fields ลงแต่ละ item + ตั้ง timestamp
 * @param {object} setDoc — doc ต้นฉบับ (มี id ด้วย)
 */
function buildTenseSetFinalDoc(setDoc) {
  const now = new Date();
  const { id, ...rest } = setDoc;
  return {
    ...rest,
    items: setDoc.items.map((it) => ({ ...buildLegacyFields(it), ...it })),
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * เขียน doc ลง Firestore (merge — รันซ้ำได้)
 * @returns {Promise<'created'|'updated'>}
 */
async function writeSetToFirestore(db, docId, doc) {
  const ref = db.collection('exercises').doc(docId);
  const existing = await ref.get();
  await ref.set(doc, { merge: true });
  return existing.exists ? 'updated' : 'created';
}

/** เชื่อม Firebase Admin ด้วย serviceAccountKey.json (throw ถ้าไม่พบ) */
function connectFirebase() {
  let serviceAccount;
  try {
    serviceAccount = require('../serviceAccountKey.json');
  } catch {
    throw new Error('ไม่พบ backend/serviceAccountKey.json — ดาวน์โหลดจาก Firebase Console → Project settings → Service accounts');
  }
  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

module.exports = {
  VALID_MODES,
  VALID_TAGS,
  VALID_LEVELS,
  TENSE_COLORS,
  buildLegacyFields,
  validateTenseSetDoc,
  buildTenseSetFinalDoc,
  writeSetToFirestore,
  connectFirebase,
};

