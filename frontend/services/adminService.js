// frontend/services/adminService.js
// CRUD สำหรับ Admin — vocabulary, exercises (ผ่าน Backend API), users/statistics
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  deleteDoc, query, where, limit, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { adminApi } from './adminApi';
import { cachedFetch, clearCache, isQuotaError } from './firebaseCache';

// cache สั้น ๆ (1 นาที) สำหรับการโหลดหน้า admin ซ้ำ / กด back-forth
const TTL_ADMIN_MS = 60 * 1000;
// เพดานอ่านต่อ query — กัน collection ที่โตไม่รู้จบ (เช่น statistics) กินโควต้า
const MAX_ADMIN_ROWS = 5000;

function logAdminError(label, err) {
  if (isQuotaError(err)) {
    console.warn(`[adminService] ${label} ติดโควต้า Firebase (resource-exhausted/429):`, err?.message);
  } else {
    console.error(`[adminService] ${label} error:`, err?.code, err?.message);
  }
}

// ══════════════════════════════════════════════════════════════
// VOCABULARY CRUD (ตรง Firestore — admin vocab ยังไม่ผ่าน API)
// ══════════════════════════════════════════════════════════════

export async function adminGetAllVocab() {
  return cachedFetch(
    'admin:vocab',
    async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'vocabulary'), limit(MAX_ADMIN_ROWS)),
        );
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (a.wordEN ?? '').localeCompare(b.wordEN ?? ''));
        return docs;
      } catch (err) {
        logAdminError('adminGetAllVocab', err);
        return [];
      }
    },
    { ttlMs: TTL_ADMIN_MS, fallback: [] },
  );
}

export async function adminAddVocab({ wordEN, wordTH, cefrLevel, partOfSpeech }) {
  const ref = await addDoc(collection(db, 'vocabulary'), {
    wordEN, wordTH, cefrLevel, partOfSpeech: partOfSpeech ?? '',
    ttsVoice: '', createdAt: serverTimestamp(),
  });
  clearCache('admin:vocab');
  clearCache('vocabulary'); // ฝั่ง user app ก็อ่านคลังเดียวกัน
  return ref;
}

export async function adminUpdateVocab(docId, fields) {
  await updateDoc(doc(db, 'vocabulary', docId), { ...fields, updatedAt: serverTimestamp() });
  clearCache('admin:vocab');
  clearCache('vocabulary');
}

export async function adminDeleteVocab(docId) {
  await deleteDoc(doc(db, 'vocabulary', docId));
  clearCache('admin:vocab');
  clearCache('vocabulary');
}

// ══════════════════════════════════════════════════════════════
// EXERCISE CRUD (ผ่าน Backend REST API — ตรงตาม SCHEMA.md)
// ══════════════════════════════════════════════════════════════

export async function adminGetAllExercises(params = {}) {
  const data = await adminApi.listExercises(params);
  return data.data || [];
}

export async function adminAddExercise(data) {
  const result = await adminApi.createExercise(data);
  return result.data;
}

export async function adminUpdateExercise(docId, fields) {
  const result = await adminApi.updateExercise(docId, fields);
  return result.data;
}

export async function adminDeleteExercise(docId) {
  await adminApi.deleteExercise(docId);
}

// ══════════════════════════════════════════════════════════════
// USERS / STATISTICS (Read-only สำหรับ Admin)
// ══════════════════════════════════════════════════════════════

export async function adminGetAllStatistics() {
  return cachedFetch(
    'admin:stats',
    async () => {
      try {
        // limit กัน collection statistics (โตทุกครั้งที่ผู้ใช้จบบทเรียน) กินโควต้า
        const snap = await getDocs(
          query(
            collection(db, 'statistics'),
            orderBy('createdAt', 'desc'),
            limit(MAX_ADMIN_ROWS),
          ),
        );
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        // failed-precondition = composite index ยังไม่ถูกสร้าง → แบบไม่มี orderBy
        if (err.code === 'failed-precondition') {
          try {
            const snap = await getDocs(
              query(collection(db, 'statistics'), limit(MAX_ADMIN_ROWS)),
            );
            const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            docs.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
            return docs;
          } catch (innerErr) {
            logAdminError('adminGetAllStatistics(fallback)', innerErr);
            return [];
          }
        }
        logAdminError('adminGetAllStatistics', err);
        return [];
      }
    },
    { ttlMs: TTL_ADMIN_MS, fallback: [] },
  );
}

export async function adminGetUserSummary() {
  const stats = await adminGetAllStatistics();
  const map = {};
  for (const s of stats) {
    if (!map[s.email]) {
      map[s.email] = { email: s.email, totalSessions: 0, passed: 0, lastActivity: s.createdAt };
    }
    map[s.email].totalSessions += 1;
    if (s.passed) map[s.email].passed += 1;
  }
  return Object.values(map).sort((a, b) => (a.email ?? '').localeCompare(b.email ?? ''));
}

// ══════════════════════════════════════════════════════════════
// USER PROFILE CRUD (Firestore users collection)
// ══════════════════════════════════════════════════════════════

export async function adminGetUserByEmail(email) {
  if (!email) return null;
  try {
    const snap = await getDocs(query(
      collection(db, 'users'),
      where('email', '==', email),
      limit(1),
    ));
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { uid: doc.id, ...doc.data() };
  } catch (err) {
    logAdminError('adminGetUserByEmail', err);
    return null;
  }
}

export async function adminUpdateUser(uid, fields) {
  await updateDoc(doc(db, 'users', uid), { ...fields, updatedAt: serverTimestamp() });
}

export async function adminDeleteUser(uid) {
  await deleteDoc(doc(db, 'users', uid));
}
