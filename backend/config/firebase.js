// backend/config/firebase.js
//
// Firebase Admin initialization — shared โดยทุก module ที่ต้องการ (server.js,
// services/, routes/) กันการ initializeApp ซ้ำ (ซึ่ง throw error ถ้า default app ซ้ำ)
//
// Export:
//   - adminAuth   : Firebase Admin Auth (สร้าง custom token / ยืนยัน ID token)
//   - db          : Firestore instance (ทำงานลอด Security Rules ได้เพราะเป็น Admin SDK)

require('dotenv').config();

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth }              = require('firebase-admin/auth');
const { getFirestore }         = require('firebase-admin/firestore');

const serviceAccount = require('../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
});

const adminAuth = getAuth();
const db        = getFirestore();

module.exports = { adminAuth, db };