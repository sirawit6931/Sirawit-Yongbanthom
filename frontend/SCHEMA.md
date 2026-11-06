# SCHEMA.md — Canonical Data Model (Cloud Firestore)

> เอกสารนี้เป็น **single source of truth** ของโครงสร้างข้อมูล ใช้สำหรับ:
> - Admin API (M1) — CRUD vocabulary / exercises / users / reports / admins / config
> - Learning Engine (M3) — สุ่มโจทย์ และ fetch แบบ live จากคลังคำศัพท์
> - Migration script (`backend/scripts/migrate.js`) — รวม fields ที่มีการแก้
>
> ให้อัปเดตเอกสารนี้ทุกครั้งที่เปลี่ยน schema, add field หรือ rename field.

## Rules
- CEFR scope: **`A1`, `A2` เท่านั้น** (requirement ระบุ beginner A1–A2 จาก Oxford 3000)
- Admin เขียนผ่าน **Backend API (Admin SDK)** เสมอ — client SDK ใช้ได้แค่ Read
- ใช้ `serverTimestamp()` สำหรับ timestamp (มาจาก server ไม่ใช่ client clock)
- คอลเลกชัน static (vocabulary / exercises) ต้องมีสถานะ `draft|published`
  เพื่อกันไม่ให้สมาชิกเห็นชุดที่ยังไม่พร้อมเผยแพร่

---

## 1) users — โปรไฟล์สมาชิก

| Field | Type | Note |
|---|---|---|
| `uid` (doc id) | string | Firebase Auth UID |
| `email` | string | ใช้เชื่อมกับ `statistics.email` |
| `username` | string | ตั้งตอน Register |
| `createdAt` | Timestamp | |

---

## 2) admins — รายชื่อผู้ดูแล (หลายคนได้)

| Field | Type | Note |
|---|---|---|
| `{email}` (doc id) | string | เป็น key — login check (`checkIsAdmin`) อ่าน `doc(db,'admins',email)` |
| `name` | string | ชื่อผู้ดูแล |
| `role` | string | `admin` หรือ `superadmin` |
| `createdAt` | Timestamp | |
| `username` (optional) | string | ชื่อผู้ดูแลสำหรับ Admin Web login (username/password) — ค้น fallback ด้วย `where('username','==',…)` เมื่อ doc id ไม่ใช่ username |
| `password` (optional) | string | รหัสผ่านสำหรับ `POST /api/admin/login` (เทียบแบบ timing-safe) — **ถ้ามี field นี้จะ "ชนะ" default creds** (ห้าม fallback) |
| `passwordHash` (optional) | string | ทางเลือกแทน `password` — hex sha256 ของรหัสผ่าน (เทียบแบบ timing-safe) |
| `uid` (optional) | string | Firebase Auth UID ของผู้ดูแล (ใช้ตอนออก custom token จาก `/api/admin/login` + `/api/admin/session`) |

**Admin Authentication env (`backend/.env`)**

| Env | Default | หมายเหตุ |
|---|---|---|
| `ADMIN_SESSION_SECRET` | (dev fallback + warning 1 ครั้ง) | secret สำหรับลงนาม session token (HMAC-SHA256) — **ควรตั้งค่าเสมอใน production** |
| `ADMIN_TOKEN_TTL_HOURS` | `8` | อายุ session token (ชั่วโมง) |
| `ADMIN_USERNAME` | `admin01` | default username สำหรับ login เมื่อ doc ไม่มีรหัสผ่าน |
| `ADMIN_PASSWORD` | `admin01` | default password สำหรับ login เมื่อ doc ไม่มีรหัสผ่าน |

> การยืนยันตัวตนของ `/api/admin/*` รับ **2 แบบ** (ดู `backend/middleware/authMiddleware.js`):
> 1. **Session token** จาก `POST /api/admin/login` (Admin Web — เก็บใน localStorage)
> 2. **Firebase ID token** (โมบายล์ `AdminLoginScreen` — path เดิม backward-compatible)

---

## 3) vocabulary — คลังคำศัพท์ Oxford 3000 (หลัก)

> ข้อมูลปัจจุบัน: **1,772 คำ (A1: 900 / A2: 872)** — ตรงกับ Oxford 3000 by CEFR
> (source: ไฟล์ PDF ของ Oxford + `backend/data/oxford_vocabulary.json`;
>  289 คำปรากฏมากกว่า 1 level ตาม sense ต่างกัน จึงรวม entries เกิน 3,000 ชื่อ)

> ⚠️ **FIELD NAME — CEFR**: ใช้ `cefrLevel` (ที่ Admin UI เขียน). เดิม seed ใช้ชื่อ `level` —
> migration `migrate.js` จะแปลง `level` → `cefrLevel` และลบ `level` ทิ้ง.

| Field | Type | Note |
|---|---|---|
| `id` (auto) | string | `vocabulary.id` เชื่อมกับ `favoriteVocab.wordId` และ `exercises.items[].wordId` |
| `wordEN` | string (Index) | คำศัพท์ EN (จาก Oxford 3000) |
| `wordTH` | string | คำแปล TH |
| `cefrLevel` | enum `A1` \\ `A2` | ระดับคำศัพท์ (ขอบเขตของระบบ) |
| `partOfSpeech` | string | noun / verb / adjective / ... |
| `ttsVoice` | string | default `''` (ใช้ global config แทน) |
| `createdAt` | Timestamp | |
| `usedInExercises` | number (soft) | นับว่าถูกอ้างอิงใน published items (สำหรับ admin visibility) |

