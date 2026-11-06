// frontend/utils/learningEngine.js
//
// คลังฟังก์ชัน "Learning Engine" — สุ่ม/สุ่มเลือก/ประกอบโจทย์ แบบ pure (stateless)
// สำหรับการ randomization และการสร้าง session ของแบบฝึกหัดทั้ง 3 หมวด.
//
// ⚠️ ไฟล์นี้เป็น **CommonJS module** (module.exports) — ตั้งใจให้ใช้ร่วมได้ทั้ง:
//   - Backend Node.js (require)   เช่น `backend/services/exerciseGeneratorService.js`
//   - Frontend Expo / Metro (import หรือ require) — Babel interop อ่าน named exports ได้
// ไม่มี dependency กับ React Native / Firebase เลย จึง import ตรงไปยัง Jest ได้.
//
// วิธีใช้:
//   - VocabExerciseScreen  → shuffleStages / buildFillBlankChoices / normalizeExerciseItem
//   - Exercise Generator (Admin API M1.3) → sampleWithoutReplacement / buildVocabItems / buildQuizSession
//   - ทุกฟังก์ชัน accept `rng` ที่ inject ได้ เพื่อ deterministic-test และ property-based tests

// ───────────── constants (จาก .kiro/specs/vocabulary-learning-module) ─────────────
const STAGES = Object.freeze(['matching', 'spelling', 'fillblank', 'pronunciation']);

// จำนวนคู่สูงสุดสำหรับการ์ด Matching (ใช้ร่วมกันทุก consumer)
// — dynamic: ถ้าชุดข้อมูลมีคู่น้อยกว่า (เช่น 7-8 คู่) ให้ใช้เท่าที่มี ไม่บังคับให้ครบ 10
const MATCHING_PAIRS_MAX = 10;

// pool ที่จะ shuffle หลัง matching ซึ่งอยู่ fixed ที่ index 0 (invariant)
const VOCAB_POOL = Object.freeze(['spelling', 'fillblank', 'pronunciation']);

/**
 * Fisher–Yates shuffle แบบ non-mutating พร้อม rng ที่ inject ได้ (สำหรับทดสอบ)
 * @param {Array} arr
 * @param {() => number} [rng] ค่าใน [0,1) — default Math.random
 * @returns {Array} ชุดใหม่ (ไม่แก้ input)
 */
function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/**
 * สุ่มลำดับ stages: [matching] + shuffle([spelling, fillblank, pronunciation])
 * INVARIANT: result[0] === 'matching' always (Validation: Requirements 1.1-1.4)
 * @param {() => number} [rng]
 * @returns {string[]}
 */
function shuffleStages(rng = Math.random) {
  return ['matching', ...shuffle(VOCAB_POOL, rng)];
}

/**
 * สุ่มเลือก `size` รายจาก arr แบบไม่ซ้ำ (without replacement)
 * @param {Array} arr
 * @param {number} size
 * @param {() => number} [rng]
 * @returns {Array} ยาว ≤ min(size, arr.length)
 */
function sampleWithoutReplacement(arr, size, rng = Math.random) {
  if (size <= 0) return [];
  if (size >= arr.length) return shuffle(arr, rng);
  const pool = [...arr];
  const out  = [];
  for (let i = pool.length - 1; i >= 0 && out.length < size; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = pool[i];
    pool[i] = pool[j];
    pool[j] = t;
    out.push(pool[i]);
  }
  return out;
}

/**
 * เลือก distractors (คำหลอก) จาก pool โดยไม่รวม target
 * @param {Array<{wordEN?:string}>} pool รายคำศัพท์
 * @param {string} targetWordEN คำที่ถูก (ไม่ใช้ใน distractors)
 * @param {number} [count=2]
 * @param {() => number} [rng]
 * @returns {string[]} ราย wordEN ของคำหลอก
 */
function pickDistractors(pool, targetWordEN, count = 2, rng = Math.random) {
  const candidates = (pool ?? []).filter((w) => (w.wordEN ?? '') !== targetWordEN);
  const picked = sampleWithoutReplacement(candidates, Math.min(count, candidates.length), rng);
  return picked.map((w) => w.wordEN);
}

