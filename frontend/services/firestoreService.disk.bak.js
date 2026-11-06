// frontend/services/firestoreService.js
//
// ศูนย์รวมคุยกับ Firestore ฝั่ง user — จอต่างๆ เรียกผ่านไฟล์นี้ไฟล์เดียว
// users=โปรไฟล์ | vocabulary=คลังศัพท์ | exercises=ชุดข้อสอบ | statistics=คะแนน | favoriteVocab=คำโปรด
//
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  limit,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { cachedFetch, clearCache, isQuotaError } from './firebaseCache';

// ของไม่ค่อยเปลี่ยน (ข้อสอบ/คลังศัพท์) จำไว้ 5 นาที — ไม่ต้องยิงบ่อย
const TTL_REF_DATA_MS = 5 * 60 * 1000;   // 5 นาที
// ของส่วนตัว (คะแนน/โปรด) จำไว้ 1 นาที — เอาสดหน่อย
const TTL_USER_DATA_MS = 60 * 1000;      // 1 นาที

// แปล error ให้อ่านรู้เรื่อง — แยกโควต้าเต็มกับพังทั่วไป
/**
 * log error จาก Firestore พร้อมแยกชนิด (โควต้าเต็ม vs ทั่วไป)
 * @param {string} label
 * @param {any} err
 */
function logReadError(label, err) {
  if (isQuotaError(err)) {
    console.warn(`[firestoreService] ${label} ติดโควต้า Firebase (resource-exhausted/429):`, err?.message);
  } else {
    console.error(`[firestoreService] ${label} error:`, err?.code, err?.message);
  }
}

// ══════════════════════════════════════════════════════════════
// VOCABULARY
// ══════════════════════════════════════════════════════════════

// ดึงคลังศัพท์ทั้งหมด — หน้า Home ใช้นับคำที่เจอ
/**
 * ดึงคำศัพท์ทั้งหมดจาก Firestore
 * — มี TTL cache (5 นาที): การเปิดหน้า Home/แท็บซ้ำๆ จะไม่ยิง request ใหม่ทุกครั้ง
 * — ถ้าโควต้าเต็มจะคืนข้อมูลเก่าจาก cache แทนที่จะพัง
 * @returns {Promise<Array>} รายการคำศัพท์ [{id, wordEN, wordTH, ttsVoice}, ...]
 */
