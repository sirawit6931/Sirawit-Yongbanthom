// backend/middleware/authMiddleware.js
// M1.1 — Admin Authentication Middleware
//
// `requireAdmin`: ยืนยัน Bearer token จาก header `Authorization` แล้วตรวจว่าผู้ใช้
// เป็น admin ก่อนอนุญาตให้เข้าถึง `/api/admin/*` endpoints.
//
// ตรวจสิทธิ์ 2 ช่องทาง (อย่างใดอย่างหนึ่งผ่านก็ถือว่าเป็น admin):
//   1) custom claim `admin: true` บน ID token
//   2) มี document ใน collection `admins` (doc id = email ตัวพิมพ์เล็ก ตาม SCHEMA.md)
//
// HTTP status:
//   - 401  ไม่มี / รูปแบบ token ไม่ถูกต้อง / token ไม่ถูกต้องหรือหมดอายุ
//   - 403  ยืนยันตัวตนแล้ว แต่ไม่ใช่ admin
const { adminAuth, db } = require('../config/firebase');

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
  const idToken = extractBearerToken(req);
  if (!idToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized: missing bearer token' });
  }

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
