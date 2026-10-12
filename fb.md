# fb.md — คู่มือศึกษาโค้ด my-eng (Frontend + Backend)

> แอปฝึกภาษาอังกฤษ A1-A2 (Oxford 3000) + Admin Portal
> อ่านไฟล์นี้จบใน ~20 นาที แล้วจะรู้ว่าแก้ตรงไหน
> หลักจำ: `screens = หน้า` / `components+styles = ของตกแต่ง` / `services = ข้อมูล` / `backend = Admin API + Admin Web`

## 0. ภาพรวมสถาปัตยกรรม (Layered + Role-based)

```
[UI: frontend/screens + components]
        ↓ import
[Service: firestoreService / adminApi / ttsService / firebaseCache]
        ↓ แยก 2 ทาง
(A) Member: Firebase Client SDK ตรง → Firestore (อ่านโจทย์/บันทึกคะแนน)
(B) Admin: Express Backend (Admin SDK ข้าม Rules) → Firestore (CRUD)
```

`frontend/App.js` แยก 3 สายด้วย `onAuthStateChanged`:
`null → AuthNavigator` / `user → MainNavigator` / `admin → AdminNavigator`

## 1. Tech Stack (ของจริงในโค้ด)

| ชั้น | เทคโนโลยี | หลักฐานในโค้ด |
|---|---|---|
| Frontend | React Native + Expo ~57, React 19.2.3, react-native 0.86.3, react-native-web | `frontend/package.json` |
| Navigation | @react-navigation/native 6 + native-stack + bottom-tabs | `frontend/App.js: createNativeStackNavigator/createBottomTabNavigator` |
| State | useState/useEffect + Auth listener + TTL cache (ไม่มี Redux) | `App.js onAuthStateChanged`, `services/firebaseCache.js cachedFetch` |
| DB/Auth | Cloud Firestore + Firebase Auth v12 | `frontend/firebase.js`, `backend/config/firebase.js (firebase-admin 14.1)` |
| Backend | Node.js + Express 5.2.1 + cors + dotenv + nodemailer(OTP) | `backend/package.json`, `backend/server.js` |
| เสียง | expo-speech (TTS) + AsyncStorage | `services/ttsService.js: speakEnglish/stopSpeaking` |
| ไอคอน/ฟอนต์ | @expo/vector-icons Ionicons / Admin Web Kanit | ทุก Screen `import {Ionicons}`, `backend/public/admin/css/style.css` |
| Test | backend `node --test`, frontend `jest --runInBand` | `backend/__tests__/`, `frontend/__tests__/` |

## 2. Directory Tree — เรียงตามภาพ Explorer (A-Z)

> VS Code Explorer เรียง A-Z อัตโนมัติ — รายการข้างล่าง mirror ภาพที่ส่งมาเป๊ะ
> ห้าม rename/y้ายโฟลเดอร์จริงเพื่อให้ลำดับเปลี่ยน (import จะพัง) — แค่จำลำดับไว้อ่าน

