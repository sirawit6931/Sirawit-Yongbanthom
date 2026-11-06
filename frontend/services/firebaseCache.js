// frontend/services/firebaseCache.js
//
// ตัวช่วยลดการกินโควต้า Firestore:
//   1. TTL Cache — เก็บผลลัพธ์คิวรีไว้ชั่วคราว ไม่ยิง request ซ้ำทุกครั้งที่เปิดหน้าจอ
//   2. In-flight dedupe — ถ้ามี request ชนิดเดียวกันวิ่งอยู่ ให้ share promise เดียวกัน
//      (กันกรณีหลายหน้า focus พร้อมกันแล้วยิง query ซ้ำ 2-3 รอบ)
//   3. Quota fallback — ดักจับ error resource-exhausted / HTTP 429 แล้วคืนข้อมูลเก่า (stale)
//      แทนที่จะปล่อยให้หน้าจอพัง
//
// หมายเหตุ: เป็น in-memory cache (ราย session) ส่วน persisted cache (ข้าม session)
// เปิดไว้ที่ frontend/firebase.js ผ่าน initializeFirestore({ localCache: persistentLocalCache })

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 นาที
const MAX_ENTRIES = 100;               // กัน memory บวม

/** key -> { value, expiresAt } */
const cache = new Map();
/** key -> Promise ที่กำลังวิ่งอยู่ */
const inflight = new Map();

/** เวลาล่าสุดที่เจอ quota error (ms epoch) — ใช้ให้หน้าจอแสดง banner แจ้งเตือน */
let lastQuotaAt = 0;

// ══════════════════════════════════════════════════════════════
// QUOTA ERROR DETECTION
// ══════════════════════════════════════════════════════════════

/**
 * ตรวจว่าเป็น error ประเภทโควต้า Firebase เต็มหรือไม่
 * ครอบคลุม: FirebaseError code=resource-exhausted, HTTP 429, ข้อความ quota exceeded
 * @param {any} err
 * @returns {boolean}
 */
export function isQuotaError(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const status = Number(err.status || err.statusCode || 0);
  const msg = String(err.message || '').toLowerCase();

  return (
    code === 'resource-exhausted' ||
    code === 'too-many-requests' ||
    code === 'quota-exceeded' ||
    status === 429 ||
    msg.includes('resource-exhausted') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('too many requests') ||
    msg.includes('429') ||
    msg.includes('quota')
  );
}

/**
 * ข้อความแจ้งเตือนผู้ใช้ (ภาษาไทย) สำหรับ error ประเภทโควต้า
 * @param {any} err
 * @returns {string}
 */
export function quotaMessage(err) {
  if (isQuotaError(err)) {
    return 'ระบบ Firebase กำลังติดขัดชั่วคราว (โควต้าการใช้งานเต็ม) กรุณาลองใหม่ในอีกสักครู่';
  }
  return 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง';
}

/**
 * คืนข้อความแจ้งเตือนถ้า "เพิ่ง" เจอ quota error ภายในช่วง windowMs ที่กำหนด
 * (cachedFetch กลืน error ไว้ไม่ throw → หน้าจอใช้ตัวนี้ตรวจเพื่อแสดง banner)
 * @param {number} [windowMs] หน่วย ms (ค่าเริ่มต้น 2 นาที)
 * @returns {string} '' ถ้าไม่ได้เพิ่งเจอ quota error
 */
export function recentQuotaNotice(windowMs = 2 * 60 * 1000) {
  if (lastQuotaAt && Date.now() - lastQuotaAt <= windowMs) {
    return quotaMessage({ code: 'resource-exhausted' });
  }
  return '';
}

// ══════════════════════════════════════════════════════════════
// TTL CACHE
// ══════════════════════════════════════════════════════════════

function pruneIfFull() {
  if (cache.size < MAX_ENTRIES) return;
  // ลบตัวที่เก่าที่สุด (Map เก็บตามลำดับ insert)
  const oldestKey = cache.keys().next().value;
  cache.delete(oldestKey);
}

