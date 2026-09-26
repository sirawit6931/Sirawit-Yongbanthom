// backend/routes/adminVocabularyRoutes.js
// Admin Vocabulary Exercise Sets API — mount ที่ /api/admin/vocabulary-sets
// ดูแลชุดแบบฝึกหัดหมวดคำศัพท์ (category = 'vocab') แบบเฉพาะทาง
//
// รองรับ 4 โหมดคำถาม: matching, spelling, listen-repeat, fill-blank
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
const MIN_ITEMS = 4;
const MAX_ITEMS = 15;

function sendError(res, err) {
  const status = err instanceof ApiError ? err.statusCode : 500;
  if (status >= 500) console.error('[adminVocabularyRoutes]', err.message);
  return res.status(status).json({ success: false, error: err.message });
}

// ตรวจ payload สำหรับชุดคำศัพท์
function validatePayload(body, { requireItems = true } = {}) {
  if (!body || typeof body !== 'object') throw new ApiError('ข้อมูลไม่ถูกส่ง', 400);

  const title = (body.title ?? '').trim();
  if (!title) throw new ApiError('กรุณากรอกชื่อชุดแบบฝึกหัด', 422);

  const level = body.level ?? 'A1';
  if (!VALID_LEVELS.includes(level)) throw new ApiError(`ระดับไม่ถูกต้อง: ${level}`, 422);

  const ttsSystem = body.ttsSystem ?? 'female';
  if (!VALID_TTS.includes(ttsSystem)) throw new ApiError(`ttsSystem ไม่ถูกต้อง: ${ttsSystem}`, 422);

  const playbackSpeed = body.playbackSpeed ?? 1.0;
  if (typeof playbackSpeed !== 'number' || playbackSpeed < 0.5 || playbackSpeed > 2.0) {
    throw new ApiError('playbackSpeed ต้องเป็นตัวเลข 0.5-2.0', 422);
  }

  const items = Array.isArray(body.items) ? body.items : undefined;
  if (requireItems && (!items || items.length < MIN_ITEMS || items.length > MAX_ITEMS)) {
    throw new ApiError(`จำนวนข้อต้อง ${MIN_ITEMS}-${MAX_ITEMS} ข้อ (ได้ ${items?.length ?? 0})`, 422);
  }

  let cleanItems;
  if (items !== undefined) {
    cleanItems = items.map((it) => ({
      wordId: (typeof it.wordId === 'string' && it.wordId.trim())
        ? it.wordId.trim()
        : 'vs_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      wordEN: (it.wordEN ?? '').trim(),
      wordTH: (it.wordTH ?? '').trim(),
      sentence: (it.sentence ?? '').trim(),
      sentenceTH: (it.sentenceTH ?? '').trim(),
      ttsVoice: VALID_TTS.includes(it.ttsVoice) ? it.ttsVoice : ttsSystem,
      playbackSpeed: typeof it.playbackSpeed === 'number' ? it.playbackSpeed : playbackSpeed,
      distractors: Array.isArray(it.distractors)
        ? it.distractors.map((d) => String(d).trim()).filter(Boolean).slice(0, 2)
        : [],
    }));
    for (let i = 0; i < cleanItems.length; i++) {
      if (!cleanItems[i].wordEN || !cleanItems[i].wordTH) {
        throw new ApiError(`ข้อที่ ${i + 1}: ต้องกรอกคำศัพท์ (EN) และคำแปล (TH)`, 422);
      }
    }
    for (let i = 0; i < cleanItems.length; i++) {
      const s = cleanItems[i].sentence;
      const en = cleanItems[i].wordEN;
      if (s && s.toLowerCase().indexOf(en.toLowerCase()) === -1) {
        throw new ApiError(`ข้อที่ ${i + 1}: ประโยคต้องมีคำว่า "${en}"`, 422);
      }
    }
  }

  // Handle spellingWords field
  let cleanSpellingWords = [];
  const spellingWords = Array.isArray(body.spellingWords) ? body.spellingWords : undefined;
  if (spellingWords !== undefined) {
    cleanSpellingWords = spellingWords.map((word) => ({
      wordEN: (word.wordEN ?? '').trim(),
      wordTH: (word.wordTH ?? '').trim(),
    })).filter(word => word.wordEN && word.wordTH);
    
    // Validate spelling words count
    if (cleanSpellingWords.length > 15) {
      throw new ApiError('จำนวนคำศัพท์สำหรับสะกดต้องไม่เกิน 15 คำ', 422);
    }
  }

  // Handle listenRepeatWords field
  let cleanListenRepeatWords = [];
  const listenRepeatWords = Array.isArray(body.listenRepeatWords) ? body.listenRepeatWords : undefined;
  if (listenRepeatWords !== undefined) {
    cleanListenRepeatWords = listenRepeatWords.map((word) => ({
      wordEN: (word.wordEN ?? '').trim(),
      wordTH: (word.wordTH ?? '').trim(),
    })).filter(word => word.wordEN && word.wordTH);

    // Validate listenRepeatWords count
    if (cleanListenRepeatWords.length > 15) {
      throw new ApiError('จำนวนคำสำหรับ Listen & Repeat ต้องไม่เกิน 15 คำ', 422);
    }
  }

  // Handle fillInBlankSentences field (FIB) — อนุญาตให้ใช้คำศัพท์ซ้ำได้ แต่ประโยคต้องไม่ซ้ำกัน
  let cleanFillInBlankSentences = [];
  const fillInBlankSentences = Array.isArray(body.fillInBlankSentences) ? body.fillInBlankSentences : undefined;
  if (fillInBlankSentences !== undefined) {
    cleanFillInBlankSentences = fillInBlankSentences
      .map((f) => ({
        wordEN: (f.wordEN ?? '').trim(),
        wordTH: (f.wordTH ?? '').trim(),
        sentence: (f.sentence ?? '').trim(),
        sentenceTH: (f.sentenceTH ?? '').trim(),
      }))
      .filter((f) => f.sentence || f.sentenceTH);

    const seenSentences = new Set();
    const seenWords = new Set();
    for (let i = 0; i < cleanFillInBlankSentences.length; i++) {
      const f = cleanFillInBlankSentences[i];
      if (f.sentence && f.wordEN && f.sentence.toLowerCase().indexOf(f.wordEN.toLowerCase()) === -1) {
        throw new ApiError(`ประโยคที่ ${i + 1}: ต้องมีคำว่า "${f.wordEN}"`, 422);
      }
      const wordKey = f.wordEN.toLowerCase();
      if (wordKey && seenWords.has(wordKey)) {
        throw new ApiError(`ประโยคที่ ${i + 1}: คำศัพท์ "${f.wordEN}" ถูกใช้ซ้ำในหลายประโยค`, 422);
      }
      if (wordKey) seenWords.add(wordKey);
      const key = (f.sentence || f.sentenceTH).toLowerCase();
      if (key && seenSentences.has(key)) {
        throw new ApiError(`ประโยคซ้ำกัน: "${f.sentence || f.sentenceTH}" — กรุณาใช้ประโยคที่ไม่ซ้ำ`, 422);
      }
      if (key) seenSentences.add(key);
    }
  }

  // Compute question statistics for frontend display
  const matchingCount = 1;  // Always 1 matching stage
  const spellingCount = cleanSpellingWords.length;
  const listenCount = cleanListenRepeatWords.length;
  // FIB count: 1 ประโยค = 1 ข้อ (ใช้ fillInBlankSentences ถ้าส่งมา มิฉะนั้น fallback ไป items)
  const fibCount = fillInBlankSentences !== undefined
    ? cleanFillInBlankSentences.length
    : (cleanItems || []).filter(
      (it) => (it.sentence && it.sentence.trim()) || (it.sentenceTH && it.sentenceTH.trim())
    ).length;

  return {
    title,
    description: (body.description ?? '').trim(),
    level,
    ttsSystem,
    playbackSpeed,
    status: body.status === 'published' ? 'published' : 'draft',
    items: cleanItems,
    spellingWords: cleanSpellingWords,
    listenRepeatWords: cleanListenRepeatWords,
    fillInBlankSentences: cleanFillInBlankSentences,
    questionStats: {
      matching: matchingCount,
      spelling: spellingCount,
      listenRepeat: listenCount,
      fillBlank: fibCount,
    },
    totalQuestions: matchingCount + spellingCount + listenCount + fibCount,
  };
}

