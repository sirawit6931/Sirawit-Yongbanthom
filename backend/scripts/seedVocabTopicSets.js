// backend/scripts/seedVocabTopicSets.js
// ══════════════════════════════════════════════════════════════════════════════
// เพิ่มชุดแบบฝึกหัดคำศัพท์ 2 ชุด ลง Firestore collection `exercises`:
//   1. vex_a1_school_01 — คำศัพท์ A1 โรงเรียน    master 6 คู่ → รวม 10 ข้อ
//   2. vex_a1_daily_01  — คำศัพท์ A1 ชีวิตประจำวัน master 6 คู่ → รวม 15 ข้อ
//
// กติกา (ตามที่กำหนด):
//   - คำทุกคำต้องมีอยู่จริงใน backend/data/oxford_vocabulary.json ระดับ A1
//     (wordId/wordTH ดึงจากคลังอัตโนมัติ — ไม่เดาคำแปลเอง)
//   - Matching = master pairs 6 คู่/ชุด (อยู่ในช่วง 4-6 คู่)
//   - ด่านอื่น (spelling / listenRepeat / fillBlank) ใช้คำจาก master pairs เท่านั้น
//   - ประโยคต้องมีคำนั้นอยู่ข้างใน (backend API บังคับ) และ FIB ห้ามซ้ำคำ/ประโยค
//   - distractors = 2 คำจาก master pairs ชุดเดียวกัน (ไม่เท่ากับคำตอบถูก)
//
// รัน:  node scripts/seedVocabTopicSets.js
//       node scripts/seedVocabTopicSets.js --dry-run   (ตรวจอย่างเดียว ไม่เขียน)
// รันซ้ำได้ — set(..., { merge: true })
// ══════════════════════════════════════════════════════════════════════════════
require('dotenv').config();

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }       = require('firebase-admin/firestore');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── ข้อมูลชุด (master pairs + การแบ่งด่าน) ───────────────────────────────────
// words: master pairs (Matching) — ทุกคำต้องอยู่ในคลัง A1 จริง
// stages: spelling/listenRepeat/fillBlank ใช้คำจาก words เท่านั้น
const VOCAB_TOPIC_SETS = [
  {
    id: 'vex_a1_school_01',
    level: 'A1',
    theme: 'โรงเรียนและของใช้ในโรงเรียน',
    title: 'คำศัพท์ A1 โรงเรียนและของใช้ในโรงเรียน',
    description: 'คำศัพท์เกี่ยวกับโรงเรียน 6 คู่ — จับคู่ · สะกดคำ · ฟัง-พูดตาม · เติมช่องว่าง',
    ttsSystem: 'female',
    words: [
      { wordEN: 'book',   sentence: 'I read a book in the library.',      sentenceTH: 'ฉันอ่านหนังสือในห้องสมุด' },
      { wordEN: 'pen',    sentence: 'She writes with a new pen.',         sentenceTH: 'เธอเขียนด้วยปากกาใหม่' },
      { wordEN: 'pencil', sentence: 'He draws with a pencil.',            sentenceTH: 'เขาวาดภาพด้วยดินสอ' },
      { wordEN: 'bag',    sentence: 'My school bag is very big.',         sentenceTH: 'กระเป๋านักเรียนของฉันใหญ่มาก' },
      { wordEN: 'school', sentence: 'We go to school by bus.',            sentenceTH: 'เราไปโรงเรียนด้วยรถบัส' },
      { wordEN: 'teacher',sentence: 'Our teacher speaks English well.',   sentenceTH: 'ครูของเราพูดภาษาอังกฤษเก่ง' },
    ],
    stages: {
      spelling:      ['book', 'pencil', 'bag'],
      listenRepeat:  ['pen', 'school', 'teacher'],
      fillBlank:     ['book', 'pencil', 'school'],
    },
  },
  {
    id: 'vex_a1_daily_01',
    level: 'A1',
    theme: 'ชีวิตประจำวัน',
    title: 'คำศัพท์ A1 ชีวิตประจำวัน',
    description: 'คำศัพท์ชีวิตประจำวัน 6 คู่ — จับคู่ · สะกดคำ · ฟัง-พูดตาม · เติมช่องว่าง',
    ttsSystem: 'female',
    words: [
      { wordEN: 'milk',   sentence: 'I drink milk every morning.',        sentenceTH: 'ฉันดื่มนมทุกเช้า' },
      { wordEN: 'house',  sentence: 'My house is near the school.',       sentenceTH: 'บ้านของฉันอยู่ใกล้โรงเรียน' },
      { wordEN: 'rice',   sentence: 'We eat rice for lunch.',             sentenceTH: 'เรากินข้าวเป็นอาหารกลางวัน' },
      { wordEN: 'wash',   sentence: 'I wash my hands before eating.',     sentenceTH: 'ฉันล้างมือของฉันก่อนกินอาหาร' },
      { wordEN: 'market', sentence: 'My mother buys fruit at the market.',sentenceTH: 'แม่ของฉันซื้อผลไม้ที่ตลาด' },
      { wordEN: 'fruit',  sentence: 'I like to eat fresh fruit.',         sentenceTH: 'ฉันชอบกินผลไม้สด' },
    ],
    stages: {
      spelling:      ['milk', 'house', 'rice', 'wash'],
      listenRepeat:  ['market', 'fruit', 'milk', 'house'],
      fillBlank:     ['milk', 'house', 'rice', 'wash', 'market', 'fruit'],
    },
  },
];
// ─── สร้าง payload ชุดแบบฝึก (mirror vocabSetsData.buildVocabSetDoc) ──────────
// @param {object} set        ชุดจาก VOCAB_TOPIC_SETS
// @param {Array}  vocabPool  oxford_vocabulary.json
// คืน payload พร้อมเขียนลง Firestore (ไม่มี timestamp)
function buildTopicVocabSetDoc(set, vocabPool) {
  const pool = Array.isArray(vocabPool) ? vocabPool : [];
  const sameLevelEN = [...new Set(
    pool.filter((v) => v.cefrLevel === set.level).map((v) => v.wordEN),
  )];
  const byWord = new Map();
  for (const w of set.words) byWord.set(w.wordEN, w);

  const needStageWord = (stage, name) => {
    const w = byWord.get(name);
    if (!w) throw new Error(`${set.id} ${stage}: คำ "${name}" ไม่ได้อยู่ใน master pairs`);
    return w;
  };

  const resolved = set.words.map((w, i) => {
    const hit = pool.find((v) => v.wordEN === w.wordEN && v.cefrLevel === set.level);
    if (!hit) throw new Error(`${set.id}: ไม่พบ "${w.wordEN}" ระดับ ${set.level} ในคลังคำศัพท์`);
    return { wordId: hit.id, wordEN: w.wordEN, wordTH: hit.wordTH, sentence: w.sentence, sentenceTH: w.sentenceTH, _index: i };
  });
  const resolvedBy = new Map(resolved.map((w) => [w.wordEN, w]));

  // distractors: 2 คำแรกของ master ที่ไม่ใช่คำตอบ (deterministic, ไม่ต้องสุ่ม)
  const pickDistractors = (wordEN) => {
    const out = [];
    for (const w of resolved) {
      if (w.wordEN.toLowerCase() !== wordEN.toLowerCase()) out.push(w.wordEN);
      if (out.length === 2) break;
    }
    return out;
  };

  const toItem = (w) => ({
    wordId: w.wordId || `vs_${set.id}_${w._index}`,
    wordEN: w.wordEN,
    wordTH: w.wordTH,
    sentence: w.sentence,
    sentenceTH: w.sentenceTH,
    level: set.level,
    cefrLevel: set.level,
    ttsVoice: set.ttsSystem,
    playbackSpeed: 1.0,
    distractors: pickDistractors(w.wordEN),
  });

  const spellingWords = set.stages.spelling.map((n) => {
    const w = needStageWord('spelling', n);
    return { wordEN: w.wordEN, wordTH: resolvedBy.get(n).wordTH };
  });
  const listenRepeatWords = set.stages.listenRepeat.map((n) => {
    const w = needStageWord('listenRepeat', n);
    return { wordEN: w.wordEN, wordTH: resolvedBy.get(n).wordTH };
  });
  const fillInBlankSentences = set.stages.fillBlank.map((n) => {
    const w = needStageWord('fillBlank', n);
    const r = resolvedBy.get(n);
    return {
      wordEN: r.wordEN, wordTH: r.wordTH, sentence: r.sentence, sentenceTH: r.sentenceTH,
      distractors: pickDistractors(r.wordEN),
    };
  });

  const questionStats = {
    matching: 1,
    spelling: spellingWords.length,
    listenRepeat: listenRepeatWords.length,
    fillBlank: fillInBlankSentences.length,
  };

  return {
    id: set.id,
    category: 'vocab',
    level: set.level,
    vocabularyLevel: set.level,
    status: 'published',
    sourceVersion: 2,
    source: 'manual',
    title: set.title,
    description: set.description,
    theme: set.theme,
    ttsSystem: set.ttsSystem,
    items: resolved.map(toItem),
    spellingWords,
    listenRepeatWords,
    fillInBlankSentences,
    questionStats,
    totalQuestions: questionStats.matching + questionStats.spelling
      + questionStats.listenRepeat + questionStats.fillBlank,
  };
}

