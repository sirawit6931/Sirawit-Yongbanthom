// backend/routes/adminExerciseRoutes.js
// Admin Exercise API (M1.3) — mount ที่ /api/admin/exercises
//
// M1.1 — ป้องกันทุก endpoint ด้วย requireAdmin (ยืนยันตัวตน + สิทธิ์ admin)
const express = require('express');
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../config/firebase');
const { requireAdmin } = require('../middleware/authMiddleware');
const { generateVocabExercise, ApiError } = require('../services/exerciseGeneratorService');

const router = express.Router();

// ทุก route ใต้ /api/admin/exercises ต้องผ่านการยืนยัน admin ก่อน
router.use(requireAdmin);

// whitelist ฟิลด์ที่ PUT เปิดให้แก้ได้ (กันแก้ field ระบบ เช่น generatedAt/sourceVersion)
const EXERCISE_EDITABLE_FIELDS = [
  'title', 'description', 'level', 'category', 'ttsSystem',
  'status', 'items', 'dialogue', 'questions',
];

function sendError(res, err) {
  const status = err instanceof ApiError ? err.statusCode : 500;
  if (status >= 500) console.error('[adminExerciseRoutes]', err.message);
  return res.status(status).json({ success: false, error: err.message });
}

// POST /api/admin/exercises/generate — สุ่มสร้างชุด vocab → บันทึกเป็น draft
router.post('/generate', async (req, res) => {
  try {
    const { level, size, title, description, ttsSystem } = req.body ?? {};
    const exercise = await generateVocabExercise({ level, size, title, description, ttsSystem });
    return res.status(201).json({ success: true, data: exercise });
  } catch (err) {
    return sendError(res, err);
  }
});

const VALID_LEVELS = ['A1', 'A2'];
const VALID_CATEGORIES = ['vocab', 'tense', 'listening'];
const VALID_TTS = ['male', 'female'];

// จำนวนข้อสำหรับ vocab ตาม spec (6.1.5): 10–15 ข้อต่อแบบฝึกหัด
const VOCAB_MIN_ITEMS = 10;
const VOCAB_MAX_ITEMS = 15;