/**
 * Normalize ExerciseItem — field mapping (จาก spec Requirement 2.1)
 *   wordId   ← item.wordId ?? item.id ?? String(Math.random())
 *   wordEN   ← item.wordEN ?? item.word ?? ''
 *   wordTH   ← item.wordTH ?? item.translation ?? ''
 *   level    ← item.level ?? item.cefrLevel ?? ''
 *   cefrLevel← item.cefrLevel ?? item.level ?? ''
 * @param {object} item
 * @returns {{wordId:string, wordEN:string, wordTH:string, sentence:string, sentenceTH:string, speakText:string, ttsVoice:string, distractors:string[], level:string, cefrLevel:string}}
 */
function normalizeExerciseItem(item) {
  const it = item ?? {};
  return {
    wordId:      it.wordId ?? it.id ?? String(Math.random()),
    wordEN:      it.wordEN ?? it.word ?? '',
    wordTH:      it.wordTH ?? it.translation ?? '',
    sentence:    it.sentence ?? '',
    sentenceTH:  it.sentenceTH ?? '',
    speakText:   it.speakText ?? '',
    ttsVoice:    it.ttsVoice ?? '', // เพศเสียง TTS ที่ Admin ตั้งไว้: 'female' | 'male' | '' (ไม่มี → โทนปกติ)
    distractors: it.distractors ?? [],
    level:       it.level ?? it.cefrLevel ?? '',
    cefrLevel:   it.cefrLevel ?? it.level ?? '',
  };
}
/**
 * กรองเฉพาะ item ที่มี wordEN และ wordTH ที่ไม่ว่าง/ไม่มีช่องว่าง (whitespace)
 * (Validation: Requirement 2.2)
 * @param {Array<{wordEN?:string, wordTH?:string}>} items
 * @returns {Array}
 */
function filterUsableItems(items) {
  const clean = (s) => typeof s === 'string' && s.trim().length > 0;
  return (items ?? []).filter((it) => it && clean(it.wordEN) && clean(it.wordTH));
}

/**
 * สร้าง choices สำหรับ FillBlank: [wordEN(ถูก), ...distractors] แล้ว สุ่มลำดับ
 * INVARIANT: มี wordEN ของข้อนี้ อย่างน้อย 1 และทุกค่าใน list ไม่นำจากข้ออื่น
 * @param {{wordEN:string, distractors?:string[]}} item
 * @param {() => number} [rng]
 * @returns {string[]}
 */
function buildFillBlankChoices(item, rng = Math.random) {
  const correct = item?.wordEN ?? '';
  // Dynamic: ใช้คำหลอกที่ admin ตั้งมาสูงสุด 5 ช่อง — ว่าง [] = เหลือแค่คำตอบถูก (สุ่มเสริมจาก pool ที่ buildQuizSession)
  const distractors = (item?.distractors ?? []).slice(0, 5);
  return shuffle([correct, ...distractors], rng);
}

/**
 * สร้าง items[] ของแบบฝึก vocab จาก รายคำศัพท์ที่ sample มา
 * @param {Array<{id?:string, wordId?:string, wordEN:string, wordTH:string, sentence?:string, sentenceTH?:string, speakText?:string, level?:string, cefrLevel?:string}>} words
 * @param {object} [opts]
 * @param {Array} [opts.pool]           — แหล่งของ distractors (default = words)
 * @param {() => number} [opts.rng]
 * @param {(v:object) => string} [opts.sentenceFor]     — override sentence generator
 * @param {(v:object) => string} [opts.sentenceTHFor]   — override sentenceTH generator
 * @returns {Array<{wordId, wordEN, wordTH, sentence, sentenceTH, speakText, distractors, level, cefrLevel}>}
 */
