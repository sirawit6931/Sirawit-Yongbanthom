// frontend/scripts/seedFirestore.js
// Oxford 3000 aligned seed data for Firestore (A1–A2)
import {
  collection, doc, setDoc, getDocs, query, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

import OXFORD_VOCAB from './oxfordVocabSeed';

function buildVocabExercises(vocabList, level, chunkSize = 10) {
  const sets = [];
  for (let i = 0; i < vocabList.length; i += chunkSize) {
    const chunk  = vocabList.slice(i, i + chunkSize);
    const setNum = Math.floor(i / chunkSize) + 1;
    const allOtherEN = vocabList
      .filter((_, idx) => idx < i || idx >= i + chunkSize)
      .map((v) => v.wordEN);
    const items = chunk.map((v) => {
      const pool = allOtherEN.filter((w) => w !== v.wordEN);
      const dist = pool.sort(() => 0.5 - Math.random()).slice(0, 2);
      return {
        wordId: v.id, wordEN: v.wordEN, wordTH: v.wordTH,
        sentence: `I know the word "${v.wordEN}".`,
        sentenceTH: `ฉันรู้จักคำว่า "${v.wordTH}"`,
        distractors: dist,
      };
    });
    sets.push({
      id: `vex_${level.toLowerCase()}_${String(setNum).padStart(2,'0')}`,
      category: 'vocab', level,
      title: `คำศัพท์ Oxford ${level} ชุดที่ ${setNum}`,
      description: `คำศัพท์ Oxford 3000 ระดับ ${level} ชุดที่ ${setNum}`,
      ttsSystem: 'female', items,
    });
  }
  return sets;
}

const OXFORD_A1 = OXFORD_VOCAB.filter((v) => v.level === 'A1');
const OXFORD_A2 = OXFORD_VOCAB.filter((v) => v.level === 'A2');

const VOCAB_EXERCISES_SEED = [
  ...buildVocabExercises(OXFORD_A1, 'A1'),
  ...buildVocabExercises(OXFORD_A2, 'A2'),
];

const TENSE_EXERCISES_SEED = [
  {
    id: 'tex001', category: 'tense', level: 'A2',
    title: 'Tense ỞƬ Past Simple', description: 'เติมคำในอดีต',
    ttsSystem: 'female',
    items: [
      {
        tenseType:'Past Simple', tenseColor:'#FF9500',
        exampleEN:'He ate rice for lunch.', exampleTH:'เขากินข้าวตอนกลางวัน',
        sentenceTH:'ฉันเดินทางไปเชียงใหม่เมื่อปีที่แล้ว',
        sentence:'I ___ to Chiang Mai last year.',
        answer:'went', choices:['go','went','will go'],
        orderWords:['I','went','to','Chiang','Mai','last','year'],
        speakText:'I went to Chiang Mai last year.',
      },
      {
        tenseType:'Past Simple', tenseColor:'#FF9500',
        exampleEN:'She cooked dinner yesterday.', exampleTH:'เธอทำอาหารเย็นเมื่อวาน',
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
    ],
  },
  {
    id: 'tex002', category: 'tense', level: 'A2',
    title: 'Tense ỞƬ Future Simple', description: 'วางแผนในอนาคต',
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
        tenseType:'Future Continuous', tenseColor:'#00C7BE',
        exampleEN:'I will be working at 9 tomorrow.', exampleTH:'ฉันจะกำลังทำงานตอน 9 โมงพรุ่งนี้',
        sentenceTH:'เธอจะกำลังเรียนตอนบ่ายพรุ่งนี้',
        sentence:'She will be ___ tomorrow afternoon.',
        answer:'studying', choices:['study','studied','studying'],
        orderWords:['She','will','be','studying','tomorrow','afternoon'],
        speakText:'She will be studying tomorrow afternoon.',
      },
    ],
  },
  {
    id: 'tex003', category: 'tense', level: 'A2',
    title: 'Tense ỞƬ Present Continuous', description: 'กิจกรรมที่กำลังทำ',
    ttsSystem: 'female',
    items: [
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
];

const LISTENING_EXERCISES_SEED = [
  {
    id: 'lex001', category: 'listening', level: 'A1',
    title: 'ฟังบทสนทนา A1 — วันหยุดสุดสัปดาห์', description: 'บทสนทนาสั้นๆ เกี่ยวกับกิจกรรมวันหยุด',
    ttsSystem: 'female',
    speakerA: { name: 'Anna', ttsVoice: 'female' },
    speakerB: { name: 'David', ttsVoice: 'male' },
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
          prompt: 'David อ่านหนังสือตอนไหน?',
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
    title: 'ฟังบทสนทนา A2 — เที่ยวชายหาด', description: 'เล่าเรื่องการเดินทางที่ชายหาด',
    ttsSystem: 'female',
    speakerA: { name: 'Sara', ttsVoice: 'female' },
    speakerB: { name: 'Tom', ttsVoice: 'male' },
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
    title: 'ฟังบทสนทนา A2 — แผนสำหรับอนาคต', description: 'พูดถึงแผนในอนาคต',
    speakerA: { name: 'Mike', ttsVoice: 'male' },
    speakerB: { name: 'Lisa', ttsVoice: 'female' },
    ttsSystem: 'female',
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

async function seedVocabulary() {
  console.log('🌱 Seeding vocabulary...');
  for (const vocab of OXFORD_VOCAB) {
    await setDoc(doc(db, 'vocabulary', vocab.id), {
      wordEN: vocab.wordEN,
      wordTH: vocab.wordTH,
      cefrLevel: vocab.cefrLevel ?? vocab.level,
      partOfSpeech: vocab.partOfSpeech || '',
      ttsVoice: '',
    }, { merge: true });
  }
  console.log(`✅ Seeded ${OXFORD_VOCAB.length} vocabulary items`);
}

async function seedExercises() {
  console.log('🌱 Seeding exercises...');
  const allExercises = [...VOCAB_EXERCISES_SEED, ...TENSE_EXERCISES_SEED, ...LISTENING_EXERCISES_SEED];
  for (const ex of allExercises) {
    const { id, ...data } = ex;
    await setDoc(doc(db, 'exercises', id), { ...data, createdAt: serverTimestamp() });
  }
  console.log(`✅ Seeded ${allExercises.length} exercise sets`);
}

export async function seedAll() {
  console.log('🚀 Starting Firestore seed...');
  try {
    await seedVocabulary();
    await seedExercises();
    console.log('🎉 Seed complete!');
    return { success: true };
  } catch (err) {
    console.error('❌ Seed failed:', err);
    return { success: false, error: err.message };
  }
}

export async function checkSeeded() {
  // limit(1): แค่เช็คว่ามีข้อมูลอย่างน้อย 1 ชุด — ไม่ต้องดึงทั้ง collection (กิน read ฟรี ๆ)
  try {
    const snap = await getDocs(query(collection(db, 'exercises'), limit(1)));
    return !snap.empty;
  } catch (err) {
    console.error('[checkSeeded] error:', err?.code, err?.message);
    return false;
  }
}