// ตรวจสอบ payload ที่สร้าง/อัปเดตชุดด้วยตนเอง (manual) และันคืน items ที่สะอาด
function validateManualPayload(body, { requireItems = true } = {}) {
  if (!body || typeof body !== 'object') {
    throw new ApiError('ข้อมูลไม่ถูกส่ง', 400);
  }
  const title = (body.title ?? '').trim();
  if (!title) throw new ApiError('กรุณากรอกชื่อชุดแบบฝึกหัด', 422);

  const category = body.category ?? 'vocab';
  if (!VALID_CATEGORIES.includes(category)) {
    throw new ApiError(`ประเภทไม่ถูกต้อง: ${category} — ต้องเป็น ${VALID_CATEGORIES.join(' หรือ ')}`, 422);
  }

  if (body.level !== undefined && !VALID_LEVELS.includes(body.level)) {
    throw new ApiError(`ระดับไม่ถูกต้อง: ${body.level} — ต้องเป็น ${VALID_LEVELS.join(' หรือ ')}`, 422);
  }

  const ttsSystem = (body.ttsSystem ?? 'female');
  if (!VALID_TTS.includes(ttsSystem)) {
    throw new ApiError(`ttsSystem ไม่ถูกต้อง: ${ttsSystem} — ต้องเป็น ${VALID_TTS.join(' หรือ ')}`, 422);
  }

  const status = body.status ?? 'draft';
  if (!['draft', 'published'].includes(status)) {
    throw new ApiError(`status ไม่ถูกต้อง: ${status} — ต้องเป็น draft หรือ published`, 422);
  }

  if (category === 'vocab') {
    const items = Array.isArray(body.items) ? body.items : undefined;
    if (requireItems && (!items || items.length < VOCAB_MIN_ITEMS)) {
      throw new ApiError(
        `แบบฝึกหัดคำศัพท์ต้องมี ${VOCAB_MIN_ITEMS}–${VOCAB_MAX_ITEMS} ข้อ (ได้ ${items?.length ?? 0} ข้อ)`,
        422,
      );
    }
    if (items && items.length > VOCAB_MAX_ITEMS) {
      throw new ApiError(
        `แบบฝึกหัดคำศัพท์ต้องมีไม่เกิน ${VOCAB_MAX_ITEMS} ข้อ (ได้ ${items.length} ข้อ)`,
        422,
      );
    }
    let cleanItems;
    if (items !== undefined) {
      cleanItems = items.map((it) => {
        // Dynamic distractors: รับ array สูงสุด 5 ช่อง — ว่าง [] = สุ่มอัตโนมัติตอนสอบ
        // ลำดับ: trim → กันซ้ำ+กันเท่าคำตอบถูกก่อน → ค่อยตัดเหลือ 5 (กันตัวหลังหลุดฟรี)
        const correctLow = String(it.wordEN ?? '').trim().toLowerCase();
        const seenPre = new Set();
        const deduped = (Array.isArray(it.distractors) ? it.distractors : [])
          .map((d) => String(d ?? '').trim())
          .filter((d) => {
            const low = d.toLowerCase();
            if (!low || low === correctLow || seenPre.has(low)) return false;
            seenPre.add(low);
            return true;
          });
        return {
          wordId: (typeof it.wordId === 'string' && it.wordId.trim())
            ? it.wordId.trim()
            : 'vs_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          wordEN: (it.wordEN ?? '').trim(),
          wordTH: (it.wordTH ?? '').trim(),
          sentence: (it.sentence ?? '').trim(),
          sentenceTH: (it.sentenceTH ?? '').trim(),
          distractors: deduped.slice(0, 5),
        };
      });
      for (let i = 0; i < cleanItems.length; i++) {
        if (!cleanItems[i].wordEN || !cleanItems[i].wordTH) {
          throw new ApiError(`ข้อ ${i + 1}: กรุณากรอกคำศัพท์ (EN) และคำแปล (TH) ให้ครบ`, 422);
        }
      }
    }
    return {
      title, description: (body.description ?? '').trim(), level: body.level, category, ttsSystem, status,
      items: cleanItems,
    };
  }

  if (category === 'tense') {
    const items = Array.isArray(body.items) ? body.items : undefined;
    if (requireItems && (!items || items.length === 0)) {
      throw new ApiError('กรุณาเพิ่มอย่างน้อย 1 ข้อคำถาม (items[])', 422);
    }
    if (items && items.length > 50) {
      throw new ApiError('จำนวนข้อเกิน 50 — โปรดลดจำนวน items', 422);
    }
    let cleanItems;
    if (items !== undefined) {
      cleanItems = items.map((it) => ({
        tenseType: (it.tenseType ?? '').trim(),
        tenseColor: (it.tenseColor ?? '#5B4FCF').trim(),
        exampleEN: (it.exampleEN ?? '').trim(),
        exampleTH: (it.exampleTH ?? '').trim(),
        sentenceTH: (it.sentenceTH ?? '').trim(),
        sentence: (it.sentence ?? '').trim(),
        answer: (it.answer ?? '').trim(),
        choices: Array.isArray(it.choices)
          ? it.choices.map((c) => String(c).trim()).filter(Boolean).slice(0, 4)
          : [],
        orderWords: Array.isArray(it.orderWords)
          ? it.orderWords.map((w) => String(w).trim()).filter(Boolean)
          : [],
        speakText: (it.speakText ?? '').trim(),
      }));
      for (let i = 0; i < cleanItems.length; i++) {
        const it = cleanItems[i];
        if (!it.tenseType || !it.answer) {
          throw new ApiError(`ข้อ ${i + 1}: กรุณากรอก tenseType และ answer`, 422);
        }
        if (!it.choices.includes(it.answer)) {
          throw new ApiError(`ข้อ ${i + 1}: answer ต้องอยู่ใน choices`, 422);
        }
        if (!it.orderWords.join(' ')) {
          throw new ApiError(`ข้อ ${i + 1}: กรุณากรอก orderWords`, 422);
        }
        if (!it.speakText) {
          it.speakText = it.orderWords.join(' ');
        }
      }
    }
    return {
      title, description: (body.description ?? '').trim(), level: body.level, category, ttsSystem, status,
      items: cleanItems,
    };
  }

  if (category === 'listening') {
    const dialogue = Array.isArray(body.dialogue) ? body.dialogue : [];
    const cleanDialogue = dialogue.map((d) => ({
      speaker: (d.speaker ?? 'A').trim(),
      side: ['left', 'right'].includes(d.side) ? d.side : (d.speaker === 'B' ? 'right' : 'left'),
      text: (d.text ?? '').trim(),
    })).filter((d) => d.text.length > 0);

    const questions = Array.isArray(body.questions) ? body.questions : [];
    if (requireItems && questions.length === 0) {
      throw new ApiError('กรุณาเพิ่มคำถามอย่างน้อย 1 ข้อ (questions[])', 422);
    }
    const cleanQuestions = questions.map((q) => {
      const opts = Array.isArray(q.choices)
        ? q.choices.map((o) => String(o).trim()).filter(Boolean).slice(0, 4)
        : [];
      const answer = (q.answer ?? '').trim();
      return {
        question: (q.question ?? '').trim(),
        choices: opts,
        answer,
      };
    });
    for (let i = 0; i < cleanQuestions.length; i++) {
      const q = cleanQuestions[i];
      if (!q.question || q.choices.length < 2) {
        throw new ApiError(`คำถาม ${i + 1}: ต้องกรอกคำถาม และตัวเลือกอย่างน้อย 2 ตัวเลือก`, 422);
      }
      if (!q.answer || !q.choices.includes(q.answer)) {
        throw new ApiError(`คำถาม ${i + 1}: ต้องกรอก answer ที่อยู่ใน choices`, 422);
      }
    }
    return {
      title, description: (body.description ?? '').trim(), level: body.level, category, ttsSystem, status,
      dialogue: cleanDialogue, questions: cleanQuestions,
    };
  }

  return {
    title, description: (body.description ?? '').trim(), level: body.level, category, ttsSystem, status,
  };
}

