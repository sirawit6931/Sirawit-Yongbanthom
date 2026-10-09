// backend/routes/adminTenseRoutes.js
// Admin Tense Exercise Sets API — mount ที่ /api/admin/tense-sets
// ดูแลชุดแบบฝึกหัดหมวด Tense/Grammar (category = 'tense') แบบเฉพาะทาง
//
// รองรับ 3 โหมดคำถาม: sentence-reordering, fill-blank-tense, listen-repeat
// ครอบคลุม Present, Past, Future Tenses
// จำนวนข้อ: บันทึกได้กี่ข้อก็ได้ (ต้องมีอย่างน้อย 1 ข้อ)
const express = require('express');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../config/firebase');
const { requireAdmin } = require('../middleware/authMiddleware');
const { ApiError } = require('../services/exerciseGeneratorService');

const router = express.Router();
router.use(requireAdmin);

const VALID_LEVELS = ['A1', 'A2'];
const VALID_TTS = ['male', 'female'];
const VALID_TENSE_TAGS = ['Present', 'Past', 'Future'];
const VALID_MODES = ['reorder', 'fillBlank', 'listenRepeat'];
// จำนวนข้อของชุด Tense: ไม่จำกัดจำนวน (บันทึกได้กี่ข้อก็ได้) แต่ต้องมีอย่างน้อย 1 ข้อ
const MIN_ITEMS = 1;
const DEFAULT_TENSE_COLORS = {
  Present: '#5B4FCF',
  Past: '#FF9500',
  Future: '#007AFF',
};

// Helper: sync ข้อมูลให้อยู่ในรูปแบบ legacy schema (frontend/SCHEMA.md 4.2)
// เพื่อให้แอปฝั่ง User (TenseExerciseScreen ซึ่งอ่าน sentence, answer, choices, orderWords, speakText, tenseType)
// ยังคงเปิดเล่นและตรวจคำตอบได้อย่างถูกต้องตรงกัน
function syncLegacyTenseFields(rawItem, clean) {
  const answer = clean.correctAnswer || clean.missingWord || String(rawItem.answer || '').trim();
  const target = clean.targetSentence;

  // 1) speakText: ประโยคเต็มสำหรับอ่านออกเสียง (ป้องกัน ___ ตกค้างในทุกโหมด)
  let speakText = String(rawItem.speakText || '').trim();
  const sourceSentence = target || speakText;
  if (sourceSentence) {
    speakText = sourceSentence
      .replace(/_{2,}/g, answer)
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 2) sentence: ประโยคที่มีช่องว่าง ___ 3 ตัว (สำหรับหน้า Multiple Choice ของ User app)
  let sentence = String(rawItem.sentence || '').trim();
  if (clean.mode === 'fillBlank') {
    // Normalize ให้มีช่องว่าง ___ 3 ตัวสม่ำเสมอ เพื่อให้ User app replace('___', answer) ทำงานถูกต้อง
    sentence = target.replace(/_{2,}/g, '___');
  } else if (!sentence) {
    if (answer && answer !== target && target.includes(answer)) {
      sentence = target.replace(answer, '___');
    } else {
      sentence = target;
    }
  }

  // 3) orderWords: ลำดับคำที่ถูกต้อง (User app ใช้คำนวณเฉลยของโหมด wordOrdering: orderWords.join(' '))
  let orderWords = Array.isArray(rawItem.orderWords) && rawItem.orderWords.length > 0
    ? rawItem.orderWords.map((w) => String(w).trim()).filter(Boolean)
    : [];
  if (orderWords.length === 0 || clean.mode === 'reorder' || clean.mode === 'fillBlank') {
    orderWords = speakText.split(/\s+/).filter(Boolean);
  }

  // 4) choices: ตัวเลือกสำหรับ Multiple Choice ใน User app (ต้องมี answer อยู่ใน choices เสมอ)
  // - ถ้ามี distractors (คำตอบที่ผิดที่ผู้ดูแลกำหนดใน Step 2) → choices = [คำตอบถูก, ...คำตอบผิด]
  // - ไม่มี distractors (ชุดเก่า / client เก่า) → ใช้ rawItem.choices เดิมตามพฤติกรรมเดิม
  let choices;
  const distractors = Array.isArray(clean.distractors)
    ? clean.distractors.map((d) => String(d).trim()).filter(Boolean)
    : [];
  if (distractors.length > 0) {
    const merged = [answer, ...distractors].filter(Boolean);
    choices = [...new Set(merged)].slice(0, 4);
  } else {
    choices = Array.isArray(rawItem.choices)
      ? rawItem.choices.map((c) => String(c).trim()).filter(Boolean)
      : [];
    if (answer && !choices.includes(answer)) {
      choices = [answer, ...choices.filter((c) => c !== answer)].slice(0, 4);
    }
    if (choices.length === 0 && answer) {
      choices = [answer];
    }
  }

  // 5) tenseType: คงชื่อเต็มเดิมไว้ (เช่น 'Present Simple') ถ้า indicator เปลี่ยน ให้ปรับ prefix ตาม
  let tenseType = String(rawItem.tenseType || '').trim();
  if (!tenseType) {
    tenseType = `${clean.tenseIndicator} Simple`;
  } else if (!tenseType.startsWith(clean.tenseIndicator)) {
    const parts = tenseType.split(/\s+/);
    parts[0] = clean.tenseIndicator;
    tenseType = parts.join(' ');
  }

  // 6) tenseColor: รหัสสีตามประเภท Tense
  const tenseColor = String(rawItem.tenseColor || '').trim()
    || DEFAULT_TENSE_COLORS[clean.tenseIndicator]
    || '#5B4FCF';

  // 7) exampleEN, exampleTH
  const exampleEN = String(rawItem.exampleEN || '').trim();
  const exampleTH = String(rawItem.exampleTH || '').trim();

  return {
    tenseType,
    tenseColor,
    exampleEN,
    exampleTH,
    sentence,
    sentenceTH: clean.sentenceTH,
    answer,
    choices,
    orderWords,
    speakText,
  };
}