```
my-eng/
├── backend/                     ← API + Admin Web (Node+Express)
└── frontend/                    ← แอปมือถือ+เว็บ (Expo) — ขยายตามภาพ:
    ├── __tests__/               ← เทส frontend (jest)
    ├── .expo/                   ← cache Expo (ไม่ต้องแตะ)
    ├── assets/                  ← รูป/โลโก้ E-1.png + splash/icon
    ├── components/ (6 ไฟล์)     ← ของใช้ซ้ำทุกหน้า
    │   ├── AppErrorBoundary.js  ← กันจอขาวค้าง
    │   ├── ConfirmModal.js      ← modal กันออกกลางเกม (EXERCISE_EXIT_TEXTS)
    │   ├── Logo.js              ← โลโก้ E-1.png 100x100
    │   ├── ResponsiveContainer.js ← กรอบกลาง form600/dashboard900/exercise700
    │   ├── SoundToggle.js       ← ปุ่ม 🔊/🔇 (ttsService toggleMute)
    │   └── SpeechSpeedToggle.js ← ปุ่ม 0.5x/1.0x/1.5x (cycleSpeed)
    ├── docs/                    ← โน้ตย่อย frontend
    ├── hooks/ (3 ไฟล์)          ← useResponsive / useSpeechRate / useNativeSpeechRecognition(ไมค์)
    ├── node_modules/            ← lib (collapsed ไม่ต้องเปิด)
    ├── screens/ (18 ไฟล์)       ← 1 ไฟล์ = 1 หน้า
    │   ├── Member Auth: LoginScreen / RegisterScreen / ForgotPasswordScreen
    │   ├── Member หลัก: HomeScreen / ExerciseListScreen / StatsScreen / ProfileScreen
    │   ├── Member เล่น: VocabExerciseScreen / TenseExerciseScreen / ListeningExerciseScreen
    │   ├── Member เสริม: VocabLibraryScreen (คำโปรด) + DevScreen (gate admin)
    │   └── Admin มือถือ (6): AdminLoginScreen / AdminDashboardScreen / AdminVocabScreen / AdminExerciseScreen / AdminExerciseFormScreen / AdminUsersScreen
    ├── scripts/                 ← seedFirestore.js + oxfordVocabSeed (ยิงข้อมูลตั้งต้น)
    ├── services/ (7 ไฟล์)       ← ต่อข้อมูล (ห้ามแก้ UI ที่นี่)
    │   ├── firestoreService.js  ← ศูนย์ Member CRUD (users/vocab/exercises/statistics/favorite)
    │   ├── firebaseCache.js     ← cachedFetch TTL + กันโควต้า 429
    │   ├── ttsService.js        ← speakEnglish/stopSpeaking + speed/voice
    │   ├── adminApi.js          ← fetch /api/admin/exercises (Bearer)
    │   ├── adminService.js      ← Vocab ตรง Firestore + Exercise ผ่าน adminApi
    │   ├── apiConfig.js         ← getApiBase (ห้าม hardcode URL ที่อื่น)
    │   └── speechLog.js         ← log ฝึกพูด
    ├── styles/                  ← authStyles.js (PRIMARY #5B4FCF input52px primaryBtn/outlineBtn — ใช้ร่วม Login/Register/Forgot)
    ├── utils/                   ← logic ล้วนไม่พึ่ง RN
    │   ├── responsive.js        ← BREAKPOINTS 768/1024 + CONTAINER_WIDTH
    │   ├── learningEngine.js    ← shuffle/shuffleStages (matching ตัวแรกเสมอ) MAX 10
    │   ├── tenseMode.js / encounteredWords.js / speechVerify.js / confirmDialog.js ← logic ย่อย
    ├── .env                     ← EXPO_PUBLIC_API_URL + Firebase keys
    ├── .gitignore
    ├── AGENTS.md                ← กฎ AI agent
    ├── App.js                   ← ประตู + Navigation 3 สาย (Auth/Main/Admin)
    └── app.json                 ← config Expo (ชื่อ/ไอคอน/splash)
    (+ ไฟล์ root ที่ภาพย่อไว้: firebase.js=init Client SDK, SCHEMA.md=truth 7 collections, PROJECT_SCOPE.md=กฎโปรเจกต์, package.json, index.js, firestore.rules.txt)
```

## 3. Frontend Core (2 ไฟล์ต้องอ่านก่อน)

### 3.1 `frontend/App.js` — import อะไร logic อะไร
```js
import './firebase'; // init ก่อนใคร
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { checkIsAdmin, getUserProfile } from './services/firestoreService';
```
Logic: `useEffect onAuthStateChanged → Promise.all[getUserProfile(uid), checkIsAdmin(email)] → mergedUser{username,role} → เลือก Navigator` + `DevScreenGate(__DEV__||role==admin)` + web `maxWidth 1100` desktop เท่านั้น

### 3.2 `frontend/firebase.js` — import อะไร logic อะไร
```js
import { initializeApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
```
Logic: Web+Native=inMemory ทั้งคู่ (บังคับ login ใหม่ทุกครั้งที่เปิด/รีเฟรช) / Firestore web=persistentLocalCache (IndexedDB กันโควต้า) + `export {app,auth,db}`

## 4. Frontend screens/ (18 หน้า)