// POST /api/admin/exercises — สร้างชุดใหม่ด้วยตนเอง (manual) พร้อม items[]
router.post('/', async (req, res) => {
  try {
    const clean = validateManualPayload(req.body ?? {});
    if (!clean.category) throw new ApiError('กรุณาเลือกประเภท (category)', 422);
    if (!clean.level)    throw new ApiError('กรุณาเลือกระดับ (level)', 422);

    const now = FieldValue.serverTimestamp();
    const exerciseData = {
      category: clean.category,
      level: clean.level,
      vocabularyLevel: clean.level,   // SCHEMA.md: level ของ pool ที่ใช้สร้าง
      status: clean.status,
      title: clean.title,
      description: clean.description,
      ttsSystem: clean.ttsSystem,
      source: 'manual',               // ต่างจาก generator: ระบุว่าสร้างด้วยมือ
      createdAt: now,
      updatedAt: now,
      ...(clean.category === 'vocab' || clean.category === 'tense'
        ? { items: clean.items }
        : {}),
      ...(clean.category === 'listening'
        ? { dialogue: clean.dialogue, questions: clean.questions }
        : {}),
    };

    const ref = await db.collection('exercises').add(exerciseData);
    const created = await ref.get();
    return res.status(201).json({ success: true, data: { id: created.id, ...created.data() } });
  } catch (err) {
    return sendError(res, err);
  }
});

// GET /api/admin/exercises?category=&status=&level=
router.get('/', async (req, res) => {
  try {
    const { category, status, level } = req.query;
    let q = db.collection('exercises');
    if (category) q = q.where('category', '==', category);
    if (status)   q = q.where('status', '==', status);
    if (level)    q = q.where('level', '==', level);

    const snap = await q.get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));

    return res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    return sendError(res, err);
  }
});

