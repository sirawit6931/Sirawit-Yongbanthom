// backend/scripts/vocabInventory.js
// อ่าน collection `vocabulary` จาก Firestore (read-only) แล้วบันทึกเป็น JSON
// รัน: node scripts/vocabInventory.js   (จากโฟลเดอร์ backend)
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const serviceAccount = require('../serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

(async () => {
  const snap = await db.collection('vocabulary').get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  docs.sort((a, b) => String(a.wordEN || '').localeCompare(String(b.wordEN || '')));

  const outPath = path.join(__dirname, 'vocab_existing.json');
  fs.writeFileSync(outPath, JSON.stringify(docs, null, 1), 'utf8');

  const byLevel = {};
  for (const d of docs) {
    const lv = d.cefrLevel || d.level || '(none)';
    byLevel[lv] = (byLevel[lv] || 0) + 1;
  }
  console.log('total vocabulary docs:', docs.length);
  console.log('by level:', byLevel);
  console.log('missing wordTH:', docs.filter((d) => !d.wordTH).length);
  console.log('written:', outPath);
  process.exit(0);
})().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
