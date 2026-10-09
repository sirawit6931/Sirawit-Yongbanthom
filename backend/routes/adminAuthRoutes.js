// backend/routes/adminAuthRoutes.js
// ─────────────────────────────────────────────────────────────────────────────
// Admin Authentication API (username/password → session token) — mount ที่ /api/admin
//
//   POST /api/admin/login    — public: ตรวจ username/password แล้วออก session token
//   POST /api/admin/session  — requireAdmin: ออก Firebase customToken ใหม่ให้ client
//                              (ใช้ตอนรีเฟรชหน้าแล้ว Firebase session หาย)
//   GET  /api/admin/admins    — requireAdmin: คืนรายชื่อ admin พร้อมฟิลด์ `username`
//                              (ไม่มี username → ตัดส่วน @domain ออกจาก email/doc.id)
//
// ตรวจ credentials 2 ทาง (ตาม requirement — ทำทั้งสอง):
//   1) Firestore `admins`: doc id = username.toLowerCase() → fallback query
//      where('username','==',username) — ถ้า doc มี field `password`/`passwordHash`
//      ค่อยเทียบแบบ timing-safe (doc ที่มีรหัสผ่าน "ชนะ" ห้าม fallback default)
//   2) Default creds: ADMIN_USERNAME/ADMIN_PASSWORD (default admin01/admin01)
//      — ใช้ได้เมื่อ doc ไม่มีรหัสผ่าน (รวม case ไม่มี doc เลย)
//
// HTTP status:
//   - 400  ขาด field / ว่าง
//   - 401  รหัสผ่านไม่ถูกต้อง
//   - 429  ลองผิดเกิน 5 ครั้งใน 5 นาที (in-memory throttle กัน brute force)
//   - 500  Firestore หรือระบบในฝั่ง server ขัดข้อง
const express = require('express');
const crypto = require('crypto');
const { adminAuth, db } = require('../config/firebase');
const { requireAdmin } = require('../middleware/authMiddleware');
const { signAdminToken } = require('../utils/adminSessionToken');

const router = express.Router();

// ─── Login throttle (in-memory, กัน brute force) ──────────────────────────────
const THROTTLE_WINDOW_MS = 5 * 60 * 1000; // 5 นาที
const THROTTLE_MAX_ATTEMPTS = 5;           // ผิดเกิน 5 ครั้ง → 429
const THROTTLE_MAP_MAX = 1000;             // กัน map โตไม่รู้จบ (คิดเฉพาะ key ที่ยัง active)

/** key = ip|username(lowercase) — กันยิงหลายบัญชีจาก ip เดียวด้วย */
const loginAttempts = new Map();

