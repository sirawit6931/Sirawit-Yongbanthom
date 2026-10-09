// backend/middleware/authMiddleware.js
// M1.1 — Admin Authentication Middleware
//
// `requireAdmin`: ยืนยัน Bearer token จาก header `Authorization` แล้วตรวจว่าผู้ใช้
// เป็น admin ก่อนอนุญาตให้เข้าถึง `/api/admin/*` endpoints.
//
// ลำดับการตรวจ (3 ทาง — ผ่านทางใดทางหนึ่งก็ถือว่าเป็น admin):
//   0) `req.user` ถูกตั้งไว้แล้ว (โดย global guard ใน server.js) → ผ่านเลย
//      (กัน verify ซ้ำ เมื่อมี global guard + router middleware ทั้งคู่)
//   1) admin session token (ออกโดย POST /api/admin/login — HMAC ฝั่งเราเอง)
//   2) Firebase ID token + custom claim `admin: true`
//   3) Firebase ID token + มี document ใน collection `admins` (doc id = email ตัวพิมพ์เล็ก)
//      — คงไว้ให้โมบายล์ (AdminLoginScreen) และ test เดิมไม่พัง
//
// HTTP status:
//   - 401  ไม่มี / รูปแบบ token ไม่ถูกต้อง / token ไม่ถูกต้องหรือหมดอายุ
//   - 403  ยืนยันตัวตนแล้ว แต่ไม่ใช่ admin
const { adminAuth, db } = require('../config/firebase');
const { verifyAdminToken } = require('../utils/adminSessionToken');

/**
 * ดึง Bearer token จาก `Authorization` header
 * @param {object} req Express request
 * @returns {string|null} token หรือ null ถ้าไม่พบ
 */
function extractBearerToken(req) {
  const authHeader = req.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

/**
 * ตรวจว่าผู้ใช้เป็น admin ตาม document ใน collection `admins`
 * @param {object} decoded decoded token จาก verifyIdToken ({ uid, email, ... })
 * @returns {Promise<object|null>} ข้อมูล admin doc หรือ null ถ้าไม่พบ
 */
async function findAdminDoc(decoded) {
  const admins = db.collection('admins');

  // 1) doc id = email (ตัวพิมพ์เล็ก) — ตาม SCHEMA.md `doc(db,'admins',email)`
  if (decoded.email) {
    const emailSnap = await admins.doc(String(decoded.email).toLowerCase()).get();
    if (emailSnap.exists) return emailSnap.data();
  }

  // 2) fallback: doc id = uid (กันกรณี token ไม่มี email)
  const uidSnap = await admins.doc(decoded.uid).get();
  if (uidSnap.exists) return uidSnap.data();

  return null;
}

/**
 * Middleware — ยืนยันตัวตน + สิทธิ์ admin
 */
async function requireAdmin(req, res, next) {
  // 0) req.user ถูกตั้งโดย global guard แล้ว → ผ่านเลย (กัน verify ซ้ำ)
  if (req.user) return next();

  const idToken = extractBearerToken(req);
  if (!idToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized: missing bearer token' });
  }

  // 1) admin session token ใหม่ (HMAC ฝั่งเราเอง — ออกโดย POST /api/admin/login)
  //    Firebase ID token ก็เป็น JWT เหมือนกันแต่ลงนามคนละ key → คืน null ที่นี่เอง
  const sessionPayload = verifyAdminToken(idToken);
  if (sessionPayload) {
    req.user = {
      admin: true,
      username: sessionPayload.username,
      name: sessionPayload.name,
      role: sessionPayload.role,
      authType: 'session',
    };
    return next();
  }

  // 2/3) fallback: Firebase ID token (โมบายล์ / ระบบเดิม — backward-compatible)
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: invalid or expired token' });
  }

  // 1) custom claim admin === true
  if (decoded.admin === true) {
    req.user = decoded;
    return next();
  }

  // 2) document ใน collection admins
  try {
    const adminData = await findAdminDoc(decoded);
    if (adminData) {
      req.user = { ...decoded, ...adminData };
      return next();
    }
  } catch (err) {
    console.error('[requireAdmin] admins lookup failed:', err.message);
    return res.status(500).json({ success: false, error: 'Internal error checking admin status' });
  }

  return res.status(403).json({ success: false, error: 'Forbidden: not an admin' });
}

module.exports = { requireAdmin, extractBearerToken, findAdminDoc };
