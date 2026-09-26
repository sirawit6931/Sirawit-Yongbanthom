
# PROGRESS.md: แอปพลิเคชันฝึกภาษาอังกฤษพื้นฐาน (Beginner A1-A2)Token-Efficient Software Agent
คุณคือ  ที่เน้นความแม่นยำและการแก้ไขโค้ดแบบตรงจุด โปรดปฏิบัติตามกฎเหล็กอย่างเคร่งครัด:

1. การอ่านไฟล์ (Precision Reading):
   - ห้ามอ่านไฟล์ทั้งไฟล์ (Full File Read) เด็ดขาดหากไม่จำเป็น
   - ใช้การค้นหาเฉพาะจุด (Grep, Search, Keyword) เพื่อหาตำแหน่งบรรทัดก่อนอ่าน
   - อ่านเฉพาะช่วงบรรทัด (Line Range) ที่เกี่ยวข้องกับ Task เท่านั้น (เช่น อ่านแค่บรรทัดที่ 40-70)

2. การแก้ไขโค้ด (Surgical Edits):
   - แก้ไขเฉพาะบรรทัด หรือเฉพาะฟังก์ชันที่มีปัญหาเท่านั้น
   - ห้ามเขียนไฟล์ใหม่ทั้งหมด หรือส่งคืนโค้ดส่วนที่ไม่เกี่ยวข้อง
   - ใช้รูปแบบ Search & Replace หรือ Git Diff ในการแก้ไข เพื่อลด Token ในการตอบกลับ

3. ป้องกันการเดา/มั่ว (Strict Grounding & Zero Hallucination):
   - ห้ามเดาชื่อฟังก์ชัน, Variable, Import หรือ API เอาเองโดยไม่ตรวจเช็กในโค้ดจริง
   - หากข้อมูลที่มีอยู่ไม่เพียงพอ ให้ระบุชื่อไฟล์/ช่วงบรรทัดที่ต้องการดูเพิ่มอย่างกระชับ ห้ามสุ่มเขียนโค้ดเพื่อเดาทางเด็ดขาด

4. สื่อสารสั้นกระชับ (Token-Efficient Output):
   - งดคำอารัมภบท คำทักทาย หรือการอธิบายยาวเกินจำเป็น
   - ให้ผลลัพธ์เป็น: [สาเหตุย่อๆ] -> [จุดที่แก้] -> [Diff/Code Snippet] เท่านั้น
   
สถานะโครงการ: อยู่ในกระบวนการวิเคราะห์ ออกแบบ และพัฒนา (พ.ย. 2568 – ต.ค. 2569)

ฐานข้อมูลหลักคำศัพท์: คลังคำศัพท์ Oxford 3000 (เน้นกรองเฉพาะระดับ A1 และ A2)

แนวคิดหลัก: ปราศจากข้อจำกัดด้านพลังงาน (No Energy Limit) และใช้งานฟรี 100% เพื่อลดความเหลื่อมล้ำทางดิจิทัล

สถาปัตยกรรมทางเทคโนโลยี (MALL): React Native (Expo Go), Node.js, Firebase (Auth & Cloud Firestore), Web Speech API

---

## 1. ขอบเขตระบบและสิทธิ์การใช้งาน (System Scope & Roles)

ระบบถูกแบ่งออกเป็น 3 บทบาทหลักตามความต้องการของระบบ (System Requirements):

### 1.1 ผู้ใช้งานทั่วไป (Guest)
- สมัครสมาชิกด้วย: Username, Email, Password
- เข้าสู่ระบบ (Login) ด้วย Email และ Password
- กู้คืน/รีเซ็ตรหัสผ่านใหม่ (Forgot Password) ผ่านระบบ OTP ทางอีเมล

### 1.2 สมาชิก (Member)
- เข้าใช้งานบทเรียนระดับพื้นฐาน (Beginner A1-A2 จาก Oxford 3000)
- เลือกทำแบบฝึกหัดได้ 3 หมวดหมู่หลัก ได้แก่ หมวดคำศัพท์, หมวด Tense, และหมวดการฟังและอ่าน Tense
- มีระบบบันทึกคลังคำศัพท์โปรดส่วนตัว (Favorite Vocabulary) เพื่อดึงคำศัพท์ Oxford มาทบทวนซ้ำ
- ดูสถิติ คะแนน ความคืบหน้า และประวัติการทำแบบฝึกหัดย้อนหลัง

