// backend/scripts/seedTenseSetTopics.js
// ══════════════════════════════════════════════════════════════════════════════
// เพิ่มชุดแบบฝึกหัด Tense 5 ชุด ลง Firestore collection `exercises`:
//   1. tex_daily_life_001 — ชีวิตประจำวัน (Daily Life)      15 ข้อ (Present 5 / Past 5 / Future 5)
//   2. tex_pets_001       — สัตว์เลี้ยง (Pets)              10 ข้อ (Present 4 / Past 3 / Future 3)
//   3. tex_school_001     — โรงเรียนและของใช้ในโรงเรียน    10 ข้อ (Present 4 / Past 3 / Future 3)
//   4. tex_daily_life_002 — ชีวิตประจำวัน ชุดที่ 2         15 ข้อ (Present 5 / Past 5 / Future 5)
//   5. tex_lifestyle_001  — กิจวัตรและไลฟ์สไตล์ (Lifestyle) 10 ข้อ (Present 4 / Past 3 / Future 3)
//
// รัน:  node scripts/seedTenseSetTopics.js
//       node scripts/seedTenseSetTopics.js --dry-run   (ตรวจอย่างเดียว ไม่เขียน)
//
// รันซ้ำได้ — ใช้ set(..., { merge: true }) อัปเดตทับชุดเดิม
//
// helper ทั้งหมด (legacy sync / validate / Firestore write) อยู่ที่ tenseSetSeedUtils.js
// → แต่ละ item เขียนครบทั้ง 2 schema → User app เล่นได้ทันที
// ══════════════════════════════════════════════════════════════════════════════
require('dotenv').config();

