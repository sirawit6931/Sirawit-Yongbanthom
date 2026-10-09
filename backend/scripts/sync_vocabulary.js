// backend/scripts/sync_vocabulary.js
// ซิงก์ data/oxford_vocabulary.json (Oxford 3000 A1+A2 = 1,772 คำ) เข้า Firestore collection `vocabulary`
//  - doc ที่ id ตรงกับที่มีอยู่ -> อัปเดต field (wordEN/wordTH/cefrLevel/partOfSpeech) แบบ merge
//    (คง createdAt/ttsVoice/usedInExercises ที่ admin เคยตั้งไว้)
//  - doc ใหม่ -> สร้างด้วย id จาก data
//  - doc ที่ไม่อยู่ในลิสต์ (นอก Oxford A1+A2) -> ลบ (มี exactly 1: grade / a2_056)
// รัน: node scripts/sync_vocabulary.js   (จากโฟลเดอร์ backend)
// ทำซ้ำได้ (idempotent)
require('dotenv').config();
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const serviceAccount = require('../serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const data = require('../data/oxford_vocabulary.json');

const BATCH = 400;

async function main() {
  if (data.length !== 1772) {
    throw new Error(`data ต้องมี 1772 คำ (พบ ${data.length})`);
  }
  const targetIds = new Set(data.map((d) => d.id));

  const snap = await db.collection('vocabulary').get();
  const existing = new Map(snap.docs.map((d) => [d.id, d]));
  console.log(`vocabulary ปัจจุบัน: ${existing.size} docs`);

  // 1) upsert 1772 docs
  let n = 0;
  for (let i = 0; i < data.length; i += BATCH) {
    const chunk = data.slice(i, i + BATCH);
    const batch = db.batch();
    for (const v of chunk) {
      const ref = db.collection('vocabulary').doc(v.id);
      const prev = existing.get(v.id);
      const payload = {
        wordEN: v.wordEN,
        wordTH: v.wordTH,
        cefrLevel: v.cefrLevel,
        partOfSpeech: v.partOfSpeech || '',
        ttsVoice: prev && prev.data().ttsVoice !== undefined ? prev.data().ttsVoice : '',
        createdAt: prev && prev.data().createdAt !== undefined ? prev.data().createdAt : new Date(),
      };
      // เผื่อ doc เก่าที่ยังมี field `level` ค้าง (legacy) — ลบออกให้เหลือ cefrLevel ตาม SCHEMA.md
      const legacyLevel = prev && prev.data();
      if (legacyLevel && Object.prototype.hasOwnProperty.call(legacyLevel, 'level')) {
        payload.level = FieldValue.delete();
      }
      batch.set(ref, payload, { merge: true });
      n += 1;
    }
    await batch.commit();
    console.log(`   upsert ${Math.min(i + BATCH, data.length)}/${data.length}`);
  }
  console.log(`✅ upsert แล้ว ${n} docs`);

  // 2) ลบ docs ที่ไม่อยู่ในลิสต์
  const toDelete = [];
  for (const id of existing.keys()) {
    if (!targetIds.has(id)) toDelete.push(id);
  }
  if (toDelete.length) {
    for (let i = 0; i < toDelete.length; i += BATCH) {
      const chunk = toDelete.slice(i, i + BATCH);
      const batch = db.batch();
      for (const id of chunk) batch.delete(db.collection('vocabulary').doc(id));
      await batch.commit();
    }
    console.log(`🗑️  ลบ docs นอกลิสต์ ${toDelete.length} ตัว:`, toDelete.join(', '));
  } else {
    console.log('🗑️  ไม่มี docs ที่ต้องลบ');
  }

  // 3) verify
  const after = await db.collection('vocabulary').get();
  const byLevel = {};
  let missingTH = 0;
  let missingPOS = 0;
  for (const d of after.docs) {
    const v = d.data();
    const lv = v.cefrLevel || '(none)';
    byLevel[lv] = (byLevel[lv] || 0) + 1;
    if (!v.wordTH) missingTH += 1;
    if (!v.partOfSpeech) missingPOS += 1;
  }
  console.log('verify → total:', after.size, '| by level:', byLevel,
    '| missing wordTH:', missingTH, '| missing partOfSpeech:', missingPOS);
  if (after.size !== 1772) throw new Error(`ต้องได้ 1772 แต่ได้ ${after.size}`);
  if (byLevel.A1 !== 900 || byLevel.A2 !== 872) throw new Error('ระดับไม่ตรง A1=900/A2=872');
  console.log('🎉 sync vocabulary สำเร็จ — ครบ 1,772 คำ (A1: 900, A2: 872)');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ sync failed:', err.message);
  console.error(err);
  process.exit(1);
});