function sendError(res, err) {
  const status = err instanceof ApiError ? err.statusCode : 500;
  if (status >= 500) console.error('[adminTenseRoutes]', err.message);
  return res.status(status).json({ success: false, error: err.message });
}

// ตรวจ payload สำหรับชุด Tense
function validatePayload(body, { requireItems = true, existing = null } = {}) {
  if (!body || typeof body !== 'object') throw new ApiError('ข้อมูลไม่ถูกส่ง', 400);

  const title = (body.title ?? '').trim();
  if (!title) throw new ApiError('กรุณากรอกชื่อชุดแบบฝึกหัด', 422);

  const level = body.level ?? existing?.level ?? 'A1';
  if (!VALID_LEVELS.includes(level)) throw new ApiError(`ระดับไม่ถูกต้อง: ${level}`, 422);

  const tenseTag = body.tenseTag ?? existing?.tenseTag ?? 'Present';
  if (!VALID_TENSE_TAGS.includes(tenseTag)) {
    throw new ApiError(`tenseTag ไม่ถูกต้อง: ${tenseTag} — ต้องเป็น ${VALID_TENSE_TAGS.join(' / ')}`, 422);
  }

  const ttsSystem = body.ttsSystem ?? existing?.ttsSystem ?? 'female';
  if (!VALID_TTS.includes(ttsSystem)) throw new ApiError(`ttsSystem ไม่ถูกต้อง: ${ttsSystem}`, 422);

  const items = Array.isArray(body.items) ? body.items : undefined;
  if (requireItems && (!items || items.length < MIN_ITEMS)) {
    throw new ApiError(`ต้องมีอย่างน้อย ${MIN_ITEMS} ข้อ (ได้ ${items?.length ?? 0} ข้อ)`, 422);
  }

  let cleanItems;
  if (items !== undefined) {
    cleanItems = items.map((it) => {
      const mode = VALID_MODES.includes(it.mode) ? it.mode : 'reorder';
      const targetSentence = (it.targetSentence ?? '').trim();
      const sentenceTH = (it.sentenceTH ?? '').trim();
      const scrambledWords = Array.isArray(it.scrambledWords)
        ? it.scrambledWords.map((w) => String(w).trim()).filter(Boolean)
        : [];
      const missingWord = (it.missingWord ?? '').trim();
      const correctAnswer = (it.correctAnswer ?? '').trim();
      const tenseIndicator = VALID_TENSE_TAGS.includes(it.tenseIndicator) ? it.tenseIndicator : tenseTag;
      const ttsVoice = VALID_TTS.includes(it.ttsVoice) ? it.ttsVoice : ttsSystem;

      // distractors: คำตอบที่ผิด (สูงสุด 2 ช่อง) ตัดค่าว่าง/ซ้ำ/ซ้ำกับคำตอบถูกออก
      const rawDistractors = Array.isArray(it.distractors) ? it.distractors : [];
      const seen = new Set([correctAnswer.toLowerCase()]);
      const distractors = [];
      for (const d of rawDistractors) {
        const v = String(d ?? '').trim();
        if (!v) continue;
        const key = v.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        distractors.push(v);
        if (distractors.length >= 2) break;
      }

      const cleanCore = {
        mode,
        targetSentence,
        sentenceTH,
        scrambledWords,
        missingWord,
        correctAnswer,
        tenseIndicator,
        ttsVoice,
        distractors,
      };

      // Dual-write: สร้าง/sync legacy fields ควบคู่ไปกับ schema ใหม่เสมอ
      const legacyFields = syncLegacyTenseFields(it, cleanCore);

      return {
        ...legacyFields,
        ...cleanCore,
      };
    });
    for (let i = 0; i < cleanItems.length; i++) {
      const it = cleanItems[i];
      if (!it.targetSentence || !it.correctAnswer) {
        throw new ApiError(`ข้อที่ ${i + 1}: ต้องกรอกประโยคเป้าหมาย และคำตอบที่ถูกต้อง`, 422);
      }
    }
  }

  return {
    title,
    description: (body.description ?? '').trim(),
    level,
    tenseTag,
    ttsSystem,
    status: body.status === 'published' ? 'published' : 'draft',
    items: cleanItems,
  };
}

