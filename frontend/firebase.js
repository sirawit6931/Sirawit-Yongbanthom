import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
} from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

// ดึงค่าแบบ Static Direct Reference เพื่อให้ Metro แปลงค่าบรรทัดต่อบรรทัดได้ถูกต้อง
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBEyXIfw7UCrOq7leUtzZslt5Do7K0V2Kc",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "my-eng-auth.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "my-eng-auth",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "my-eng-auth.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "961630734061",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:961630734061:web:2353200f405578891a2ee4",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-CV011HSTBH"
};

// ป้องกันการ Initialize ซ้ำขณะโมดูลทำงาน
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// ── Auth: เก็บ session ตามมาตรฐานระบบ (ข้าม refresh / รีเปิดแอป) ─────────────
// — Web: ใช้ default persistence ของ Firebase เอง (IndexedDB → localStorage)
//        → รีเฟรชหน้า/เปิดแท็บใหม่ = ยังล็อกอินอยู่ หน้าโหลดข้อมูลใหม่เท่านั้น
// — Native: AsyncStorage (มีใน package.json แล้ว) → ปิดแอป/เปิดใหม่ = ยังล็อกอินอยู่
// — ออกจากระบบมีเฉพาะจุดตั้งใจ: ปุ่ม signOut ใน ProfileScreen / AdminDashboard
//   และหลังเปลี่ยนรหัสผ่านสำเร็จ (ForgotPasswordScreen)
//   (เลิกใช้ inMemoryPersistence แล้ว — เดิมบังคับล็อกอินใหม่ทุกครั้งที่รีเฟรช)
let auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  try {
    // require ใน branch (ไม่ใช้ import บนสุด) เพื่อไม่ให้ web bundle แตะ AsyncStorage
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // init ซ้ำ (เช่น HMR/reload) → ใช้ instance เดิมที่ register ไว้แล้ว
    auth = getAuth(app);
  }
}

// ── Firestore: เปิด Offline Persistence (Caching) ──────────────────────────
// Web (browser): ใช้ persistentLocalCache → เก็บข้อมูลลง IndexedDB
//   → โหลดหน้าซ้ำ/ออฟไลน์จะอ่านจาก Local Cache แทนการยิง request ไป Firebase
//   → ลด read bandwidth ซึ่งเป็นสาเหตุหลักของ "Firebase Quota Exceeded"
// Native: persistentLocalCache ต้องพึ่ง IndexedDB (ไม่มีบน RN) → SDK จะใช้
//   memory cache ตามปกติ จึง fallback ไป getFirestore() ตรงๆ
//   (มี in-memory TTL cache ชั้นที่ 2 ที่ frontend/services/firebaseCache.js ดูแลแทน)
let db;
if (Platform.OS === 'web') {
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache(),
    });
  } catch (err) {
    // ถ้า init ซ้ำ (มี getFirestore ถูกเรียกก่อน) → ใช้ instance เดิม
    console.warn('[firebase] initializeFirestore fallback:', err?.message);
    db = getFirestore(app);
  }
} else {
  db = getFirestore(app);
}

export { app, auth, db };