function throttleKey(req, username) {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${ip}|${String(username).toLowerCase()}`;
}

function pruneThrottleMap() {
  if (loginAttempts.size <= THROTTLE_MAP_MAX) return;
  const now = Date.now();
  for (const [key, rec] of loginAttempts) {
    if (now > rec.resetAt) loginAttempts.delete(key);
  }
}

function isThrottled(key) {
  const rec = loginAttempts.get(key);
  if (!rec) return false;
  if (Date.now() > rec.resetAt) {
    loginAttempts.delete(key);
    return false;
  }
  return rec.count >= THROTTLE_MAX_ATTEMPTS;
}

function recordFailure(key) {
  const now = Date.now();
  const rec = loginAttempts.get(key);
  if (!rec || now > rec.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + THROTTLE_WINDOW_MS });
  } else {
    rec.count += 1;
  }
  pruneThrottleMap();
}

function clearFailures(key) {
  loginAttempts.delete(key);
}

// ─── Credential helpers ───────────────────────────────────────────────────────

function defaultUsername() {
  return String(process.env.ADMIN_USERNAME || 'admin01').trim();
}

function defaultPassword() {
  return String(process.env.ADMIN_PASSWORD || 'admin01');
}


/**
 * หา doc ใน collection `admins` จาก username
 * 1) doc id = username.toLowerCase()  2) fallback query where('username','==',username)
 * @returns {Promise<object|null>} { id, ...data } หรือ null
 */
async function findAdminByUsername(username) {
  const admins = db.collection('admins');
  const uname = String(username).trim();

  // 1) doc id = username (ตัวพิมพ์เล็ก)
  const byId = await admins.doc(uname.toLowerCase()).get();
  if (byId.exists) return { id: byId.id, ...byId.data() };

  // 2) fallback: query ตาม field username (ติดขัดเรื่อง index ได้ → ไม่ block default login)
  try {
    let col = admins.where('username', '==', uname);
    if (typeof col.limit === 'function') col = col.limit(1);
    const snap = await col.get();
    if (snap && !snap.empty && Array.isArray(snap.docs) && snap.docs.length > 0) {
      const d = snap.docs[0];
      return { id: d.id, ...d.data() };
    }
  } catch (err) {
    console.warn('[adminLogin] username query fallback failed:', err.message);
  }
  return null;
}

/**
 * ตรวจ username/password
 * @returns {Promise<object|null>} admin profile ถ้าผ่าน, null ถ้าไม่ผ่าน
 * @throws {Error} เมื่อ Firestore ขัดข้อง (caller แปลงเป็น 500)
 */
async function verifyCredentials(username, password) {
  const uname = String(username).trim();
  const adminDoc = await findAdminByUsername(uname);

  if (adminDoc) {
    // doc มีรหัสผ่าน → ต้องตรงกับรหัสใน doc เท่านั้น (ห้าม fallback default)
    const storedPlain = adminDoc.password;
    const storedHash = adminDoc.passwordHash;
    if (typeof storedPlain === 'string' && storedPlain) {
      return safeEqual(password, storedPlain) ? adminDoc : null;
    }
    if (typeof storedHash === 'string' && storedHash) {
      return safeEqual(sha256hex(password), storedHash) ? adminDoc : null;
    }
    // doc ไม่มีรหัสผ่าน → ใช้ default creds ได้ (เมื่อ username ตรงกับ ADMIN_USERNAME)
    if (
      safeEqual(uname.toLowerCase(), defaultUsername().toLowerCase())
      && safeEqual(password, defaultPassword())
    ) {
      return adminDoc;
    }
    return null;
  }

  // ไม่มี doc → default creds
  if (
    safeEqual(uname.toLowerCase(), defaultUsername().toLowerCase())
    && safeEqual(password, defaultPassword())
  ) {
    return { id: uname.toLowerCase(), name: uname, role: 'admin' };
  }
  return null;
}

// ─── POST /api/admin/login (public) ──────────────────────────────────────────
router.post('/login', async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'ต้องระบุชื่อผู้ดูแลและรหัสผ่าน' });
  }

  const key = throttleKey(req, username);
  if (isThrottled(key)) {
    return res.status(429).json({
      success: false,
      error: 'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
    });
  }

  let adminDoc;
  try {
    adminDoc = await verifyCredentials(username, password);
  } catch (err) {
    console.error('[adminLogin] credential check failed:', err.message);
    return res.status(500).json({ success: false, error: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่' });
  }

  if (!adminDoc) {
    recordFailure(key);
    return res.status(401).json({ success: false, error: 'ชื่อผู้ดูแลหรือรหัสผ่านไม่ถูกต้อง' });
  }

  clearFailures(key);

  const name = adminDoc.name || username;
  const role = adminDoc.role || 'admin';
  const uid = String(adminDoc.uid || adminDoc.id || username); // สำหรับ Firebase custom token

  // session token สำหรับเรียก /api/admin/* (เก็บใน localStorage ของ Admin Web)
  const token = signAdminToken({ username, role, name });

  // Firebase custom token สำหรับ signInWithCustomToken (fail-soft — สร้างไม่ได้ไม่ block login)
  let customToken = null;
  try {
    customToken = await adminAuth.createCustomToken(uid, { admin: true });
  } catch (err) {
    console.warn('[adminLogin] createCustomToken failed (fail-soft):', err.message);
  }

  return res.json({ success: true, token, username, name, role, customToken });
});

// ─── POST /api/admin/session (requireAdmin) ──────────────────────────────────
// ออก customToken ใหม่ให้ client ตอนรีเฟรชหน้าแล้ว Firebase session หาย
// (IndexedDB ถูกล้าง) — กัน Firestore client reads พัง
router.post('/session', requireAdmin, async (req, res) => {
  try {
    const user = req.user || {};
    const uid = user.uid || user.sub || user.username;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'Unauthorized: no identity in token' });
    }
    const customToken = await adminAuth.createCustomToken(String(uid), { admin: true });
    return res.json({ success: true, customToken });
  } catch (err) {
    console.error('[adminSession] createCustomToken failed:', err.message);
    return res.status(500).json({ success: false, error: 'สร้าง session ใหม่ไม่สำเร็จ กรุณาลองใหม่' });
  }
});

// ─── GET /api/admin/admins (requireAdmin) ─────────────────────────────────────
// คืนรายชื่อ admin พร้อมฟิลด์ `username` ให้ Frontend แสดงคอลัมน์ชื่อผู้ใช้
// legacy docs อาจไม่มี `username` — fallback ตัดส่วน @domain ออกจาก email/doc.id
// เช่น `admin01@gmail.com` → `admin01` (ตัดเฉพาะ @ ตัวแรกขึ้นไป)
router.get('/admins', requireAdmin, async (req, res) => {
  try {
    const snap = await db.collection('admins').get();
    const data = snap.docs.map((d) => {
      const raw = d.data() || {};
      return {
        id: d.id,
        username: deriveUsername(raw, d.id),
        email: raw.email || d.id,
        name: raw.name || '',
        role: raw.role || 'admin',
      };
    });
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[adminAdmins] list failed:', err.message);
    return res.status(500).json({ success: false, error: 'ดึงรายชื่อ admin ไม่สำเร็จ' });
  }
});

// ใช้ใน tests เท่านั้น — reset throttle ระหว่าง test case
router.__resetLoginThrottle = () => { loginAttempts.clear(); };

module.exports = router;

/**
 * หา username สำหรับแสดงผล: ใช้ `username` ถ้ามี ไม่งั้นตัด @domain ออกจาก email/doc.id
 */
function deriveUsername(docData, docId) {
  const direct = docData && typeof docData.username === 'string' ? docData.username.trim() : '';
  if (direct) return direct;
  const source = (docData && typeof docData.email === 'string' && docData.email.trim())
    ? docData.email.trim()
    : String(docId ?? '');
  const at = source.indexOf('@');
  return (at > 0 ? source.slice(0, at) : source).trim() || String(docId ?? '');
}

/**
 * เทียบค่าแบบ timing-safe (hash ก่อนเทียบ กัน length leak)
 */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? ''), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b ?? ''), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

function sha256hex(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}