export async function getAllVocabulary() {
  return cachedFetch(
    'vocabulary:all',
    async () => {
      const snap = await getDocs(collection(db, 'vocabulary'));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    { ttlMs: TTL_REF_DATA_MS, fallback: [] },
  );
}

// ดึงศัพท์คำเดียวตาม id — กันกดซ้ำรัวๆ ด้วย cache
/**
 * ดึงคำศัพท์ตาม id (cache สั้น ๆ กันกดซ้ำรัว ๆ)
 */
export async function getVocabById(wordId) {
  try {
    return await cachedFetch(
      `vocabulary:${wordId}`,
      async () => {
        const snap = await getDoc(doc(db, 'vocabulary', wordId));
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() };
      },
      { ttlMs: TTL_REF_DATA_MS, fallback: null },
    );
  } catch (err) {
    logReadError('getVocabById', err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// EXERCISES
// ══════════════════════════════════════════════════════════════

// แปลงวันเวลาทุกรูปแบบให้เป็นตัวเลข — เอาไว้เรียงลำดับ
/**
 * แปลง createdAt (Timestamp | Date | number | undefined) → epoch ms
 * เพื่อให้ sort เรียงลำดับได้เสมอแม้ข้อมูลเก่าจะไม่มี field นี้
 */
function toEpochMs(value) {
  if (!value) return 0;
  if (typeof value.seconds === 'number') return value.seconds * 1000 + ((value.nanoseconds || 0) / 1e6);
  if (value instanceof Date) return value.getTime();
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

// กันข้อมูลเก่าขาดชื่อ/คำอธิบาย — เติมค่าเผื่อไว้ไม่ให้จอโล่ง
/**
 * ปรับโครงสร้างชุดแบบฝึกหัด (normalize) ให้มี field พื้นฐานครบเสมอ
 * — ป้องกันข้อมูลเก่าที่อาจขาด title/description หรือมีค่า null
 *   ทำให้ card บน User App render ข้อความว่าง (หน้าจอโล่ง)
 *
 * @param {object} ex  — doc จาก Firestore ({ id, ...data })
 * @param {number} [index] — ลำดับรายการ ใช้เป็น fallback สำหรับชื่อ
 * @returns {object} ชุดแบบฝึกหัดที่รับประกันว่า title/description/level เป็น string
 */
export function normalizeExercise(ex, index = 0) {
  const raw = ex ?? {};
  const level = raw.level || raw.vocabularyLevel || 'A1';
  return {
    ...raw,
    id:          raw.id || raw._id || `exercise_${index + 1}`,
    title:       String(raw.title || raw.name || `ชุดคำศัพท์ ${index + 1}`),
    description: String(raw.description || `คำศัพท์ระดับ ${level}`),
    level,
    _createdAtMs: toEpochMs(raw.createdAt), // ใช้สำหรับเรียงลำดับภายในเท่านั้น
  };
}

// ดึงชุดข้อสอบตามหมวด vocab/tense/listening — เอาเฉพาะที่เผยแพร่แล้ว
/**
 * ดึงรายการชุดแบบฝึกหัดตามหมวด (และระดับ CEFR ถ้าระบุ)
 * กรองเฉพาะ status = 'published' เพื่อซ่อน draft จากผู้ใช้งานทั่วไป
 *
 * หมายเหตุ: query นี้ต้องการ Composite Index ใน Firestore:
 *   collection: exercises | fields: category ASC, status ASC, level ASC (ถ้าใช้ level filter)
 *   สร้างได้ที่ Firebase Console → Firestore → Indexes
 *   หรือรอให้ Firestore ส่ง URL สร้าง index ใน console log ตอน error ครั้งแรก
 *
 * @param {'vocab'|'tense'|'listening'} category
 * @param {string} [level] — ระดับ CEFR เช่น A1, A2
 * @returns {Promise<Array>} [{id, title, category, items: [...], ...}, ...]
 */
export async function getExercisesByCategory(category, level) {
  // cache ต่อ category+level — กันดึงซ้ำทุกครั้งที่สลับแท็บ (Home→Stats→List)
  return cachedFetch(
    `exercises:${category}:${level || 'all'}`,
    async () => {
      try {
        // เงื่อนไข: หมวดตรง + เผยแพร่แล้ว (draft แอดมินเห็นอย่างเดียว)
        const constraints = [
          where('category', '==', category),
          where('status', '==', 'published'),
        ];
        if (level) constraints.push(where('level', '==', level));

        const q = query(collection(db, 'exercises'), ...constraints, limit(200));
        const snap = await getDocs(q);
        // Normalize ทันทีหลัง fetch → ทุก object มี title/description/level/id เป็น string เสมอ
        const docs = snap.docs.map((d, i) => normalizeExercise({ id: d.id, ...d.data() }, i));

        docs.sort((a, b) => {
          const ta = a._createdAtMs ?? 0;
          const tb = b._createdAtMs ?? 0;
          if (ta !== tb) return ta - tb;
          return a.id.localeCompare(b.id);
        });

        return docs;
      } catch (err) {
        // ยังไม่สร้าง index ใน Console → ใช้วิธีบ้านๆ ดึงมากรองเอง กันแอปพัง
        // FAILED_PRECONDITION = Composite Index ยังไม่ได้สร้างใน Firebase Console
        // fallback: ดึงทั้งหมด แล้ว filter ใน memory เพื่อไม่ให้แอปพัง
        if (err.code === 'failed-precondition') {
          console.warn(
            '[firestoreService] Composite index ยังไม่พร้อม — fallback ไป client-side filter\n' +
            'กรุณาสร้าง index ที่ Firebase Console หรือดู URL ใน error ด้านล่าง:\n',
            err.message,
          );
          try {
            const fallbackQ = query(
              collection(db, 'exercises'),
              where('category', '==', category),
            );
            const fallbackSnap = await getDocs(fallbackQ);
            let docs = fallbackSnap.docs
              .map((d, i) => normalizeExercise({ id: d.id, ...d.data() }, i))
              .filter((d) => d.status === 'published' || !d.status)
              .filter((d) => !level || d.level === level);

            docs.sort((a, b) => {
              const ta = a._createdAtMs ?? 0;
              const tb = b._createdAtMs ?? 0;
              if (ta !== tb) return ta - tb;
              return a.id.localeCompare(b.id);
            });

            return docs;
          } catch (innerErr) {
            logReadError('getExercisesByCategory(fallback)', innerErr);
            return [];
          }
        }

        logReadError('getExercisesByCategory', err);
        return [];
      }
    },
    { ttlMs: TTL_REF_DATA_MS, fallback: [] },
  );
}

// ดึงข้อสอบชุดเดียวตาม id — กันเปิดการ์ดซ้ำ
/**
 * ดึงชุดแบบฝึกหัดตาม id (cache กันเปิดการ์ดซ้ำ)
 */
export async function getExerciseById(exerciseId) {
  try {
    return await cachedFetch(
      `exercises:${exerciseId}`,
      async () => {
        const snap = await getDoc(doc(db, 'exercises', exerciseId));
        if (!snap.exists()) return null;
        return normalizeExercise({ id: snap.id, ...snap.data() });
      },
      { ttlMs: TTL_REF_DATA_MS, fallback: null },
    );
  } catch (err) {
    logReadError('getExerciseById', err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// STATISTICS  (ผลคะแนนสมาชิก)
// ══════════════════════════════════════════════════════════════

// เซฟคะแนน 1 รอบ — ผ่านถ้าได้ >=80% (ล้าง cache ทันที)
/**
 * บันทึกผลคะแนนหลังทำแบบฝึกหัดเสร็จ
 * @param {string} userEmail
 * @param {string} exerciseId
 * @param {object} result  { score, totalQuestions, timeSpent (วินาที), category }
 */
export async function saveStatistic(userEmail, exerciseId, result) {
  const { score, totalQuestions, timeSpent, category } = result;
  const passed = (score / totalQuestions) * 100 >= 80;

  await addDoc(collection(db, 'statistics'), {
    email:          userEmail,
    exerciseId,
    category,
    score,
    totalQuestions,
    timeSpent,
    passed,
    percentage:     Math.round((score / totalQuestions) * 100),
    createdAt:      serverTimestamp(),
  });
  // สถิติเปลี่ยน → ล้าง cache ของผู้ใช้คนนี้เพื่อให้โหลดค่าใหม่รอบหน้า
  clearCache(`stats:${userEmail}`);
}

// ดึงประวัติคะแนน 200 รอบล่าสุด — ใหม่ไปเก่า หน้า Stats ใช้
/**
 * ดึงประวัติผลคะแนนของสมาชิก (ล่าสุด 200 รายการ)
 * — มี limit + cache: ป้องกันการดึง collection `statistics` ทั้งหมด (โตไม่รู้จบ)
 * — ถ้า composite index ยังไม่พร้อม (failed-precondition) จะ fallback ไป query เดิม
 */
export async function getUserStatistics(userEmail) {
  return cachedFetch(
    `stats:${userEmail}`,
    async () => {
      try {
        const q = query(
          collection(db, 'statistics'),
          where('email', '==', userEmail),
          orderBy('createdAt', 'desc'),
          limit(200),
        );
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        // ยังไม่มี composite index (email + createdAt) → แบบไม่มี orderBy
        if (err.code === 'failed-precondition') {
          try {
            const q = query(
              collection(db, 'statistics'),
              where('email', '==', userEmail),
              limit(200),
            );
            const snap = await getDocs(q);
            const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
            return docs;
          } catch (innerErr) {
            logReadError('getUserStatistics(fallback)', innerErr);
            return [];
          }
        }
        logReadError('getUserStatistics', err);
        return [];
      }
    },
    { ttlMs: TTL_USER_DATA_MS, fallback: [] },
  );
}

// รวมคะแนนซ้ำให้เหลือชุดละ 1 — เจอหลายรอบเอารอบคะแนนสูงสุดไว้
/**
 * ดึงผลคะแนนที่ดีที่สุด (คะแนนสูงสุด) ของแต่ละชุดแบบฝึกหัด สำหรับคำนวณ progress
 * — การ์ด/สถิติจะแสดงผลเป็น "คะแนนสูงสุด" เสมอ แม้ครั้งหลังทำได้คะแนนน้อยกว่า
 *   และค่า passed มาจาก record ที่ได้คะแนนสูงสุดนั้นด้วย (เคยผ่านแล้วจะไม่ถูกลดกลับ)
 * คืนค่า: { [exerciseId]: { passed, percentage, score, ... } }
 */
export async function getUserProgressMap(userEmail) {
  const stats = await getUserStatistics(userEmail);
  const map   = {};
  // stats เรียงใหม่→เก่าอยู่แล้ว → ถ้าคะแนนเท่ากันให้ใช้ record ที่ใหม่กว่า
  // วนเทียบทีละรอบ — รอบไหน % สูงสุดชนะ ได้เป็นตัวแทนของชุดนั้น
  for (const s of stats) {
    const cur   = map[s.exerciseId];
    const pctOf = (r) => r.percentage ??
      (r.totalQuestions ? Math.round((r.score / r.totalQuestions) * 100) : 0);
    if (!cur || pctOf(s) > pctOf(cur)) {
      map[s.exerciseId] = s;
    }
  }
  return map;
}

// คิด % ผ่านรายหมวด — นับเฉพาะชุดที่ passed หารด้วยชุดทั้งหมด
/**
 * คำนวณ progress รวมของแต่ละหมวด (0-100)
 * @param {string} userEmail
 * @param {'vocab'|'tense'|'listening'} category
 * @returns {Promise<number>} เปอร์เซ็นต์ความคืบหน้า
 */
export async function getCategoryProgress(userEmail, category) {
  // ดึงชุดแบบฝึกทั้งหมดของหมวดนี้
  const exercises = await getExercisesByCategory(category);
  if (exercises.length === 0) return 0;

  const progressMap = await getUserProgressMap(userEmail);
  let passedCount   = 0;

  for (const ex of exercises) {
    if (progressMap[ex.id]?.passed) passedCount += 1;
  }

  return Math.round((passedCount / exercises.length) * 100);
}

// ══════════════════════════════════════════════════════════════
// FAVORITE VOCABULARY
// ══════════════════════════════════════════════════════════════

// ดึงคำโปรดของคนนี้ — หน้า Library + หัวใจในห้องสอบใช้
/**
 * ดึงรายการคำศัพท์โปรดของสมาชิก (cache 1 นาที + limit กันดึงเพลิน)
 * @returns {Promise<Array>} [{id, wordId, wordEN, wordTH, ttsVoice}, ...]
 */
export async function getFavoriteVocab(userEmail) {
  return cachedFetch(
    `fav:${userEmail}`,
    async () => {
      const q = query(
        collection(db, 'favoriteVocab'),
        where('email', '==', userEmail),
        limit(1000),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    { ttlMs: TTL_USER_DATA_MS, fallback: [] },
  );
}

// กดหัวใจ — เช็คซ้ำก่อน มีแล้วคืนอันเดิม ไม่เพิ่มซ้ำ
/**
 * เพิ่มคำศัพท์เข้ารายการโปรด
 * @returns {Promise<string>} favoriteDocId ของเอกสารที่สร้าง (หรือเอกสารเดิมถ้ามีอยู่แล้ว)
 */
export async function addFavoriteVocab(userEmail, vocabData) {
  const norm = (s) => String(s ?? '').trim().toLowerCase();
  // ตรวจซ้ำก่อน: wordId ตรงกัน หรือ ข้อความคำตรงกัน (case-insensitive)
  //   — query แค่ email เพื่อไม่ต้องพึ่ง composite index (email + wordId)
  //   — กันคำเดียวกันถูกบันทึกหลาย doc เมื่อ wordId ไม่เสถียร (fallback id ของการ์ด)
  const q    = query(
    collection(db, 'favoriteVocab'),
    where('email', '==', userEmail),
    limit(1000), // ป้องกันดึงเพลินตอนเช็คซ้ำ
  );
  const snap = await getDocs(q);
  const dup = snap.docs.find((d) => {
    const data = d.data() ?? {};
    return data.wordId === vocabData.id || norm(data.wordEN) === norm(vocabData.wordEN);
  });
  if (dup) return dup.id; // มีแล้ว ไม่เพิ่มซ้ำ — คืน id เดิม

  const ref = await addDoc(collection(db, 'favoriteVocab'), {
    email:    userEmail,
    wordId:   vocabData.id,
    wordEN:   vocabData.wordEN,
    wordTH:   vocabData.wordTH,
    ttsVoice: vocabData.ttsVoice ?? '',
    addedAt:  serverTimestamp(),
  });
  clearCache(`fav:${userEmail}`); // รายการเปลี่ยน → โหลดใหม่รอบหน้า
  return ref.id;
}

// กดหัวใจซ้ำเพื่อลบออก — ล้าง cache ด้วย
/**
 * ลบคำศัพท์ออกจากรายการโปรด
 * @param {string} favoriteDocId  — id ของ document ใน favoriteVocab
 * @param {string} [userEmail]   — ใช้ล้าง cache ของผู้ใช้ (ถ้าไม่ส่งมาก็ข้าม)
 */
export async function removeFavoriteVocab(favoriteDocId, userEmail) {
  await deleteDoc(doc(db, 'favoriteVocab', favoriteDocId));
  if (userEmail) clearCache(`fav:${userEmail}`);
}

// เช็คว่าหัวใจเต็มหรือยัง — เต็มคืน id ว่างคืน null
/**
 * ตรวจว่าคำนี้อยู่ในโปรดแล้วหรือยัง
 * @returns {Promise<string|null>} favoriteDocId หรือ null
 */
export async function checkIsFavorite(userEmail, wordId) {
  try {
    const q    = query(
      collection(db, 'favoriteVocab'),
      where('email',  '==', userEmail),
      where('wordId', '==', wordId),
      limit(1), // เจอเอกสารแรกก็พอ ไม่ต้องอ่านทั้งชุด
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch (err) {
    logReadError('checkIsFavorite', err);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// MEMBER PROFILE
// ══════════════════════════════════════════════════════════════





// ดึงชื่อ sirawit จาก users/{uid} — หน้า Result + Profile ใช้
/**
 * ดึงโปรไฟล์ผู้ใช้จาก Firestore ตาม UID
 * @param {string} uid
 * @returns {Promise<object|null>} { id, email, username, numericId, createdAt } หรือ null
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch {
    return null;
  }
}

// เปลี่ยนชื่อในหน้า Profile — merge ทับ ไม่ลบ field อื่น
/**
 * อัปเดตชื่อผู้ใช้ในโปรไฟล์ Firestore (users/{uid})
 * ใช้ setDoc(..., { merge: true }) เพื่อรองรับกรณีที่ยังไม่มีเอกสารโปรไฟล์
 * (เช่น ผู้ใช้ที่สมัคร/เข้าสู่ระบบก่อนมี createUserProfile)
 * @param {string} uid
 * @param {string} username
 */
export async function updateUsername(uid, username) {
  if (!uid) return;
  await setDoc(
    doc(db, 'users', uid),
    { username: (username || '').trim(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}

// ══════════════════════════════════════════════════════════════
// ADMIN
// ══════════════════════════════════════════════════════════════

// เช็คว่าเมลนี้เป็นแอดมินไหม — มี doc ใน admins แปลว่าใช่
/**
 * ตรวจสอบว่า email นี้เป็น Admin หรือไม่
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function checkIsAdmin(email) {
  if (!email) return false;
  try {
    const snap = await getDoc(doc(db, 'admins', email));
    return snap.exists();
  } catch {
    return false;
  }
}