| ไฟล์ | หน้าที่ | import หลัก | logic เด่น | แก้ UI ตรงไหน |
|---|---|---|---|---|
| `LoginScreen.js` | เข้าสู่ระบบ | `../firebase {auth}`, `firebase/auth signIn`, `Logo`, `ResponsiveContainer form`, `authStyles`, `apiConfig` | `handleLogin trim→signIn→ยิง /api/protected-data แบบไม่บังคับ→App.js เปลี่ยนหน้า`, แปล error.code ไทย | ข้อความ 89-90, input 101-133, ปุ่ม 144-163 |
| `RegisterScreen.js` | สมัคร | `+createUserWithEmailAndPassword`, `updateUsername` | `create→setDoc(users/{uid})` | ฟอร์ม username |
| `ForgotPasswordScreen.js` | ลืมรหัส/OTP | `{auth}`, `sendPasswordResetEmail` | OTP ผ่าน backend nodemailer | ฟอร์มเดียวกับ Login |
| `HomeScreen.js` | Hub 3 หมวด | `getExercisesByCategory/getUserProgressMap/getAllVocabulary`, `countEncounteredWords` | `Promise.all 5 query→นับ passed>=80→pct`, `CATEGORIES vocabม่วง/tenseเขียว/listeningส้ม` | `CATEGORIES`, `s.header/summaryCard/catCard` |
| `ExerciseListScreen.js` | ลิสต์ชุด | `getExercisesByCategory/getUserProgressMap` | filter published → navigate+exerciseId | card + filter A1/A2 |
| `VocabExerciseScreen.js` | เล่นศัพท์ 4 ด่าน | `saveStatistic/favorite*`, `speakEnglish`, `buildQuizSession/shuffleStages`, `SpeechSpeedToggle/SoundToggle/ConfirmModal` | Matching/Spelling/FillBlank/Speaking, ผิด1ไม่เฉลย ผิด2เฉลย+เสียง, `pct=round(score/total*100) passed>=80 UUID` | `PRIMARY/SUCCESS/ERROR/FAV_PINK`, `ms.btn/btnCorrect/btnWrong` |
| `TenseExerciseScreen.js` | เล่น Tense | `saveStatistic`, `speakEnglish` | MCQ+ordering, beforeRemove กันออก, ฟังซ้ำ | ธีมเขียว |
| `ListeningExerciseScreen.js` | ฟังบทสนทนา | `saveStatistic`, `speakEnglish` | dialogueทีละบรรทัด + questions | ธีมส้ม bubble |
| `StatsScreen.js` | ประวัติ | `getUserStatistics`, `quotaMessage` | useFocusEffect reload | ตารางคะแนน |
| `ProfileScreen.js` | โปรไฟล์ | `{auth}`, `signOut`, `updateUsername` | navigate Library/Dev | ฟอร์มชื่อ+เมนู |
| `VocabLibraryScreen.js` | คำโปรด | `getFavoriteVocab/removeFavoriteVocab`, `speakEnglish` | FlatList+🔊+ลบ dedupe | การ์ดคำ |
| `AdminLoginScreen.js` | login admin มือถือ | `{auth}`, `signIn`, `checkIsAdmin` | getIdToken→POST /api/admin/login | ฟอร์มสี #1A237E |
| `AdminDashboardScreen.js` | เมนู admin | `{auth}`, `signOut` | MENUS Vocab/Exercise/Users | s.menuRow |
| `AdminVocabScreen.js` | CRUD ศัพท์มือถือ | `adminGetAllVocab/Add/Update/Delete` | wordEN/TH/cefrLevel/ttsVoice | ตาราง |
| `AdminExerciseScreen+Form.js` | CRUD โจทย์มือถือ | `adminGetAllExercises/Delete + Add/Update` | category/items/status draft/published | ตาราง+ฟอร์ม |
| `AdminUsersScreen.js` | สมาชิก | `adminGetUserSummary/ByEmail/Update/Delete` | users+listAllAuthUsers 1000 | ตาราง |
| `DevScreen.js` | ดีบัก gate | `seedAll/checkSeeded` | __DEV__\|\|admin | ลิงก์ทดสอบ |

## 5. Frontend services/components/utils/hooks/styles

### services/ (แก้ query/เสียง/URL — ห้ามแก้ UI)
| ไฟล์ | import | logic |
|---|---|---|
| `firestoreService.js` | `firebase/firestore collection/doc/query/where/serverTimestamp`, `../firebase {db}`, `./firebaseCache` | getAllVocabulary TTL5นาที, getExercises normalize กัน title null, saveStatistic/getUserStatistics TTL1นาที, favorite dedupe email+wordId, getUserProfile merge, checkIsAdmin admins/email |
| `firebaseCache.js` | ล้วน JS | cachedFetch: freshคืนเลย/inflight share/สำเร็จsetCache/โควต้าคืนstale, MAX 100, isQuotaError 429/quota |
| `ttsService.js` | `expo-speech`, `AsyncStorage` | SPEED slow0.5/normal1.0/fast1.5 persist, speakEnglish muted→return + หา voice en-US ตรงเพศ + pitch fallback |
| `adminApi.js` | `../firebase {auth}`, `./apiConfig` | getIdToken→Bearer, fetch /api/admin/exercises CRUD |
| `apiConfig.js` | `Platform` | EXPO_PUBLIC_API_URL > android 10.0.2.2:5000 > localhost:5000 |
| `adminService.js` | `firestore`, `{db}`, `adminApi`, `firebaseCache` | VocabตรงFirestore + Exerciseผ่านadminApi, TTL1นาที MAX5000 |
### components/utils/hooks/styles (แก้ UI ที่นี่)
| ไฟล์ | import | แก้เมื่อ |
|---|---|---|
| `Logo.js` | `require('../assets/E-1.png')` | โลโก้ 100x100 |
| `ResponsiveContainer.js` | `useResponsive`, `resolveContainerStyle` | กรอบกลาง form600/dashboard900/exercise700 |
| `SpeechSpeedToggle.js` | `useSpeechRate` | ปุ่ม 0.5x/1.0x/1.5x |
| `SoundToggle.js` | `ttsService toggleMute` | ปุ่ม 🔊/🔇 |
| `ConfirmModal.js` | — | กันออกกลางเกม EXERCISE_EXIT_TEXTS |
| `utils/responsive.js` | ล้วน JS | BREAKPOINTS 768/1024, numColumns 1/2/3 |
| `utils/learningEngine.js` | CommonJS ทั้ง FE+BE | shuffle/shuffleStages matching ตัวแรกเสมอ, MAX 10 |
| `hooks/useResponsive/useSpeechRate/useNativeSpeechRecognition` | RN+services | ขนาดจอ/ความเร็ว/ไมค์ |
| `styles/authStyles.js` | StyleSheet | PRIMARY #5B4FCF input52px primaryBtn/outlineBtn — แก้ที่เดียวได้ 3 หน้า |

