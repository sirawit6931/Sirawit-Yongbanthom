const fs = require('fs');
const p = 'c:/my-eng/backend/public/admin/js/adminApp.js';
let t = fs.readFileSync(p, 'utf8');
const marker1 = "tensesetErr.textContent = `ข้อที่ ${i + 1}: กรุณากรอกคำที่สับสน`;";
if (!t.includes(marker1)) { console.error('MARKER1 NOT FOUND'); process.exit(1); }
// ลบบล็อก validation คำสับสนทั้ง if (4 บรรทัด: if / textContent / remove hidden / return / })
const startIdx = t.indexOf("\t\tif (item.mode === 'reorder'");
const endMarker = "\t\t}\n\t\tif (item.mode === 'fillBlank'";
const endIdx = t.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) { console.error('RANGE NOT FOUND'); process.exit(1); }
t = t.slice(0, startIdx) + "\t\t// โหมดเรียงประโยค: คำสับสนสร้างอัตโนมัติ (normalization ด้านล่าง) ไม่ต้องกรอก\n" + t.slice(endIdx + "\t\t}\n".length);
const marker2 = "const { _uid, ...rest } = item;";
if (!t.includes(marker2)) { console.error('MARKER2 NOT FOUND'); process.exit(1); }
t = t.split(marker2).join("const { _uid, _scrambleTimer, ...rest } = item;");
// แทรก normalization หลังลูป validation fillBlank (ก่อน const items = ...)
const anchor = "\t}\n\t\n\tconst items = tensesetItems.map(item => {";
if (!t.includes(anchor)) { console.error('ANCHOR NOT FOUND'); process.exit(1); }
const norm = "\t}\n\t\n\t// Normalization ก่อนส่ง: default คำตอบ + สร้างคำสลับอัตโนมัติ\n\t// (backend บังคับ correctAnswer ทุกข้อ — โหมด reorder/listenRepeat ใช้ประโยคเป้าหมายเป็นคำตอบ)\n\tfor (let i = 0; i < tensesetItems.length; i++) {\n\t\tconst nItem = tensesetItems[i];\n\t\tif ((nItem.mode === 'reorder' || nItem.mode === 'listenRepeat') && (!nItem.correctAnswer || !nItem.correctAnswer.trim())) {\n\t\t\tnItem.correctAnswer = (nItem.targetSentence || '').trim();\n\t\t}\n\t\tif (nItem.mode === 'reorder' && (!nItem.scrambledWords || nItem.scrambledWords.length === 0)) {\n\t\t\tnItem.scrambledWords = autoScrambleSentence(nItem.targetSentence || '');\n\t\t}\n\t}\n\t\n\tconst items = tensesetItems.map(item => {";
t = t.split(anchor).join(norm);
fs.writeFileSync(p, t);
console.log('PATCHED OK');