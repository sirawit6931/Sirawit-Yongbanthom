// backend/server.js
require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const nodemailer               = require('nodemailer');

// ─── Firebase Admin (shared config — backend/config/firebase.js) ──────────────
const { adminAuth, db } = require('./config/firebase');

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── บังคับ Content-Type เป็น application/json เฉพาะ /api/ endpoints เท่านั้น ──
// ไม่ครอบคลุม /admin (express.static/sendFile) เพื่อให้ HTML/CSS/JS ได้
// Content-Type: text/html; charset=utf-8 ตาม MIME ของไฟล์ และหน้า Admin render เป็น UI
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// ─── Admin Exercise API (M1.3) ────────────────────────────────────────────────
const adminExerciseRoutes = require('./routes/adminExerciseRoutes');
app.use('/api/admin/exercises', adminExerciseRoutes);

// ─── Admin Category-Specific APIs (M2.0 — Separated Exercise Management) ──────
const adminVocabularyRoutes = require('./routes/adminVocabularyRoutes');
app.use('/api/admin/vocabulary-sets', adminVocabularyRoutes);

const adminTenseRoutes = require('./routes/adminTenseRoutes');
app.use('/api/admin/tense-sets', adminTenseRoutes);

const adminListeningReadingRoutes = require('./routes/adminListeningReadingRoutes');
app.use('/api/admin/listening-reading-sets', adminListeningReadingRoutes);

// ─── Admin Users API (members list) — needs Auth + admin check ─────────────
const { requireAdmin } = require('./middleware/authMiddleware');

// ดึงผู้ใช้ทั้งหมดจาก Firebase Authentication (paginate ทีละ 1000)
async function listAllAuthUsers() {
  const users = [];
  let nextPageToken;
  do {
    const page = await adminAuth.listUsers(1000, nextPageToken);
    users.push(...page.users);
    nextPageToken = page.pageToken ?? null;
  } while (nextPageToken);
  return users;
}

// แปลง metadata.creationTime (ISO string) → { seconds, milliseconds } ให้เป็น Timestamp-like
// เพื่อให้ frontend (new Date(u.createdAt.seconds * 1000)) แสดงวันที่ได้เหมือนเดิม
function authCreatedAt(u) {
  const t = u?.metadata?.creationTime;
  if (!t) return undefined;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return undefined;
  return { seconds: Math.floor(ms / 1000), milliseconds: ms };
}

app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    // 1) ข้อมูลโปรไฟล์จาก Firestore users collection (ถ้ามี)
    const snap = await db.collection('users').get();
    const firestoreUsers = snap.docs.map((d) => ({ id: d.id, uid: d.id, ...d.data() }));

    // 2) สมาชิกทุกคนจาก Firebase Auth (source of truth สำหรับอีเมล/uid)
    //    — merge กับ Firestore เพื่อให้ทุกบัญชีแสดงผลแม้ไม่มี profile doc
    const byUid = new Map(firestoreUsers.map((u) => [u.uid, u]));
    const authUsers = await listAllAuthUsers();
    authUsers.forEach((u) => {
      const existing = byUid.get(u.uid);
      const authProfile = {
        id: u.uid,
        uid: u.uid,
        email: u.email ?? existing?.email ?? '',
        name: u.displayName ?? existing?.name ?? '',
        username: existing?.username ?? u.displayName ?? '',
        displayName: existing?.displayName ?? u.displayName ?? '',
        createdAt: existing?.createdAt ?? authCreatedAt(u),
      };
      byUid.set(u.uid, existing ? { ...existing, ...authProfile } : authProfile);
    });

    const data = Array.from(byUid.values());
    data.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    return res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('[api/admin/users]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Nodemailer (Gmail SMTP) ──────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// ─── OTP Store (เก็บใน Memory, หมดอายุ 5 นาที) ──────────────────────────────
// โครงสร้าง: { 'email@xxx.com': { code: '123456', expiry: timestamp } }
const otpStore = {};

const OTP_EXPIRE_MS = 5 * 60 * 1000; // 5 นาที

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 หลัก
}

