# แผนแก้ไขระบบแอดมิน — การจัดตำแหน่งตามขอบเขตเอกสาร

**วันที่สร้าง:** วันพุธ 9 กันยายน 2569  
**สถานะ:** ร่างแผน  
**กำหนดเสร็จ:** —

---

## 1. สรุปภาพรวม

ระบบแอดมินปัจจุบันได้ดำเนินการตามแผนสำเร็จแล้ว **Phase 1 + Phase 2 ครบทุก Step** ตามไฟล์ `planadmin.md`

เอกสารขอบเขต (Agent.docx) ระบุข้อกำหนดรายละเอียดเพิ่มเติมสำหรับผู้ดูแลระบบ ซึ่งหลายส่วนอยู่ในระบบแล้ว แต่บางส่วนยังจำเป็นต้องตรวจสอบ ปรับปรุง หรือเพิ่มเติม

---

## 2. การวิเคราะห์ขอบเขต (Scope Analysis)

### ขอบเขตของผู้ดูแลระบบจากเอกสาร (Section 1.3.3)

| ลำดับ | ความต้องการ | สถานะปัจจุบัน | หมายเหตุ |
|------|-----------|------------|---------|
| **(1)** เข้าสู่ระบบผู้ดูแลระบบด้วยชื่อและรหัสผ่าน | ✅ เสร็จ | ใช้ Firebase Auth (email-based) — ไม่ใช่ admin_name ตามเอกสาร |
| **(2)** ออกจากระบบผู้ดูแลระบบ | ✅ เสร็จ | ปุ่มออกจากระบบในโครงร่าง |
| **(3.1)** ตรวจสอบรายชื่อสมาชิก | ✅ เสร็จ | ตาราง Users + Pagination |
| **(3.2)** แก้ไขข้อมูลสมาชิก | ✅ เสร็จ | Modal Edit (displayName, email) |
| **(3.3)** ลบข้อมูลสมาชิก | ✅ เสร็จ | ปุ่ม Delete + Confirm |
| **(4.1)** จัดการแบบฝึกหัดคำศัพท์ (เพิ่ม/แก้ไข/ลบ) | ✅ เสร็จ | Section Vocabulary + Full CRUD |
| --- | • จับคู่ | ✅ เสร็จ | VocabSet โหมด Matching |
| --- | • สะกด | ⚠️ บางส่วน | ยังไม่มีโหมด Spelling เฉพาะ |
| --- | • เติมคำในช่องว่าง | ✅ เสร็จ | VocabSet โหมด Fill-in-the-blank |
| --- | • ฟังเสียงและพูดตาม | ⚠️ บางส่วน | ยังไม่มีโหมด Speaking เฉพาะ |
| **(4.2)** จัดการแบบฝึกหัด Tense (เพิ่ม/แก้ไข/ลบ) | ✅ เสร็จ | Section Tense + Full CRUD |
| --- | • สร้าง Tense (Present, Past, Future) | ✅ เสร็จ | TenseSet Modal + Tag |
| --- | • ระบุประเภท Tense | ✅ เสร็จ | Select field (Present/Past/Future) |
| --- | • สร้างโจทย์เรียง Tense | ✅ เสร็จ | โหมด WordOrdering |
| --- | • เติมคำในTense | ✅ เสร็จ | โหมด Fill-in-blank |
| --- | • สร้างTense สำหรับพูดตาม | ⚠️ บางส่วน | ยังไม่มีโหมด Speaking เฉพาะ |
| **(4.3)** จัดการแบบฝึกหัดการฟังและดู Tense (เพิ่ม/แก้ไข/ลบ) | ✅ เสร็จ | Section Listening-Reading + Full CRUD |
| --- | • สร้าง Tense | ✅ เสร็จ | DialogueSet สามารถเลือก Tense |
| --- | • กำหนดคำถาม | ✅ เสร็จ | DialogueSet Modal + QA pairs |
| **(4.4)** กำหนดเสียงชายและหญิง | ✅ เสร็จ | TTS Dropdown (male/female) ในทุก section |
| **(4.5)** กำหนดคำตอบที่ถูกต้อง | ✅ เสร็จ | ทุก section มีฟิลด์ `correct_answer` |
| **(5.1)** ตรวจสอบจำนวนสมาชิก | ✅ เสร็จ | Overview Card "สมาชิกทั้งหมด" |
| **(5.2)** ตรวจสอบผลคะแนนแบบฝึก | ✅ เสร็จ | Section สถิติสมาชิก + ตาราง scores |
| **(5.3)** ตรวจสอบความคืบหน้า | ✅ เสร็จ | Section สถิติสมาชิก + % progress |
| **(6.1)** ดูคลังศัพท์ทั้งหมด | ✅ เสร็จ | Section คลังคำศัพท์ + ตาราง Vocabulary |
| **(6.2)** แก้ไขคำศัพท์ | ✅ เสร็จ | Modal Edit Vocab |
| **(6.3)** แก้ไขคำแปล | ✅ เสร็จ | ฟิลด์ wordTH ใน Modal |