// GET /api/admin/tense-sets — ดึงชุด Tense ทั้งหมด
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection('exercises').where('category', '==', 'tense').get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
    return res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    return sendError(res, err);
  }
});

// GET /api/admin/tense-sets/:id — ดึงชุดเดียว (สำหรับหน้าแก้ไข)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const snap = await db.collection('exercises').doc(id).get();
    if (!snap.exists) throw new ApiError(`ไม่พบชุด id=${id}`, 404);
    return res.json({ success: true, data: { id: snap.id, ...snap.data() } });
  } catch (err) {
    return sendError(res, err);
  }
});

// POST /api/admin/tense-sets — สร้างชุดใหม่
router.post('/', async (req, res) => {
  try {
    const clean = validatePayload(req.body, { requireItems: true });
    const now = FieldValue.serverTimestamp();
    const data = {
      ...clean,
      category: 'tense',
      createdAt: now,
      updatedAt: now,
    };
    const ref = await db.collection('exercises').add(data);
    const created = await ref.get();
    return res.status(201).json({ success: true, data: { id: created.id, ...created.data() } });
  } catch (err) {
    return sendError(res, err);
  }
});

// PUT /api/admin/tense-sets/:id — อัปเดต
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection('exercises').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiError(`ไม่พบชุด id=${id}`, 404);

    const clean = validatePayload(req.body, { requireItems: true, existing: snap.data() });
    clean.updatedAt = FieldValue.serverTimestamp();
    await ref.update(clean);

    const after = await ref.get();
    return res.json({ success: true, data: { id: after.id, ...after.data() } });
  } catch (err) {
    return sendError(res, err);
  }
});

// DELETE /api/admin/tense-sets/:id — ลบ
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection('exercises').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiError(`ไม่พบชุด id=${id}`, 404);
    await ref.delete();
    return res.json({ success: true, message: `ลบชุด Tense ${id} แล้ว` });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;