// ─── Validate ก่อนเขียน — ผ่านทุกข้อจึงค่อยยิง Firestore ──────────────────────
function validateTopicSets(docs, rawSets) {
  const errors = [];
  const masterById = new Map(rawSets.map((s) => [s.id, s.words.map((w) => w.wordEN.toLowerCase())]));

  for (const d of docs) {
    // matching pairs (items/master) ต้องมีแค่ 4-6 คู่ตามที่กำหนด
    if (d.items.length < 4 || d.items.length > 6) {
      errors.push(`${d.id}: master pairs ต้อง 4-6 คู่ (ได้ ${d.items.length})`);
    }
    // ด่านอื่นต้องใช้คำจาก master pairs เท่านั้น
    for (const w of d.spellingWords) {
      if (!masterById.get(d.id).includes(w.wordEN.toLowerCase())) {
        errors.push(`${d.id}: spelling "${w.wordEN}" ไม่ได้อยู่ใน master pairs`);
      }
    }
    for (const w of d.listenRepeatWords) {
      if (!masterById.get(d.id).includes(w.wordEN.toLowerCase())) {
        errors.push(`${d.id}: listenRepeat "${w.wordEN}" ไม่ได้อยู่ใน master pairs`);
      }
    }
    // ทุก item: ประโยคต้องมีคำนั้น (rule เดียวกับ backend API)
    d.items.forEach((i, idx) => {
      if (!i.wordEN || !i.wordTH) errors.push(`${d.id} ข้อ ${idx + 1}: ต้องมี wordEN/wordTH`);
      if (i.sentence && !i.sentence.toLowerCase().includes(i.wordEN.toLowerCase())) {
        errors.push(`${d.id} ข้อ ${idx + 1}: ประโยคต้องมีคำว่า "${i.wordEN}"`);
      }
      if (i.distractors.length !== 2 || i.distractors.includes(i.wordEN)) {
        errors.push(`${d.id}/${i.wordEN}: distractors ไม่ถูกต้อง`);
      }
    });
    // FIB: คำและประโยคห้ามซ้ำกัน
    const fibWords = d.fillInBlankSentences.map((f) => f.wordEN.toLowerCase());
    if (new Set(fibWords).size !== fibWords.length) errors.push(`${d.id}: FIB มีคำซ้ำ`);
    const fibSents = d.fillInBlankSentences.map((f) => f.sentence.toLowerCase());
    if (new Set(fibSents).size !== fibSents.length) errors.push(`${d.id}: FIB มีประโยคซ้ำ`);
    for (const f of d.fillInBlankSentences) {
      if (f.sentence && !f.sentence.toLowerCase().includes(f.wordEN.toLowerCase())) {
        errors.push(`${d.id}/FIB: ประโยคต้องมีคำว่า "${f.wordEN}"`);
      }
    }
    // คำนวณ totalQuestions ตรงกับผลรวมจริง
    const expectTotal = 1 + d.spellingWords.length + d.listenRepeatWords.length
      + d.fillInBlankSentences.length;
    if (d.totalQuestions !== expectTotal) {
      errors.push(`${d.id}: totalQuestions (${d.totalQuestions}) ไม่ตรงผลรวมด่าน (${expectTotal})`);
    }
  }

  const ids = docs.map((d) => d.id);
  if (new Set(ids).size !== ids.length) errors.push('id ชุดซ้ำกัน');
  return errors;
}