## 6. Backend (Node+Express+Admin SDK)

### 6.1 server.js + core
```js
require('dotenv').config();
const express = require('express'); // 5.2.1
const { adminAuth, db } = require('./config/firebase');
const { requireAdmin } = require('./middleware/authMiddleware');
```
`cors+json10mb → guard /api/admin (login/bootstrap public) → mount 6 routers → serve /admin → POST /bootstrap → listen 0.0.0.0:5000`

| ไฟล์ | require | logic |
|---|---|---|
| `config/firebase.js` | `firebase-admin/app cert/auth/firestore`, `serviceAccountKey.json` | export {adminAuth,db} ข้าม Rules |
| `middleware/authMiddleware.js` | `config/firebase`, `verifyAdminToken` | 3 ทาง: req.user→session HMAC→Firebase ID+admins/email; 401/403 |
| `utils/adminSessionToken.js` | `crypto` | sign/verify HMAC-SHA256 TTL 8ชม |

### 6.2 routes/ 6 ไฟล์ (express.Router + requireAdmin)
| ไฟล์ | Endpoint | field/logic |
|---|---|---|
| `adminAuthRoutes.js` | POST /login/session GET /me | throttle 5/5นาที ออก session token |
| `adminExerciseRoutes.js` | CRUD /exercises | status draft/published |
| `adminVocabularyRoutes.js` | CRUD /vocabulary-sets | wordEN/TH/cefrLevel A1-A2/ttsVoice |
| `adminTenseRoutes.js` | CRUD /tense-sets | answer∈choices speakText==orderWords |
| `adminListeningReadingRoutes.js` | CRUD /listening-reading-sets | dialogues 1-3 + questions |
| `adminStatisticsRoutes.js` | GET /statistics?email&category | Admin SDK อ่านข้าม owner |

### 6.3 public/admin/ (SPA ไม่ใช่ React)
`index.html ~976 บรรทัด` import firebase CDN 10.12.2 → login-view + sidebar 7 หมวด + wizard 3 ขั้น + modal + pagination / `css/style.css` Kanit / `js/adminApp.js` renderPage 20/หน้า

## 7. จำแบบชีวิตประจำวัน
* cachedFetch = ตู้เย็น: สดกินเลย ทำซ้ำรอหม้อเดียว ไฟดับกินของค้างคืน
* saveStatistic = สมุดพก: ผูก email+exerciseId ตก/ผ่าน>=80 กันเบิลด้วย UUID
* requireAdmin = ยาม: บัตรเรา(session)ผ่านเลย ไม่งั้นเช็กทะเบียนบ้าน(admins/email)
* shuffleStages = ร้านข้าว: จานแรกบังคับข้าว(matching) ที่เหลือสุ่ม

## 8. Data Flow
A. Member Vocab: ExerciseList(published)→VocabExercise(getById→shuffleStages→speakEnglish→❤️favorite→saveStatistic)→Stats
B. Admin Web: login(POST /login→token)→sidebar vocabulary(GET+requireAdmin)→Edit(PUT /:id)→renderPage reload

## 9. Cheat
```
Login → styles/authStyles.js | Logo → components/Logo.js
Home → screens/HomeScreen.js | โจทย์ → screens/Vocab|Tense|Listening + learningEngine.js
เสียง → services/ttsService.js | query → services/firestoreService.js
URL → services/apiConfig.js | Adminมือถือ → screens/Admin* | Adminเว็บ → public/admin/
API/สิทธิ์ → routes/*.js + authMiddleware.js | เพิ่มfield → SCHEMA.md→migrate.js→firestoreService.js
```
เริ่มชิ้นแรก: HomeScreen เปลี่ยน PRIMARY #5B4FCF→#FF6B00 แล้ว expo start --web


