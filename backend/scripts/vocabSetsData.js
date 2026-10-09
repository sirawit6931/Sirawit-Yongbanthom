// backend/scripts/vocabSetsData.js
// ══════════════════════════════════════════════════════════════════════════════
// แหล่งข้อมูลชุดแบบฝึกหัดหมวดคำศัพท์ (10 ชุด) — single source of truth
//
// ใช้ร่วมกันระหว่าง:
//   - backend/scripts/seedVocabSets.js  (เขียนลง Firestore)
//   - backend/__tests__/vocabSets.test.js (validate ก่อนเขียน)
//   - backend/seed.js                    (seed ทั้งระบบ — require จากไฟล์นี้)
//
// กติกา:
//   - คำทุกคำต้องมีอยู่ใน backend/data/oxford_vocabulary.json ที่ระดับนั้นจริง
//   - ประโยคต้องมีคำนั้นอยู่ข้างใน (backend API บังคับ — adminVocabularyRoutes.js:74)
//   - FIB: คำและประโยคห้ามซ้ำกัน
//   - ครบทั้ง 4 ด่าน: matching (auto) + spelling + listenRepeat + fillblank
//
// ⚠️ ไฟล์นี้เป็น pure data — ห้าม import firebase / react-native
// ══════════════════════════════════════════════════════════════════════════════

// ─── สัดส่วนด่าน (การันตีครบทั้ง 4 รูปแบบฝึก) ─────────────────────────────────
// การ์ดรวมของชุด = 1 (matching) + จำนวนคำทุกคำ
//   ชุด 10 คำ → spelling 4 + listenRepeat 3 + fillblank 3 = 10 การ์ดเดี่ยว + 1 = 11
//   ชุด 15 คำ → spelling 5 + listenRepeat 5 + fillblank 5 = 15 การ์ดเดี่ยว + 1 = 16
// สัดส่วนนี้อ้างถึง property test: ทุกชุดต้องมี stage ทุกแบบอย่างน้อย 1 การ์ด
function splitStagePlan(wordCount) {
  const spelling = Math.ceil(wordCount / 3);
  const listen   = Math.floor((wordCount - spelling) / 2);
  const fill     = wordCount - spelling - listen;
  return { spelling, listenRepeat: listen, fillBlank: fill };
}

/**
 * แยกคำของชุดเป็น 3 กลุ่มตามสัดส่วนด้านบน (เรียงลำดับสลับกันเพื่อให้คำที่อยู่
 * หางชุดไม่ได้ไปจับที่ด่านเดียวกันหมดทุกชุด)
 * @param {Array} words รายคำทั้งชุด
 * @returns {{spelling:Array, listenRepeat:Array, fillBlank:Array}}
 */
function assignStages(words) {
  const plan = splitStagePlan(words.length);
  const spelling = [];
  const listenRepeat = [];
  const fillBlank = [];
  words.forEach((w, i) => {
    if (spelling.length < plan.spelling) spelling.push(w);
    else if (listenRepeat.length < plan.listenRepeat) listenRepeat.push(w);
    else fillBlank.push(w);
  });
  return { spelling, listenRepeat, fillBlank };
}

// ─── RNG แบบคงที่ (deterministic) — distractor เดิมทุกครั้งที่รันซ้ำ ────────────
// เหตุผล: ถ้าใช้ Math.random แล้ว seed ซ้ำจะได้ชุดคำหลอกต่างกัน → ดูเหมือนข้อมูลเพี้ยน
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** เลือก `count` อย่างจาก arr แบบไม่ซ้ำ โดยไม่เอาคำใน `exclude` */
function sampleDistinct(arr, count, exclude, rng) {
  const pool = arr.filter((x) => !exclude.includes(x));
  const out = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}