// ─── Middleware ตรวจ Firebase Token ──────────────────────────────────────────
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized: ไม่มี Token ส่งมา' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(403).json({
      message: 'Unauthorized: Token ไม่ถูกต้องหรือหมดอายุ',
      error: error.message,
    });
  }
};

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/send-otp
// รับ: { email }
// ส่ง OTP 6 หลักไปที่อีเมลผู้ใช้
// ═════════════════════════════════════════════════════════════════════════════
app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, message: 'อีเมลไม่ถูกต้อง' });
  }

  // ตรวจว่าอีเมลนี้มีบัญชีใน Firebase หรือไม่
  try {
    await adminAuth.getUserByEmail(email.trim());
  } catch (err) {
    // ไม่พบบัญชี — แจ้ง error แต่ไม่บอกตรงๆ เพื่อความปลอดภัย
    return res.status(404).json({ success: false, message: 'ไม่พบบัญชีที่ใช้อีเมลนี้' });
  }

  // สร้าง OTP และเก็บไว้
  const code = generateOtp();
  otpStore[email.trim().toLowerCase()] = {
    code,
    expiry: Date.now() + OTP_EXPIRE_MS,
  };

  // ส่งอีเมล
  const mailOptions = {
    from: `"My-Eng App" <${process.env.GMAIL_USER}>`,
    to: email.trim(),
    subject: 'รหัส OTP สำหรับรีเซ็ตรหัสผ่าน',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e0e0e0;border-radius:12px;">
        <h2 style="color:#5B4FCF;text-align:center;">🔐 รีเซ็ตรหัสผ่าน</h2>
        <p style="color:#333;font-size:15px;">รหัส OTP ของคุณคือ:</p>
        <div style="text-align:center;margin:24px 0;">
          <span style="font-size:42px;font-weight:bold;letter-spacing:10px;color:#5B4FCF;">${code}</span>
        </div>
        <p style="color:#666;font-size:13px;">รหัสนี้จะหมดอายุใน <strong>5 นาที</strong></p>
        <p style="color:#666;font-size:13px;">หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยอีเมลนี้</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
        <p style="color:#aaa;font-size:12px;text-align:center;">My-Eng — แอปฝึกภาษาอังกฤษพื้นฐาน</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.json({ success: true, message: 'ส่ง OTP สำเร็จ' });
  } catch (mailErr) {
    console.error('ส่งอีเมลล้มเหลว:', mailErr.message);
    return res.status(500).json({ success: false, message: 'ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/verify-otp
// รับ: { email, otp }
// ตรวจสอบ OTP และส่ง Custom Token กลับเพื่อให้ Frontend ตั้งรหัสใหม่
// ═════════════════════════════════════════════════════════════════════════════
app.post('/api/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'ข้อมูลไม่ครบ' });
  }

  const key    = email.trim().toLowerCase();
  const record = otpStore[key];

  // ไม่มี OTP หรือหมดอายุแล้ว
  if (!record) {
    return res.status(400).json({ success: false, message: 'ไม่พบรหัส OTP กรุณาขอใหม่' });
  }
  if (Date.now() > record.expiry) {
    delete otpStore[key];
    return res.status(400).json({ success: false, message: 'รหัส OTP หมดอายุแล้ว กรุณาขอใหม่' });
  }

  // รหัสไม่ตรง
  if (otp.toString().trim() !== record.code) {
    return res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้อง' });
  }

  // ถูกต้อง — ลบ OTP ออกจาก store
  delete otpStore[key];

  // สร้าง Custom Token เพื่อให้ Frontend login แล้วตั้งรหัสใหม่ได้
  try {
    const userRecord  = await adminAuth.getUserByEmail(email.trim());
    const customToken = await adminAuth.createCustomToken(userRecord.uid, {
      resetPassword: true,
    });
    return res.json({ success: true, customToken });
  } catch (err) {
    console.error('สร้าง Custom Token ล้มเหลว:', err.message);
    return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด กรุณาลองใหม่' });
  }
});

// ─── Admin Web Portal (static files) ─────────────────────────────────────────
// บังคับ Content-Type: text/html + ปิด cache ให้ HTML เพื่อให้ Chrome render เป็น UI
// (และกันกรณี response แบบ RAW เดิมถูก cache ค้างใน browser)
app.use('/admin', express.static(path.join(__dirname, 'public/admin'), {
  setHeaders: (res, filePath) => {
    if (path.extname(filePath).toLowerCase() === '.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));
// SPA fallback — Express 5 + path-to-regexp 8 ไม่รับ wildcard ใน app.get
// ใช้ app.use middleware แทน และระบุ Content-Type: text/html อย่างชัดเจน
app.use('/admin', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// ═════════════════════════════════════════════════════════════════════════════
// POST /api/admin/bootstrap
// Bootstrap endpoint: สร้าง admin คนแรก (ใช้ได้แค่เมื่อไม่มี admin ใดๆ)
// รับ: { email, password, name }
// ไม่ต้อง auth token สำหรับคำขอแรก แต่ต้องมี Firebase Auth user สำหรับอีเมลนั้น
// ═════════════════════════════════════════════════════════════════════════════
app.post('/api/admin/bootstrap', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ success: false, error: 'Email and name required' });
    }

    // ตรวจว่ามี admin ที่มีอยู่แล้วหรือไม่
    const adminsSnap = await db.collection('admins').limit(1).get();
    if (!adminsSnap.empty) {
      return res.status(403).json({ success: false, error: 'Admins already exist. Use authenticated endpoint instead.' });
    }

    // ตรวจว่าอีเมลนี้มี Firebase Auth account หรือไม่
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email.trim());
    } catch (err) {
      return res.status(404).json({ success: false, error: 'User account not found. Please create Firebase Auth user first.' });
    }

    // สร้าง admin document
    await db.collection('admins').doc(email.toLowerCase()).set({
      name: name.trim(),
      role: 'admin',
      createdAt: new Date(),
      uid: userRecord.uid,
    });

    return res.json({
      success: true,
      message: 'Admin created successfully',
      adminEmail: email.toLowerCase(),
    });
  } catch (err) {
    console.error('[bootstrap admin]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Existing endpoint ────────────────────────────────────────────────────────
app.get('/api/protected-data', verifyFirebaseToken, (req, res) => {
  res.json({
    message: 'ยินดีต้อนรับสู่ my-eng! เชื่อมต่อกับ Backend สำเร็จแล้ว',
    user: req.user,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
// หมายเหตุ: เมื่อ bind สำเร็จ server จะค้าง event loop ไว้ ให้ process รันต่อไปเรื่อยๆ
// (server จะ active จนกว่าจะถูกหยุดด้วย Ctrl+C เท่านั้น) — process.exit(1) ใช้เฉพาะตอน bind ล้มเหลว
const PORT = 5000;
const server = app.listen(PORT, '0.0.0.0');

// สำคัญ: Express 5's app.listen() จะเรียก callback ที่ส่งเข้าไปทั้งตอน 'listening' และตอน
// 'error' (เพราะใน Express ทำเลยเป็น server.once('error', done)) — ถ้าพอร์ตถูกใช้อยู่
// (EADDRINUSE) callback เดิมจะยังถูกเรียก และจะพิมพ์ "✅ Server กำลังรัน" ขึ้นมาอย่างไม่ถูกต้อง
// จึงแยกเหตุการณ์ 'listening' กับ 'error' ชัดเจน เพื่อให้ log ตรงกับความเป็นจริงเท่านั้น
server.on('listening', () => {
  console.log(`✅ Server กำลังรันที่พอร์ต ${PORT}`);
  console.log(`🚀 Local:   http://localhost:${PORT}/admin`);
  console.log(`🌐 Network: http://192.168.1.117:${PORT}/admin`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`❌ Server เริ่มไม่ได้: พอร์ต ${PORT} ถูกใช้งานอยู่ (EADDRINUSE)`);
    console.error(`   🔍 ดู process ที่ถือพอร์ต:  netstat -ano | findstr :${PORT}`);
    console.error(`   ⚔️ ปิดมันด้วย:                 taskkill /PID <PID> /F`);
  } else {
    console.error('❌ Server failed to start:', err && err.message ? err.message : err);
  }
  process.exit(1); // จบ process ให้ชัดเจนหลัง bind ล้มเหลว
});
