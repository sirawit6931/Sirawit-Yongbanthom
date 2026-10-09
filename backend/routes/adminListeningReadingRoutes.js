// backend/routes/adminListeningReadingRoutes.js
// Admin Listening & Reading (Dialogue) Sets API — mount ที่ /api/admin/listening-reading-sets
// ดูแลชุดแบบฝึกหัดหมวดฟังและอ่าน (category = 'listening') แบบเฉพาะทาง
//
// รูปแบบ: บทสนทนา 1–3 ชุด (dialogues) — แต่ละชุดมีเส้นสนทนา + คำถาม 1 ข้อ
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
const MIN_DIALOGUES = 1;
const MAX_DIALOGUES = 3;
const MIN_LINES = 2;

// สะอาด: เส้นสนทนาบรรทัดเดียว
function cleanLine(d) {
  return {
    speaker: d && d.speaker === 'B' ? 'B' : 'A',
    text: d ? String(d.text ?? '').trim() : '',
  };
}

// สะอาด: คำถาม 1 ข้อ
function cleanQuestion(q) {
  const opts = Array.isArray(q && q.options)
    ? q.options.map((o) => String(o).trim()).filter(Boolean).slice(0, 4)
    : [];
  const correctIdx = q && typeof q.correctIndex === 'number' ? q.correctIndex : 0;
  return {
    prompt: q ? String(q.prompt ?? '').trim() : '',
    options: opts,
    correctIndex: correctIdx >= 0 && correctIdx < opts.length ? correctIdx : 0,
  };
}

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

  // บทสนทนา 1–3 ชุด — แต่ละชุดมีเส้นสนทนา + คำถาม 1 ข้อ
  // รองรับข้อมูลแบบเก่า: dialogue[] + questions[] → แปลงเป็น dialogues[]
  let rawDialogues = Array.isArray(body.dialogues) ? body.dialogues : null;
  if (!rawDialogues) {
    const legacyDialogue = Array.isArray(body.dialogue) ? body.dialogue : [];
    const legacyQuestions = Array.isArray(body.questions) ? body.questions : [];
    if (legacyDialogue.length > 0 || legacyQuestions.length > 0) {
      if (legacyQuestions.length > 0) {
        rawDialogues = legacyQuestions.map((q) => ({ lines: legacyDialogue, question: q }));
      } else {
        rawDialogues = [{ lines: legacyDialogue, question: {} }];
      }
    } else {
      rawDialogues = [];
    }
  }

  if (requireItems && rawDialogues.length < MIN_DIALOGUES) {
    throw new ApiError(`ต้องมีบทสนทนาอย่างน้อย ${MIN_DIALOGUES} ชุด`, 422);
  }
  if (rawDialogues.length > MAX_DIALOGUES) {
    throw new ApiError(`บทสนทนามีได้ไม่เกิน ${MAX_DIALOGUES} ชุด (ได้ ${rawDialogues.length})`, 422);
  }

  const dialogues = rawDialogues.map((d, di) => {
    const n = di + 1;
    const lines = Array.isArray(d && d.lines) ? d.lines.map(cleanLine).filter((l) => l.text.length > 0) : [];
    if (requireItems && lines.length < MIN_LINES) {
      throw new ApiError(`บทสนทนาที่ ${n}: ต้องมีเส้นสนทนาอย่างน้อย ${MIN_LINES} บรรทัด`, 422);
    }
    const question = cleanQuestion(d ? d.question : null);
    if (requireItems && (!question.prompt || question.options.length < 2)) {
      throw new ApiError(`บทสนทนาที่ ${n}: ต้องกรอกคำถาม และตัวเลือกอย่างน้อย 2 ตัวเลือก`, 422);
    }
    return { lines, question };
  });

  return {
    title,
    description: (body.description ?? '').trim(),
    level,
    speakerA,
    speakerB,
    dialogues,
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

// GET /api/admin/listening-reading-sets/:id — ดึงชุดเดียว (สำหรับหน้าแก้ไข)
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