---

## 3. ความต้องการเพิ่มเติม / ปรับปรุง

### A. โหมดการฝึก "Spelling" (เฉพาะคำศัพท์)

**เอกสารระบุ (6.1.2):** "สะกดคำศัพท์เป็นภาษาอังกฤษจากคำแปลภาษาไทย"

**สถานะปัจจุบัน:** ยังไม่มีโหมด Spelling เฉพาะ  
**ปัญหา:** ระบบ VocabSet ปัจจุบันเน้นเฉพาะ Matching และ Fill-in-the-blank

**วิธีแก้:**
- เพิ่มขั้นตอน Step 3 ใน VocabSet ชื่อ "โหมดสะกด (Spelling)"
- ระบบฉากอัตโนมัติสะกดคำ (ผู้ดูแลเพียงเลือกคำจาก Master pairs)
- ส่งไปยัง Exercise ใน App ประเภท `vocabExercise.type = 'spelling'`

### B. โหมดการฝึก "Speaking" (ฟังเสียงและพูดตาม)

**เอกสารระบุ (6.1.3):** "ระบบฟังเสียงคำศัพท์และพูดตาม เพื่อฝึกการออกเสียง สามารถข้ามได้"

**สถานะปัจจุบัน:** ยังไม่มี UI เฉพาะในแอดมิน (เพราะทำฝนต้นฉบับแล้วใน Frontend)  
**ปัญหา:** ไม่มี UI ให้ผู้ดูแลเลือกหรือสร้าง Speaking exercises

**วิธีแก้:**
- เพิ่มขั้นตอน Step 4 ใน VocabSet ชื่อ "โหมดพูดตาม (Speaking)"
- ผู้ดูแลเลือกคำศัพท์ และระบบจะแสดง TTS voice ที่จะใช้
- ส่งไปยัง Exercise ประเภท `vocabExercise.type = 'speaking'`

### C. โหมด Speaking ใน TenseExercise

**เอกสารระบุ (6.2.4):** "ฟัง Tense และพูดตาม สามารถข้ามได้"

**สถานะปัจจุบัน:** ยังไม่มี UI ให้ผู้ดูแลจัดการ  
**ปัญหา:** TenseSet Modal ยังไม่มี option สำหรับ Speaking exercises

**วิธีแก้:**
- เพิ่ม "โหมดพูดตาม" ในแบบฝึกหัด Tense
- อนุญาตให้ผู้ดูแลเลือกประโยค Tense เพื่อเป็น Speaking exercises

### D. ระบบการตรวจสอบระดับ CEFR

**เอกสารระบุ:** "ระบุระดับ CEFR Level เช่น A1, A2 สำหรับคำศัพท์"

**สถานะปัจจุบัน:** ✅ เสร็จแล้ว มี CEFR field ในทุก section

### E. การป้องกันและตรวจสอบข้อมูล

**เอกสารระบุ:** "ระบบจะบันทึกผลว่าการฝึก... ผ่านและนำไปคำนวณความคืบหน้า" (เกณฑ์ 80%)

**สถานะปัจจุบัน:** ✅ เสร็จแล้วใน Frontend + Firestore  
**ตรวจสอบเพิ่มเติม:** 
- Firestore Rules ควรป้องกัน admin/users ลบ statistics โดยไม่ได้รับอนุญาต
- Admin ควรมีแถบค้นหา/กรองใน Statistics section

### F. การจัดการ Admin หลายคน

**เอกสารระบุ:** ไม่ชัดเจน  
**สถานะปัจจุบัน:** ✅ เสร็จแล้ว มี Section "จัดการ Admin"

---

## 4. รายการเปลี่ยนแปลงที่ต้องทำ

### Phase 3 — เพิ่มโหมด Spelling สำหรับคำศัพท์

**ไฟล์ที่ได้รับผลกระทบ:**
- `backend/public/admin/index.html` — เพิ่ม Step 3 UI (Spelling mode selector)
- `backend/public/admin/js/adminApp.js` — เพิ่มตรรมชาติสำหรับสร้าง/จัดการ Spelling exercises