async function main() {
  const vocabPool = require('../data/oxford_vocabulary.json');
  const docs = VOCAB_TOPIC_SETS.map((s) => buildTopicVocabSetDoc(s, vocabPool));

  console.log(`\n📦 เตรียมเขียนชุดคำศัพท์ ${docs.length} ชุด:`);
  docs.forEach((d) => {
    console.log(
      `   • ${d.id} ${d.level} ธีม "${d.theme}" — master ${d.items.length} คู่ → ` +
      `spelling:${d.questionStats.spelling} listenRepeat:${d.questionStats.listenRepeat} ` +
      `fillBlank:${d.questionStats.fillBlank} (รวม ${d.totalQuestions} ข้อ)`,
    );
    d.items.forEach((i, idx) => {
      console.log(`       - คู่ ${idx + 1}: ${i.wordEN} = ${i.wordTH}`);
    });
  });

  // validate ก่อนเชื่อม Firebase — ไม่เสีย quota/เวลาเมื่อข้อมูลผิด
  const errors = validateTopicSets(docs, VOCAB_TOPIC_SETS);
  if (errors.length > 0) {
    console.error('\n❌ ข้อมูลไม่ผ่านการตรวจ — ยกเลิกการเขียนทั้งหมด:');
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }
  console.log('   ✅ ตรวจข้อมูลผ่านครบ (คำอยู่ในคลัง A1 / ประโยคมีคำ / FIB ไม่ซ้ำ / total ตรง)');

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

  for (const d of docs) {
    const ref = db.collection('exercises').doc(d.id);
    const existing = await ref.get();
    await ref.set({ ...d, createdAt: new Date() }, { merge: true });
    console.log(`🎉 ${existing.exists ? 'อัปเดต' : 'สร้าง'}ชุด ${d.id} สำเร็จ (รวม ${d.totalQuestions} ข้อ, status: ${d.status})`);
  }
  console.log('\n   ตรวจสอบ: Firebase Console → Firestore → collection "exercises"\n');
}

main().catch((err) => {
  console.error('\n❌ เกิดข้อผิดพลาด:', err.message);
  process.exit(1);
});