### 1.3 ผู้ดูแลระบบ (Admin)
- เข้าสู่ระบบด้วยสิทธิ์ที่กำหนดไว้เฉพาะ (Admin_Name, Password)
- Oxford 3000 Inventory Management: จัดการคลังคำศัพท์หลัก (เพิ่ม/แก้ไข/ลบ คำศัพท์และคำแปลภาษาไทย รวมถึงระบุระดับ CEFR Level เช่น A1, A2)
- Content Management: เพิ่ม/แก้ไข/ลบ โจทย์ในหมวดคำศัพท์ (ที่ผูกกับ Oxford 3000), Tense, และบทสนทนา
- System Configuration: กำหนดคำตอบที่ถูกต้อง และตั้งค่าเสียงสังเคราะห์เริ่มต้น (ชาย/หญิง)
- User Management: ตรวจสอบรายชื่อสมาชิก, แก้ไข/ลบข้อมูลผู้ใช้งาน และดูรายงานสถิติภาพรวม

---

## 2. โครงสร้างฐานข้อมูล (Database Schema & Dictionary)

ระบบเลือกใช้ NoSQL (Cloud Firestore) ร่วมกับ Firebase Authentication ในการจัดเก็บข้อมูลโดยปรับปรุงโครงสร้างเพื่อรองรับข้อมูลจำเพาะของ Oxford 3000:

### 2.1 โครงสร้างตาราง/คอลเลกชัน (Schema)

```
[Member] ──(1:N)──> [Statistics] <──(N:1)── [Exercise] <──(N:1)── [Admin]
   │                                            │
   └──────(1:N)──> [Favorite_Vocab] <──(N:1)────┘ [Vocabulary (Oxford 3000 Mapping)]
```

### 2.2 พจนานุกรมข้อมูล (Data Dictionary)

**Member (ตารางจัดเก็บข้อมูลสมาชิก)**
- Email (VARCHAR/VARCHAR(100), PK) - อีเมลผู้ใช้งาน
- Username (VARCHAR(50)) - ชื่อผู้ใช้งาน
- Password (VARCHAR(255)) - รหัสผ่าน (Encrypted)

**Admin (ตารางสิทธิ์ผู้ดูแลระบบ)**
- Admin_Name (VARCHAR(50), PK) - ชื่อบัญชีผู้ดูแลระบบ
- Password (VARCHAR(255)) - รหัสผ่านสำหรับผู้ดูแลระบบ

**Vocabulary (ตารางคลังคำศัพท์หลัก Oxford 3000)**
- Word_ID (INT, PK) - รหัสคำศัพท์
- Word_EN (VARCHAR(100)) - คำศัพท์ภาษาอังกฤษ (อิงจาก Oxford 3000)
- Word_TH (VARCHAR(100)) - คำแปลภาษาไทย
- CEFR_Level (VARCHAR(10)) - ระดับคำศัพท์เจาะจงเฉพาะ (A1 หรือ A2) เท่านั้น
- Part_of_Speech (VARCHAR(20)) - ประเภทของคำ (เช่น noun, verb, adjective)
- TTS_Voice (TEXT) - ข้อมูลเสียงสังเคราะห์

**Exercise (ตารางโจทย์แบบฝึกหัด)**
- Ex_ID (INT, PK) - รหัสแบบฝึกหัด
- Vocab_Exercise (VARCHAR(255)) - ตัวเลือกสุ่ม/ข้อมูลหมวดคำศัพท์
- Tense_Exercise (VARCHAR(255)) - ระบุประเภท Tense (Present, Past, Future)
- Listening_Reading_Tense (VARCHAR(255)) - ข้อมูลบทสนทนา
- Question (TEXT) - เนื้อหาโจทย์
- Correct_Answer (TEXT) - คำตอบที่ถูกต้อง
- TTS_System (VARCHAR(50)) - ตั้งค่าระบบเสียง (ชาย/หญิง)
- Word_ID (INT, FK -> Vocabulary) - เชื่อมโยงไอดีเพื่อดึงคำศัพท์ Oxford 3000 มาสร้างโจทย์
- Admin_Name (VARCHAR(50), FK -> Admin)

**Statistics (ตารางบันทึกคะแนนและสถิติ)**
- Stat_ID (INT, PK) - รหัสบันทึกสถิติ
- Email (VARCHAR(50), FK -> Member)
- Ex_ID (INT, FK -> Exercise)
- Score (INT) - คะแนนที่ได้
- Time_Spent (INT) - เวลาที่ใช้ทำ (วินาที)
- Pass_Status (VARCHAR(20)) - สถานะการผ่าน (เกณฑ์ ≥ 80%)

**Favorite_Vocab (รายการคำศัพท์โปรดส่วนบุคคล)**
- Email (VARCHAR(100), PK, FK -> Member)
- Word_ID (INT, PK, FK -> Vocabulary)

---

## 3. ลำดับขั้นตอนการทำงานของแอปพลิเคชัน (Step-by-Step Application Flow)