const {
  validateTenseSetDoc,
  buildTenseSetFinalDoc,
  writeSetToFirestore,
  connectFirebase,
} = require('./tenseSetSeedUtils');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── ชุดที่ 1: ชีวิตประจำวัน (Daily Life) — 15 ข้อ ─────────────────────────────
const DAILY_LIFE_SET = {
  id: 'tex_daily_life_001',
  category: 'tense',
  title: 'แบบฝึกหัด Tense ชีวิตประจำวัน (Daily Life)',
  description:
    'ชีวิตประจำวัน 15 ข้อ — Present Simple (สิ่งที่ทำเป็นประจำ) · Past Simple (สิ่งที่ทำเสร็จแล้วในอดีต) · Future Simple (สิ่งที่จะทำในอนาคต)',
  level: 'A1',
  tenseTag: 'Present',
  ttsSystem: 'female',
  status: 'published',
  items: [
    // ── Present Simple (5 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'I _____ fresh water every day.',
      sentenceTH: 'ฉันดื่มน้ำสดชื่นทุกวัน',
      correctAnswer: 'drink',
      distractors: ['drinks', 'drinking'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'She _____ the kitchen in the morning.',
      sentenceTH: 'เธอทำความสะอาดห้องครัวในตอนเช้า',
      correctAnswer: 'cleans',
      distractors: ['clean', 'cleaned'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'He _____ a banana for breakfast.',
      sentenceTH: 'เขากินกล้วยหนึ่งลูกสำหรับอาหารเช้า',
      correctAnswer: 'eats',
      distractors: ['eat', 'eating'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'We walk to the bus stop every day.',
      sentenceTH: 'พวกเราเดินไปที่ป้ายรถเมล์ทุกวัน',
      correctAnswer: 'We walk to the bus stop every day.',
      distractors: [],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'My mother _____ good food.',
      sentenceTH: 'แม่ของฉันทำอาหารอร่อย',
      correctAnswer: 'cooks',
      distractors: ['cook', 'cooking'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    // ── Past Simple (5 ข้อ) ──
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
      mode: 'fillBlank',
      targetSentence: 'She _____ her face this morning.',
      sentenceTH: 'เธอล้างหน้าของเธอเมื่อเช้านี้',
      correctAnswer: 'washed',
      distractors: ['wash', 'washing'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'He bought a white shirt last night.',
      sentenceTH: 'เขาซื้อเสื้อเชิ้ตสีขาวเมื่อคืนนี้',
      correctAnswer: 'He bought a white shirt last night.',
      distractors: [],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'We _____ a fun film on TV.',
      sentenceTH: 'พวกเราดูหนังสนุกๆ บนทีวี',
      correctAnswer: 'watched',
      distractors: ['watch', 'watching'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'They played games in the room.',
      sentenceTH: 'พวกเขาเล่นเกมในห้อง',
      correctAnswer: 'They played games in the room.',
      distractors: [],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    // ── Future Simple (5 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'I will _____ English tomorrow.',
      sentenceTH: 'ฉันจะเรียนภาษาอังกฤษในวันพรุ่งนี้',
      correctAnswer: 'study',
      distractors: ['studied', 'studying'],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'She will call her doctor tonight.',
      sentenceTH: 'เธอจะโทรหาหมอของเธอคืนนี้',
      correctAnswer: 'She will call her doctor tonight.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'He will _____ his house this weekend.',
      sentenceTH: 'เขาจะทำความสะอาดบ้านของเขาในวันหยุดเสาร์-อาทิตย์นี้',
      correctAnswer: 'clean',
      distractors: ['cleans', 'cleaned'],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'We will buy food at the market.',
      sentenceTH: 'พวกเราจะซื้ออาหารที่ตลาด',
      correctAnswer: 'We will buy food at the market.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'listenRepeat',
      targetSentence: 'They will go to bed early tonight.',
      sentenceTH: 'พวกเขาจะเข้านอนแต่หัวค่ำคืนนี้',
      correctAnswer: 'They will go to bed early tonight.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
  ],
};

// ─── ชุดที่ 2: สัตว์เลี้ยง (Pets) — 10 ข้อ ──────────────────────────────────────
const PETS_SET = {
  id: 'tex_pets_001',
  category: 'tense',
  title: 'แบบฝึกหัด Tense สัตว์เลี้ยง (Pets)',
  description:
    'สัตว์เลี้ยง 10 ข้อ — Present Simple (สิ่งที่ทำเป็นประจำ) · Past Simple (สิ่งที่ทำเสร็จแล้วในอดีต) · Future Simple (สิ่งที่จะทำในอนาคต)',
  level: 'A1',
  tenseTag: 'Present',
  ttsSystem: 'female',
  status: 'published',
  items: [
    // ── Present Simple (4 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'Cats _____ on the soft bed.',
      sentenceTH: 'แมวทั่วไปนอนหลับบนเตียงนุ่มๆ',
      correctAnswer: 'sleep',
      distractors: ['sleeps', 'sleeping'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'My dog _____ at the door.',
      sentenceTH: 'สุนัขของฉันเห่าที่ประตู',
      correctAnswer: 'barks',
      distractors: ['bark', 'barking'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'She feeds her small fish every morning.',
      sentenceTH: 'เธอให้อาหารปลาตัวเล็กของเธอทุกเช้า',
      correctAnswer: 'She feeds her small fish every morning.',
      distractors: [],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'Birds _____ sweet songs in the garden.',
      sentenceTH: 'นกร้องเพลงไพเราะในสวน',
      correctAnswer: 'sing',
      distractors: ['sings', 'singing'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    // ── Past Simple (3 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'I _____ a cute cat yesterday.',
      sentenceTH: 'ฉันเห็นแมวน่ารักตัวหนึ่งเมื่อวานนี้',
      correctAnswer: 'saw',
      distractors: ['see', 'seen'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'The dog ran in the big park.',
      sentenceTH: 'สุนัขวิ่งในสวนสาธารณะใหญ่',
      correctAnswer: 'The dog ran in the big park.',
      distractors: [],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'He _____ his dog last week.',
      sentenceTH: 'เขาอาบน้ำให้สุนัขของเขาเมื่อสัปดาห์ที่แล้ว',
      correctAnswer: 'washed',
      distractors: ['wash', 'washing'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    // ── Future Simple (3 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'I will _____ a new pet tomorrow.',
      sentenceTH: 'ฉันจะซื้อสัตว์เลี้ยงตัวใหม่ในวันพรุ่งนี้',
      correctAnswer: 'buy',
      distractors: ['bought', 'buying'],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'She will take her dog for a walk.',
      sentenceTH: 'เธอจะพาสุนัขของเธอไปเดินเล่น',
      correctAnswer: 'She will take her dog for a walk.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'listenRepeat',
      targetSentence: 'We will play with the cat tonight.',
      sentenceTH: 'พวกเราจะเล่นกับแมวในคืนนี้',
      correctAnswer: 'We will play with the cat tonight.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
  ],
};


// ─── ชุดที่ 3: โรงเรียนและของใช้ในโรงเรียน (School & Stationeries) — 10 ข้อ ──
const SCHOOL_SET = {
  id: 'tex_school_001',
  category: 'tense',
  title: 'แบบฝึกหัด Tense โรงเรียนและของใช้ในโรงเรียน (School)',
  description:
    'โรงเรียนและของใช้ในโรงเรียน 10 ข้อ — Present Simple · Past Simple · Future Simple',
  level: 'A1',
  tenseTag: 'Present',
  ttsSystem: 'female',
  status: 'published',
  items: [
    // ── Present Simple (4 ข้อ) ──
    {
      mode: 'reorder',
      targetSentence: 'Students read books in the library.',
      sentenceTH: 'นักเรียนอ่านหนังสือในห้องสมุด',
      correctAnswer: 'Students read books in the library.',
      distractors: [],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'I _____ a pen to write lessons.',
      sentenceTH: 'ฉันใช้ปากกาเขียนบทเรียน',
      correctAnswer: 'use',
      distractors: ['uses', 'using'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'She _____ her pencils in the box.',
      sentenceTH: 'เธอเก็บดินสอของเธอไว้ในกล่อง',
      correctAnswer: 'keeps',
      distractors: ['keep', 'keeping'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'The teacher writes on the board.',
      sentenceTH: 'ครูเขียนบนกระดาน',
      correctAnswer: 'The teacher writes on the board.',
      distractors: [],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    // ── Past Simple (3 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'I _____ my eraser yesterday.',
      sentenceTH: 'ฉันทำยางลบหายเมื่อวานนี้',
      correctAnswer: 'lost',
      distractors: ['lose', 'losing'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'He opened his bag in the classroom.',
      sentenceTH: 'เขาเปิดกระเป๋าของเขาในห้องเรียน',
      correctAnswer: 'He opened his bag in the classroom.',
      distractors: [],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'We _____ a picture on white paper.',
      sentenceTH: 'พวกเราวาดภาพบนกระดาษสีขาว',
      correctAnswer: 'drew',
      distractors: ['draw', 'drawing'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    // ── Future Simple (3 ข้อ) ──
    {
      mode: 'reorder',
      targetSentence: 'I will bring my computer to school.',
      sentenceTH: 'ฉันจะนำคอมพิวเตอร์ของฉันไปโรงเรียน',
      correctAnswer: 'I will bring my computer to school.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'She will _____ a question in class.',
      sentenceTH: 'เธอจะถามคำถามในห้องเรียน',
      correctAnswer: 'ask',
      distractors: ['asks', 'asking'],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'listenRepeat',
      targetSentence: 'We will study science tomorrow.',
      sentenceTH: 'พวกเราจะเรียนวิทยาศาสตร์ในวันพรุ่งนี้',
      correctAnswer: 'We will study science tomorrow.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
  ],
};


// ─── ชุดที่ 4: ชีวิตประจำวัน ชุดที่ 2 (Daily Life 2) — 15 ข้อ ──────────────────
const DAILY_LIFE_2_SET = {
  id: 'tex_daily_life_002',
  category: 'tense',
  title: 'แบบฝึกหัด Tense ชีวิตประจำวัน ชุดที่ 2 (Daily Life 2)',
  description:
    'ชีวิตประจำวัน (ชุดที่ 2) 15 ข้อ — Present Simple · Past Simple · Future Simple',
  level: 'A1',
  tenseTag: 'Present',
  ttsSystem: 'female',
  status: 'published',
  items: [
    // ── Present Simple (5 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'I _____ warm milk every morning.',
      sentenceTH: 'ฉันดื่มนมอุ่นทุกเช้า',
      correctAnswer: 'drink',
      distractors: ['drinks', 'drinking'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'She _____ her hands before eating.',
      sentenceTH: 'เธอล้างมือของเธอก่อนกินอาหาร',
      correctAnswer: 'washes',
      distractors: ['wash', 'washing'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'He walks to the bus stop every day.',
      sentenceTH: 'เขาเดินไปที่ป้ายรถเมล์ทุกวัน',
      correctAnswer: 'He walks to the bus stop every day.',
      distractors: [],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'We clean our house on Sunday.',
      sentenceTH: 'พวกเราทำความสะอาดบ้านของเราในวันอาทิตย์',
      correctAnswer: 'We clean our house on Sunday.',
      distractors: [],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'My father _____ rice for dinner.',
      sentenceTH: 'พ่อของฉันหุงข้าวสำหรับอาหารเย็น',
      correctAnswer: 'cooks',
      distractors: ['cook', 'cooking'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    // ── Past Simple (5 ข้อ) ──
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
      mode: 'fillBlank',
      targetSentence: 'She _____ a new coat last week.',
      sentenceTH: 'เธอซื้อเสื้อโค้ตตัวใหม่เมื่อสัปดาห์ที่แล้ว',
      correctAnswer: 'bought',
      distractors: ['buy', 'buyed'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'He _____ an apple for lunch.',
      sentenceTH: 'เขากินแอปเปิลหนึ่งลูกสำหรับอาหารกลางวัน',
      correctAnswer: 'ate',
      distractors: ['eat', 'eaten'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'We watched a good movie last night.',
      sentenceTH: 'พวกเราดูภาพยนตร์ที่ดีเรื่องหนึ่งเมื่อคืนนี้',
      correctAnswer: 'We watched a good movie last night.',
      distractors: [],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'They played in the garden this morning.',
      sentenceTH: 'พวกเขาเล่นในสวนเมื่อเช้านี้',
      correctAnswer: 'They played in the garden this morning.',
      distractors: [],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    // ── Future Simple (5 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'I will _____ early tonight.',
      sentenceTH: 'ฉันจะเข้านอนแต่หัวค่ำคืนนี้',
      correctAnswer: 'sleep',
      distractors: ['sleeps', 'sleeping'],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'She will call her mother tomorrow.',
      sentenceTH: 'เธอจะโทรหาแม่ของเธอในวันพรุ่งนี้',
      correctAnswer: 'She will call her mother tomorrow.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'He will _____ his car this weekend.',
      sentenceTH: 'เขาจะทำความสะอาดรถของเขาในวันหยุดเสาร์-อาทิตย์นี้',
      correctAnswer: 'clean',
      distractors: ['cleans', 'cleaned'],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'We will buy fresh fruit at the market.',
      sentenceTH: 'พวกเราจะซื้อผลไม้สดที่ตลาด',
      correctAnswer: 'We will buy fresh fruit at the market.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'listenRepeat',
      targetSentence: 'They will visit the zoo next month.',
      sentenceTH: 'พวกเขาจะไปเที่ยวสวนสัตว์ในเดือนหน้า',
      correctAnswer: 'They will visit the zoo next month.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
  ],
};

// ─── ชุดที่ 5: กิจวัตรและไลฟ์สไตล์ (Lifestyle) — 10 ข้อ ────────────────────────
const LIFESTYLE_SET = {
  id: 'tex_lifestyle_001',
  category: 'tense',
  title: 'แบบฝึกหัด Tense กิจวัตรและไลฟ์สไตล์ (Lifestyle)',
  description:
    'กิจวัตรและไลฟ์สไตล์ 10 ข้อ — Present Simple (กิจวัตรประจำวัน) · Past Simple (เหตุการณ์ที่จบแล้ว) · Future Simple (เหตุการณ์ในอนาคต)',
  level: 'A1',
  tenseTag: 'Present',
  ttsSystem: 'female',
  status: 'published',
  items: [
    // ── Present Simple (4 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'You _____ to music in the evening.',
      sentenceTH: 'คุณฟังเพลงในตอนเย็น',
      correctAnswer: 'listen',
      distractors: ['listens', 'listening'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'They _____ fresh apples from the market.',
      sentenceTH: 'พวกเขาซื้อแอปเปิลสดจากตลาด',
      correctAnswer: 'buy',
      distractors: ['buys', 'buying'],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'The boy rides his bicycle every day.',
      sentenceTH: 'เด็กผู้ชายขี่จักรยานของเขาทุกวัน',
      correctAnswer: 'The boy rides his bicycle every day.',
      distractors: [],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'My sister works in a big office.',
      sentenceTH: 'พี่สาว/น้องสาวของฉันทำงานในสำนักงานใหญ่',
      correctAnswer: 'My sister works in a big office.',
      distractors: [],
      tenseIndicator: 'Present',
      ttsVoice: 'female',
    },
    // ── Past Simple (3 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'You _____ a glass of milk last night.',
      sentenceTH: 'คุณดื่มนมหนึ่งแก้วเมื่อคืนนี้',
      correctAnswer: 'drank',
      distractors: ['drink', 'drinking'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'They visited their grandmother yesterday.',
      sentenceTH: 'พวกเขาไปเยี่ยมคุณยายของพวกเขาเมื่อวานนี้',
      correctAnswer: 'They visited their grandmother yesterday.',
      distractors: [],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    {
      mode: 'fillBlank',
      targetSentence: 'The girl _____ her key this morning.',
      sentenceTH: 'เด็กผู้หญิงทำกุญแจของเธอหายเมื่อเช้านี้',
      correctAnswer: 'lost',
      distractors: ['lose', 'losing'],
      tenseIndicator: 'Past',
      ttsVoice: 'female',
    },
    // ── Future Simple (3 ข้อ) ──
    {
      mode: 'fillBlank',
      targetSentence: 'You will _____ a new jacket tomorrow.',
      sentenceTH: 'คุณจะได้เสื้อแจ็กเกตตัวใหม่ในวันพรุ่งนี้',
      correctAnswer: 'get',
      distractors: ['gets', 'getting'],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'reorder',
      targetSentence: 'My dad will wash his car this weekend.',
      sentenceTH: 'พ่อของฉันจะล้างรถของเขาในวันหยุดเสาร์-อาทิตย์นี้',
      correctAnswer: 'My dad will wash his car this weekend.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
    {
      mode: 'listenRepeat',
      targetSentence: 'They will meet near the park tonight.',
      sentenceTH: 'พวกเขาจะพบกันใกล้สวนสาธารณะคืนนี้',
      correctAnswer: 'They will meet near the park tonight.',
      distractors: [],
      tenseIndicator: 'Future',
      ttsVoice: 'female',
    },
  ],
};

const ALL_SETS = [DAILY_LIFE_SET, PETS_SET, SCHOOL_SET, DAILY_LIFE_2_SET, LIFESTYLE_SET];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. build + validate ทุกชุดก่อนเชื่อม Firebase (ไม่เสีย quota เมื่อข้อมูลผิด)
  const docs = ALL_SETS.map((s) => ({ id: s.id, doc: buildTenseSetFinalDoc(s) }));

  console.log(`\n📦 เตรียมเขียนชุด Tense ${docs.length} ชุด:`);
  let hasError = false;
  for (const { id, doc } of docs) {
    const errors = validateTenseSetDoc(doc);
    const fb = doc.items.filter((i) => i.mode === 'fillBlank').length;
    const ro = doc.items.filter((i) => i.mode === 'reorder').length;
    const lr = doc.items.filter((i) => i.mode === 'listenRepeat').length;
    console.log(
      `   • ${id} "${doc.title}" — ${doc.items.length} ข้อ (fillBlank: ${fb} · reorder: ${ro} · listenRepeat: ${lr})`,
    );
    if (errors.length > 0) {
      hasError = true;
      errors.forEach((e) => console.error(`     ❌ ${e}`));
    }
  }
  if (hasError) {
    console.error('\n❌ ข้อมูลไม่ผ่านการตรวจ — ยกเลิกการเขียนทั้งหมด');
    process.exit(1);
  }
  console.log('   ✅ ตรวจข้อมูลผ่านครบทุกชุด (schema ใหม่ + legacy fields ครบทุกข้อ)');

  if (DRY_RUN) {
    console.log('\n🔍 --dry-run: ไม่เขียนลง Firestore\n');
    return;
  }

  // 2. เชื่อม Firebase แล้วเขียนทีละชุด
  let db;
  try {
    db = connectFirebase();
  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    process.exit(1);
  }

  for (const { id, doc } of docs) {
    const action = await writeSetToFirestore(db, id, doc);
    console.log(`🎉 ${action === 'updated' ? 'อัปเดต' : 'สร้าง'}ชุด ${id} สำเร็จ (${doc.items.length} ข้อ, status: ${doc.status})`);
  }
  console.log('\n   ตรวจสอบ: Firebase Console → Firestore → collection "exercises"\n');
}

main().catch((err) => {
  console.error('\n❌ เกิดข้อผิดพลาด:', err.message);
  process.exit(1);
});

