// backend/services/exerciseGeneratorService.js
// M1.3 — Exercise Generator Service
// สุ่มสร้างชุดแบบฝึกหัดหมวด vocab จากคลังคำศัพท์ (vocabulary) ที่ Admin จัดการ
// แล้วบันทึกเป็นสถานะ draft ให้ Admin ตรวจ/เผยแพร่ก่อนที่ผู้ใช้จะเห็น
const { FieldValue } = require('firebase-admin/firestore');
const { db } = require('../config/firebase');
const { buildQuizSession } = require('../../frontend/utils/learningEngine');

const VALID_LEVELS = ['A1', 'A2']; // ขอบเขต CEFR ของระบบ (ตาม SCHEMA.md)
const DEFAULT_SIZE = 10;
const MIN_SIZE = 1;
const MAX_SIZE = 15;
const DEFAULT_TTS = 'female';

/** ข้อผิดพลาดที่มี HTTP status — ใช้ใน routes เพื่อตอบสถานะที่ตรง */
class ApiError extends Error {
  constructor(message, statusCode = 422) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

function validateInputs({ level, size } = {}) {
  if (!VALID_LEVELS.includes(level)) {
    throw new ApiError(
      `ระดับไม่ถูกต้อง: ${level ?? '(ไม่ระบุ)'} — ต้องเป็น ${VALID_LEVELS.join(' หรือ ')}`,
      422
    );
  }
  const n = Number(size ?? DEFAULT_SIZE);
  if (!Number.isInteger(n) || n < MIN_SIZE || n > MAX_SIZE) {
    throw new ApiError(
      `จำนวนข้อไม่ถูกต้อง: ${size} — ต้องเป็นจำนวนเต็มระหว่าง ${MIN_SIZE}-${MAX_SIZE}`,
      422
    );
  }
  return { level, size: n };
}

async function getVocabPool(level) {
  // field มาตรฐานตาม SCHEMA.md คือ `cefrLevel`; เผื่อ docs เก่าที่ยังใช้ `level` (legacy จาก seed)
  let snap = await db.collection('vocabulary').where('cefrLevel', '==', level).get();
  if (snap.empty) {
    snap = await db.collection('vocabulary').where('level', '==', level).get();
  }
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function generateVocabExercise({ level, size, title, description, ttsSystem } = {}) {
  const { level: lv, size: n } = validateInputs({ level, size });

  // 1) ดึงคลังคำศัพท์ระดับนี้
  const pool = await getVocabPool(lv);
  if (pool.length === 0) {
    throw new ApiError(`ไม่พบคำศัพท์ระดับ ${lv} ในคลัง vocabulary`, 422);
  }
  if (pool.length < n) {
    throw new ApiError(`คลังคำศัพท์ระดับ ${lv} มีแค่ ${pool.length} คำ ไม่พอสำหรับ ${n} ข้อ`, 422);
  }

  // 2) สุ่มโจทย์ผ่าน learning engine (ส่ง doc ที่มี { id, wordEN, wordTH, ... })
  const { items: generatedItems } = buildQuizSession({
    exercise: { category: 'vocab', level: lv },
    vocabPool: pool,
    size: n,
  });

  if (!Array.isArray(generatedItems) || generatedItems.length < n) {
    throw new ApiError('สร้างโจทย์ไม่สำเร็จ — items ที่ได้ไม่ครบตามจำนวนที่ต้องการ', 500);
  }

  // 3) ประกอบ doc + บันทึกเป็น draft
  const now = FieldValue.serverTimestamp();
  const exerciseData = {
    category: 'vocab',
    level: lv,                   // field เดิมที่ ExerciseListScreen ใช้กรอง
    vocabularyLevel: lv,         // NEW — ตาม SCHEMA.md (ระดับ pool ที่สร้างชุดนี้)
    status: 'draft',             // ยังไม่เผยแพร่ — Admin กด publish ทีหลัง
    sourceVersion: 1,            // bump เมื่อ regenerate จาก vocabulary
    title: (title ?? '').trim() || `คำศัพท์ Oxford ${lv} (สุ่มอัตโนมัติ)`,
    description: (description ?? '').trim(),
    ttsSystem: ['male', 'female'].includes(ttsSystem) ? ttsSystem : DEFAULT_TTS,
    items: generatedItems,
    generatedAt: now,
    createdAt: now,
  };

  const ref = await db.collection('exercises').add(exerciseData);
  const created = await ref.get(); // อ่านกลับเพื่อเอา timestamp จริง (serverTimestamp)

  return { id: created.id, ...created.data() };
}

module.exports = { generateVocabExercise, getVocabPool, validateInputs, ApiError };