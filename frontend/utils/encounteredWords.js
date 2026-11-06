// frontend/utils/encounteredWords.js
// นับ "คำศัพท์ที่เจอ": คำไม่ซ้ำจากคลัง vocabulary ของแอดมิน (Firestore collection `vocabulary`)
// ที่ "ปรากฏอย่างน้อย 1 ครั้ง" ในแบบฝึกหัดที่ผู้ใช้เคยทำจบแล้ว (ทุกหมวด: vocab / tense / listening)
//
// หมายเหตุ:
// - คลังเป็นความจริงเดียว (source of truth) — คำที่ไม่อยู่ในคลังจะไม่ถูกนับ
// - norm มาตรฐานเดียวกับ dedupe คำโปรด (trim + lowercase) — firestoreService.addFavoriteVocab
// - v1: exact match เท่านั้น (รูปผันเช่น played ≠ play ในคลัง) — จะเพิ่ม heuristic inflection ทีหลังถ้าต้องการ
// - pure functions ทั้งไฟล์ → ทดสอบด้วย jest ได้โดยตรง (ไม่มี RN import)

/**
 * normalize คำ 1 คำ: trim + lowercase + ตัดเครื่องหมายวรรคตอนหัวท้าย (เก็บ apostrophe กลางคำ เช่น don't)
 * @param {any} s
 * @returns {string} '' ถ้าว่าง
 */
export function normalizeWord(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
}

/**
 * แตกประโยค/ข้อความภาษาอังกฤษเป็น token สำหรับ match
 * @param {any} text
 * @returns {string[]}
 */
export function tokenizeEnglish(text) {
  return String(text ?? '')
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter((t) => t.length > 0);
}

/**
 * สร้าง lookup ของคลังคำศัพท์แอดมิน: norm(wordEN) → { id, wordEN }
 * @param {Array} vocabDocs  docs จาก collection `vocabulary` (getAllVocabulary)
 * @returns {Map<string, {id:string, wordEN:string}>}
 */
export function buildVocabLookup(vocabDocs) {
  const map = new Map();
  const list = Array.isArray(vocabDocs) ? vocabDocs : [];
  for (const v of list) {
    if (!v || typeof v !== 'object') continue;
    const key = normalizeWord(v.wordEN);
    if (!key) continue;
    if (!map.has(key)) map.set(key, { id: v.id ?? '', wordEN: String(v.wordEN).trim() });
  }
  return map;
}

function pushStr(arr, v) {
  if (typeof v === 'string' && v.trim()) arr.push(v);
}

function pushStrArr(arr, v) {
  if (Array.isArray(v)) {
    for (const x of v) pushStr(arr, x);
  }
}

/**
 * ดึงข้อความภาษาอังกฤษทั้งหมดจาก exercise 1 ชุด (ครอบคลุมทั้ง 3 หมวด + schema เก่า)
 * - vocab:     items[].wordEN (+ ประโยคตัวอย่างถ้ามี)
 * - tense:     items[] (sentence/speakText/targetSentence + choices + answer + missingWord)
 * - listening: dialogues[].lines[].text + question (prompt/choices/answer)
 * @param {object} exercise
 * @returns {string[]}
 */
export function extractExerciseTextParts(exercise) {
  const parts = [];
  if (!exercise || typeof exercise !== 'object') return parts;

  // ── items (แบบฝึกหัดคำศัพท์ + Tense) ──
  if (Array.isArray(exercise.items)) {
    for (const it of exercise.items) {
      if (!it || typeof it !== 'object') continue;
      pushStr(parts, it.wordEN);
      pushStr(parts, it.sentence);
      pushStr(parts, it.speakText);
      pushStr(parts, it.targetSentence);
      pushStrArr(parts, it.choices);
      pushStr(parts, it.answer);
      pushStr(parts, it.correctAnswer);
      pushStr(parts, it.missingWord);
    }
  }

  // ── dialogues (การฟังและการดู — schema ใหม่) ──
  if (Array.isArray(exercise.dialogues)) {
    for (const d of exercise.dialogues) {
      if (!d || typeof d !== 'object') continue;
      if (Array.isArray(d.lines)) {
        for (const line of d.lines) pushStr(parts, line && line.text);
      }
      const q = d.question;
      if (q && typeof q === 'object') {
        pushStr(parts, q.prompt);
        pushStr(parts, q.question);
        pushStrArr(parts, q.options);
        pushStrArr(parts, q.choices);
        pushStr(parts, q.answer);
        if (typeof q.correctIndex === 'number' && Array.isArray(q.options)) {
          pushStr(parts, q.options[q.correctIndex]);
        }
      }
    }
  }

  // ── legacy flat listening (dialogue[] + questions[]) ──
  if (Array.isArray(exercise.dialogue)) {
    for (const line of exercise.dialogue) pushStr(parts, line && line.text);
  }
  if (Array.isArray(exercise.questions)) {
    for (const q of exercise.questions) {
      if (!q || typeof q !== 'object') continue;
      pushStr(parts, q.prompt);
      pushStr(parts, q.question);
      pushStrArr(parts, q.options);
      pushStrArr(parts, q.choices);
      pushStr(parts, q.answer);
    }
  }

  return parts;
}

/**
 * นับคำศัพท์ที่เจอ: unique คำจากคลังที่ปรากฏในแบบฝึกหัดที่เคยทำจบ
 * @param {{ vocabulary?: Array, exercises?: Array, progressMap?: object }} args
 * @returns {{ count: number, words: Array<{id:string, wordEN:string, wordTH:string}> }}
 */
export function countEncounteredWords({ vocabulary, exercises, progressMap }) {
  const lookup = buildVocabLookup(vocabulary);
  const list = Array.isArray(exercises) ? exercises : [];
  const doneIds = progressMap && typeof progressMap === 'object' ? new Set(Object.keys(progressMap)) : new Set();
  const matched = new Map(); // normKey -> vocab entry
  const phrases = [...lookup.keys()].filter((k) => k.includes(' ')); // รายการคลังที่เป็นวลีหลายคำ

  for (const ex of list) {
    if (!ex || typeof ex !== 'object' || !ex.id || !doneIds.has(ex.id)) continue;
    const parts = extractExerciseTextParts(ex);
    if (parts.length === 0) continue;

    // 1) คำเดี่ยว: token match
    for (const part of parts) {
      for (const tok of tokenizeEnglish(part)) {
        if (lookup.has(tok) && !matched.has(tok)) matched.set(tok, lookup.get(tok));
      }
    }

    // 2) วลีหลายคำในคลัง: substring บน normalized text
    if (phrases.length > 0) {
      const flat = ' ' + parts.map((p) => tokenizeEnglish(p).join(' ')).join(' ') + ' ';
      for (const phrase of phrases) {
        if (!matched.has(phrase) && flat.includes(' ' + phrase + ' ')) {
          matched.set(phrase, lookup.get(phrase));
        }
      }
    }
  }

  return { count: matched.size, words: [...matched.values()] };
}