### 3.1 ระบบการจัดการสมาชิก (Process 1.0)

**สมัครสมาชิก (Process 1.1):** ผู้ใช้ทั่วไปกรอกข้อมูล -> ระบบบันทึกเข้าฐานข้อมูล D1 Member

**เข้าสู่ระบบ (Process 1.2):** ตรวจสอบอีเมล/รหัสผ่านกับฐานข้อมูล -> เปลี่ยนสถานะเป็น "สมาชิก" และเข้าสู่หน้าหลัก

**กู้คืนรหัสผ่าน (Process 1.3):** สมาชิกกรอกอีเมล -> ระบบส่ง OTP -> สมาชิกยืนยัน OTP -> ตั้งรหัสผ่านใหม่ลงฐานข้อมูล

### 3.2 ระบบแบบฝึกหัดและการประมวลผล (Process 2.0)

แอปพลิเคชันมีกลไกสำคัญคือ "ระบบสุ่มรูปแบบการฝึก (Random Exercise Loop)" และ "ระบบดึงคลังคำศัพท์ตามระดับความยาก (CEFR Filter API)" โดยมีสเต็ปการทำงานดังนี้:

**สเต็ปที่ 1: เลือกหมวดหมู่บทเรียนและระดับ (Process 2.1)**
สมาชิกเลือกเรียนจาก 3 หมวดหมู่หลัก โดยระบบจะฟิลเตอร์ดึงข้อมูลเฉพาะคำศัพท์ที่อยู่ในตระกูล Oxford 3000 ที่กำหนดค่า CEFR_Level เป็น A1 หรือ A2 มาจากคอลเลกชัน D2 Exercise และ Vocabulary

**สเต็ปที่ 2: ดำเนินการทำแบบฝึกหัด (Process 2.2)**
ใน 1 ชุดแบบฝึกหัดจะมีโจทย์ 10-15 ข้อ และระบบจะทำการ สุ่มสลับรูปแบบด่าน อัตโนมัติ:

**หมวดคำศัพท์ (Oxford 3000 Based):** สุ่มสลับ 4 รูปแบบด่าน
- จับคู่คำศัพท์ (Matching): เลือกคำศัพท์ Oxford ภาษาอังกฤษให้ตรงกับคำแปลภาษาไทย
- สะกดคำศัพท์ (Spelling): พิมพ์สะกดคำศัพท์ภาษาอังกฤษระดับ A1-A2 ให้ถูกต้องตามคำแปล
- เติมประโยคในช่องว่าง (Fill in the Blank): เลือกคำศัพท์ Oxford เติมลงในช่องว่างของประโยคตัวอย่าง
- ฟังเสียงและพูดตาม (Pronunciation): ระบบใช้ Web Speech API (TTS) เล่นเสียงคำศัพท์อังกฤษ และใช้ Speech Recognition รับเสียงพูดเพื่อประเมินความถูกต้อง (ผู้ใช้กดข้ามด่านนี้ได้หากไม่สะดวกพูด)

**หมวด Tense (Present, Past, Future):** สุ่มสลับ 3 รูปแบบด่าน โดยใช้คำกริยาและคำนามพื้นฐานจาก Oxford 3000
- เรียงประโยค Tense (Sentence Ordering): จัดเรียงลำดับคำในประโยคให้ถูกต้องตามหลักไวยากรณ์
- เติมคำในช่องว่าง: เลือกโครงสร้างกริยา/คำศัพท์ให้ตรงตาม Tense
- ฟัง Tense และพูดตาม: ฝึกออกเสียงประโยคโครงสร้างไวยากรณ์ (กดข้ามได้)

**หมวดการฟังและการอ่าน Tense:**
- ระบบเล่นเสียงจำลองบทสนทนาโต้ตอบที่สร้างจากคำศัพท์ Oxford 3000 -> สมาชิกอ่านประโยค -> ตอบคำถาม Multiple Choice ท้ายบทสนทนา

**ลอจิกการตรวจคำตอบ (Immediate Feedback Logic)**
- ตอบถูกในครั้งแรก: ได้คะแนน -> ระบบแสดงปุ่ม "ด่านถัดไป"
- ตอบผิดครั้งที่ 1: ระบบแจ้งเตือน "ลองอีกครั้ง" (ยังไม่ได้คะแนน และให้โอกาสตอบใหม่)
- ตอบผิดครั้งที่ 2 (ผิดซ้ำ): ระบบจะ เฉลยคำตอบที่ถูกต้องทันที -> หักคะแนนในข้อนั้น -> แสดงปุ่มให้ผู้ใช้กดสุ่มไปด่านถัดไป