function buildVocabItems(words, opts = {}) {
  const rng = opts.rng ?? Math.random;
  const pool = opts.pool ?? words;
  const defaultSentence   = (v) => `I know the word "${v.wordEN}".`;
  const defaultSentenceTH = (v) => `ฉันรู้จักคำว่า "${v.wordTH}"`;
  return words.map((v) => {
    const wordId = v.id ?? v.wordId ?? String(Math.random());
    return {
      wordId,
      wordEN:      v.wordEN,
      wordTH:      v.wordTH,
      sentence:    v.sentence ?? (opts.sentenceFor ? opts.sentenceFor(v) : defaultSentence(v)),
      sentenceTH:  v.sentenceTH ?? (opts.sentenceTHFor ? opts.sentenceTHFor(v) : defaultSentenceTH(v)),
      speakText:   v.speakText ?? '',
      distractors: pickDistractors(pool, v.wordEN, 2, rng),
      level:       v.level ?? v.cefrLevel ?? '',
      cefrLevel:   v.cefrLevel ?? v.level ?? '',
    };
  });
}

/**
 * สร้าง session ของแบบฝึก vocab ตามโครงสร้างใหม่:
 *   - Card 1 (Matching): 1 การ์ดจับคู่ที่มีสูงสุด ${MATCHING_PAIRS_MAX} คู่ (ถ้ามีคู่น้อยกว่า ใช้เท่าที่มี)
 *   - Cards 2..N: การ์ดคำถมเดี่ยว (Spelling / Pronunciation / FillBlank)
 *   - รวม = N การ์ดพอดี (N = 10 หรือ 15)
 *   - ทุกการ์ดมี ttsVoice ('female' | 'male' | '') สำหรับเลือกเสียง TTS
 *     ลำดับความสำคัญ: per-item (w.ttsVoice) → เพศเสียงของชุด (ex.ttsSystem) → '' (โทนปกติ)
 *
 * เรียกได้ 2 แบบ:
 *   buildQuizSession({ exercise, vocabPool, level, size, rng })  // แบบหลัก (object opts)
 *   buildQuizSession(vocabPool, { targetSize })                  // shorthand — รองรับ service M1.3
 *
 * @param {object|Array} optsOrPool
 * @param {object} [legacyOpts] ใช้เฉพาะกรณี array overload
 * @returns {{items: Array}}
 */