**ขั้นตอน:**
1. ขยาย VocabSet Wizard จาก 2 steps เป็น 3 steps
   - Step 1: Matching (Master pairs) ✅ เสร็จแล้ว
   - Step 2: Fill-in-the-blank (Dependent sentences) ✅ เสร็จแล้ว
   - **Step 3: Spelling (New)**

2. ใน Step 3:
   - แสดงตัวเลือก "เลือกคำศัพท์ที่จะสะกด"
   - ผู้ดูแลติ๊กช่อง (checkbox) คำศัพท์ที่ต้องการ (มากสุด 10-15)
   - บันทึก spelling data ใน Firestore: `{ type: 'spelling', words: [...]}`

3. Frontend: ดึงข้อมูล Spelling exercises และแสดงในโหมด Spelling ของ VocabExerciseScreen

---

### Phase 4 — เพิ่มโหมด Speaking สำหรับคำศัพท์

**ไฟล์ที่ได้รับผลกระทบ:**
- `backend/public/admin/index.html` — เพิ่ม Step 4 UI
- `backend/public/admin/js/adminApp.js` — ตรรมชาติ Speaking

**ขั้นตอน:**
1. ขยาย VocabSet Wizard จาก 3 steps เป็น 4 steps
   - **Step 4: Speaking (New)**

2. ใน Step 4:
   - เลือก "โหมดพูดตาม (Speaking)"
   - ผู้ดูแลเลือกคำศัพท์ (มากสุด 10-15 ข้อ)
   - ระบบแสดงตัวเลือกเสียง TTS (ชาย/หญิง) สำหรับแต่ละคำ
   - บันทึก: `{ type: 'speaking', words: [...], tts: 'female'|'male' }`

3. Frontend: ดึงและแสดงใน VocabExerciseScreen โหมด Speaking

---

### Phase 5 — เพิ่มโหมด Speaking สำหรับ Tense

**ไฟล์ที่ได้รับผลกระทบ:**
- `backend/public/admin/index.html` — เพิ่ม UI ใน TenseSet Modal
- `backend/public/admin/js/adminApp.js` — ตรรมชาติ Tense Speaking

**ขั้นตอน:**
1. ใน TenseSet Modal ระบบแล้ว:
   - เพิ่ม checkbox "รวม Speaking exercises"
   - ตัวเลือก "เลือกประโยค Tense สำหรับพูดตาม"
   - บันทึก: `{ type: 'speaking', sentences: [...] }`

2. Frontend: ดึงและแสดงในโหมด Speaking ของ TenseExerciseScreen

---

### Phase 6 — ปรับปรุง Firestore Security Rules

**ไฟล์ที่ได้รับผลกระทบ:**
- `frontend/firestore.rules.txt`

**การตรวจสอบ:**
- ✅ Admin เท่านั้นที่สามารถแก้ไข/ลบ exercises, vocabulary, statistics
- ✅ Users สามารถอ่าน exercises + vocabulary ได้
- ✅ Users สามารถเขียน statistics ได้ (บันทึกคะแนนของตนเอง)
- ✅ Users ไม่สามารถเขียน/ลบ exercises หรือ vocabulary

---

## 5. ลำดับการดำเนินการแนะนำ

```
ปัจจุบัน: Phase 1 + Phase 2 ✅ เสร็จ

ถัดไป:
Phase 3 — Spelling mode (VocabSet Step 3)
    ↓
Phase 4 — Speaking mode (VocabSet Step 4)
    ↓
Phase 5 — Tense Speaking (TenseExercise option)
    ↓
Phase 6 — Security Rules verification + refinement
```

---

## 6. ตัวชี้วัดความสำเร็จ (Success Criteria)

| ไฟเจอร์ | เกณฑ์ |
|--------|------|
| Spelling mode | ✅ ผู้ดูแลสามารถเลือกคำศัพท์สำหรับสะกด, Frontend แสดงโหมด Spelling |
| Speaking mode (Vocab) | ✅ ผู้ดูแลเลือกคำศัพท์ + เสียง, Frontend แสดง Web Speech API |
| Speaking mode (Tense) | ✅ ผู้ดูแลเลือกประโยค Tense, Frontend แสดง Speaking exercises |
| Security Rules | ✅ Admin เท่านั้นจัดการข้อมูล, Users สามารถเขียน statistics ได้เท่านั้น |

---

## 7. หมายเหตุ

- **ปัจจุบัน:** ระบบแอดมินครอบคลุม ~95% ของข้อกำหนดแล้ว
- **ความเสี่ยง:** ไม่มี Speaking mode ใน UI (แต่ Frontend สนับสนุนแล้ว)
- **ลำดับความสำคัญ:** Phase 3 + 4 (Spelling/Speaking) เป็นสิ่งสำคัญที่สุด