**สเต็ปที่ 3: ประมวลผลและบันทึกสถิติ (Process 2.3)**
เมื่อทำครบถ้วน ระบบจะคำนวณคะแนนรวมและเวลาที่ใช้
เกณฑ์การผ่าน (Pass Criterion): ต้องได้คะแนน ร้อยละ 80 ขึ้นไป (≥ 80%) เพื่อบันทึกสถานะ "Pass" ลงใน D3 Statistics

**สเต็ปที่ 4: การจัดการคลังคำศัพท์ส่วนตัว (Process 2.4)**
ระหว่างเรียน สมาชิกสามารถกดไอคอนหัวใจเพื่อบันทึกคำศัพท์ Oxford 3000 ที่สนใจลงรายการโปรด (Favorite_Vocab) เพื่อแยกไว้ทบทวนต่างหากได้

### 3.4 โมดูลของผู้ดูแลระบบ (Admin Module Flow)

Admin ทำงานผ่าน Admin Dashboard เพื่อควบคุมระบบทั้งหมด:

**การจัดการคลังข้อมูล Oxford 3000:**
สามารถ Import หรือกรอกคำศัพท์ Oxford 3000 เพิ่มเติม ระบุระดับคลาส A1/A2 เพื่อเป็นคลังวัตถุดิบหลักในการทำโจทย์

**การจัดการแบบฝึกหัด:**
สร้างโจทย์โดยเลือกผูกข้อคำถามเข้ากับ Word_ID ของ Oxford 3000 เพื่อทำระบบตัดคะแนนและเชื่อมโยงข้อมูลสถิติ

**การตรวจสอบรายงาน:**
เรียกดูรายงานคะแนน เวลาที่ใช้ และประเมินผลสัมฤทธิ์ทางการเรียนของสมาชิกแต่ละคนเพื่อนำไปพัฒนาระบบคลังคำศัพท์ต่อไป

---

## 4. สรุปความคืบหน้าด้านเทคนิค (Technical Implementation Summary)

**Database Query Optimization:** มีการจัดการ Composite Index บน Cloud Firestore เรียบร้อยแล้ว (สำหรับคอลเลกชัน exercises และ statistics) ทำให้รองรับการ Query ข้อมูลแบบกรองเงื่อนไขและจัดเรียงเวลาพร้อมกันได้อย่างเสถียร ไม่เกิดข้อผิดพลาดจากตัวระบบคลาวด์อีกต่อไป

---

## 5. สถานะการพัฒนาปัจจุบัน (Development Status)

### สรุปภาพรวม

| หมวด | สถานะ | ความคืบหน้า |
|------|--------|-------------|
| โครงสร้างโปรเจกต์ & Backend | ✅ เสร็จ | 100% |
| Authentication | ✅ เสร็จ | 100% |
| Navigation & UI หลัก | ✅ เสร็จ | 100% |
| Firestore Service Layer | ✅ เสร็จ | 100% |
| Seed ข้อมูล Oxford 3000 | ✅ เสร็จ | 100% |
| หน้ารายการแบบฝึกหัด | ✅ เสร็จ | 100% |
| เชื่อม HomeScreen | ✅ เสร็จ | 100% |
| หน้าทำแบบฝึกหัด (Vocab / Tense / Listening) | ✅ เสร็จ | 100% |
| เชื่อม StatsScreen | ✅ เสร็จ | 100% |
| TTS (Text-to-Speech) | ✅ เสร็จ | 100% |
| ฟีเจอร์เสริม (คลังคำศัพท์, คำโปรด) | ✅ เสร็จ | 100% |

**ความคืบหน้ารวมโดยประมาณ: ~75%**

---

## 6. Flow ของแอป

```
Login/Register
    ↓
HomeScreen ──(กดหมวดหมู่)──→ ExerciseListScreen
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
            VocabExercise    TenseExercise   ListeningExercise
                    ↓               ↓               ↓
                    └───────────────┴───────────────┘
                                    ↓
                          บันทึก statistics → Firestore
                                    ↓
                          StatsScreen / HomeScreen อัปเดต
```

---

## 7. ขั้นตอนการพัฒนาที่เสร็จสมบูรณ์ (Completed Development Steps)

### ส่วนที่ 1 — โครงสร้างพื้นฐาน ✅ เสร็จ