// ══════════════════════════════════════════════════════════════════════════════
// ข้อมูล 10 ชุด — คำทุกคำดึงจาก oxford_vocabulary.json (A1 900 คำ / A2 872 คำ)
// ประโยคเขียนเป็น simple present ประโยคเดียว มีคำนั้นอยู่ข้างในเสมอ
// ══════════════════════════════════════════════════════════════════════════════
const VOCAB_SETS = [
  // ── ชุดที่ 1 — A1 ครอบครัวและผู้คน (15 คำ) ──────────────────────────────
  {
    id: 'vex_a1_01',
    level: 'A1',
    theme: 'ครอบครัวและผู้คน',
    title: 'คำศัพท์ A1 ชุดที่ 1 — ครอบครัวและผู้คน',
    description: 'คำศัพท์พื้นฐานเกี่ยวกับสมาชิกในครอบครัวและผู้คน รองรับ 4 รูปแบบฝึก',
    ttsSystem: 'female',
    words: [
      { wordEN: 'family',    sentence: 'My family is very big.',            sentenceTH: 'ครอบครัวของฉันใหญ่มาก' },
      { wordEN: 'mother',    sentence: 'My mother cooks good food.',        sentenceTH: 'แม่ของฉันทำอาหารอร่อย' },
      { wordEN: 'father',    sentence: 'My father works in an office.',     sentenceTH: 'พ่อของฉันทำงานที่ออฟฟิศ' },
      { wordEN: 'sister',    sentence: 'My sister is a nurse.',             sentenceTH: 'น้องสาวของฉันเป็นพยาบาล' },
      { wordEN: 'brother',   sentence: 'I have one brother.',               sentenceTH: 'ฉันมีพี่ชายหนึ่งคน' },
      { wordEN: 'son',       sentence: 'Their son is five years old.',      sentenceTH: 'ลูกชายของพวกเขาอายุห้าขวบ' },
      { wordEN: 'daughter',  sentence: 'His daughter goes to school.',      sentenceTH: 'ลูกสาวของเขาไปโรงเรียน' },
      { wordEN: 'friend',    sentence: 'She is my best friend.',            sentenceTH: 'เธอเป็นเพื่อนสนิทของฉัน' },
      { wordEN: 'boy',       sentence: 'The boy is playing football.',      sentenceTH: 'เด็กผู้ชายคนนั้นกำลังเล่นฟุตบอล' },
      { wordEN: 'girl',      sentence: 'A girl is reading a book.',         sentenceTH: 'เด็กผู้หญิงคนหนึ่งกำลังอ่านหนังสือ' },
      { wordEN: 'man',       sentence: 'That man is my uncle.',             sentenceTH: 'ผู้ชายคนนั้นเป็นลุงของฉัน' },
      { wordEN: 'woman',     sentence: 'The woman is very kind.',           sentenceTH: 'ผู้หญิงคนนั้นใจดีมาก' },
      { wordEN: 'child',     sentence: 'Every child needs love.',           sentenceTH: 'เด็กทุกคนต้องการความรัก' },
      { wordEN: 'teacher',   sentence: 'Our teacher speaks English.',       sentenceTH: 'ครูของเราพูดภาษาอังกฤษ' },
      { wordEN: 'student',   sentence: 'I am a new student here.',          sentenceTH: 'ฉันเป็นนักเรียนใหม่ที่นี่' },
    ],
  },

  // ── ชุดที่ 2 — A1 อาหารและเครื่องดื่ม (10 คำ) ────────────────────────────
  {
    id: 'vex_a1_02',
    level: 'A1',
    theme: 'อาหารและเครื่องดื่ม',
    title: 'คำศัพท์ A1 ชุดที่ 2 — อาหารและเครื่องดื่ม',
    description: 'คำศัพท์อาหารและเครื่องดื่มที่ใช้บ่อยในชีวิตประจำวัน รองรับ 4 รูปแบบฝึก',
    ttsSystem: 'female',
    words: [
      { wordEN: 'apple',   sentence: 'I eat an apple every morning.',  sentenceTH: 'ฉันกินแอปเปิลทุกเช้า' },
      { wordEN: 'banana',  sentence: 'She likes a yellow banana.',     sentenceTH: 'เธอชอบกล้วยสีเหลือง' },
      { wordEN: 'bread',   sentence: 'I buy bread from the shop.',     sentenceTH: 'ฉันซื้อขนมปังจากร้าน' },
      { wordEN: 'cake',    sentence: 'We eat cake on my birthday.',    sentenceTH: 'เรากินเค้กในวันเกิดของฉัน' },
      { wordEN: 'cheese',  sentence: 'This cheese is very good.',      sentenceTH: 'ชีสตัวนี้อร่อยมาก' },
      { wordEN: 'chicken', sentence: 'My mother cooks chicken today.', sentenceTH: 'แม่ของฉันทำอาหารจากไก่วันนี้' },
      { wordEN: 'coffee',  sentence: 'He drinks coffee after work.',   sentenceTH: 'เขาดื่มกาแฟหลังเลิกงาน' },
      { wordEN: 'dinner',  sentence: 'Dinner is ready at seven.',      sentenceTH: 'อาหารเย็นพร้อมเจ็ดโมง' },
      { wordEN: 'egg',     sentence: 'I want one egg for breakfast.',  sentenceTH: 'ฉันต้องการไข่หนึ่งฟองสำหรับอาหารเช้า' },
      { wordEN: 'fish',    sentence: 'The fish is in the water.',      sentenceTH: 'ปลาอยู่ในน้ำ' },
    ],
  },

  // ── ชุดที่ 3 — A1 สถานที่และการเดินทาง (15 คำ) ───────────────────────────
  {
    id: 'vex_a1_03',
    level: 'A1',
    theme: 'สถานที่และการเดินทาง',
    title: 'คำศัพท์ A1 ชุดที่ 3 — สถานที่และการเดินทาง',
    description: 'คำศัพท์สถานที่สำคัญและยานพาหนะ รองรับ 4 รูปแบบฝึก',
    ttsSystem: 'male',
    words: [
      { wordEN: 'airport',  sentence: 'The airport is very big.',         sentenceTH: 'สนามบินใหญ่มาก' },
      { wordEN: 'bank',     sentence: 'The bank opens at nine.',          sentenceTH: 'ธนาคารเปิดเก้าโมง' },
      { wordEN: 'beach',    sentence: 'We swim at the beach.',            sentenceTH: 'เราว่ายน้ำที่ชายหาด' },
      { wordEN: 'bus',      sentence: 'I take the bus to school.',        sentenceTH: 'ฉันนั่งรถบัสไปโรงเรียน' },
      { wordEN: 'car',      sentence: 'His car is very new.',             sentenceTH: 'รถยนต์ของเขาใหม่มาก' },
      { wordEN: 'city',     sentence: 'Bangkok is a big city.',           sentenceTH: 'กรุงเทพฯ เป็นเมืองใหญ่' },
      { wordEN: 'country',  sentence: 'Thailand is a beautiful country.', sentenceTH: 'ประเทศไทยเป็นประเทศที่สวยงาม' },
      { wordEN: 'hospital', sentence: 'My aunt works in a hospital.',     sentenceTH: 'ป้าของฉันทำงานที่โรงพยาบาล' },
      { wordEN: 'hotel',    sentence: 'We sleep at a small hotel.',       sentenceTH: 'เรานอนที่โรงแรมเล็ก ๆ' },
      { wordEN: 'house',    sentence: 'Their house has a red door.',      sentenceTH: 'บ้านของพวกเขาประตูสีแดง' },
      { wordEN: 'library',  sentence: 'I read books in the library.',     sentenceTH: 'ฉันอ่านหนังสือที่ห้องสมุด' },
      { wordEN: 'market',   sentence: 'My mother goes to the market.',    sentenceTH: 'แม่ของฉันไปตลาด' },
      { wordEN: 'park',     sentence: 'The children play in the park.',   sentenceTH: 'เด็ก ๆ เล่นในสวนสาธารณะ' },
      { wordEN: 'school',   sentence: 'School starts at eight.',          sentenceTH: 'โรงเรียนเริ่มแปดโมง' },
      { wordEN: 'station',  sentence: 'We wait at the train station.',    sentenceTH: 'เรารอที่สถานีรถไฟ' },
    ],
  },

  // ── ชุดที่ 4 — A1 ตัวเลข 1 ถึง 10 (10 คำ) ───────────────────────────────
  {
    id: 'vex_a1_04',
    level: 'A1',
    theme: 'ตัวเลข 1 ถึง 10',
    title: 'คำศัพท์ A1 ชุดที่ 4 — ตัวเลข 1 ถึง 10',
    description: 'คำศัพท์ตัวเลขพื้นฐาน 1-10 รองรับ 4 รูปแบบฝึก',
    ttsSystem: 'female',
    words: [
      { wordEN: 'one',   sentence: 'I have one sister.',         sentenceTH: 'ฉันมีน้องสาวหนึ่งคน' },
      { wordEN: 'two',   sentence: 'She has two cats.',          sentenceTH: 'เธอมีแมวสองตัว' },
      { wordEN: 'three', sentence: 'There are three books here.',sentenceTH: 'มีหนังสือสามเล่มที่นี่' },
      { wordEN: 'four',  sentence: 'My family has four people.', sentenceTH: 'ครอบครัวของฉันมีสี่คน' },
      { wordEN: 'five',  sentence: 'I eat five apples.',         sentenceTH: 'ฉันกินแอปเปิลห้าลูก' },
      { wordEN: 'six',   sentence: 'He works six days a week.',  sentenceTH: 'เขาทำงานหกวันต่อสัปดาห์' },
      { wordEN: 'seven', sentence: 'The class starts at seven.', sentenceTH: 'ชั้นเรียนเริ่มเจ็ดโมง' },
      { wordEN: 'eight', sentence: 'I sleep eight hours.',       sentenceTH: 'ฉันนอนแปดชั่วโมง' },
      { wordEN: 'nine',  sentence: 'She has nine pencils.',      sentenceTH: 'เธอมีดินสอเก้าลูก' },
      { wordEN: 'ten',   sentence: 'There are ten students.',    sentenceTH: 'มีนักเรียนสิบคน' },
    ],
  },

  // ── ชุดที่ 5 — A1 คำคุณศัพท์พื้นฐาน (15 คำ) ─────────────────────────────
  {
    id: 'vex_a1_05',
    level: 'A1',
    theme: 'คำคุณศัพท์พื้นฐาน',
    title: 'คำศัพท์ A1 ชุดที่ 5 — คำคุณศัพท์พื้นฐาน',
    description: 'คำคุณศัพท์บรรยายขนาด อุณหภูมิ และความรู้สึก รองรับ 4 รูปแบบฝึก',
    ttsSystem: 'female',
    words: [
      { wordEN: 'big',       sentence: 'They live in a big house.',    sentenceTH: 'พวกเขาอาศัยอยู่ในบ้านหลังใหญ่' },
      { wordEN: 'small',     sentence: 'I have a small dog.',          sentenceTH: 'ฉันมีสุนัขตัวเล็ก' },
      { wordEN: 'good',      sentence: 'This is a good book.',         sentenceTH: 'นี่คือหนังสือที่ดี' },
      { wordEN: 'bad',       sentence: 'The weather is bad today.',    sentenceTH: 'วันนี้อากาศแย่' },
      { wordEN: 'new',       sentence: 'I bought a new phone.',        sentenceTH: 'ฉันซื้อโทรศัพท์เครื่องใหม่' },
      { wordEN: 'old',       sentence: 'My grandfather is very old.',  sentenceTH: 'ปู่ของฉันอายุมากแล้ว' },
      { wordEN: 'hot',       sentence: 'The soup is very hot.',        sentenceTH: 'ซุปร้อนมาก' },
      { wordEN: 'cold',      sentence: 'The water is too cold.',       sentenceTH: 'น้ำเย็นเกินไป' },
      { wordEN: 'happy',     sentence: 'She looks very happy today.',  sentenceTH: 'วันนี้เธอดูมีความสุขมาก' },
      { wordEN: 'beautiful', sentence: 'The flowers are beautiful.',   sentenceTH: 'ดอกไม้สวยงาม' },
      { wordEN: 'clean',     sentence: 'Please keep your room clean.', sentenceTH: 'กรุณารักษาห้องให้สะอาด' },
      { wordEN: 'cheap',     sentence: 'These shoes are very cheap.',  sentenceTH: 'รองเท้าคู่นี้ถูกมาก' },
      { wordEN: 'expensive', sentence: 'That watch is expensive.',     sentenceTH: 'นาฬิกานั่นแพง' },
      { wordEN: 'fast',      sentence: 'He is a very fast runner.',    sentenceTH: 'เขาวิ่งเร็วมาก' },
      { wordEN: 'slow',      sentence: 'The bus is very slow.',        sentenceTH: 'รถบัสช้ามาก' },
    ],
  },

  // ── ชุดที่ 6 — A2 สิ่งแวดล้อมและสังคม (10 คำ) ────────────────────────────
  {
    id: 'vex_a2_01',
    level: 'A2',
    theme: 'สิ่งแวดล้อมและสังคม',
    title: 'คำศัพท์ A2 ชุดที่ 6 — สิ่งแวดล้อมและสังคม',
    description: 'คำศัพท์ระดับ A2 เกี่ยวกับสิ่งแวดล้อมและสังคม รองรับ 4 รูปแบบฝึก',
    ttsSystem: 'female',
    words: [
      { wordEN: 'environment', sentence: 'We must protect the environment.',    sentenceTH: 'เราต้องป้องกันสิ่งแวดล้อม' },
      { wordEN: 'pollution',   sentence: 'Air pollution is a big problem.',     sentenceTH: 'มลพิษทางอากาศเป็นปัญหาสำคัญ' },
      { wordEN: 'population',  sentence: 'The population of this city is large.',sentenceTH: 'ประชากรของเมืองนี้มาก' },
      { wordEN: 'society',     sentence: 'Technology changes our society.',     sentenceTH: 'เทคโนโลยีเปลี่ยนสังคมของเรา' },
      { wordEN: 'government',  sentence: 'The government made a new plan.',     sentenceTH: 'รัฐบาลทำแผนใหม่' },
      { wordEN: 'service',     sentence: 'The service at this hotel is good.',  sentenceTH: 'บริการของโรงแรมนี้ดี' },
      { wordEN: 'transport',   sentence: 'Public transport is cheap here.',     sentenceTH: 'การขนส่งมวลชนถูกที่นี่' },
      { wordEN: 'system',      sentence: 'This system works very well.',        sentenceTH: 'ระบบนี้ทำงานได้ดีมาก' },
      { wordEN: 'technology',  sentence: 'Modern technology helps us a lot.',   sentenceTH: 'เทคโนโลยีสมัยใหม่ช่วยเรามาก' },
      { wordEN: 'energy',      sentence: 'Children have a lot of energy.',      sentenceTH: 'เด็ก ๆ มีพลังงานมาก' },
    ],
  },

  // ── ชุดที่ 7 — A2 การศึกษาและการเรียนรู้ (15 คำ) ─────────────────────────
  {
    id: 'vex_a2_02',
    level: 'A2',
    theme: 'การศึกษาและการเรียนรู้',
    title: 'คำศัพท์ A2 ชุดที่ 7 — การศึกษาและการเรียนรู้',
    description: 'คำศัพท์ระดับ A2 เกี่ยวกับการศึกษาและการเรียนรู้ รองรับ 4 รูปแบบฝึก',
    ttsSystem: 'male',
    words: [
      { wordEN: 'education',    sentence: 'Education is very important.',      sentenceTH: 'การศึกษาสำคัญมาก' },
      { wordEN: 'knowledge',    sentence: 'Reading gives us knowledge.',       sentenceTH: 'การอ่านให้ความรู้กับเรา' },
      { wordEN: 'instruction',  sentence: 'Please read the instruction first.', sentenceTH: 'กรุณาอ่านคำแนะนำก่อน' },
      { wordEN: 'method',       sentence: 'This method is easy to learn.',     sentenceTH: 'วิธีนี้เรียนรู้ง่าย' },
      { wordEN: 'research',     sentence: 'She does research at a hospital.',  sentenceTH: 'เธอทำการวิจัยที่โรงพยาบาล' },
      { wordEN: 'explanation',  sentence: 'His explanation was very clear.',   sentenceTH: 'คำอธิบายของเขาชัดเจนมาก' },
      { wordEN: 'discussion',   sentence: 'We had a long discussion today.',   sentenceTH: 'วันนี้เราหารือกันยาว' },
      { wordEN: 'decision',     sentence: 'It was a difficult decision.',      sentenceTH: 'มันเป็นการตัดสินใจที่ยาก' },
      { wordEN: 'choice',       sentence: 'You have only one choice.',         sentenceTH: 'คุณมีทางเลือกเพียงหนึ่ง' },
      { wordEN: 'opportunity',  sentence: 'This job is a great opportunity.',  sentenceTH: 'งานนี้เป็นโอกาสที่ดี' },
      { wordEN: 'experience',   sentence: 'I have no work experience.',        sentenceTH: 'ฉันไม่มีประสบการณ์ทำงาน' },
      { wordEN: 'progress',     sentence: 'You are making good progress.',     sentenceTH: 'คุณก้าวหน้าอย่างดี' },
      { wordEN: 'schedule',     sentence: 'My schedule is full this week.',    sentenceTH: 'ตารางเวลาของฉันเต็มในสัปดาห์นี้' },
      { wordEN: 'memory',       sentence: 'I have a good memory for names.',   sentenceTH: 'ฉันมีความจำที่ดีสำหรับชื่อ' },
      { wordEN: 'experiment',   sentence: 'The experiment was successful.',    sentenceTH: 'การทดลองนั้นสำเร็จ' },
    ],
  },

  // ── ชุดที่ 8 — A2 คำคุณศัพท์ (10 คำ) ─────────────────────────────────────
  {
    id: 'vex_a2_03',
    level: 'A2',
    theme: 'คำคุณศัพท์ A2',
    title: 'คำศัพท์ A2 ชุดที่ 8 — คำคุณศัพท์',
    description: 'คำคุณศัพท์ระดับ A2 บรรยายคุณสมบัติและสภาพ รองรับ 4 รูปแบบฝึก',
    ttsSystem: 'female',
    words: [
      { wordEN: 'able',        sentence: 'She is able to swim very fast.',  sentenceTH: 'เธอสามารถว่ายน้ำเร็วมาก' },
      { wordEN: 'active',      sentence: 'My grandfather is still active.', sentenceTH: 'ปู่ของฉันยังกระตือรือร้น' },
      { wordEN: 'alive',       sentence: 'The old tree is still alive.',    sentenceTH: 'ต้นไม้ต้นเก่ายังมีชีวิตอยู่' },
      { wordEN: 'ancient',     sentence: 'This is an ancient temple.',      sentenceTH: 'นี่เป็นวัดโบราณ' },
      { wordEN: 'attractive',  sentence: 'The price is very attractive.',   sentenceTH: 'ราคาน่าดึงดูดมาก' },
      { wordEN: 'available',   sentence: 'Are you available on Monday?',    sentenceTH: 'คุณว่างวันจันทร์ไหม' },
      { wordEN: 'average',     sentence: 'He is an average student.',       sentenceTH: 'เขาเป็นนักเรียนระดับปานกลาง' },
      { wordEN: 'brilliant',   sentence: 'That is a brilliant idea.',       sentenceTH: 'นั่นเป็นความคิดที่ยอดเยี่ยม' },
      { wordEN: 'broken',      sentence: 'My phone is broken.',             sentenceTH: 'โทรศัพท์ของฉันพัง' },
      { wordEN: 'comfortable', sentence: 'This chair is very comfortable.', sentenceTH: 'เก้าอี้นี้สบายมาก' },
    ],
  },

  // ── ชุดที่ 9 — A2 คำกริยา (15 คำ) ───────────────────────────────────────
  {
    id: 'vex_a2_04',
    level: 'A2',
    theme: 'คำกริยา A2',
    title: 'คำศัพท์ A2 ชุดที่ 9 — คำกริยา',
    description: 'คำกริยาระดับ A2 ที่ใช้บ่อย รองรับ 4 รูปแบบฝึก',
    ttsSystem: 'male',
    words: [
      { wordEN: 'accept',      sentence: 'I accept your invitation.',       sentenceTH: 'ฉันยอมรับคำเชิญของคุณ' },
      { wordEN: 'achieve',     sentence: 'She wants to achieve her goal.',  sentenceTH: 'เธอต้องการบรรลุเป้าหมายของเธอ' },
      { wordEN: 'avoid',       sentence: 'You should avoid sugar.',         sentenceTH: 'คุณควรหลีกเลี่ยงน้ำตาล' },
      { wordEN: 'borrow',      sentence: 'Can I borrow your pen?',          sentenceTH: 'ฉันขอยืมปากกาคุณได้ไหม' },
      { wordEN: 'celebrate',   sentence: 'We celebrate my birthday tonight.',sentenceTH: 'คืนนี้เราฉลองวันเกิดของฉัน' },
      { wordEN: 'communicate', sentence: 'We communicate by email.',        sentenceTH: 'เราสื่อสารกันทางอีเมล' },
      { wordEN: 'complain',    sentence: 'He never complains about work.',  sentenceTH: 'เขาไม่เคยบ่นเรื่องงาน' },
      { wordEN: 'depend',      sentence: 'Children depend on their parents.',sentenceTH: 'เด็ก ๆ ขึ้นอยู่กับพ่อแม่' },
      { wordEN: 'invite',      sentence: 'Please invite your friends.',     sentenceTH: 'กรุณาเชิญเพื่อนของคุณ' },
      { wordEN: 'offer',       sentence: 'They offer me a new job.',        sentenceTH: 'พวกเขาเสนองานใหม่ให้ฉัน' },
      { wordEN: 'promise',     sentence: 'I promise to help you.',          sentenceTH: 'ฉันสัญญาว่าจะช่วยคุณ' },
      { wordEN: 'reach',       sentence: 'We reach the hotel at night.',    sentenceTH: 'เราถึงโรงแรมตอนกลางคืน' },
      { wordEN: 'receive',     sentence: 'I receive your letter today.',    sentenceTH: 'ฉันได้รับจดหมายของคุณวันนี้' },
      { wordEN: 'belong',      sentence: 'This book belongs to me.',        sentenceTH: 'หนังสือเล่มนี้เป็นของฉัน' },
      { wordEN: 'arrange',     sentence: 'Can you arrange a meeting?',      sentenceTH: 'คุณจัดประชุมได้ไหม' },
    ],
  },

  // ── ชุดที่ 10 — A2 ความรู้สึกและบุคลิกภาพ (10 คำ) ───────────────────────
  {
    id: 'vex_a2_05',
    level: 'A2',
    theme: 'ความรู้สึกและบุคลิกภาพ',
    title: 'คำศัพท์ A2 ชุดที่ 10 — ความรู้สึกและบุคลิกภาพ',
    description: 'คำคุณศัพท์ระดับ A2 บ่งบอกอารมณ์และบุคลิกภาพ รองรับ 4 รูปแบบฝึก',
    ttsSystem: 'female',
    words: [
      { wordEN: 'careful',   sentence: 'Be careful with the hot water.',   sentenceTH: 'ระมัดระวังกับน้ำร้อน' },
      { wordEN: 'clever',    sentence: 'She is a very clever student.',    sentenceTH: 'เธอเป็นนักเรียนที่ฉลาดมาก' },
      { wordEN: 'nervous',   sentence: 'I feel nervous before a test.',    sentenceTH: 'ฉันรู้สึกประหม่่าก่อนการสอบ' },
      { wordEN: 'worried',   sentence: 'My mother is worried about me.',   sentenceTH: 'แม่ของฉันกังวลเกี่ยวกับฉัน' },
      { wordEN: 'polite',    sentence: 'The staff are always polite.',     sentenceTH: 'พนักงานสุภาพเสมอ' },
      { wordEN: 'surprised', sentence: 'We were surprised by the news.',   sentenceTH: 'เราประหลาดใจกับข่าว' },
      { wordEN: 'lazy',      sentence: 'He is too lazy to study.',         sentenceTH: 'เขาเกียจคร้านเกินกว่าจะเรียน' },
      { wordEN: 'crazy',     sentence: 'That idea is completely crazy.',   sentenceTH: 'ไอเดียนั่นบ้าอย่างเต็มตัว' },
      { wordEN: 'crowded',   sentence: 'The train is very crowded.',       sentenceTH: 'รถไฟแออัดมาก' },
      { wordEN: 'serious',   sentence: 'This is a serious problem.',       sentenceTH: 'นี่เป็นปัญหาที่ร้ายแรง' },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// buildVocabSetDoc(set, vocabPool) — pure function สร้าง payload ของชุด
//
// @param {object} set        ชุดจาก VOCAB_SETS ด้านบน
// @param {Array}  vocabPool  คลังคำศัพท์ทั้งหมด (จาก data/oxford_vocabulary.json)
//                            ใช้ (1) ยืนยันว่าคำมีอยู่จริงระดับนั้น (2) สุ่ม distractors
// @returns {object} payload พร้อมเขียนลง Firestore (ไม่มี timestamp)
//
// โครงสร้างที่คืนออกมาตามที่ adminVocabularyRoutes.js + learningEngine.js คาดหวัง:
//   items[]              — คำทุกคำของชุด (wordId/wordEN/wordTH/sentence/sentenceTH/distractors)
//   spellingWords[]      — คำที่ใช้ด่านสะกดคำ
//   listenRepeatWords[]  — คำที่ใช้ด่านฟัง-พูดตาม
//   fillInBlankSentences[] — ประโยคที่ใช้ด่านเติมช่องว่าง
//   questionStats/totalQuestions — ทำให้ learningEngine รู้ว่า adminConfigured = true
//                                 → สร้างการ์ดตรงตาม config ครบทั้ง 4 ด่าน (ไม่สุ่ม)
// ══════════════════════════════════════════════════════════════════════════════
function buildVocabSetDoc(set, vocabPool) {
  const pool = Array.isArray(vocabPool) ? vocabPool : [];

  // ดึงเฉพาะคำที่อยู่ในคลังจริง *ระดับเดียวกัน* — ถ้าคำไม่อยู่/ผิดระดับจะไม่ถูกเติม
  // (ตัว runner และ test จะ assert ว่า resolved.length === set.words.length)
  // รายคำภาษาอังกฤษระดับเดียวกัน — dedupe เพราะคลังมีคำซ้ำข้ามชนิดคำ
  // (เช่น 'fish' เป็นทั้ง noun และ verb) ถ้าไม่ dedupe distractor อาจออกมาเป็นคำเดียวกัน 2 ครั้ง
  const sameLevelEN = [...new Set(
    pool.filter((v) => v.cefrLevel === set.level).map((v) => v.wordEN)
  )];

  // rng คงที่ตาม id ของชุด → distractor เหมือนเดิมทุกครั้งที่รันซ้ำ
  const seed = Array.from(String(set.id)).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const rng = mulberry32(seed);

  const resolved = set.words.map((w, i) => {
    const hit = pool.find((v) => v.wordEN === w.wordEN && v.cefrLevel === set.level);
    return {
      wordId:     hit ? hit.id : '',
      wordEN:     w.wordEN,
      wordTH:     hit ? hit.wordTH : '',
      sentence:   w.sentence,
      sentenceTH: w.sentenceTH,
      _index:     i,
    };
  });

  const stages = assignStages(resolved);

  const toItem = (w) => ({
    wordId:     w.wordId || `vs_${set.id}_${w._index}`,
    wordEN:     w.wordEN,
    wordTH:     w.wordTH,
    sentence:   w.sentence,
    sentenceTH: w.sentenceTH,
    level:      set.level,   // learningEngine กรอง pool ด้วย level — ต้องมีทุก item
    cefrLevel:  set.level,   // SCHEMA.md — field มาตรฐาน
    ttsVoice:   set.ttsSystem,
    playbackSpeed: 1.0,
    distractors: sampleDistinct(sameLevelEN, 2, [w.wordEN], rng),
  });

  const items = resolved.map(toItem);

  // ด่านสะกดคำ / ฟัง-พูดตาม → ใช้เฉพาะ wordEN+wordTH (ตาม schema ของ API)
  const spellingWords      = stages.spelling.map((w) => ({ wordEN: w.wordEN, wordTH: w.wordTH }));
  const listenRepeatWords  = stages.listenRepeat.map((w) => ({ wordEN: w.wordEN, wordTH: w.wordTH }));
  // ด่านเติมช่องว่าง → ต้องมี sentence (API บังคับว่าประโยคต้องมีคำนั้น)
  const fillInBlankSentences = stages.fillBlank.map((w) => ({
    wordEN:     w.wordEN,
    wordTH:     w.wordTH,
    sentence:   w.sentence,
    sentenceTH: w.sentenceTH,
  }));

  const questionStats = {
    matching:     1,                        // learningEngine สร้าง matching card 1 ใบเสมอ
    spelling:     spellingWords.length,
    listenRepeat: listenRepeatWords.length,
    fillBlank:    fillInBlankSentences.length,
  };

  return {
    id:              set.id,
    category:        'vocab',
    level:           set.level,             // ExerciseListScreen ใช้กรอง
    vocabularyLevel: set.level,             // SCHEMA.md — ระดับ pool ที่ใช้สร้าง
    status:          'published',           // seed = พร้อมเล่นทันที
    sourceVersion:   2,                     // v2 = สร้างจากไฟล์ข้อมูลชุดใหม่ (ครบ 4 ด่าน)
    source:          'manual',
    title:           set.title,
    description:     set.description,
    theme:           set.theme,
    ttsSystem:       set.ttsSystem,
    items,
    spellingWords,
    listenRepeatWords,
    fillInBlankSentences,
    questionStats,
    totalQuestions:  questionStats.matching + questionStats.spelling
                   + questionStats.listenRepeat + questionStats.fillBlank,
  };
}

/** build payload ของทุกชุดพร้อมกัน */
function buildAllVocabSetDocs(vocabPool) {
  return VOCAB_SETS.map((set) => buildVocabSetDoc(set, vocabPool));
}

module.exports = {
  VOCAB_SETS,
  splitStagePlan,
  assignStages,
  buildVocabSetDoc,
  buildAllVocabSetDocs,
  mulberry32,
  sampleDistinct,
};
