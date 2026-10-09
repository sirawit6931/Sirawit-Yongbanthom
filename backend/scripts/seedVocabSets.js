// backend/scripts/seedVocabSets.js
// ══════════════════════════════════════════════════════════════════════════════
// เขียนชุดแบบฝึกหัดคำศัพท์ 10 ชุด (A1×5 / A2×5) จาก scripts/vocabSetsData.js
// ลง Firestore collection `exercises`
//
// รัน:  node scripts/seedVocabSets.js
//       node scripts/seedVocabSets.js --dry-run   (ตรวจอย่างเดียว ไม่เขียน)
//
// รันซ้ำได้ — ใช้ doc().set() แบบ overwrite เฉพาะชุดที่กำหนดในไฟล์ข้อมูล
// ══════════════════════════════════════════════════════════════════════════════
require('dotenv').config();

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');

const {
  buildAllVocabSetDocs,
} = require('./vocabSetsData');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── เช็คข้อมูลก่อนเขียน — ถ้าไม่ผ่านให้หยุด ไม่เขียนอะไรเลย ────────────────
// เหตุผล: seed ที่เงียบ ๆ เขียนข้อมูลผิดจะไปโผล่ในแอปผู้ใช้ทันที
function validate(docs, vocabPool) {
  const errors = [];

  for (const d of docs) {
    // 1) จำนวนข้อในกรอบที่ API อนุญาต
    if (d.items.length < 4 || d.items.length > 15) {
      errors.push(`${d.id}: items ต้อง 4-15 ข้อ (ได้ ${d.items.length})`);
    }

    // 2) ครบทั้ง 4 รูปแบบฝึก
    const st = d.questionStats;
    if (st.matching < 1) errors.push(`${d.id}: ไม่มีด่าน matching`);
    if (st.spelling < 1) errors.push(`${d.id}: ไม่มีด่านสะกดคำ`);
    if (st.listenRepeat < 1) errors.push(`${d.id}: ไม่มีด่านฟัง-พูดตาม`);
    if (st.fillBlank < 1) errors.push(`${d.id}: ไม่มีด่านเติมช่องว่าง`);

    // 3) ทุกคำต้องมีอยู่ในคลังระดับเดียวกัน + ประโยคต้องมีคำนั้น
    d.items.forEach((i, idx) => {
      const hit = vocabPool.find((v) => v.wordEN === i.wordEN && v.cefrLevel === d.level);
      if (!hit) {
        errors.push(`${d.id} ข้อ ${idx + 1}: ไม่พบ "${i.wordEN}" ระดับ ${d.level} ในคลังคำศัพท์`);
      } else if (!i.wordTH) {
        errors.push(`${d.id} ข้อ ${idx + 1}: ไม่มีคำแปลจากคลัง`);
      }
      if (!i.sentence.toLowerCase().includes(i.wordEN.toLowerCase())) {
        errors.push(`${d.id} ข้อ ${idx + 1}: ประโยคต้องมีคำว่า "${i.wordEN}"`);
      }
    });

    // 4) FIB คำ/ประโยคห้ามซ้ำ (API throw ถ้าซ้ำ)
    const fibWords = d.fillInBlankSentences.map((f) => f.wordEN.toLowerCase());
    if (new Set(fibWords).size !== fibWords.length) errors.push(`${d.id}: FIB มีคำซ้ำ`);
    const fibSents = d.fillInBlankSentences.map((f) => f.sentence.toLowerCase());
    if (new Set(fibSents).size !== fibSents.length) errors.push(`${d.id}: FIB มีประโยคซ้ำ`);

    // 5) distractors ครบ 2 คำ ไม่ซ้ำคำตอบ
    d.items.forEach((i) => {
      if (i.distractors.length !== 2 || i.distractors.includes(i.wordEN)) {
        errors.push(`${d.id}/${i.wordEN}: distractors ไม่ถูกต้อง (${i.distractors.join(', ')})`);
      }
    });
  }

  // 6) id ห้ามซ้ำ
  const ids = docs.map((d) => d.id);
  if (new Set(ids).size !== ids.length) errors.push('id ชุดซ้ำกัน');

  return errors;
}

async function main() {
  const vocabPool = require('../data/oxford_vocabulary.json');
  const docs = buildAllVocabSetDocs(vocabPool);

  console.log(`\n📦 เตรียมเขียน ${docs.length} ชุด (A1: ${docs.filter(d=>d.level==='A1').length} / A2: ${docs.filter(d=>d.level==='A2').length})`);

  // ── validate ก่อนเชื่อม Firebase เพื่อไม่เสีย quota / เวลาเมื่อข้อมูลผิด ──
  const errors = validate(docs, vocabPool);
  if (errors.length > 0) {
    console.error('\n❌ ข้อมูลไม่ผ่านการตรวจ — ยกเลิกการเขียนทั้งหมด:');
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }
  console.log('   ✅ ตรวจข้อมูลผ่านครบ (4 รูปแบบฝึก / คำตรงคลัง / ประโยคมีคำ / FIB ไม่ซ้ำ)');

  docs.forEach((d) => {
    const s = d.questionStats;
    console.log(`   • ${d.id} ${d.level} ${d.items.length} ข้อ → matching:${s.matching} spelling:${s.spelling} listenRepeat:${s.listenRepeat} fillBlank:${s.fillBlank} (รวม ${d.totalQuestions} การ์ด)`);
  });

  if (DRY_RUN) {
    console.log('\n🔍 --dry-run: ไม่เขียนลง Firestore\n');
    return;
  }

  // ── เชื่อม Firebase ──
  let serviceAccount;
  try {
    serviceAccount = require('../serviceAccountKey.json');
  } catch {
    console.error('\n❌ ไม่พบ backend/serviceAccountKey.json — ดาวน์โหลดจาก Firebase Console → Project settings → Service accounts');
    process.exit(1);
  }

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  // batch สูงสุด 400 ตัว (ขีดจำกัด Firestore) — 10 ชุดเลยใช้ batch เดียวได้
  const batch = db.batch();
  for (const d of docs) {
    batch.set(db.collection('exercises').doc(d.id), {
      ...d,
      createdAt: new Date(), // อย่าใช้ FieldValue.serverTimestamp() เพราะ batch.set ไม่คืนค่ากลับ
    });
  }
  await batch.commit();

  console.log(`\n🎉 เขียน ${docs.length} ชุดลง Firestore เรียบร้อย`);
  console.log('   ตรวจสอบที่ Firebase Console → Firestore → collection "exercises"\n');
}

main().catch((err) => {
  console.error('\n❌ เกิดข้อผิดพลาด:', err.message);
  process.exit(1);
});