| # | ขั้นตอน | สถานะ | ไฟล์ที่เกี่ยวข้อง |
|---|---------|--------|-------------------|
| 1.1 | ตั้งค่าโปรเจกต์ Expo (React Native) | ✅ เสร็จ | `frontend/package.json`, `frontend/App.js` |
| 1.2 | ตั้งค่า Firebase (Auth + Firestore) | ✅ เสร็จ | `frontend/firebase.js` |
| 1.3 | สร้าง Express Backend | ✅ เสร็จ | `backend/server.js` |
| 1.4 | API ส่ง OTP ทางอีเมล (Gmail SMTP) | ✅ เสร็จ | `backend/server.js` → `POST /api/send-otp` |
| 1.5 | API ยืนยัน OTP + Custom Token | ✅ เสร็จ | `backend/server.js` → `POST /api/verify-otp` |
| 1.6 | กำหนด Firestore Security Rules | ✅ เสร็จ | `frontend/firestore.rules.txt` |
| 1.7 | Seed ข้อมูล Oxford 3000 + แบบฝึกหัด | ✅ เสร็จ | `backend/seed.js`, `frontend/scripts/seedFirestore.js` |

**ข้อมูลที่ seed แล้ว:**
- คำศัพท์ 350 คำ (A1: 100, A2: 100, B1: 80, B2: 70)
- ชุดแบบฝึก Vocab 35 ชุด (10 คำ/ชุด)
- ชุดแบบฝึก Tense 3 ชุด (5 ข้อ/ชุด)
- ชุดแบบฝึก Listening 3 ชุด (3 คำถาม/ชุด)

---

### ส่วนที่ 2 — Authentication ✅ เสร็จ

| # | ขั้นตอน | สถานะ | ไฟล์ที่เกี่ยวข้อง |
|---|---------|--------|-------------------|
| 2.1 | หน้า Login (อีเมล + รหัสผ่าน) | ✅ เสร็จ | `frontend/screens/LoginScreen.js` |
| 2.2 | หน้า Register (สมัครสมาชิก) | ✅ เสร็จ | `frontend/screens/RegisterScreen.js` |
| 2.3 | หน้า Forgot Password (OTP 3 ขั้นตอน) | ✅ เสร็จ | `frontend/screens/ForgotPasswordScreen.js` |
| 2.4 | Auth State → สลับหน้าอัตโนมัติ | ✅ เสร็จ | `frontend/App.js` (`onAuthStateChanged`) |

---

### ส่วนที่ 3 — Navigation & UI หลัก ✅ เสร็จ

| # | ขั้นตอน | สถานะ | ไฟล์ที่เกี่ยวข้อง |
|---|---------|--------|-------------------|
| 3.1 | Auth Stack Navigator | ✅ เสร็จ | `frontend/App.js` |
| 3.2 | Bottom Tab Navigator (หน้าหลัก / สถิติ / โปรไฟล์) | ✅ เสร็จ | `frontend/App.js` |
| 3.3 | Main Stack Navigator (Tab + Exercise screens) | ✅ เสร็จ | `frontend/App.js` |
| 3.4 | หน้า HomeScreen (UI + เชื่อม Firestore + navigation) | ✅ เสร็จ | `frontend/screens/HomeScreen.js` |
| 3.5 | หน้า ProfileScreen (แสดงโปรไฟล์ + ออกจากระบบ) | ✅ เสร็จ | `frontend/screens/ProfileScreen.js` |
| 3.6 | หน้า StatsScreen (UI เท่านั้น) | 🟡 บางส่วน | `frontend/screens/StatsScreen.js` |
| 3.7 | หน้า DevScreen (Seed จากแอป) | 🟡 บางส่วน | `frontend/screens/DevScreen.js` (ยังไม่ได้ใส่ใน navigation) |

---

### ส่วนที่ 4 — Firestore Service Layer ✅ เสร็จ

| # | ขั้นตอน | สถานะ | ไฟล์ที่เกี่ยวข้อง |
|---|---------|--------|-------------------|
| 4.1 | ดึงคำศัพท์ (`getAllVocabulary`, `getVocabById`) | ✅ เสร็จ | `frontend/services/firestoreService.js` |
| 4.2 | ดึงแบบฝึกหัด (`getExercisesByCategory`, `getExerciseById`) | ✅ เสร็จ | `frontend/services/firestoreService.js` |
| 4.3 | บันทึก/ดึงสถิติ (`saveStatistic`, `getUserStatistics`) | ✅ เสร็จ | `frontend/services/firestoreService.js` |
| 4.4 | คำนวณ progress (`getUserProgressMap`, `getCategoryProgress`) | ✅ เสร็จ | `frontend/services/firestoreService.js` |
| 4.5 | คำศัพท์โปรด (`addFavoriteVocab`, `removeFavoriteVocab`, ...) | ✅ เสร็จ | `frontend/services/firestoreService.js` |

---

### ส่วนที่ 5 — หน้ารายการแบบฝึกหัด ✅ เสร็จ

