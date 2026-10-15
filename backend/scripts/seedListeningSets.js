// backend/scripts/seedListeningSets.js
// ══════════════════════════════════════════════════════════════════════════════
// เพิ่มชุดแบบฝึกหัดการฟังและการดู Tense 2 ชุด ลง Firestore collection `exercises`:
//   1. lex_daily_life_001 — ชีวิตประจำวัน (Daily Life)  3 บท × 1 คำถาม (3 ตัวเลือก)
//   2. lex_school_001     — โรงเรียน (School)           3 บท × 1 คำถาม (3 ตัวเลือก)
//
// กติกา (ตรงกับ adminListeningReadingRoutes + ListeningExerciseScreen):
//   - 1 บทสนทนา = 1 คำถาม + ตัวเลือก 3 ตัวเลือก (correctIndex ชี้เฉลย)
//   - บทละ ≥2 บรรทัด, ผู้พูด A/B พร้อม ttsVoice แยกคน
//
// รัน:  node scripts/seedListeningSets.js
//       node scripts/seedListeningSets.js --dry-run   (ตรวจอย่างเดียว ไม่เขียน)
// รันซ้ำได้ — set(..., { merge: true })
// ══════════════════════════════════════════════════════════════════════════════
require('dotenv').config();

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }       = require('firebase-admin/firestore');

const DRY_RUN = process.argv.includes('--dry-run');

const VALID_LEVELS = ['A1', 'A2'];
const VALID_TTS = ['male', 'female'];

// ─── ชุดที่ 1: ชีวิตประจำวัน (Daily Life) ─────────────────────────────────────
const DAILY_LIFE_LR = {
  id: 'lex_daily_life_001',
  category: 'listening',
  title: 'การฟังและการดู Tense ชีวิตประจำวัน (Daily Life)',
  description: 'บทสนทนาชีวิตประจำวัน 3 บท — กิจวัตรตอนเช้า · ทำความสะอาดบ้าน · แผนวันหยุด',
  level: 'A1',
  speakerA: { name: 'Ann', ttsVoice: 'male' },
  speakerB: { name: 'Ben', ttsVoice: 'female' },
  status: 'published',
  dialogues: [
    {
      topic: 'Morning Routine (กิจวัตรตอนเช้า)',
      lines: [
        { speaker: 'A', text: 'Good morning, Tom! What time do you wake up?' },
        { speaker: 'B', text: "I wake up at six o'clock every morning." },
        { speaker: 'A', text: 'Do you drink coffee or tea?' },
        { speaker: 'B', text: 'I drink warm tea, and then I eat breakfast.' },
      ],
      question: {
        prompt: 'What time does Tom wake up?',
        options: ["5 o'clock", "6 o'clock", "7 o'clock"],
        correctIndex: 1,
      },
    },
    {
      topic: 'Cleaning the House (การทำความสะอาดบ้าน)',
      lines: [
        { speaker: 'A', text: 'What did you do yesterday, Sarah?' },
        { speaker: 'B', text: 'I cleaned my bedroom and washed my clothes.' },
        { speaker: 'A', text: 'Did you cook dinner too?' },
        { speaker: 'B', text: 'No, my mother cooked rice and fish for us.' },
      ],
      question: {
        prompt: 'Which room did Sarah clean yesterday?',
        options: ['The kitchen', 'The living room', 'Her bedroom'],
        correctIndex: 2,
      },
    },
    {
      topic: 'Weekend Plans (แผนวันหยุดเสาร์-อาทิตย์)',
      lines: [
        { speaker: 'A', text: 'What will you do this weekend, Alex?' },
        { speaker: 'B', text: 'I will visit the big market with my sister.' },
        { speaker: 'A', text: 'Will you buy some fruit?' },
        { speaker: 'B', text: 'Yes, we will buy apples and oranges.' },
      ],
      question: {
        prompt: 'When will Alex go to the market?',
        options: ['Yesterday', 'Tonight', 'This weekend'],
        correctIndex: 2,
      },
    },
  ],
};

// ─── ชุดที่ 2: โรงเรียน (School) ──────────────────────────────────────────────
const SCHOOL_LR = {
  id: 'lex_school_001',
  category: 'listening',
  title: 'การฟังและการดู Tense โรงเรียน (School)',
  description: 'บทสนทนาในโรงเรียน 3 บท — ในห้องเรียน · ทำปากกาหาย · เตรียมตัวสอบ',
  level: 'A1',
  speakerA: { name: 'Ann', ttsVoice: 'male' },
  speakerB: { name: 'Ben', ttsVoice: 'female' },
  status: 'published',
  dialogues: [
    {
      topic: 'In the Classroom (ในห้องเรียน)',
      lines: [
        { speaker: 'A', text: 'Where is the teacher, Dan?' },
        { speaker: 'B', text: 'She is standing near the board.' },
        { speaker: 'A', text: 'What is she doing?' },
        { speaker: 'B', text: 'She is writing an English lesson.' },
      ],
      question: {
        prompt: 'Where is the teacher standing?',
        options: ['Near the door', 'Near the board', 'Outside the room'],
        correctIndex: 1,
      },
    },
    {
      topic: 'Lost Pen (ทำปากกาหาย)',
      lines: [
        { speaker: 'A', text: 'Oh no! I lost my new pen.' },
        { speaker: 'B', text: 'What colour is your pen, Emma?' },
        { speaker: 'A', text: 'It is blue. I used it in the library this morning.' },
        { speaker: 'B', text: 'Look! It is under your red book.' },
      ],
      question: {
        prompt: 'What item did Emma lose?',
        options: ['A blue pen', 'A red book', 'A bag'],
        correctIndex: 0,
      },
    },
    {
      topic: 'Studying for Test (เตรียมตัวสอบ)',
      lines: [
        { speaker: 'A', text: 'Will you study science tonight, Ben?' },
        { speaker: 'B', text: 'Yes, we will have a big test tomorrow.' },
        { speaker: 'A', text: 'Can I study with you in the library?' },
        { speaker: 'B', text: 'Yes, of course! Bring your notebook.' },
      ],
      question: {
        prompt: 'What subject will they have a test on tomorrow?',
        options: ['History', 'Science', 'Art'],
        correctIndex: 1,
      },
    },
  ],
};