// GET /api/admin/vocabulary-sets — ดึงชุดคำศัพท์ทั้งหมด
router.get('/', async (req, res) => {
  try {
    const snap = await db.collection('exercises').where('category', '==', 'vocab').get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
    return res.json({ success: true, count: docs.length, data: docs });
  } catch (err) {
    return sendError(res, err);
  }
});

// POST /api/admin/vocabulary-sets — สร้างชุดใหม่
router.post('/', async (req, res) => {
  try {
    const clean = validatePayload(req.body, { requireItems: true });
    const now = FieldValue.serverTimestamp();
    const data = {
      ...clean,
      category: 'vocab',
      vocabularyLevel: clean.level,
      sourceVersion: 1,
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

// PUT /api/admin/vocabulary-sets/:id — อัปเดต
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection('exercises').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiError(`ไม่พบชุด id=${id}`, 404);

    const clean = validatePayload(req.body, { requireItems: true });
    clean.updatedAt = FieldValue.serverTimestamp();
    
    // For updates, preserve existing spellingWords if not provided in request
    const existingData = snap.data();
    if (req.body.spellingWords === undefined && existingData.spellingWords) {
      clean.spellingWords = existingData.spellingWords;
    }

    // For updates, preserve existing listenRepeatWords if not provided in request
    if (req.body.listenRepeatWords === undefined && existingData.listenRepeatWords) {
      clean.listenRepeatWords = existingData.listenRepeatWords;
    }

    // For updates, preserve existing fillInBlankSentences if not provided in request
    if (req.body.fillInBlankSentences === undefined && existingData.fillInBlankSentences) {
      clean.fillInBlankSentences = existingData.fillInBlankSentences;
    }
    
    await ref.update(clean);

    const after = await ref.get();
    return res.json({ success: true, data: { id: after.id, ...after.data() } });
  } catch (err) {
    return sendError(res, err);
  }
});

// DELETE /api/admin/vocabulary-sets/:id — ลบ
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const ref = db.collection('exercises').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new ApiError(`ไม่พบชุด id=${id}`, 404);
    await ref.delete();
    return res.json({ success: true, message: `ลบชุดคำศัพท์ ${id} แล้ว` });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;