| # | ขั้นตอน | สถานะ | ไฟล์ที่เกี่ยวข้อง |
|---|---------|--------|-------------------|
| 5.1 | หน้า ExerciseListScreen | ✅ เสร็จ | `frontend/screens/ExerciseListScreen.js` |
| 5.2 | แสดงรายการแบบฝึกตามหมวด (vocab / tense / listening) | ✅ เสร็จ | `ExerciseListScreen.js` |
| 5.3 | ค้นหาแบบฝึกหัด | ✅ เสร็จ | `ExerciseListScreen.js` |
| 5.4 | Filter ระดับ A1–B2 (vocab) | ✅ เสร็จ | `ExerciseListScreen.js` |
| 5.5 | แสดง progress bar + สถานะผ่าน/ไม่ผ่าน | ✅ เสร็จ | `ExerciseListScreen.js` |
| 5.6 | Pull-to-refresh | ✅ เสร็จ | `ExerciseListScreen.js` |

---

### ส่วนที่ 6 — เชื่อม HomeScreen ✅ เสร็จ

| # | ขั้นตอน | สถานะ | รายละเอียด |
|---|---------|--------|------------|
| 6.1 | กดหมวดหมู่ → navigate ไป ExerciseList | ✅ เสร็จ | `navigation.navigate('ExerciseList', { category })` |
| 6.2 | แสดงค่า stats จริงจาก Firestore | ✅ เสร็จ | ใช้ `stats.done`, `stats.pct`, `stats.vocabCount` + loading indicator |

---

### ส่วนที่ 7 — หน้าทำแบบฝึกหัด ✅ เสร็จ

| # | ขั้นตอน | สถานะ | รายละเอียด |
|---|---------|--------|------------|
| 7.1 | สร้าง VocabExerciseScreen | ✅ เสร็จ | `frontend/screens/VocabExerciseScreen.js` |
| 7.2 | └ รูปแบบจับคู่ (EN ↔ TH) | ✅ เสร็จ | ข้อ 1–3 ของแต่ละชุด |
| 7.3 | └ รูปแบบสะกด (พิมพ์คำศัพท์) | ✅ เสร็จ | ข้อ 4–6 ของแต่ละชุด |
| 7.4 | └ รูปแบบเติมช่องว่าง (เลือกคำ) | ✅ เสร็จ | ข้อ 7–10 ของแต่ละชุด |
| 7.5 | └ หน้าสรุปผล + บันทึก `saveStatistic` | ✅ เสร็จ | เกณฑ์ผ่าน 80% |
| 7.6 | สร้าง TenseExerciseScreen | ✅ เสร็จ | `frontend/screens/TenseExerciseScreen.js` |
| 7.7 | └ รูปแบบเลือกคำตอบ (multiple choice) | ✅ เสร็จ | ใช้ `choices` + `answer` |
| 7.8 | └ รูปแบบเรียงคำ (word ordering) | ✅ เสร็จ | ใช้ `orderWords` |
| 7.9 | └ หน้าสรุปผล + บันทึก `saveStatistic` | ✅ เสร็จ | เกณฑ์ผ่าน 80% |
| 7.10 | สร้าง ListeningExerciseScreen | ✅ เสร็จ | `frontend/screens/ListeningExerciseScreen.js` |
| 7.11 | └ Phase 1: แสดงบทสนทนา (dialogue bubbles) | ✅ เสร็จ | ใช้ `dialogue[]` |
| 7.12 | └ Phase 2: ตอบคำถาม comprehension | ✅ เสร็จ | ใช้ `questions[]` |
| 7.13 | └ หน้าสรุปผล + บันทึก `saveStatistic` | ✅ เสร็จ | เกณฑ์ผ่าน 80% |
| 7.14 | อัปเดต App.js ให้ใช้ screen จริง | ✅ เสร็จ | แทน placeholder ใน `MainStack` |

---

### ส่วนที่ 8 — เชื่อม StatsScreen ⬜ ยังไม่เสร็จ

| # | ขั้นตอน | สถานะ | รายละเอียด |
|---|---------|--------|------------|
| 8.1 | ดึงข้อมูลจาก `getUserStatistics` | ✅ เสร็จ | useFocusEffect + auth.currentUser.email |
| 8.2 | คำนวณคะแนนสูงสุด | ✅ เสร็จ | `Math.max(...percentages)` |
| 8.3 | คำนวณเวลาที่ใช้รวม | ✅ เสร็จ | `sum(timeSpent)` แสดงเป็น m/s |
| 8.4 | นับจำนวนชุดที่ผ่านเกณฑ์ | ✅ เสร็จ | `filter(passed).length` |
| 8.5 | แสดง progress แต่ละหมวด | ✅ เสร็จ | `getCategoryProgress` × 3 หมวด (Promise.all) |
| 8.6 | Reload เมื่อเปิดแท็บ (`useFocusEffect`) | ✅ เสร็จ | cleanup active flag กัน memory leak |

