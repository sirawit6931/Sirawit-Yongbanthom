// backend/utils/adminSessionToken.js
// ─────────────────────────────────────────────────────────────────────────────
// Admin session token สำหรับ username/password login ของ Admin Web
// - รูปแบบ JWT (header.payload.signature, base64url) ลงนามด้วย HMAC-SHA256
//   จาก Node built-in `crypto` — ไม่ต้องติดตั้ง `jsonwebtoken` เพิ่ม
// - payload: { sub, username, name, role, admin: true, iat, exp }
//
// Env (ทั้งหมด optional):
//   ADMIN_SESSION_SECRET  — secret สำหรับลงหมาย (production ควรตั้งค่าเสมอ)
//   ADMIN_TOKEN_TTL_HOURS — อายุ token เป็นชั่วโมง (default: 8)
//
// หมายเหตุ: Firebase ID token ก็เป็น JWT เหมือนกัน แต่ลงนามคนละ key →
// verifyAdminToken จะ fail HMAC แล้วคืน null ให้ caller fallback ไป
// verifyIdToken ตามปกติ (ไม่ต้องแยกชนิด token ด้วย prefix)
const crypto = require('crypto');

// ใช้เฉพาะตอนไม่ได้ตั้ง ADMIN_SESSION_SECRET — ปลอดภัยแค่ในเครื่อง dev เท่านั้น
const DEV_FALLBACK_SECRET = 'dev-admin-session-secret-change-me';
let warnedMissingSecret = false;

/**
 * ดึง secret สำหรับลง/ตรวจลายเซ็น
 * @returns {string}
 */
function getSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (secret && String(secret).trim()) return String(secret);
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      '[adminSessionToken] ไม่พบ ADMIN_SESSION_SECRET — ใช้ dev fallback secret '
      + '(ปลอดภัยเฉพาะ development — ตั้งค่าใน .env ก่อนใช้งานจริง)'
    );
  }
  return DEV_FALLBACK_SECRET;
}

/**
 * อายุ token จาก env (ชั่วโมง) — invalid/ไม่ระบุ → 8 ชม.
 * @returns {number} อายุเป็นวินาที
 */
function getTtlSeconds() {
  const hours = Number(process.env.ADMIN_TOKEN_TTL_HOURS);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 8;
  return Math.floor(safeHours * 3600);
}

/**
 * HMAC-SHA256 แล้ว encode เป็น base64url
 * @param {string} data
 * @returns {string} signature (base64url)
 */
function signData(data) {
  return crypto.createHmac('sha256', getSecret()).update(data, 'utf8').digest('base64url');
}

/**
 * encode object เป็น base64url (JSON)
 * @param {object} obj
 * @returns {string}
 */
function encodeJson(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

/**
 * เทียบ string แบบ timing-safe (hash ก่อนเทียบกัน length leak)
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqualString(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? ''), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b ?? ''), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * สร้าง admin session token
 * @param {{ username: string, role?: string, name?: string }} info
 * @returns {string} JWT (header.payload.signature)
 * @throws {Error} ถ้าไม่มี username
 */
function signAdminToken({ username, role, name } = {}) {
  const uname = String(username ?? '').trim();
  if (!uname) throw new Error('signAdminToken: username is required');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: uname,
    username: uname,
    name: name || uname,
    role: role || 'admin',
    admin: true,
    iat: now,
    exp: now + getTtlSeconds(),
  };

  const head = encodeJson(header);
  const body = encodeJson(payload);
  return `${head}.${body}.${signData(`${head}.${body}`)}`;
}

/**
 * ตรวจ admin session token
 * - ตรวจรูปแบบ (3 ส่วน, header alg = HS256)
 * - ตรวจลายเซ็นแบบ timing-safe
 * - ตรวจ payload (admin === true, มี username, ยังไม่หมดอายุ)
 * @param {string} token
 * @returns {object|null} payload ถ้าผ่าน, null ถ้าไม่ผ่าน/หมดอายุ/รูปแบบผิด
 */
function verifyAdminToken(token) {
  if (typeof token !== 'string' || !token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [head, body, signature] = parts;
  if (!head || !body || !signature) return null;

  // ตรวจลายเซ็นก่อน (timing-safe — ความยาวต่างกันถือว่าไม่ตรงทันที)
  const expected = signData(`${head}.${body}`);
  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  // ลายเซ็นถูก → แกะ payload
  let header;
  let payload;
  try {
    header = JSON.parse(Buffer.from(head, 'base64url').toString('utf8'));
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!header || header.alg !== 'HS256') return null;
  if (!payload || typeof payload !== 'object') return null;
  if (payload.admin !== true) return null;
  if (!payload.username || typeof payload.username !== 'string') return null;
  if (typeof payload.exp !== 'number') return null;
  if (payload.exp <= Math.floor(Date.now() / 1000)) return null; // หมดอายุ

  return payload;
}

module.exports = {
  signAdminToken,
  verifyAdminToken,
  safeEqualString,
  // ใช้ใน tests เท่านั้น — ล้าง warning flag ให้ test ควบคุม output เอง
  _resetWarnings() { warnedMissingSecret = false; },
};
