// backend/seed.js
// รัน: node seed.js
// ใส่ข้อมูล Oxford 3000 (A1–A2) + exercises เข้า Firestore
// รันซ้ำได้ — ใช้ setMerge จะ overwrite เฉพาะที่เปลี่ยน

require('dotenv').config();
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const serviceAccount = require('./serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ══════════════════════════════════════════════════════════════════════════════
// Oxford 3000 — A1 + A2 (1,772 คำ: A1 900 / A2 872)
// source: data/oxford_vocabulary.json (สร้างด้วย scripts/build_seed_data.py)
// ══════════════════════════════════════════════════════════════════════════════
const ALL_VOCAB = require('./data/oxford_vocabulary.json');
const OXFORD_A1 = ALL_VOCAB.filter((v) => v.cefrLevel === 'A1');
const OXFORD_A2 = ALL_VOCAB.filter((v) => v.cefrLevel === 'A2');

// ══════════════════════════════════════════════════════════════════════════════
// ชุดแบบฝึกหัดคำศัพท์ — ดึงจาก scripts/vocabSetsData.js (single source of truth)
// เลิกใช้ buildVocabExercises() ตัวเก่าแล้ว เพราะ:
//   - sentence เป็น template ทุกข้อ (ไม่ใช่ประโยคตัวอย่างที่อ่านได้)
//   - ไม่ผูก spellingWords / listenRepeatWords / fillInBlankSentences
//     ทำให้ learningEngine สุ่ม type ของคำถามเอง อาจได้ชุดที่ไม่มีด่านพูดเลย
// เขียนชุดลง Firestore แยกได้ที่: node scripts/seedVocabSets.js
// ══════════════════════════════════════════════════════════════════════════════
const { buildAllVocabSetDocs } = require('./scripts/vocabSetsData');

// ══════════════════════════════════════════════════════════════════════════════
// ข้อมูล: ชุดแบบฝึกหัด Tense
// ══════════════════════════════════════════════════════════════════════════════
const TENSE_EXERCISES = [
  {
    id: 'tex001', category: 'tense',
    title: 'แบบฝึกหัด Tense ชุดที่ 1', description: 'Present Simple',
    ttsSystem: 'female',
    items: [
      {
        tenseType:'Present Simple', tenseColor:'#5B4FCF',
        exampleEN:'She goes to school every day.', exampleTH:'เธอไปโรงเรียนทุกวัน',
        sentenceTH:'ฉันไปโรงเรียนทุกวัน',
        sentence:'I ___ to school every day.',
        answer:'go', choices:['go','went','going'],
        orderWords:['I','go','to','school','every','day'],
        speakText:'I go to school every day.',
      },
      {
        tenseType:'Present Simple', tenseColor:'#5B4FCF',
        exampleEN:'He eats rice for lunch.', exampleTH:'เขากินข้าวตอนกลางวัน',
        sentenceTH:'เธอกินแอปเปิ้ลตอนกลางวัน',
        sentence:'She ___ an apple for lunch.',
        answer:'eats', choices:['eat','eats','eaten'],
        orderWords:['She','eats','an','apple','for','lunch'],
        speakText:'She eats an apple for lunch.',
      },
      {
        tenseType:'Present Simple', tenseColor:'#5B4FCF',
        exampleEN:'They play football every weekend.', exampleTH:'พวกเขาเล่นฟุตบอลทุกสุดสัปดาห์',
        sentenceTH:'ฉันดูทีวีทุกคืน',
        sentence:'I ___ TV every night.',
        answer:'watch', choices:['watch','watched','watching'],
        orderWords:['I','watch','TV','every','night'],
        speakText:'I watch TV every night.',
      },
      {
        tenseType:'Present Continuous', tenseColor:'#007AFF',
        exampleEN:'She is reading a book.', exampleTH:'เธอกำลังอ่านหนังสืออยู่',
        sentenceTH:'เขากำลังเล่นฟุตบอลอยู่',
        sentence:'He ___ playing football.',
        answer:'is', choices:['is','are','was'],
        orderWords:['He','is','playing','football'],
        speakText:'He is playing football.',
      },
      {
        tenseType:'Present Continuous', tenseColor:'#007AFF',
        exampleEN:'We are having dinner.', exampleTH:'พวกเรากำลังทานอาหารเย็นอยู่',
        sentenceTH:'พวกเขากำลังเรียนภาษาอังกฤษอยู่',
        sentence:'They ___ studying English.',
        answer:'are', choices:['is','are','were'],
        orderWords:['They','are','studying','English'],
        speakText:'They are studying English.',
      },
    ],
  },
  {
    id: 'tex002', category: 'tense',
    title: 'แบบฝึกหัด Tense ชุดที่ 2', description: 'Past Simple',
    ttsSystem: 'female',
    items: [
      {
        tenseType:'Past Simple', tenseColor:'#FF9500',
        exampleEN:'He ate rice for lunch.', exampleTH:'เขากินข้าวตอนกลางวัน',
        sentenceTH:'พวกเขาเล่นฟุตบอลเมื่อวาน',
        sentence:'They ___ football yesterday.',
        answer:'played', choices:['play','played','will play'],
        orderWords:['They','played','football','yesterday'],
        speakText:'They played football yesterday.',
      },
      {
        tenseType:'Past Simple', tenseColor:'#FF9500',
        exampleEN:'We watched a movie last night.', exampleTH:'พวกเราดูหนังเมื่อคืน',
        sentenceTH:'ฉันเดินทางไปเชียงใหม่เมื่อปีที่แล้ว',
        sentence:'I ___ to Chiang Mai last year.',
        answer:'went', choices:['go','went','will go'],
        orderWords:['I','went','to','Chiang','Mai','last','year'],
        speakText:'I went to Chiang Mai last year.',
      },
      {
        tenseType:'Past Simple', tenseColor:'#FF9500',
        exampleEN:'She studied hard for the test.', exampleTH:'เธอเรียนหนักเพื่อสอบ',
        sentenceTH:'เขาซื้อหนังสือเล่มใหม่เมื่อวาน',
        sentence:'He ___ a new book yesterday.',
        answer:'bought', choices:['buy','buys','bought'],
        orderWords:['He','bought','a','new','book','yesterday'],
        speakText:'He bought a new book yesterday.',
      },
      {
        tenseType:'Past Continuous', tenseColor:'#FF6B6B',
        exampleEN:'I was reading when she called.', exampleTH:'ฉันกำลังอ่านหนังสือตอนที่เธอโทรมา',
        sentenceTH:'เธอกำลังทำอาหารตอนที่ฝนตก',
        sentence:'She ___ cooking when it rained.',
        answer:'was', choices:['was','were','is'],
        orderWords:['She','was','cooking','when','it','rained'],
        speakText:'She was cooking when it rained.',
      },
      {
        tenseType:'Past Simple', tenseColor:'#FF9500',
        exampleEN:'They arrived at 8 o\'clock.', exampleTH:'พวกเขามาถึงตอน 8 โมง',
        sentenceTH:'เราออกจากบ้านแต่เช้า',
        sentence:'We ___ home early.',
        answer:'left', choices:['leave','left','leaving'],
        orderWords:['We','left','home','early'],
        speakText:'We left home early.',
      },
    ],
  },
  {
    id: 'tex003', category: 'tense',
    title: 'แบบฝึกหัด Tense ชุดที่ 3', description: 'Future Simple',
    ttsSystem: 'female',
    items: [
      {
        tenseType:'Future Simple', tenseColor:'#34C759',
        exampleEN:'I will travel to Japan next year.', exampleTH:'ฉันจะเดินทางไปญี่ปุ่นปีหน้า',
        sentenceTH:'เธอจะโทรหาคุณพรุ่งนี้',
        sentence:'She ___ call you tomorrow.',
        answer:'will', choices:['will','did','does'],
        orderWords:['She','will','call','you','tomorrow'],
        speakText:'She will call you tomorrow.',
      },
      {
        tenseType:'Future Simple', tenseColor:'#34C759',
        exampleEN:'They will visit us next week.', exampleTH:'พวกเขาจะมาเยี่ยมสัปดาห์หน้า',
        sentenceTH:'ฉันจะซื้อหนังสือใหม่พรุ่งนี้',
        sentence:'I will ___ a new book tomorrow.',
        answer:'buy', choices:['buy','bought','buying'],
        orderWords:['I','will','buy','a','new','book','tomorrow'],
        speakText:'I will buy a new book tomorrow.',
      },
      {
        tenseType:'Future Simple', tenseColor:'#34C759',
        exampleEN:'He will finish the project soon.', exampleTH:'เขาจะทำโปรเจกต์เสร็จเร็วๆ นี้',
        sentenceTH:'พวกเราจะไปชายหาดในวันหยุด',
        sentence:'We will ___ to the beach on holiday.',
        answer:'go', choices:['go','went','going'],
        orderWords:['We','will','go','to','the','beach','on','holiday'],
        speakText:'We will go to the beach on holiday.',
      },
      {
        tenseType:'Future Continuous', tenseColor:'#00C7BE',
        exampleEN:'I will be working at 9 tomorrow.', exampleTH:'ฉันจะกำลังทำงานตอน 9 โมงพรุ่งนี้',
        sentenceTH:'เธอจะกำลังเรียนตอนบ่ายพรุ่งนี้',
        sentence:'She will be ___ tomorrow afternoon.',
        answer:'studying', choices:['study','studied','studying'],
        orderWords:['She','will','be','studying','tomorrow','afternoon'],
        speakText:'She will be studying tomorrow afternoon.',
      },
      {
        tenseType:'Future Simple', tenseColor:'#34C759',
        exampleEN:'It will rain tonight.', exampleTH:'คืนนี้จะมีฝน',
        sentenceTH:'เขาจะช่วยคุณในวันพรุ่งนี้',
        sentence:'He ___ help you tomorrow.',
        answer:'will', choices:['will','would','won\'t'],
        orderWords:['He','will','help','you','tomorrow'],
        speakText:'He will help you tomorrow.',
      },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// ข้อมูล: ชุดแบบฝึกหัดการฟัง
// ══════════════════════════════════════════════════════════════════════════════
const LISTENING_EXERCISES = [
  {
    id: 'lex001', category: 'listening', level: 'A1',
    title: 'การฟังและการดู Tense ชุดที่ 1', description: 'บทสนทนาในชีวิตประจำวัน',
    speakerA: { name: 'Anna', ttsVoice: 'female' },
    speakerB: { name: 'David', ttsVoice: 'male' },
    dialogues: [
      {
        lines: [
          { speaker:'A', text:'Hi! How are you today?' },
          { speaker:'B', text:'I am fine, thank you! And you?' },
          { speaker:'A', text:'I am great! What do you usually do on weekends?' },
          { speaker:'B', text:'I like to go to the park and read books.' },
          { speaker:'A', text:'That sounds fun! I usually go shopping.' },
        ],
        question: {
          prompt: 'David ทำอะไรในวันหยุดสุดสัปดาห์?',
          options: ['ไปสวนสาธารณะและอ่านหนังสือ','ไปช้อปปิ้ง','ดูหนัง','ไปว่ายน้ำ'],
          correctIndex: 0,
        },
      },
      {
        lines: [
          { speaker:'A', text:'Do you like reading books?' },
          { speaker:'B', text:'Yes, I read every evening before bed.' },
        ],
        question: {
          prompt: 'ผู้พูดอ่านหนังสือตอนไหน?',
          options: ['ตอนเช้า','ก่อนนอนทุกคืน','ตอนกลางวัน','ไม่เคยอ่าน'],
          correctIndex: 1,
        },
      },
      {
        lines: [
          { speaker:'A', text:'What does she do every day?' },
          { speaker:'B', text:'She goes to school every day.' },
        ],
        question: {
          prompt: 'บทสนทนานี้ใช้ Tense ใดเป็นหลัก?',
          options: ['Present Simple','Past Simple','Future Simple','Present Continuous'],
          correctIndex: 0,
        },
      },
    ],
  },
  {
    id: 'lex002', category: 'listening', level: 'A2',
    title: 'การฟังและการดู Tense ชุดที่ 2', description: 'เล่าเรื่องในอดีต',
    speakerA: { name: 'Sara', ttsVoice: 'female' },
    speakerB: { name: 'Tom', ttsVoice: 'male' },
    dialogues: [
      {
        lines: [
          { speaker:'A', text:'Where did you go last weekend?' },
          { speaker:'B', text:'I went to the beach with my family.' },
          { speaker:'A', text:'Did you swim in the sea?' },
          { speaker:'B', text:'Yes, I swam for two hours! It was amazing!' },
          { speaker:'A', text:'That sounds wonderful! I stayed home last weekend.' },
        ],
        question: {
          prompt: 'Tom ไปที่ไหนสุดสัปดาห์ที่ผ่านมา?',
          options: ['ชายหาด','ภูเขา','ห้างสรรพสินค้า','สวนสาธารณะ'],
          correctIndex: 0,
        },
      },
      {
        lines: [
          { speaker:'A', text:'What did you eat yesterday?' },
          { speaker:'B', text:'I ate rice with my family.' },
        ],
        question: {
          prompt: 'ผู้พูดกินอะไรเมื่อวาน?',
          options: ['ข้าว','ก๋วยเตี๋ยว','พิซซ่า','สลัด'],
          correctIndex: 0,
        },
      },
      {
        lines: [
          { speaker:'A', text:'When did they play football?' },
          { speaker:'B', text:'They played football yesterday.' },
        ],
        question: {
          prompt: 'บทสนทนานี้ใช้ Tense ใดเป็นหลัก?',
          options: ['Past Simple','Present Simple','Future Simple','Present Continuous'],
          correctIndex: 0,
        },
      },
    ],
  },
  {
    id: 'lex003', category: 'listening', level: 'A2',
    title: 'การฟังและการดู Tense ชุดที่ 3', description: 'แผนสำหรับอนาคต',
    speakerA: { name: 'Mike', ttsVoice: 'male' },
    speakerB: { name: 'Lisa', ttsVoice: 'female' },
    dialogues: [
      {
        lines: [
          { speaker:'A', text:'What will you do next summer?' },
          { speaker:'B', text:'I will travel to Japan with my friends.' },
          { speaker:'A', text:'That is exciting! Will you learn Japanese?' },
          { speaker:'B', text:'Yes, I will take a short language course before I go.' },
          { speaker:'A', text:'I will visit you there if I can!' },
        ],
        question: {
          prompt: 'Lisa จะทำอะไรในฤดูร้อนหน้า?',
          options: ['เดินทางไปญี่ปุ่น','เรียนภาษาจีน','อยู่บ้าน','ไปทำงาน'],
          correctIndex: 0,
        },
      },
      {
        lines: [
          { speaker:'A', text:'What will you buy next month?' },
          { speaker:'B', text:'I will buy a new phone next month.' },
        ],
        question: {
          prompt: 'ผู้พูดจะซื้ออะไรเดือนหน้า?',
          options: ['โทรศัพท์ใหม่','หนังสือ','รถ','คอมพิวเตอร์'],
          correctIndex: 0,
        },
      },
      {
        lines: [
          { speaker:'A', text:'Will you come to the party?' },
          { speaker:'B', text:'Yes, I will be there tomorrow.' },
        ],
        question: {
          prompt: 'บทสนทนานี้ใช้ Tense ใดเป็นหลัก?',
          options: ['Future Simple','Past Simple','Present Continuous','Present Simple'],
          correctIndex: 0,
        },
      },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

async function seedVocabulary() {
  console.log('\n📚 Seeding Oxford 3000 vocabulary (CEFR A1–A2 only)...');
  // Firestore batch จำกัด 500 ops — แบ่งเป็น chunk
  const chunkSize = 400;
  for (let i = 0; i < ALL_VOCAB.length; i += chunkSize) {
    const chunk = ALL_VOCAB.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const v of chunk) {
      const ref = db.collection('vocabulary').doc(v.id);
      batch.set(ref, { wordEN: v.wordEN, wordTH: v.wordTH, cefrLevel: v.cefrLevel, partOfSpeech: v.partOfSpeech || '', ttsVoice: '' }, { merge: true });
    }
    await batch.commit();
  }
  console.log(`   ✅ ${ALL_VOCAB.length} คำศัพท์ (A1:${OXFORD_A1.length} A2:${OXFORD_A2.length}) — scope A1–A2 เท่านั้น`);
}

async function seedExercises() {
  console.log('\n📝 Seeding exercises...');

  // vocab sets ทั้งหมดมาจาก scripts/vocabSetsData.js (10 ชุด: A1×5 / A2×5)
  // แต่ละชุดครบทั้ง 4 ด่าน: matching / spelling / listenRepeat / fillBlank
  const vocabSets = buildAllVocabSetDocs(ALL_VOCAB);

  const allExercises = [...vocabSets, ...TENSE_EXERCISES, ...LISTENING_EXERCISES];

  // seed exercises (batch 400)
  const chunkSize = 400;
  for (let i = 0; i < allExercises.length; i += chunkSize) {
    const chunk = allExercises.slice(i, i + chunkSize);
    const batch = db.batch();
    // batch.set แบบ overwrite เต็ม doc → ต้องเติม field มาตรฐาน (SCHEMA.md) ที่ชุด seed
    // ไม่ได้นิยามไว้เอง เพื่อไม่ให้ re-seed ลบสถานะ draft/published หรือ sourceVersion
    for (const ex of chunk) {
      const { id, ...data } = ex;
      const ref = db.collection('exercises').doc(id);
      const payload = {
        ...data,
        status: data.status ?? 'published',   // ชุด seed = พร้อมใช้ (เผยแพร่แล้ว)
        createdAt: new Date(),
      };
      if (data.category === 'vocab') {
        payload.sourceVersion = data.sourceVersion ?? 1;
        payload.vocabularyLevel = data.vocabularyLevel ?? data.level;
      }
      batch.set(ref, payload);
    }
    await batch.commit();
  }

  console.log(`   ✅ vocab sets: ${vocabSets.length} ชุด (A1:${vocabSets.filter(s=>s.level==='A1').length} / A2:${vocabSets.filter(s=>s.level==='A2').length}) — ข้อ: ${vocabSets.map(s => s.items.length).join(', ')}`);
  console.log(`      ทุกชุดครบ 4 ด่าน — การ์ดรวม: ${vocabSets.map(s => s.totalQuestions).join(', ')}`);
  console.log(`   ✅ tense sets: ${TENSE_EXERCISES.length} ชุด`);
  console.log(`   ✅ listening sets: ${LISTENING_EXERCISES.length} ชุด`);
}

// ══════════════════════════════════════════════════════════════════════════════
// Scope enforcement: ลบ docs ที่อยู่นอกขอบเขต CEFR A1–A2 (untagged หรือระดับอื่น)
// ══════════════════════════════════════════════════════════════════════════════
const VALID_LEVELS = ['A1', 'A2'];

async function cleanupOutOfScope() {
  console.log('\n🧹 Enforcing CEFR A1–A2 scope (removing out-of-scope docs)...');

  // vocabulary: ลบทุก doc ที่ cefrLevel ไม่ใช่ A1/A2
  const vSnap = await db.collection('vocabulary').get();
  let vBatch = db.batch();
  let vCount = 0;
  let vOps = 0;
  for (const d of vSnap.docs) {
    if (!VALID_LEVELS.includes(d.data().cefrLevel)) {
      vBatch.delete(d.ref);
      vCount += 1;
      if (++vOps === 400) { await vBatch.commit(); vBatch = db.batch(); vOps = 0; }
    }
  }
  if (vOps > 0) await vBatch.commit();
  console.log(`   🗑  vocabulary นอกขอบเขต: ลบ ${vCount} docs`);

  // exercises: ลบชุดที่ level/vocabularyLevel ไม่ใช่ A1/A2 (รวม id scheme เก่า vex_b1_/vex_b2_)
  const exSnap = await db.collection('exercises').get();
  let eBatch = db.batch();
  let eCount = 0;
  let eOps = 0;
  for (const d of exSnap.docs) {
    const c = d.data();
    const outOfScope =
      (c.level && !VALID_LEVELS.includes(c.level)) ||
      (c.vocabularyLevel && !VALID_LEVELS.includes(c.vocabularyLevel)) ||
      /^vex_b[12]_/.test(d.id);
    if (outOfScope) {
      eBatch.delete(d.ref);
      eCount += 1;
      if (++eOps === 400) { await eBatch.commit(); eBatch = db.batch(); eOps = 0; }
    }
  }
  if (eOps > 0) await eBatch.commit();
  console.log(`   🗑  exercises นอกขอบเขต: ลบ ${eCount} docs`);
}

async function main() {
  console.log('🚀 เริ่ม Seed Oxford 3000 (CEFR A1–A2) เข้า Firestore...');
  try {
    await cleanupOutOfScope();
    await seedVocabulary();
    await seedExercises();
    console.log('\n🎉 Seed เสร็จสมบูรณ์!');
    console.log('   ตรวจสอบได้ที่ Firebase Console → Firestore Database');
  } catch (err) {
    console.error('\n❌ Seed ล้มเหลว:', err.message);
    console.error(err);
    process.exit(1);
  }
  process.exit(0);
}

main();