> **หมายเหตุ:** ควรทำหลังขั้นที่ 7 เพื่อให้มีข้อมูล statistics ใน Firestore ก่อน

---

### ส่วนที่ 9 — TTS (Text-to-Speech) ⬜ ยังไม่เสร็จ

| # | ขั้นตอน | สถานะ | รายละเอียด |
|---|---------|--------|------------|
| 9.1 | ติดตั้ง `expo-speech` | ✅ เสร็จ | ติดตั้งแล้วใน package.json |
| 9.2 | สร้าง `services/ttsService.js` | ✅ เสร็จ | `speakEnglish()`, `stopSpeaking()`, rate=0.85 |
| 9.3 | ปุ่ม 🔊 ใน VocabExercise | ✅ เสร็จ | matching icon + spelling TouchableOpacity + speak round handlePlay |
| 9.4 | ปุ่ม 🔊 ใน TenseExercise | ✅ เสร็จ | exampleEN ทั้ง fill-blank และ word-order round |
| 9.5 | เล่นบทสนทนาใน ListeningExercise | ✅ เสร็จ | ปุ่ม 🔊 ใน DialogueBubble แต่ละบรรทัด |
| 9.6 | ปุ่มเลือกความเร็วเสียง TTS | ✅ เสร็จ | `components/SpeechSpeedToggle.js` — แสดง 0.5x / 1.0x / 1.5x แตะสลับได้ |
| 9.7 | Global speed state + persist | ✅ เสร็จ | `ttsService.js` (SPEED_PRESETS, setSpeechSpeed, cycleSpeechSpeed, loadSpeechSpeed) + AsyncStorage key `@app:tts_speed` |
| 9.8 | Hook `hooks/useSpeechRate.js` | ✅ เสร็จ | อ่าน/สลับความเร็วพร้อม re-render ผ่าน pub/sub ใน ttsService |
| 9.9 | ใส่ปุ่มความเร็วใน 3 หมวดแบบฝึกหัด | ✅ เสร็จ | VocabExercise + TenseExercise + ListeningExercise (ทั้ง 2 phase) — rate ส่งเข้า Speech.speak ทุกจุด |
| 9.10 | Unit/property tests | ✅ เสร็จ | `__tests__/speechRate.test.js` (jest + fast-check, 22 tests pass) |
| 9.11 | ปรับความเร็ว TTS เป็น 0.5 / 1.0 / 1.5 | ✅ เสร็จ | `SPEED_PRESETS` ใหม่ (default = 1.0) + อัปเดต `speechRate.test.js` |
| 9.12 | กติกาปุ่มข้าม/ถัดไป + คะแนน | ✅ เสร็จ | ทั้ง 3 หมวด: ถูก→ถัดไปอย่างเดียว (คะแนนเต็ม), ผิดครั้งแรก→แสดงปุ่มข้าม (ลองใหม่/ข้าม), ผิดครั้งที่ 2→0 คะแนน + ถัดไปอย่างเดียว |
| 9.13 | ลบปุ่ม "ข้าม" จากด่านที่ไม่ใช่การพูด | ✅ เสร็จ | เหลือ "ข้ามด่านนี้" เฉพาะ SpeakingStage — Spelling/FillBlank/Tense/Listening: ถูก→ถัดไป, ผิดครั้งแรก→ลองใหม่ (ไม่มีปุ่ม), ผิดครั้งที่ 2→เฉลย + ถัดไป |
| 9.14 | แก้ไข 1st-attempt ไม่เฉลย (FillBlank) | ✅ เสร็จ | `isCorrect` เปลี่ยนจาก `status !== 'idle'` เป็น `correct/revealed` เท่านั้น + feedback "ไม่ถูกต้อง ลองใหม่อีกครั้ง" + ตัวเลือกยังกดได้ |
| 9.15 | Refactor Tense: 2-attempt + confirm + TTS | ✅ เสร็จ | MCQ เลือกก่อนกด "ตอบ", ผิดครั้งแรกแสดง feedback ไม่เฉลย, TTS อ่านคำตอนกดเลือก/อ่านประโยคเต็มตอนถูก |
| 9.16 | ปุ่มฟังเสียงซ้ำหลังตอบถูก (Tense) | ✅ เสร็จ | แสดง "ฟังอีกครั้ง" ใกล้ประโยคเต็มทั้ง MCQ และ WordOrdering — กดซ้ำได้ไม่จำกัด |
| 9.17 | ยืนยันการออกจากแบบฝึกหัด (Tense) | ✅ เสร็จ | `navigation.addListener('beforeRemove')` ดัก back/ฮาร์ดแวร์/swipe → Alert ยกเลิก/ออก |

---

