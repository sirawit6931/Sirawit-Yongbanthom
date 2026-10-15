// backend/scripts/seedTenseSetBasics.js
// ══════════════════════════════════════════════════════════════════════════════
// เพิ่มชุดแบบฝึกหัด Tense พื้นฐาน 1 ชุด (10 ข้อ: Present 4 / Past 3 / Future 3)
// ลง Firestore collection `exercises` (doc id: tex_basic_001, status: published)
//
// รัน:  node scripts/seedTenseSetBasics.js
//       node scripts/seedTenseSetBasics.js --dry-run   (ตรวจอย่างเดียว ไม่เขียน)
//
// รันซ้ำได้ — ใช้ set(..., { merge: true }) อัปเดตทับชุดเดิม
//
// แต่ละ item เขียนครบทั้ง 2 schema (ตรงกับ adminTenseRoutes.syncLegacyTenseFields):
//   - schema ใหม่ : mode, targetSentence, missingWord, correctAnswer, tenseIndicator,
//                   ttsVoice, distractors, scrambledWords
//   - schema เก่า : sentence (มี ___), answer, choices, orderWords, speakText,
//                   tenseType, tenseColor, exampleEN, exampleTH, sentenceTH
//   → User app (TenseExerciseScreen) เล่นได้ทันทีโดยไม่ต้องแก้ผ่านหน้าแอดมินก่อน
// ══════════════════════════════════════════════════════════════════════════════
require('dotenv').config();

const DRY_RUN = process.argv.includes('--dry-run');

// helper ร่วม (legacy sync / validate / Firestore write) — กินร่วมกับ seedTenseSetTopics.js
const {
  validateTenseSetDoc,
  buildTenseSetFinalDoc,
  writeSetToFirestore,
  connectFirebase,
} = require('./tenseSetSeedUtils');

// ─── ข้อมูลชุดฝึกหัด ───────────────────────────────────────────────────────────
// ทุกข้อ: targetSentence + sentenceTH + tenseIndicator + ttsVoice + mode
// fillBlank เพิ่ม correctAnswer (คำในช่องว่าง) + distractors (คำตอบผิด 2 คำ)
const SET_DOC = {
  id: 'tex_basic_001',
  category: 'tense',
  title: 'แบบฝึกหัด Tense พื้นฐาน (Present/Past/Future)',
  description:
    'Present Simple — สิ่งที่ทำเป็นประจำ / ข้อเท็จจริง · Past Simple — สิ่งที่ทำเสร็จจบลงไปแล้วในอดีต · Future Simple — สิ่งที่จะทำในอนาคต',
  level: 'A1',
  tenseTag: 'Present',
  ttsSystem: 'female',
  status: 'published',
  items: [
    // ── Present Simple (4 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'I _____ my hands before dinner.',
      sentenceTH: 'ฉันล้างมือของฉันก่อนอาหารเย็น',
      correctAnswer: 'wash',
      distractors: ['washes', 'washing'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'She _____ cold water every morning.',
      sentenceTH: 'เธอดื่มน้ำเย็นทุกเช้า',
      correctAnswer: 'drinks',
      distractors: ['drink', 'drinking'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'He cooks delicious breakfast for his family.',
      sentenceTH: 'เขาทำอาหารเช้าแสนอร่อยให้ครอบครัวของเขา',
      correctAnswer: 'He cooks delicious breakfast for his family.',
      distractors: [],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'They _____ the living room on weekends.',
      sentenceTH: 'พวกเขาทำความสะอาดห้องนั่งเล่นในวันหยุดเสาร์-อาทิตย์',
      correctAnswer: 'clean',
      distractors: ['cleans', 'cleaned'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    // ── Past Simple (3 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'I _____ up early yesterday.',
      sentenceTH: 'ฉันตื่นนอนแต่เช้าเมื่อวานนี้',
      correctAnswer: 'woke',
      distractors: ['wake', 'woken'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'She walked to the market this morning.',
      sentenceTH: 'เธอเดินไปตลาดเมื่อเช้านี้',
      correctAnswer: 'She walked to the market this morning.',
      distractors: [],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'He _____ a new book last night.',
      sentenceTH: 'เขาซื้อหนังสือเล่มใหม่เมื่อคืนนี้',
      correctAnswer: 'bought',
      distractors: ['buyed', 'buys'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    // ── Future Simple (3 ข้อ) ──
    {
      mode: 'reorder',
      targetSentence: 'I will study English tomorrow.',
      sentenceTH: 'ฉันจะเรียนภาษาอังกฤษในวันพรุ่งนี้',
      correctAnswer: 'I will study English tomorrow.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'She will _____ her doctor tonight.',
      sentenceTH: 'เธอจะโทรหาหมอของเธอคืนนี้',
      correctAnswer: 'call',
      distractors: ['calls', 'called'],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'listenRepeat',
      targetSentence: "We will go to bed at ten o'clock.",
      sentenceTH: 'พวกเราจะเข้านอนตอนสี่ทุ่ม',
      correctAnswer: "We will go to bed at ten o'clock.",
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
  ],
};


// ─── Functions ย้ายไป scripts/tenseSetSeedUtils.js แล้ว (ใช้ร่วมกับ seedTenseSetTopics.js) ──

async function main() {
  const doc = buildTenseSetFinalDoc(SET_DOC);

  console.log(
    `\n📦 เตรียมเขียนชุด Tense: "${doc.title}" — ${doc.items.length} ข้อ ` +
    `(fillBlank: ${doc.items.filter((i) => i.mode === 'fillBlank').length} · ` +
    `reorder: ${doc.items.filter((i) => i.mode === 'reorder').length} · ` +
    `listenRepeat: ${doc.items.filter((i) => i.mode === 'listenRepeat').length})`,
  );

  // validate ก่อนเชื่อม Firebase — ไม่เสีย quota/เวลาเมื่อข้อมูลผิด
  const errors = validateTenseSetDoc(doc);
  if (errors.length > 0) {
    console.error('\n❌ ข้อมูลไม่ผ่านการตรวจ — ยกเลิกการเขียนทั้งหมด:');
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }
  console.log('   ✅ ตรวจข้อมูลผ่านครบ (schema ใหม่ + legacy fields ครบทุกข้อ)');

  doc.items.forEach((it, i) => {
    console.log(
      `   • ข้อ ${i + 1} [${it.mode}/${it.tenseIndicator}] ${it.sentence} ` +
      `(เฉลย: ${it.answer}${it.choices.length ? ` · ตัวเลือก: ${it.choices.join('/')}` : ''})`,
    );
  });

  if (DRY_RUN) {
    console.log('\n🔍 --dry-run: ไม่เขียนลง Firestore\n');
    return;
  }

  // ── เชื่อม Firebase (throw ถ้าไม่มี serviceAccountKey.json) ──
  let db;
  try {
    db = connectFirebase();
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  }

  const action = await writeSetToFirestore(db, doc.id, doc);

  console.log(
    `\n🎉 ${action === 'updated' ? 'อัปเดต' : 'สร้าง'}ชุด ${doc.id} ลง Firestore เรียบร้อย ` +
    `(${doc.items.length} ข้อ, status: ${doc.status})`,
  );
  console.log('   ตรวจสอบ: Firebase Console → Firestore → collection "exercises"\n');
}

main().catch((err) => {
  console.error('\n❌ เกิดข้อผิดพลาด:', err.message);
  process.exit(1);
});