/**
 * อ่านจาก cache ถ้ายังไม่หมดอายุ
 * @param {string} key
 * @returns {any|undefined} undefined = ไม่มีหรือหมดอายุแล้ว
 */
export function getCache(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

/**
 * เก็บลง cache — entry ที่หมดอายุแล้วจะถูกลบเมื่อ getCache เรียกเจอ
 * แต่ยังคงอยู่ใน Map เพื่อใช้เป็น stale fallback ตอนโควต้าเต็ม
 * @param {string} key
 * @param {any} value
 * @param {number} [ttlMs]
 */
export function setCache(key, value, ttlMs = DEFAULT_TTL_MS) {
  pruneIfFull();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** คืนค่าเก่า (แม้หมดอายุ) สำหรับใช้เป็น stale fallback — undefined ถ้าไม่มี */
function getStale(key) {
  const hit = cache.get(key);
  return hit ? hit.value : undefined;
}

/**
 * ลบ cache ทั้งหมด หรือเฉพาะ key ที่ขึ้นต้นด้วย prefix
 * @param {string} [prefix]
 */
export function clearCache(prefix) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// ══════════════════════════════════════════════════════════════
// CACHED FETCH (with dedupe + quota fallback)
// ══════════════════════════════════════════════════════════════

/**
 * รัน fetcher พร้อม cache + กันยิงซ้ำ + fallback เมื่อโควต้าเต็ม
 *
 * พฤติกรรม:
 *   - ถ้ามีค่า fresh ใน cache → คืนเลย (ไม่ยิง request)
 *   - ถ้ามี request ชนิดเดียวกันวิ่งอยู่ → รอ promise ตัวเดิม
 *   - สำเร็จ → เก็บลง cache แล้วคืน
 *   - error ทั่วไป → log แล้วคืน fallback
 *   - error โควต้าเต็ม → คืน stale value จาก cache (ถ้ามี) ไม่งั้นคืน fallback
 *
 * @param {string} cacheKey        เช่น 'vocabulary:all'
 * @param {Function} fetcher       async function ที่ยิง Firestore
 * @param {object}  [opts]
 * @param {number}  [opts.ttlMs]   อายุ cache (ms)
 * @param {any}     [opts.fallback] ค่าเริ่มต้นเมื่อ fetch ล้มเหลว ([] สำหรับ list)
 * @returns {Promise<any>}
 */
export async function cachedFetch(cacheKey, fetcher, opts = {}) {
  const { ttlMs = DEFAULT_TTL_MS, fallback = [] } = opts;

  // 1. fresh cache → คืนเลย
  const fresh = getCache(cacheKey);
  if (fresh !== undefined) return fresh;

  // 2. มี request ชนิดเดียวกันวิ่งอยู่ → share
  if (inflight.has(cacheKey)) return inflight.get(cacheKey);

  // 3. ยิง request ใหม่
  const promise = (async () => {
    try {
      const value = await fetcher();
      setCache(cacheKey, value, ttlMs);
      return value;
    } catch (err) {
      if (isQuotaError(err)) {
        lastQuotaAt = Date.now();
        const stale = getStale(cacheKey);
        if (stale !== undefined) {
          console.warn(`[firebaseCache] โควต้าเต็ม → ใช้ข้อมูลเก่าจาก cache: ${cacheKey}`);
          return stale;
        }
        console.warn(`[firebaseCache] โควต้าเต็ม ไม่มีข้อมูลเก่า → fallback: ${cacheKey}`);
      } else {
        console.error(`[firebaseCache] fetch error: ${cacheKey}:`, err?.code, err?.message);
      }
      return fallback;
    } finally {
      inflight.delete(cacheKey);
    }
  })();

  inflight.set(cacheKey, promise);
  return promise;
}