### ส่วนที่ 10 — ฟีเจอร์เสริม ⬜ ยังไม่เสร็จ

| # | ขั้นตอน | สถานะ | รายละเอียด |
|---|---------|--------|------------|
| 10.1 | หน้าคลังคำศัพท์ | ✅ เสร็จ | สร้าง VocabLibraryScreen.js (FlatList + ปุ่ม 🔊 + ลบ) |
| 10.2 | ปุ่มเพิ่มคำโปรดใน VocabExercise | ✅ เสร็จ | ❤️ ใน SpellingStage + SpeakingStage → addFavoriteVocab |
| 10.3 | หน้ารายการคำโปรด | ✅ เสร็จ | รวมอยู่ใน VocabLibraryScreen (getFavoriteVocab + removeFavoriteVocab) |
| 10.4 | เชื่อม DevScreen เข้า navigation | ✅ เสร็จ | เพิ่ม VocabLibrary ใน App.js + ProfileScreen navigate ได้ |

---

## 8. ลำดับที่แนะนำในการพัฒนาต่อ

```
[เสร็จแล้ว] 7.1–7.14 หน้าทำแบบฝึกหัดทั้ง 3 หมวด (Vocab / Tense / Listening)
         ↓
[ถัดไป]  8. เชื่อม StatsScreen         ← ตอนนี้มีข้อมูล statistics แล้ว
         ↓
         9. TTS (Text-to-Speech)         ← เพิ่มปุ่มเล่นเสียงในแบบฝึกหัด
         ↓
         10. ฟีเจอร์เสริม               ← คลังคำศัพท์, คำโปรด
```

---

## 9. โครงสร้างไฟล์

```
my-eng/
├── PROGRESS.md                          ← ไฟล์นี้
├── backend/
│   ├── server.js                        ✅ OTP + Firebase Admin
│   ├── seed.js                          ✅ Oxford 3000 + exercises
│   └── package.json
└── frontend/
    ├── App.js                           ✅ Navigation หลัก + Exercise screens
    ├── firebase.js                      ✅ Firebase config
    ├── firestore.rules.txt              ✅ Security rules (บันทึกไว้)
    ├── services/
    │   └── firestoreService.js          ✅ CRUD ครบ
    ├── screens/
    │   ├── LoginScreen.js               ✅
    │   ├── RegisterScreen.js            ✅
    │   ├── ForgotPasswordScreen.js      ✅
    │   ├── HomeScreen.js                ✅
    │   ├── ExerciseListScreen.js        ✅
    │   ├── StatsScreen.js               🟡 UI only
    │   ├── ProfileScreen.js             🟡 menu TODO
    │   ├── DevScreen.js                 🟡 ไม่ได้เชื่อม nav
    │   ├── VocabExerciseScreen.js       ✅ 3 modes: matching, spelling, fill-blank
    │   ├── TenseExerciseScreen.js       ✅ 2 modes: multiple choice, word ordering
    │   └── ListeningExerciseScreen.js   ✅ 2 phases: dialogue + questions
    ├── components/
    │   └── Logo.js                      ✅
    └── scripts/
        └── seedFirestore.js             ✅
```

**สัญลักษณ์:** ✅ เสร็จ | 🟡 บางส่วน | ⬜ ยังไม่เสร็จ

---

## 10. บันทึกการอัปเดต

| วันที่ | รายการ |
|--------|--------|
| 2026-07-12 | สร้างไฟล์ PROGRESS.md — สรุปสถานะโปรเจกต์ครั้งแรก |
| 2026-07-12 | ✅ ขั้นที่ 6 เสร็จ — เชื่อม HomeScreen (navigation + stats จาก Firestore) |
| 2026-07-12 | ✅ ขั้นที่ 7 เสร็จ — หน้าทำแบบฝึกหัดทั้ง 3 หมวด (Vocab/Tense/Listening) + เชื่อม App.js |
| 2026-07-12 | ✅ ขั้นที่ 8 เสร็จ — เชื่อม StatsScreen (getUserStatistics, getCategoryProgress, useFocusEffect) |
| 2026-08-07 | ✅ ขั้นที่ 9 เสร็จ — TTS: สร้าง ttsService.js + เพิ่มปุ่ม 🔊 ใน Vocab/Tense/Listening |
| 2026-08-07 | ✅ ขั้นที่ 10 เสร็จ — คลังคำศัพท์/คำโปรด: VocabLibraryScreen + ❤️ ใน VocabExercise + ProfileScreen navigate |
| 2026-08-07 | ✅ แก้ VocabExercise — Matching TH↔EN+เสียง, Spelling เฉลยตอบผิดครั้งที่2+เสียง, FillBlank stage ใหม่, Speaking Web Speech API, สุ่ม stage, max 15 ข้อ |
