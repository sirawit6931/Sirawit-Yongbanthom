// backend/scripts/migrate.js
// ─────────────────────────────────────────────────────────────────────────────
// ขั้นตอน M0.2–M0.3 — Unify schema ตาม `frontend/SCHEMA.md`
//
// การรัน:
//   node scripts/migrate.js           → DRY-RUN: แสดงสิ่งที่กำลังเปลี่ยนเท่านั้น
//   node scripts/migrate.js --apply    → เขียนจริงลง Firestore
//
// สิ่งที่ทำ:
//   1) vocabulary: ถ้า doc มี `level` (legacy จาก seed) → เปลี่ยนเป็น `cefrLevel`
//      (ตรงกับที่ adminService เขียนอยู่แล้ว) แล้วลบ field `level` ทิ้ง
//   2) exercises: backfill `status='published'` (มีชุดที่ seed อยู่แล้วก็เผยแพร่)
//      + `sourceVersion=1` และ `vocabularyLevel=level` เฉพาะหมวด vocab
//
// ใช้ Admin SDK ทำงาน — ข้าม Firestore Rules (เหมือน seed.js)
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const serviceAccount = require('../serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const APPLY = process.argv.includes('--apply');

const summary = {
  vocabChecked: 0,
  vocabLevelFixed: 0,
  exercisesChecked: 0,
  exStatusBackfilled: 0,
  exSourceBackfilled: 0,
  exStatusNormalized: 0,
};

async function log(action, message) {
  const tag = APPLY ? '[apply]' : '[dry-run]';
  console.log(`${tag} ${action}: ${message}`);
}

async function migrateVocabulary() {
  const snap = await db.collection('vocabulary').get();
  console.log(`— vocabulary: พบ ${snap.size} docs`);
  for (const doc of snap.docs) {
    summary.vocabChecked += 1;
    const data = doc.data();
    const updates = {};

    // field rename `level` → `cefrLevel`
    if (typeof data.level === 'string' && data.level && !data.cefrLevel) {
      updates.cefrLevel = data.level;
      updates.level = FieldValue.delete();
      summary.vocabLevelFixed += 1;
      await log(`vocabulary/${doc.id}`, `level ('${data.level}') → cefrLevel`);
    }

    if (Object.keys(updates).length > 0 && APPLY) {
      await doc.ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
    }
  }
}

async function migrateExercises() {
  const snap = await db.collection('exercises').get();
  console.log(`— exercises: พบ ${snap.size} docs`);
  for (const doc of snap.docs) {
    summary.exercisesChecked += 1;
    const data = doc.data();
    const updates = {};

    // backfill status → published (ชุด seed ที่เผยแพร่แล้ว)
    if (!data.status) {
      updates.status = 'published';
      summary.exStatusBackfilled += 1;
      await log(`exercises/${doc.id}`, 'เพิ่ม status=published');
    }

    // sourceVersion / vocabularyLevel เฉพาะชุด vocab ที่สร้างจาก pool คำศัพท์
    if (data.category === 'vocab') {
      if (typeof data.sourceVersion !== 'number') {
        updates.sourceVersion = 1;
        summary.exSourceBackfilled += 1;
        await log(`exercises/${doc.id}`, 'เพิ่ม sourceVersion=1');
      }
      if (!data.vocabularyLevel && data.level) {
        updates.vocabularyLevel = data.level;
        await log(`exercises/${doc.id}`, `เพิ่ม vocabularyLevel=${data.level}`);
      }
    }

    // Normalize สถานะที่เสีย (admin UI เคยส่ง label ภาษาไทยเป็นค่า status → user มองไม่เห็น)
    //  ค่าที่รู้จัก: 'เผยแพร่ทันที' → published, 'บันทึกเป็นแบบร่าง' / 'ร่าง' → draft
    //  ค่าอื่นใดที่ไมใช่ 'published'/'draft' → default เป็น 'draft'
    const rawStatus = data.status;
    if (rawStatus && rawStatus !== 'published' && rawStatus !== 'draft') {
      const statusMap = {
        'เผยแพร่ทันที': 'published',
        'บันทึกเป็นแบบร่าง': 'draft',
        'ร่าง': 'draft',
      };
      const newStatus = statusMap[rawStatus] || 'draft';
      if (!statusMap[rawStatus]) {
        await log(`exercises/${doc.id}`, `status='${rawStatus}' เป็นค่าที่ไม่รู้จัก → default 'draft'`);
      }
      updates.status = newStatus;
      summary.exStatusNormalized += 1;
      await log(`exercises/${doc.id}`, `status: '${rawStatus}' → '${newStatus}'`);
    }

    if (Object.keys(updates).length > 0 && APPLY) {
      await doc.ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
    }
  }
}

async function main() {
  console.log(`My-Eng Migration — mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);
  await migrateVocabulary();
  await migrateExercises();

  console.log('\n— สรุป —');
  console.table(summary);
  console.log(APPLY
    ? '✅ เสร็จสิ้น (apply แล้ว)'
    : 'ℹ️ นี่คือ dry-run — ใช้ `node scripts/migrate.js --apply` เพื่อเขียนจริง');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration ล้มเหลว:', err);
  process.exit(1);
});