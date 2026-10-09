// backend/routes/adminStatisticsRoutes.js
// Admin Statistics API - mount at /api/admin/statistics
//
// หน้าสถิติการใช้งาน (admin) เดิมอ่าน collection `statistics` ตรงจาก client SDK
// แต่ Firestore Rules ของ statistics อนุญาตให้อ่านเฉพาะเจ้าของข้อมูล
// (request.auth.token.email == resource.data.email) ทำให้ admin ได้
// "Missing or insufficient permissions" จึงย้ายมาอ่านผ่าน Admin SDK (ข้าม rules)
// ป้องกันด้วย requireAdmin เหมือน routes อื่น ๆ ใน /api/admin/*
const express = require('express');
const { db } = require('../config/firebase');
const { requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// ทุก route ใต้ /api/admin/statistics ต้องผ่านการยืนยัน admin ก่อน
router.use(requireAdmin);

// เพดาน row ต่อ request - ตรงกับ MAX_ADMIN_ROWS ฝั่ง frontend (กันกินโควต้า Firestore)
const MAX_STAT_ROWS = 5000;

// Normalize Firestore Timestamp ทุกรูปให้เป็น { seconds } ก่อนส่ง JSON
// (Admin SDK serialize เป็น { _seconds, _nanoseconds } แต่ frontend อ่าน .seconds)
function normalizeCreatedAt(ts) {
  if (ts == null) return undefined;
  if (typeof ts.toDate === 'function') {
    try {
      const ms = ts.toDate().getTime();
      if (!Number.isNaN(ms)) return { seconds: Math.floor(ms / 1000) };
    } catch { /* fallthrough */ }
  }
  if (typeof ts === 'object') {
    const s = ts.seconds ?? ts._seconds;
    if (Number.isFinite(Number(s))) return { seconds: Number(s) };
    const ms = ts.milliseconds ?? ts._milliseconds;
    if (Number.isFinite(Number(ms))) return { seconds: Math.floor(Number(ms) / 1000) };
    return undefined;
  }
  if (typeof ts === 'string') {
    const ms = Date.parse(ts); // ISO 8601 เท่านั้น
    if (!Number.isNaN(ms)) return { seconds: Math.floor(ms / 1000) };
    return undefined;
  }
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return { seconds: ts > 1e11 ? Math.floor(ts / 1000) : Math.floor(ts) };
  }
  return undefined;
}

function createdAtSeconds(ts) {
  return normalizeCreatedAt(ts)?.seconds ?? 0;
}

// GET /api/admin/statistics?limit=500
// คืน { success, count, data } - เรียงล่าสุด -> เก่าสุด, createdAt เป็น { seconds }
router.get('/', async (req, res) => {
  try {
    const rawLimit = Number.parseInt(req.query?.limit, 10);
    const take = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_STAT_ROWS)
      : MAX_STAT_ROWS;

    // limit + orderBy: กันดึง collection statistics ทั้งหมด (โตกว่า 5000 แถว -> เกินเพดานอ่าน)
    const snap = await db
      .collection('statistics')
      .orderBy('createdAt', 'desc')
      .limit(take)
      .get();

    const data = snap.docs.map((d) => {
      const row = d.data() || {};
      return { id: d.id, ...row, createdAt: normalizeCreatedAt(row.createdAt) };
    });
    // เรียงซ้ำใน memory - ค่าที่แปลงไม่ได้/ไม่มี createdAt จะลงไปท้ายสุดแทนที่จะหายไป
    data.sort((a, b) => createdAtSeconds(b.createdAt) - createdAtSeconds(a.createdAt));

    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[api/admin/statistics]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