function buildQuizSession(optsOrPool, legacyOpts) {
  let opts = optsOrPool;
  if (Array.isArray(optsOrPool)) {
    opts = {
      exercise:  { category: 'vocab' },
      vocabPool: optsOrPool,
      size:      legacyOpts?.targetSize ?? legacyOpts?.size ?? 10,
      rng:       legacyOpts?.rng,
    };
  }
  const { exercise, vocabPool, level, size = 10, rng, spellingWords = [], listenRepeatWords = [], fillInBlankSentences = [] } = opts ?? {};
  const r = rng ?? Math.random;
  const ex = exercise ?? {};

  if (ex.category === 'vocab') {
    const useLevel = level ?? ex.level;
    const levelPool = (vocabPool ?? []).filter(
      (v) => !useLevel || v.cefrLevel === useLevel || v.level === useLevel
        // Items that carry no CEFR tag are treated as level-agnostic so a
        // populated exercise set is never dropped to empty by the filter.
        || (!v.cefrLevel && !v.level)
    );

    // จำนวนการ์ดรวม = size (10 หรือ 15)
    // Card 1 = Matching (สูงสุด MATCHING_PAIRS_MAX คู่), Cards 2..size = คำถมเดี่ยว
    const totalCards = Math.max(1, Math.min(size, levelPool.length));

    // สุ่มเลือกคำสำหรับ Matching และคำถมเดี่ยวแยกกัน (อนุญาตให้ซ้อนทับได้)
    // เพราะชุดข้อสอบอาจมีคำศัพท์ N คำ แต่ต้องการ N การ์ดรวม (1 matching + N-1 individual)
    // Matching: dynamic — ใช้คู่ทั้งหมดที่มีในชุด แต่ไม่เกิน 10 คู่
    // (ชุดเล็กเช่น 7-8 คู่ → ได้ 7-8 คู่พอดี ไม่ error)
    const matchingPairs = Math.min(MATCHING_PAIRS_MAX, Math.max(1, levelPool.length));
    const individualCount = totalCards - 1;
    const matchingWords = sampleWithoutReplacement(levelPool, matchingPairs, r);
    const individualWords = sampleWithoutReplacement(levelPool, individualCount, r);

    // สร้าง Matching card (1 การ์ดที่มีสูงสุด MATCHING_PAIRS_MAX คู่)
    const matchingCard = {
      wordId: 'matching_card',
      wordEN: 'Matching',
      wordTH: 'จับคู่',
      sentence: '',
      sentenceTH: '',
      speakText: '',
      distractors: [],
      level: ex.level ?? '',
      cefrLevel: ex.level ?? '',
      isMatchingCard: true,       // flag ระบุว่าเป็นการ์ด Matching
      matchingPairs: matchingWords.map((w) => ({
        wordId: w.id ?? w.wordId ?? String(Math.random()),
        wordEN: w.wordEN,
        wordTH: w.wordTH,
        sentence: w.sentence ?? `I know the word "${w.wordEN}".`,
        sentenceTH: w.sentenceTH ?? `ฉันรู้จักคำว่า "${w.wordTH}"`,
        speakText: w.speakText ?? '',
        ttsVoice: w.ttsVoice || ex.ttsSystem || '', // per-item มาก่อน → fallback เพศเสียงของชุด
      })),
    };

    // ── สร้างคำถมเดี่ยว (individual cards) ──
    // เส้นทาง (A) Admin-configured: สร้างการ์ดตรงตาม config ที่ Admin เลือกไว้
    //   → Matching=1 ข้อ, Spelling=1 ข้อ/คำ, Listen&Repeat=1 ข้อ/คำ, FIB=1 ข้อ/ประโยค
    // เส้นทาง (B) Auto-generate (ไม่มี config): สุ่ม sample จาก pool แบบเดิม (M1.3)
    const normKey = (s) => (s ?? '').trim().toLowerCase();
    const spellingArr = Array.isArray(spellingWords) ? spellingWords : [];
    const listenArr   = Array.isArray(listenRepeatWords) ? listenRepeatWords : [];
    const hasSentence = (it) => !!(
      it && (
        (typeof it.sentence === 'string' && it.sentence.trim()) ||
        (typeof it.sentenceTH === 'string' && it.sentenceTH.trim())
      )
    );

    // Admin ตั้งค่าไว้ (ผ่าน vocabulary-sets wizard) → backend จะคำนวณ/เก็บ totalQuestions ไว้เสมอ
    const adminConfigured =
      spellingArr.length > 0 ||
      listenArr.length > 0 ||
      typeof ex.totalQuestions === 'number' ||
      !!ex.questionStats;

    const makeCard = (w, qType, idx) => {
      // Dynamic: ถ้า admin ตั้ง distractors มาแล้วใช้ของ admin (สูงสุด 5, กันซ้ำ+กันเท่าคำตอบถูก)
      // ถ้าว่าง [] ค่อยสุ่มเสริมจาก pool ให้ครบ 2 อัตโนมัติ
      const adminDist = Array.isArray(w.distractors)
        ? [...new Set(w.distractors.map((d) => String(d ?? '').trim()).filter(Boolean))]
          .filter((d) => d.toLowerCase() !== String(w.wordEN ?? '').trim().toLowerCase())
          .slice(0, 5)
        : [];
      const need = Math.max(0, 2 - adminDist.length);
      const autoDist = need > 0
        ? pickDistractors(
            levelPool.filter((c) => !adminDist.some((d) => d.toLowerCase() === String(c.wordEN ?? '').trim().toLowerCase())),
            w.wordEN ?? '', need, r)
        : [];
      return {
        wordId: w.wordId ?? w.id ?? `${qType}_${idx}_${normKey(w.wordEN)}`,
        wordEN: w.wordEN ?? '',
        wordTH: w.wordTH ?? '',
        sentence: w.sentence ?? `I know the word "${w.wordEN ?? ''}".`,
        sentenceTH: w.sentenceTH ?? `ฉันรู้จักคำว่า "${w.wordTH ?? ''}"`,
        speakText: w.speakText ?? '',
        ttsVoice: w.ttsVoice || ex.ttsSystem || '', // spelling/listenRepeat/FIB ไม่มี ttsVoice ต่อคำ → ใช้ของชุด
        distractors: [...adminDist, ...autoDist],
        level: w.level ?? w.cefrLevel ?? ex.level ?? '',
        cefrLevel: w.cefrLevel ?? w.level ?? ex.level ?? '',
        questionType: qType,
        isMatchingCard: false,
      };
    };

    let individualCards;
    if (adminConfigured) {
      // FIB = ข้อที่ Admin ผูกประโยคไว้ (1 ประโยค = 1 ข้อ) — ใช้ fillInBlankSentences ถ้ามี
      // มิฉะนั้น fallback ไปหา items ที่มี sentence/sentenceTH (ชุดเดิม)
      const fibArr = Array.isArray(fillInBlankSentences) ? fillInBlankSentences : [];
      const fillBlankSource = fibArr.length > 0 ? fibArr : levelPool.filter(hasSentence);
      const spellingCards      = spellingArr.map((w, i) => makeCard(w, 'spelling', i));
      const pronunciationCards = listenArr.map((w, i) => makeCard(w, 'pronunciation', i));
      const fillBlankCards     = fillBlankSource.map((w, i) => makeCard(w, 'fillblank', i));
      individualCards = [...spellingCards, ...pronunciationCards, ...fillBlankCards];
    } else {
      // Auto-generate — สุ่มประเภทคำถามแบบเดิม + การันตีครบทุก stage
      const questionTypes = ['spelling', 'pronunciation', 'fillblank'];
      const assignedTypes = individualWords.map(() => questionTypes[Math.floor(r() * questionTypes.length)]);
      const typeCounts = {};
      assignedTypes.forEach((t) => { typeCounts[t] = (typeCounts[t] || 0) + 1; });
      for (const t of questionTypes) {
        if (!typeCounts[t]) {
          const idx = Math.floor(r() * assignedTypes.length);
          assignedTypes[idx] = t;
        }
      }
      individualCards = individualWords.map((w, idx) => {
        const qType = assignedTypes[idx];
        return {
          wordId: w.id ?? w.wordId ?? String(Math.random()),
          wordEN: w.wordEN,
          wordTH: w.wordTH,
          sentence: w.sentence ?? `I know the word "${w.wordEN}".`,
          sentenceTH: w.sentenceTH ?? `ฉันรู้จักคำว่า "${w.wordTH}"`,
          speakText: w.speakText ?? '',
          ttsVoice: w.ttsVoice || ex.ttsSystem || '', // auto-generate: per-item → เพศเสียงของชุด
          distractors: pickDistractors(levelPool, w.wordEN, 2, r),
          level: w.level ?? w.cefrLevel ?? '',
          cefrLevel: w.cefrLevel ?? w.level ?? '',
          questionType: qType,
          isMatchingCard: false,
        };
      });
    }

    // รวม: Matching card ข้างหน้า + คำถมเดี่ยวตามหลัง = totalCards การ์ดพอดี
    const items = [matchingCard, ...individualCards];

    return { items };
  }

  if (ex.category === 'tense' || ex.category === 'listening') {
    const items = sampleWithoutReplacement(ex.items ?? [], Math.min(size, (ex.items ?? []).length), r);
    return { items };
  }

  return { items: [] };
}

module.exports = {
  STAGES,
  VOCAB_POOL,
  MATCHING_PAIRS_MAX,
  shuffle,
  shuffleStages,
  sampleWithoutReplacement,
  pickDistractors,
  normalizeExerciseItem,
  filterUsableItems,
  buildFillBlankChoices,
  buildVocabItems,
  buildQuizSession,
};