const ALL_LISTENING_SETS = [DAILY_LIFE_LR, SCHOOL_LR];

// ─── Validate ก่อนเขียน — ตรง rule adminListeningReadingRoutes ─────────────────
function validateListeningSets(sets) {
  const errors = [];
  for (const s of sets) {
    if (!s.title || !s.title.trim()) errors.push(`${s.id}: title ว่าง`);
    if (!VALID_LEVELS.includes(s.level)) errors.push(`${s.id}: level ไม่ถูกต้อง`);
    for (const sp of ['speakerA', 'speakerB']) {
      if (!VALID_TTS.includes(s[sp]?.ttsVoice)) errors.push(`${s.id}: ${sp}.ttsVoice ไม่ถูกต้อง`);
    }
    if (!['published', 'draft'].includes(s.status)) errors.push(`${s.id}: status ไม่ถูกต้อง`);
    if (!Array.isArray(s.dialogues) || s.dialogues.length < 1) {
      errors.push(`${s.id}: ต้องมีบทสนทนาอย่างน้อย 1 ชุด`);
    } else if (s.dialogues.length > 3) {
      errors.push(`${s.id}: บทสนทนามีได้ไม่เกิน 3 ชุด (ได้ ${s.dialogues.length})`);
    }
    s.dialogues.forEach((d, di) => {
      const no = `${s.id} บทที่ ${di + 1}`;
      const lines = (d.lines || []).filter((l) => l.text && l.text.trim());
      if (lines.length < 2) errors.push(`${no}: ต้องมีเส้นสนทนาอย่างน้อย 2 บรรทัด`);
      for (const l of d.lines || []) {
        if (l.speaker !== 'A' && l.speaker !== 'B') errors.push(`${no}: speaker ต้องเป็น A หรือ B`);
      }
      const q = d.question || {};
      const opts = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
      if (!q.prompt || !q.prompt.trim()) errors.push(`${no}: ต้องกรอกคำถาม`);
      if (opts.length < 2) errors.push(`${no}: ต้องมีตัวเลือกอย่างน้อย 2 ตัวเลือก`);
      if (opts.length !== 3) errors.push(`${no}: ชุดนี้กำหนด 3 ตัวเลือก (ได้ ${opts.length})`);
      if (q.correctIndex < 0 || q.correctIndex >= opts.length) {
        errors.push(`${no}: correctIndex ไม่ตรงกับตัวเลือก`);
      }
    });
  }
  const ids = sets.map((s) => s.id);
  if (new Set(ids).size !== ids.length) errors.push('id ชุดซ้ำกัน');
  return errors;
}

async function main() {
  console.log(`\n📦 เตรียมเขียนชุด Listening ${ALL_LISTENING_SETS.length} ชุด:`);
  for (const s of ALL_LISTENING_SETS) {
    console.log(`   • ${s.id} "${s.title}" — ${s.dialogues.length} บท × 1 คำถาม`);
    s.dialogues.forEach((d, i) => {
      console.log(`       - บท ${i + 1} (${d.topic}): ${d.lines.length} บรรทัด · ${d.question.prompt}`);
    });
  }

  // validate ก่อนเชื่อม Firebase — ไม่เสีย quota/เวลาเมื่อข้อมูลผิด
  const errors = validateListeningSets(ALL_LISTENING_SETS);
  if (errors.length > 0) {
    console.error('\n❌ ข้อมูลไม่ผ่านการตรวจ — ยกเลิกการเขียนทั้งหมด:');
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }
  console.log('   ✅ ตรวจข้อมูลผ่านครบ (บท/เส้นสนทนา/คำถาม/ตัวเลือก 3 ครบทุกบท)');

  if (DRY_RUN) {
    console.log('\n🔍 --dry-run: ไม่เขียนลง Firestore\n');
    return;
  }

  let serviceAccount;
  try {
    serviceAccount = require('../serviceAccountKey.json');
  } catch {
    console.error('\n❌ ไม่พบ backend/serviceAccountKey.json');
    process.exit(1);
  }

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const now = new Date();
  for (const s of ALL_LISTENING_SETS) {
    const { id, ...rest } = s;
    const ref = db.collection('exercises').doc(id);
    const existing = await ref.get();
    await ref.set({ ...rest, createdAt: now, updatedAt: now }, { merge: true });
    console.log(`🎉 ${existing.exists ? 'อัปเดต' : 'สร้าง'}ชุด ${id} สำเร็จ (3 บท, status: ${s.status})`);
  }
  console.log('\n   ตรวจสอบ: Firebase Console → Firestore → collection "exercises"\n');
}

main().catch((err) => {
  console.error('\n❌ เกิดข้อผิดพลาด:', err.message);
  process.exit(1);
});

