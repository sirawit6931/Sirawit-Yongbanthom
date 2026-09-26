// backend/routes/adminListeningReadingRoutes.js
// Admin Listening & Reading (Dialogue) Sets API — mount ที่ /api/admin/listening-reading-sets
// ดูแลชุดแบบฝึกหัดหมวดฟังและอ่าน (category = 'listening') แบบเฉพาะทาง
//
// รูปแบบ: Chat/Dialogue Builder — บทสนทนา 1 ชุด + คำถามความเข้าใจ 3 ข้อ
// ผู้พูด 2 คน (A/B) พร้อมตั้งค่าเสียง TTS แยกเป็นรายบุคคล
const express = require('express');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../config/firebase');
const { requireAdmin } = require('../middleware/authMiddleware');
const { ApiError } = require('../services/exerciseGeneratorService');

const router = express.Router();
router.use(requireAdmin);

const VALID_LEVELS = ['A1', 'A2'];
const VALID_TTS = ['male', 'female'];
const REQUIRED_QUESTIONS = 3;

function sendError(res, err) {
  const status = err instanceof ApiError ? err.statusCode : 500;
  if (status >= 500) console.error('[adminListeningReadingRoutes]', err.message);
  return res.status(status).json({ success: false, error: err.message });
}

// ตรวจ payload สำหรับชุด Listening/Reading (Dialogue)
function validatePayload(body, { requireItems = true } = {}) {
  if (!body || typeof body !== 'object') throw new ApiError('ข้อมูลไม่ถูกส่ง', 400);

  const title = (body.title ?? '').trim();
  if (!title) throw new ApiError('กรุณากรอกชื่อชุดแบบฝึกหัด', 422);

  const level = body.level ?? 'A1';
  if (!VALID_LEVELS.includes(level)) throw new ApiError(`ระดับไม่ถูกต้อง: ${level}`, 422);

  // Speaker A & B voice settings
  const speakerA = {
    name: (body.speakerA?.name ?? 'Speaker A').trim() || 'Speaker A',
    ttsVoice: VALID_TTS.includes(body.speakerA?.ttsVoice) ? body.speakerA.ttsVoice : 'male',
  };
  const speakerB = {
    name: (body.speakerB?.name ?? 'Speaker B').trim() || 'Speaker B',
    ttsVoice: VALID_TTS.includes(body.speakerB?.ttsVoice) ? body.speakerB.ttsVoice : 'female',
  };

  // Dialogue script
  const dialogue = Array.isArray(body.dialogue) ? body.dialogue : [];
  if (requireItems && dialogue.length === 0) {
    throw new ApiError('กรุณาเพิ่มบทสนทนาอย่างน้อย 1 บรรทัด', 422);
  }
  const cleanDialogue = dialogue.map((d) => ({
    speaker: d.speaker === 'B' ? 'B' : 'A',
    text: (d.text ?? '').trim(),
  })).filter((d) => d.text.length > 0);

  if (requireItems && cleanDialogue.length === 0) {
    throw new ApiError('บทสนทนาต้องมีข้อความอย่างน้อย 1 บรรทัด', 422);
  }

  // Comprehension questions — exactly 3
  const questions = Array.isArray(body.questions) ? body.questions : [];
  if (requireItems && questions.length !== REQUIRED_QUESTIONS) {
    throw new ApiError(`ต้องมีคำถามความเข้าใจ ${REQUIRED_QUESTIONS} ข้อเท่านั้น (ได้ ${questions.length})`, 422);
  }

  const cleanQuestions = questions.map((q) => {
    const opts = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 4) : [];
    const correctIdx = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
    return {
      prompt: (q.prompt ?? '').trim(),
      options: opts,
      correctIndex: correctIdx >= 0 && correctIdx < opts.length ? correctIdx : 0,
    };
  });

  for (let i = 0; i < cleanQuestions.length; i++) {
    const q = cleanQuestions[i];
    if (!q.prompt || q.options.length < 2) {
      throw new ApiError(`คำถาม ${i + 1}: ต้องกรอกคำถาม และตัวเลือกอย่างน้อย 2 ตัวเลือก`, 422);
    }
  }

  return {
    title,
    description: (body.description ?? '').trim(),
    level,
    speakerA,
    speakerB,
    dialogue: cleanDialogue,
    questions: cleanQuestions,
    status: body.status === 'published' ? 'published' : 'draft',
  };
}

// GET /api/admin/listening-reading-sets — ดึงชุดทั้งหมด
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection('exercises').where('category', '==', 'listening').get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
    return res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    return sendError(res, err);
  }
});

// POST /api/admin/listening-reading-sets — สร้างชุดใหม่
router.post('/', async (req, res) => {
  try {
    const clean = validatePayload(req.body, { requireItems: true });
    const now = FieldValue.serverTimestamp();
    const data = {
      ...clean,
      category: 'listening',
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

// PUT /api/admin/listening-reading-sets/:id — อัปเดต
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

// DELETE /api/admin/listening-reading-sets/:id — ลบ
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection('exercises').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiError(`ไม่พบชุด id=${id}`, 404);
    await ref.delete();
    return res.json({ success: true, message: `ลบชุดฟังและอ่าน ${id} แล้ว` });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;