**Indexes:** `cefrLevel` (ตัวกรองของ generator), `wordEN` (search)

---

## 4) exercises — ชุดแบบฝึกหัด (vocab / tense / listening)

| Field | Type | Note |
|---|---|---|
| `id` | string | auto หรือ custom seed (`vex_a1_01`, `tex001`) |
| `category` | enum `vocab` \\ `tense` \\ `listening` | |
| `level` | enum `A1` \\ `A2` | ระดับของชุด |
| `title` | string | ชื่อชุด |
| `description` | string | |
| `ttsSystem` | enum `female` \\ `male` | เสียงสังเคราะห์ของชุด (fallback จาก global config) |
| `items` | array | vocab/tense: ดู §4.1, §4.2 |
| `dialogue` | array | listening: `[{ speaker, side:'left'\|'right', text }]` |
| `questions` | array | listening: `[{ question, choices[], answer }]` |
| `status` | enum `draft` \\ `published` | **NEW** — draft ยังไม่ให้สมาชิกเห็น |
| `sourceVersion` | number | **NEW** — เพิ่มทุกครั้งที่ regenerate จาก vocabulary |
| `vocabularyLevel` | enum `A1` \\ `A2` | **NEW** — level ของ pool ที่ใช้สร้าง (เฉพาะ vocab) |
| `generatedAt` | Timestamp | **NEW** — เวลาที่ generate |
| `createdAt` / `updatedAt` | Timestamp | |

**Indexes:** `category + level + createdAt` (ExerciseList filter+sort), `status`

### 4.1 vocab `items[]`
```js
{ wordId, wordEN, wordTH, sentence, sentenceTH, distractors: string[] } // 10 ข้อ/ชุด
```
- `wordId` เชื่อมกับ `vocabulary.id` (สำหรับ generator / ตรวจสอบ cascade ตอนลบคำศัพท์)
- `distractors` ไม่เกิน 2 ตัว (คำหลอกระดับเดียวกัน, ไม่รวม wordEN ของข้อนั้น)

### 4.2 tense `items[]`
```js
{ tenseType, tenseColor, exampleEN, exampleTH, sentence, sentenceTH,
  answer, choices: string[], orderWords: string[], speakText }
```
- INVARIANT: `answer ∈ choices`, `speakText === orderWords.join(' ')`

### 4.3 listening `dialogue[]` + `questions[]`
```js
dialogue:  [{ speaker, side:'left'|'right', text }]
questions: [{ question, choices: string[], answer }] // อย่างน้อย 3 ข้อ, answer ∈ choices
```

---

## 5) statistics — บันทึกคะแนน/ประวัติของสมาชิก (1:N จาก users)

| Field | Type | Note |
|---|---|---|
| `id` (auto) | string | |
| `email` | string (Index) | เชื่อม `users.email` |
| `exerciseId` | string | เชื่อม `exercises.id` |
| `category` | enum `vocab` \\ `tense` \\ `listening` | |
| `score` | int | คะแนนที่ได้ |
| `totalQuestions` | int | จำนวนข้อทั้งหมด |
| `percentage` | int 0–100 | `round(score/total*100)` |
| `passed` | bool | `percentage >= 80` (Pass Criterion) |
| `timeSpent` | int | วินาที (หน้าสรุปผล) |
| `attemptId` | string | **NEW** — UUID ต่อ 1 รอบการทำ เพื่อกันบันทึกซ้ำ (idempotent) |
| `createdAt` | Timestamp | |

**Indexes:** `email + createdAt` (StatsScreen sort), `email + exerciseId` (progress map)

---

## 6) favoriteVocab — คลังคำศัพท์โปรดส่วนบุคคล

| Field | Type | Note |
|---|---|---|
| `id` (auto) | string | |
| `email` | string (Index) | เจ้าของ |
| `wordId` | string | เชื่อม `vocabulary.id` |
| `wordEN` / `wordTH` | string | **denormalize** (อ่านเร็ว/ออฟไลน์ แต่ต้อง refresh เมื่อคำศัพท์แก้) |
| `ttsVoice` | string | |
| `addedAt` | Timestamp | |

**Indexes:** `email + wordId` (สำหรับ dedupe ใน `addFavoriteVocab`)

---

## 7) appConfig — System Configuration (NEW, M1.7)

| Field | Type | Note |
|---|---|---|
| `defaultTtsVoice` | enum `male` \\ `female` | เสียงเริ่มต้นของระบบ |
| `passThreshold` | number | default `80` |
| `questionCountMin` / `questionCountMax` | int | default `10` / `15` |
| `updatedAt` | Timestamp | |

---

## ER (NoSQL relation style)

```
users ─(1:N statistics by email)→ statistics ─(N:1)→ exercises
users ─(1:N favoriteVocab by email)→ favoriteVocab ─(N:1)→ vocabulary.id
exercises.items[].wordId ─(N:1)→ vocabulary.id        (เฉพาะหมวด vocab)
```

## Field-unification (ที่ migrate.js ทำ)

| Collection | จาก | เป็น |
|---|---|---|
| vocabulary | `level` (legacy จาก seed) | `cefrLevel` |
| exercises | (ไม่มี) | `status='published'`, `sourceVersion=1`, `vocabularyLevel=level` (เฉพาะ vocab) |