// PUT /api/admin/exercises/:id — อัปเดต (เช่น publish draft→published, แก้ title/items)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return sendError(res, new ApiError('ไม่พบ id ของแบบฝึกหัด', 400));

    const body = req.body ?? {};

    // ถ่าส่ง items[] → ตรวจสอบ/ทำความสะอาดด้วย validator เดียวกับ POST /
    if (Object.prototype.hasOwnProperty.call(body, 'items')) {
      const clean = validateManualPayload({
        title: body.title ?? '',
        description: body.description,
        level: body.level,
        category: body.category,
        ttsSystem: body.ttsSystem,
        status: body.status,
        items: body.items,
      }, { requireItems: true });
      body.items = clean.items;
      if (clean.level !== undefined)        body.level = clean.level;
      if (clean.category !== undefined)     body.category = clean.category;
      if (clean.description !== undefined)  body.description = clean.description;
      if (clean.ttsSystem !== undefined)    body.ttsSystem = clean.ttsSystem;
    } else if (Object.prototype.hasOwnProperty.call(body, 'dialogue') || Object.prototype.hasOwnProperty.call(body, 'questions')) {
      const clean = validateManualPayload({
        title: body.title ?? '',
        description: body.description,
        level: body.level,
        category: body.category,
        ttsSystem: body.ttsSystem,
        status: body.status,
        dialogue: body.dialogue,
        questions: body.questions,
      }, { requireItems: true });
      body.dialogue = clean.dialogue;
      body.questions = clean.questions;
      if (clean.level !== undefined)        body.level = clean.level;
      if (clean.category !== undefined)     body.category = clean.category;
      if (clean.description !== undefined)  body.description = clean.description;
      if (clean.ttsSystem !== undefined)    body.ttsSystem = clean.ttsSystem;
    } else {
      // เผยแพร่/แก้ metadata อย่างเดียว — ตรวจค่าพื้นฐานถ้ามี
      if (body.level !== undefined && !VALID_LEVELS.includes(body.level)) {
        return sendError(res, new ApiError(`ระดับไม่ถูกต้อง: ${body.level}`, 422));
      }
      if (body.category !== undefined && !VALID_CATEGORIES.includes(body.category)) {
        return sendError(res, new ApiError(`ประเภทไม่ถูกต้อง: ${body.category}`, 422));
      }
      if (body.status !== undefined && !['draft', 'published'].includes(body.status)) {
        return sendError(res, new ApiError(`status ไม่ถูกต้อง: ${body.status}`, 422));
      }
    }

    const updates = {};
    for (const key of EXERCISE_EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, key)) updates[key] = body[key];
    }
    if (Object.keys(updates).length === 0) {
      return sendError(res, new ApiError('ไม่มีฟิลด์ที่แก้ไขได้ส่งมา', 400));
    }

    const ref = db.collection('exercises').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return sendError(res, new ApiError(`ไม่พบแบบฝึกหัด id=${id}`, 404));
    }

    updates.updatedAt = FieldValue.serverTimestamp();
    await ref.update(updates);

    const after = await ref.get();
    return res.json({ success: true, data: { id: after.id, ...after.data() } });
  } catch (err) {
    return sendError(res, err);
  }
});

// PATCH /api/admin/exercises/:id/status — สลับ/ตั้งสถานะ (draft ↔ published)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return sendError(res, new ApiError('ไม่พบ id ของแบบฝึกหัด', 400));
    const status = req.body?.status;
    if (!['draft', 'published'].includes(status)) {
      return sendError(res, new ApiError('status ไม่ถูกต้อง — ต้องเป็น draft หรือ published', 422));
    }
    const ref = db.collection('exercises').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return sendError(res, new ApiError(`ไม่พบแบบฝึกหัด id=${id}`, 404));
    await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
    return res.json({ success: true, data: { id, status } });
  } catch (err) {
    return sendError(res, err);
  }
});

// DELETE /api/admin/exercises/:id — ลบชุด
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return sendError(res, new ApiError('ไม่พบ id ของแบบฝึกหัด', 400));

    const ref = db.collection('exercises').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return sendError(res, new ApiError(`ไม่พบแบบฝึกหัด id=${id}`, 404));
    }

    await ref.delete();
    return res.json({ success: true, message: `ลบแบบฝึกหัด ${id} แล้ว` });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;