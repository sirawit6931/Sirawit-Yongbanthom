// backend/routes/adminTenseRoutes.js
// Admin Tense Exercise Sets API — mount ที่ /api/admin/tense-sets
// ดูแลชุดแบบฝึกหัดหมวด Tense/Grammar (category = 'tense') แบบเฉพาะทาง
//
// รองรับ 3 โหมดคำถาม: sentence-reordering, fill-blank-tense, listen-repeat
// ครอบคลุม Present, Past, Future Tenses
// จำนวนข้อ: 10-15 ข้อต่อชุด
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
const MIN_ITEMS = 10;
const MAX_ITEMS = 15;

function sendError(res, err) {
  const status = err instanceof ApiError ? err.statusCode : 500;
  if (status >= 500) console.error('[adminTenseRoutes]', err.message);
  return res.status(status).json({ success: false, error: err.message });
}

// ตรวจ payload สำหรับชุด Tense
function validatePayload(body, { requireItems = true } = {}) {
  if (!body || typeof body !== 'object') throw new ApiError('ข้อมูลไม่ถูกส่ง', 400);

  const title = (body.title ?? '').trim();
  if (!title) throw new ApiError('กรุณากรอกชื่อชุดแบบฝึกหัด', 422);

  const level = body.level ?? 'A1';
  if (!VALID_LEVELS.includes(level)) throw new ApiError(`ระดับไม่ถูกต้อง: ${level}`, 422);

  const tenseTag = body.tenseTag ?? 'Present';
  if (!VALID_TENSE_TAGS.includes(tenseTag)) {
    throw new ApiError(`tenseTag ไม่ถูกต้อง: ${tenseTag} — ต้องเป็น ${VALID_TENSE_TAGS.join(' / ')}`, 422);
  }

  const ttsSystem = body.ttsSystem ?? 'female';
  if (!VALID_TTS.includes(ttsSystem)) throw new ApiError(`ttsSystem ไม่ถูกต้อง: ${ttsSystem}`, 422);

  const items = Array.isArray(body.items) ? body.items : undefined;
  if (requireItems && (!items || items.length < MIN_ITEMS || items.length > MAX_ITEMS)) {
    throw new ApiError(`จำนวนข้อต้อง ${MIN_ITEMS}-${MAX_ITEMS} ข้อ (ได้ ${items?.length ?? 0})`, 422);
  }

  let cleanItems;
  if (items !== undefined) {
    cleanItems = items.map((it) => ({
      targetSentence: (it.targetSentence ?? '').trim(),
      sentenceTH: (it.sentenceTH ?? '').trim(),
      scrambledWords: Array.isArray(it.scrambledWords)
        ? it.scrambledWords.map((w) => String(w).trim()).filter(Boolean)
        : [],
      missingWord: (it.missingWord ?? '').trim(),
      correctAnswer: (it.correctAnswer ?? '').trim(),
      tenseIndicator: (it.tenseIndicator ?? tenseTag).trim(),
      ttsVoice: VALID_TTS.includes(it.ttsVoice) ? it.ttsVoice : ttsSystem,
    }));
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

    const clean = validatePayload(req.body, { requireItems: true });
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