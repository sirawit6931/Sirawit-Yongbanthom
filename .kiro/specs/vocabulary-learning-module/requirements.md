# Requirements Document

## Introduction

โมดูลฝึกคำศัพท์เป็นส่วนหลักของแอปพลิเคชันฝึกภาษาอังกฤษสำหรับผู้เริ่มต้น (ระดับ A1–A2) สร้างบน React Native (Expo) และ Firebase Firestore โมดูลนี้ดำเนินการ 4 ด่านต่อเนื่องใน 1 session โดยมีกฎเหล็กว่า **Matching ต้องเป็นด่านแรกเสมอ** และ 3 ด่านที่เหลือ (Spelling, Fill in the Blanks, Pronunciation) จะถูกสุ่มลำดับใหม่ทุก session

### บริบทปัญหาเดิม

ฟังก์ชัน `shuffleStages()` ปัจจุบันสุ่ม matching รวมกับ stage อื่น ซึ่ง **ผิดกฎ** และไม่มีการสุ่ม 3 stages กลางอย่างถูกต้อง ต้องปรับใหม่ให้ได้ลำดับ:

```
[matching] → [shuffle(spelling, fillblank, pronunciation)]
```

---

## Glossary

- **VocabExercise_Screen**: หน้าจอหลักของโมดูลฝึกคำศัพท์ (`VocabExerciseScreen.js`) ที่ควบคุม session flow
- **Session**: รอบการทำแบบฝึกหัด 1 ครั้ง ประกอบด้วย 4 ด่านต่อเนื่อง
- **Stage**: ด่านฝึกทักษะ 1 ประเภท ได้แก่ Matching, Spelling, FillBlank, Pronunciation
- **Stage_Sequencer**: ตรรกะที่กำหนดลำดับ stage ใน session (matching fixed-first + สุ่ม 3 ที่เหลือ)
- **Matching_Stage**: ด่านจับคู่คำศัพท์ภาษาอังกฤษกับคำแปลภาษาไทย — **ต้องเป็น stage[0] เสมอ**
- **Spelling_Stage**: ด่านพิมพ์สะกดคำศัพท์ภาษาอังกฤษจากคำแปลไทยที่โจทย์ให้
- **FillBlank_Stage**: ด่านเลือกคำหรือโครงสร้างไวยากรณ์เติมในช่องว่างของประโยค
- **Pronunciation_Stage**: ด่านฟังเสียง native audio แล้วพูดออกเสียงเพื่อให้ AI ประเมิน (ข้ามได้)
- **Score_Tracker**: กลไกนับและรวมคะแนนจากทุก stage ใน session
- **Firestore_Service**: เซอร์วิสชั้น Firestore (`firestoreService.js`) ที่ใช้บันทึก/อ่านข้อมูล
- **TTS_Service**: เซอร์วิสเล่นเสียงภาษาอังกฤษ (`ttsService.js`) ผ่าน `speakEnglish()`
- **Speech_Recognizer**: Web Speech API (`SpeechRecognition`) ที่รับเสียงพูดของผู้ใช้เพื่อประเมินการออกเสียง
- **Pass_Criterion**: เกณฑ์ผ่าน session ที่คะแนนรวม ≥ 80% จากคะแนนรวมของ Matching + Spelling + FillBlank
- **ExerciseItem**: อ็อบเจกต์ข้อมูลคำศัพท์ 1 คำ มี fields: `wordId`, `wordEN`, `wordTH`, `sentence`, `sentenceTH`, `distractors[]`
- **Distractor**: ตัวเลือกหลอกที่ใช้ใน FillBlank_Stage
- **Attempt**: จำนวนครั้งที่ผู้ใช้พยายามตอบในข้อเดิม (สูงสุด 2 ครั้งก่อนเฉลย)

---

## Requirements

---

### ข้อกำหนดที่ 1: การกำหนดลำดับ Stage ใน Session (Stage Sequencing)

**User Story:** ในฐานะผู้เรียน ฉันต้องการเริ่ม session ด้วยการจับคู่คำศัพท์ก่อนเสมอ เพื่อสร้าง recognition พื้นฐานก่อนทำด่านที่ยากขึ้น

#### เกณฑ์การยอมรับ (Acceptance Criteria)

1. THE Stage_Sequencer SHALL คืนค่าอาร์เรย์ที่มีความยาวเท่ากับ 4 เสมอ โดยมี stage ครบทั้ง 4 ประเภท ('matching', 'spelling', 'fillblank', 'pronunciation') ไม่มีซ้ำและไม่มีขาด

2. WHEN Stage_Sequencer ถูกเรียก, THE Stage_Sequencer SHALL สุ่มลำดับของ 'spelling', 'fillblank' และ 'pronunciation' โดยไม่รวม 'matching' เข้าไปในกระบวนการสุ่ม และวาง 'matching' ที่ index[0] ของอาร์เรย์ผลลัพธ์เสมอ

3. WHEN Stage_Sequencer ถูกเรียก, THE Stage_Sequencer SHALL คืนค่าอาร์เรย์ที่มี index[0] เป็น 'matching' โดยสามารถตรวจสอบได้จาก `result[0] === 'matching'`

4. WHEN Stage_Sequencer ถูกเรียก 600 ครั้งขึ้นไป, THE Stage_Sequencer SHALL ผลิต permutation ของ 3 stages กลาง ('spelling', 'fillblank', 'pronunciation') ได้ครบทั้ง 6 แบบ (3! = 6) โดยแต่ละแบบปรากฏอย่างน้อย 1 ครั้ง และไม่มี permutation ใดถูกล็อกไว้เสมอ

> **หมายเหตุสำหรับการทดสอบ:**
> - ข้อ 1–3 เป็น Invariant: ต้องถือจริงสำหรับทุก invocation — เหมาะสำหรับ property-based testing
> - ข้อ 4 เป็น Metamorphic property: ตรวจสอบความถูกต้องของ randomness และ completeness

---

### ข้อกำหนดที่ 2: Matching Stage — จับคู่คำศัพท์

**User Story:** ในฐานะผู้เรียน ฉันต้องการจับคู่คำศัพท์ภาษาอังกฤษกับคำแปลภาษาไทยเพื่อสร้างความจำขั้นต้น

#### เกณฑ์การยอมรับ

1. WHEN Matching_Stage เปิดขึ้น, THE Matching_Stage SHALL แสดงคอลัมน์ซ้ายเป็น wordEN ในลำดับเดิม และคอลัมน์ขวาเป็น wordTH ในลำดับสุ่มที่แตกต่างจากคอลัมน์ซ้าย ยกเว้นกรณีที่มีคำเพียง 1 คำ (n=1) ซึ่งคอลัมน์ขวามีเพียง 1 รายการเช่นกัน

2. WHEN ผู้ใช้เลือกคำจากทั้งสองคอลัมน์แล้วคู่ถูกต้อง, THE Matching_Stage SHALL เปลี่ยนสถานะของทั้งสองปุ่มเป็น "ถูกต้อง" (ไฮไลต์สีเขียว ไม่สามารถกดซ้ำได้) และเล่นเสียง wordEN ผ่าน TTS_Service

3. WHEN ผู้ใช้เลือกคำจากทั้งสองคอลัมน์แล้วคู่ผิด, THE Matching_Stage SHALL แสดงไฮไลต์สีแดงบนทั้งสองปุ่มเป็นเวลา 800 มิลลิวินาที แล้วคืนทั้งสองปุ่มกลับสู่สถานะว่าง (ไม่มีไฮไลต์ กดได้ใหม่) โดยที่การเลือกค้างไว้ทั้งหมดถูกล้างออก

4. THE Matching_Stage SHALL ไม่อนุญาตให้ผู้ใช้กดคำที่จับคู่ถูกต้องไปแล้ว (สถานะ "ถูกต้อง")

5. WHEN ผู้ใช้จับคู่ถูกต้องครบทุกคำ, THE Matching_Stage SHALL ส่งสัญญาณ `onComplete(n, n)` โดย n คือจำนวนคำทั้งหมดใน stage ภายใน 400 มิลลิวินาทีหลังจับคู่คู่สุดท้ายถูกต้อง

6. WHEN ผู้ใช้กดปุ่มลำโพง (🔊) บนคำในคอลัมน์ซ้าย, THE Matching_Stage SHALL เล่นเสียง wordEN ของคำนั้นผ่าน TTS_Service โดยรักษา state การเลือกปัจจุบันไว้ไม่เปลี่ยนแปลง

7. THE Matching_Stage SHALL ไม่นับคะแนนหักสำหรับการจับคู่ผิด ผู้ใช้สามารถลองซ้ำได้ไม่จำกัดครั้งจนกว่าจะถูกต้องครบทุกคู่ และ `onComplete` จะส่ง score = total เสมอ

8. THE Matching_Stage SHALL รองรับชุดคำศัพท์ขนาด 1 ถึง 15 คำ โดยส่งสัญญาณ `onComplete(n, n)` ที่ถูกต้องสำหรับทุกขนาด n ในช่วงนั้น

> **หมายเหตุสำหรับการทดสอบ:**
> - ข้อ 2, 3, 7, 8 เป็น Invariant — เหมาะสำหรับ property-based testing
> - ข้อ 5 ทดสอบได้ด้วย example test (ตรวจ onComplete callback และ timing)
> - ข้อ 4 เป็น edge case ที่ต้องทดสอบแยก

---

### ข้อกำหนดที่ 3: Spelling Stage — สะกดคำศัพท์

**User Story:** ในฐานะผู้เรียน ฉันต้องการฝึกพิมพ์สะกดคำศัพท์ภาษาอังกฤษจากคำแปลไทย เพื่อฝึกความจำในการเขียน

#### เกณฑ์การยอมรับ

1. WHEN Spelling_Stage แสดงคำแต่ละคำ, THE Spelling_Stage SHALL แสดง wordTH ของคำปัจจุบัน ช่องพิมพ์ข้อความที่ว่างเปล่า และปุ่ม "ตรวจคำตอบ"

2. WHEN ผู้ใช้กดปุ่ม "ตรวจคำตอบ" และคำที่พิมพ์ตรงกับ wordEN หลัง trim และเปรียบเทียบแบบ case-insensitive, THE Spelling_Stage SHALL บันทึก 1 คะแนนสำหรับคำนั้น เล่นเสียง wordEN ผ่าน TTS_Service และเลื่อนไปคำถัดไปโดยอัตโนมัติภายใน 1,200 มิลลิวินาที

3. IF Spelling_Stage อยู่ในสถานะ attempts = 2 และผู้ใช้กดปุ่ม "ตรวจคำตอบ" พร้อมคำตอบที่ไม่ตรง, THE Spelling_Stage SHALL แสดงตัวบ่งชี้ข้อผิดพลาด (error indicator) ลด attempts เหลือ 1 และไม่บันทึกคะแนน

4. IF Spelling_Stage อยู่ในสถานะ attempts = 1 และผู้ใช้กดปุ่ม "ตรวจคำตอบ" พร้อมคำตอบที่ไม่ตรง, THE Spelling_Stage SHALL แสดง wordEN ที่ถูกต้องเป็นเฉลย และเลื่อนไปคำถัดไปโดยไม่บันทึกคะแนนภายใน 2,500 มิลลิวินาที

5. WHEN ผู้ใช้กดปุ่ม "ตรวจคำตอบ" โดยที่ช่องพิมพ์ว่างเปล่า, THE Spelling_Stage SHALL ไม่ตรวจคำตอบและไม่เปลี่ยน state (ถือว่าผู้ใช้ยังไม่ได้ตอบ)

6. WHEN Spelling_Stage ผ่านคำสุดท้ายแล้ว, THE Spelling_Stage SHALL ส่งสัญญาณ `onComplete(score, words.length)` โดยที่ score คือจำนวนคำที่ตอบถูกในครั้งแรก

7. THE Spelling_Stage SHALL ตรวจสอบคำตอบโดย trim whitespace หัว-ท้าย และเปรียบเทียบแบบ case-insensitive เสมอ และ score สุดท้ายต้องอยู่ในช่วง 0 ≤ score ≤ words.length

> **หมายเหตุสำหรับการทดสอบ:**
> - ข้อ 7 เป็น Invariant — เหมาะสำหรับ property-based testing
> - ข้อ 3–4 ทดสอบ state machine transition ด้วย example test
> - ข้อ 5 เป็น edge case ป้องกัน empty submission

---

### ข้อกำหนดที่ 4: Fill in the Blanks Stage — เติมคำในช่องว่าง

**User Story:** ในฐานะผู้เรียน ฉันต้องการเลือกคำที่ถูกต้องเพื่อเติมในช่องว่างของประโยค เพื่อฝึกการใช้คำศัพท์ในบริบท

#### เกณฑ์การยอมรับ

1. WHEN FillBlank_Stage แสดงโจทย์แต่ละข้อ, THE FillBlank_Stage SHALL แสดงประโยค (sentence) โดยแทนที่ wordEN ด้วย "______" พร้อมตัวเลือก choices ที่ประกอบด้วย wordEN (ถูกต้อง 1 รายการ) และ distractors สูงสุด 2 รายการ โดยแต่ละข้อสุ่มลำดับ choices ใหม่อิสระจากข้ออื่น

2. WHEN ผู้ใช้เลือกตัวเลือกที่ถูกต้อง, THE FillBlank_Stage SHALL บันทึก 1 คะแนน เปลี่ยนสถานะปุ่มที่เลือกเป็นไฮไลต์สีเขียว เล่นเสียง wordEN ผ่าน TTS_Service และเลื่อนไปคำถัดไปภายใน 1,200 มิลลิวินาที

3. IF FillBlank_Stage อยู่ในสถานะ attempts = 2 และผู้ใช้เลือกตัวเลือกที่ผิด, THE FillBlank_Stage SHALL แสดงไฮไลต์สีแดงบนปุ่มที่เลือกเป็นเวลา 800 มิลลิวินาที แล้วคืนทุกปุ่มกลับสู่สถานะว่าง ลด attempts เหลือ 1 โดยไม่บันทึกคะแนน

4. IF FillBlank_Stage อยู่ในสถานะ attempts = 1 และผู้ใช้เลือกตัวเลือกที่ผิด, THE FillBlank_Stage SHALL แสดงเฉลยที่ถูกต้อง (wordEN) และเลื่อนไปคำถัดไปโดยไม่บันทึกคะแนน ภายใน 2,500 มิลลิวินาที

5. THE FillBlank_Stage SHALL แสดงตัวเลือกที่ประกอบด้วย wordEN ที่ถูกต้องอย่างน้อย 1 รายการเสมอ และตัวเลือกทั้งหมดต้องมาจากข้อมูล ExerciseItem ของข้อนั้นเท่านั้น (ไม่นำ wordEN จากข้ออื่นมาปน)

6. THE FillBlank_Stage SHALL สุ่มลำดับ choices ของแต่ละข้อแบบอิสระ โดย wordEN จะไม่ถูกจัดวางที่ตำแหน่งเดิมทุกข้อ (ป้องกันการจดจำตำแหน่ง)

7. WHEN FillBlank_Stage ผ่านคำสุดท้าย, THE FillBlank_Stage SHALL ส่งสัญญาณ `onComplete(score, words.length)` โดยที่ score ≤ words.length

8. IF ExerciseItem มี distractors เป็น array ว่าง (`[]`), THEN THE FillBlank_Stage SHALL แสดงตัวเลือกที่มี wordEN เพียงรายการเดียว และยังสามารถดำเนินการต่อไปได้โดยไม่ crash

> **หมายเหตุสำหรับการทดสอบ:**
> - ข้อ 5, 6 เป็น Invariant — เหมาะสำหรับ property-based testing
> - ข้อ 8 เป็น edge case ที่ต้องทดสอบด้วย example test

---

### ข้อกำหนดที่ 5: Pronunciation Stage — ออกเสียงและประเมินผล

**User Story:** ในฐานะผู้เรียน ฉันต้องการฟังเสียงต้นแบบและฝึกพูดออกเสียง เพื่อพัฒนาทักษะการออกเสียงภาษาอังกฤษ

#### เกณฑ์การยอมรับ

1. WHEN Pronunciation_Stage แสดงคำปัจจุบัน, THE Pronunciation_Stage SHALL แสดง wordEN และ wordTH พร้อมปุ่ม "กดฟัง & พูดตาม" และปุ่ม "ข้ามด่านนี้" ที่กดได้ตั้งแต่เปิด stage

2. WHEN ผู้ใช้กดปุ่ม "กดฟัง & พูดตาม", THE Pronunciation_Stage SHALL เล่นเสียง wordEN ผ่าน TTS_Service ก่อน แล้วเริ่มรับเสียงผู้ใช้ผ่าน Speech_Recognizer ภายหลัง 1,500 มิลลิวินาที

3. WHEN Speech_Recognizer ส่งผลลัพธ์และ transcript ใด ๆ ใน alternatives มีความสัมพันธ์แบบ substring กับ wordEN (transcript.includes(target) หรือ target.includes(transcript) โดย case-insensitive), THE Pronunciation_Stage SHALL แสดงสถานะ "ถูกต้อง" (ไฮไลต์สีเขียว) พร้อมข้อความที่ประเมินได้ และแสดงปุ่ม "ถัดไป"

4. WHEN Speech_Recognizer ส่งผลลัพธ์และไม่มี transcript ใดผ่านเงื่อนไข substring match, THE Pronunciation_Stage SHALL แสดงสถานะ "ลองอีกครั้ง" (ไฮไลต์สีแดง) พร้อมข้อความที่ประเมินได้ และแสดงปุ่ม "ถัดไป"

5. IF Speech_Recognizer ไม่รองรับบน platform ปัจจุบัน (SpeechRecognition = undefined) หรือเกิด error 'not-allowed', THEN THE Pronunciation_Stage SHALL แสดงข้อความแจ้งว่าไม่รองรับ และปุ่ม "ข้ามด่านนี้" ต้องยังคงใช้งานได้

6. THE Pronunciation_Stage SHALL มีปุ่ม "ข้ามด่านนี้" ที่ใช้งานได้ตลอดเวลาใน stage โดยไม่ขึ้นกับผลการประเมินหรือ recStatus

7. WHEN ผู้ใช้กดปุ่ม "ข้ามด่านนี้" หรือ "ถัดไป" และมีคำถัดไปในชุด, THE Pronunciation_Stage SHALL เลื่อนไปคำถัดไปและหยุด Speech_Recognizer ที่กำลังทำงานอยู่ (ถ้ามี)

8. WHEN ผู้ใช้กดปุ่ม "ข้ามด่านนี้" หรือ "ถัดไป" และเป็นคำสุดท้าย, THE Pronunciation_Stage SHALL ส่งสัญญาณ `onComplete(0, 0)` เพื่อไม่นำคะแนนจาก stage นี้ไปรวมคำนวณเกณฑ์ผ่าน

9. WHILE Pronunciation_Stage กำลังรับเสียง (recStatus = 'listening'), THE Pronunciation_Stage SHALL ปิดใช้งาน (disable) ปุ่ม "กดฟัง & พูดตาม" เพื่อป้องกันการกดซ้ำ

10. WHEN Speech_Recognizer ไม่ได้รับเสียงภายใน timeout ที่กำหนด (rec.onend ถูกเรียกขณะ recStatus ยังเป็น 'listening'), THE Pronunciation_Stage SHALL เปลี่ยน recStatus เป็น 'wrong' และแสดงปุ่ม "ถัดไป"

> **หมายเหตุสำหรับการทดสอบ:**
> - ข้อ 6, 8 เป็น Invariant
> - ข้อ 5 เป็น error condition / edge case ที่ต้องทดสอบแยก
> - ข้อ 3 ระบุ partial match algorithm ที่ testable

---

### ข้อกำหนดที่ 6: การนับคะแนนและการบันทึกสถิติ (Score Tracking & Statistics)

**User Story:** ในฐานะผู้เรียน ฉันต้องการทราบคะแนนรวมหลังทำแบบฝึกหัดครบ และมีสถิติเก็บไว้ดูภายหลัง

#### เกณฑ์การยอมรับ

1. THE Score_Tracker SHALL รวบรวมคะแนนจากทุก stage ที่นับคะแนน (Matching, Spelling, FillBlank) และคำนวณ `percentage = (totalScore / totalQuestions) * 100` โดยหาก totalQuestions = 0 ให้ percentage = 0 (ป้องกัน division by zero)

2. THE Score_Tracker SHALL ไม่รวม score และ total จาก Pronunciation_Stage (ซึ่งส่งค่า 0, 0) เข้าไปในการคำนวณ percentage

3. WHEN Session สิ้นสุดครบทุก stage, THE VocabExercise_Screen SHALL บันทึกสถิติผ่าน `saveStatistic(email, exerciseId, { score: totalScore, totalQuestions, timeSpent, category })` ใน Firestore_Service โดย timeSpent เป็นหน่วยวินาที (integer) และหาก saveStatistic ล้มเหลว ให้ log error แต่ยังแสดง ResultScreen ต่อไป

4. IF คะแนนรวม ≥ 80% ของคะแนนทั้งหมด, THEN THE VocabExercise_Screen SHALL แสดงสถานะ "ผ่านเกณฑ์ 80%" บนหน้าสรุปผล

5. IF คะแนนรวม < 80% ของคะแนนทั้งหมด, THEN THE VocabExercise_Screen SHALL แสดงสถานะ "ยังไม่ผ่าน (ต้อง 80%)" บนหน้าสรุปผล

6. THE Score_Tracker SHALL คำนวณ `percentage` ให้อยู่ในช่วง 0 ≤ percentage ≤ 100 เสมอสำหรับทุก session ที่สิ้นสุด

7. THE Score_Tracker SHALL คำนวณให้ `totalScore ≤ totalQuestions` เสมอสำหรับทุก session ที่สิ้นสุด

> **หมายเหตุสำหรับการทดสอบ:**
> - ข้อ 6, 7 เป็น Invariant — เหมาะสำหรับ property-based testing
> - ข้อ 4, 5 ทดสอบด้วย example test (boundary value ที่ 80% และ 79%)
> - ข้อ 1 (zero guard) เป็น edge case ที่ต้องทดสอบแยก

---

### ข้อกำหนดที่ 7: การโหลดข้อมูลและจัดเตรียม ExerciseItem

**User Story:** ในฐานะผู้เรียน ฉันต้องการให้ระบบโหลดคำศัพท์ได้อย่างถูกต้องและพร้อมใช้งานก่อนเริ่มทำแบบฝึกหัด

#### เกณฑ์การยอมรับ

1. WHEN VocabExercise_Screen เริ่มต้น, THE VocabExercise_Screen SHALL ดึงข้อมูลจาก `exercise.items` (ถ้ามี) หรือ `exercise.questions` (fallback) และ normalize แต่ละรายการเป็น ExerciseItem ตาม field mapping: `wordId ← item.wordId ?? item.id ?? String(Math.random())`, `wordEN ← item.wordEN ?? item.word ?? ''`, `wordTH ← item.wordTH ?? item.translation ?? ''`, `sentence ← item.sentence ?? ''`, `sentenceTH ← item.sentenceTH ?? ''`, `distractors ← item.distractors ?? []`

2. THE VocabExercise_Screen SHALL กรองเฉพาะ ExerciseItem ที่มีทั้ง `wordEN` และ `wordTH` ที่ไม่เป็น null, undefined หรือ string ที่มีแต่ whitespace ก่อนส่งไปยัง stage ใดๆ

3. THE VocabExercise_Screen SHALL จำกัดจำนวน ExerciseItem ที่ผ่านการกรองสูงสุดที่ 15 รายการต่อ session (ใช้ `.slice(0, 15)`)

4. WHEN VocabExercise_Screen กำลังโหลดข้อมูล, THE VocabExercise_Screen SHALL แสดง ActivityIndicator และซ่อน stage content จนกว่าการโหลดจะเสร็จสมบูรณ์

5. IF รายการ ExerciseItem หลังกรองมีจำนวน 0 รายการ, THEN THE VocabExercise_Screen SHALL แสดงข้อความแจ้งให้ผู้ใช้ทราบว่าไม่มีคำศัพท์สำหรับฝึกใน session นี้

6. WHEN VocabExercise_Screen normalize ExerciseItem ที่มี wordId ซ้ำกันในชุดเดียว, THE VocabExercise_Screen SHALL กำหนด fallback id ที่ไม่ซ้ำกัน (เช่น เพิ่ม suffix index) เพื่อให้ Matching_Stage ทำงานได้ถูกต้อง

7. IF `exercise.items` และ `exercise.questions` ทั้งคู่เป็น null, undefined หรือ array ว่าง, THEN THE VocabExercise_Screen SHALL แสดงข้อความแจ้งว่าไม่มีคำศัพท์ โดยไม่ crash

---

### ข้อกำหนดที่ 8: Session Timer และการออกจาก Session

**User Story:** ในฐานะผู้เรียน ฉันต้องการเห็นเวลาที่ใช้ไปตลอด session และสามารถออกได้หากต้องการ

#### เกณฑ์การยอมรับ

1. WHEN VocabExercise_Screen เสร็จสิ้นการโหลดข้อมูลและเริ่มแสดง stage แรก, THE VocabExercise_Screen SHALL เริ่มนับเวลาและแสดง timer ในรูปแบบ `MM:SS` บน header

2. WHILE Session กำลังดำเนินการ (ระหว่างที่โหลดเสร็จจนถึง ResultScreen), THE VocabExercise_Screen SHALL อัปเดต timer ทุก 1,000 มิลลิวินาที

3. WHEN Session สิ้นสุด (ผู้ใช้ทำครบทุก stage), THE VocabExercise_Screen SHALL หยุด timer และส่งค่า timeSpent เป็นจำนวนวินาที (integer) ไปใช้ใน saveStatistic

4. WHEN ผู้ใช้กดปุ่มปิด (X) ระหว่าง session, THE VocabExercise_Screen SHALL แสดง confirmation dialog ที่มีข้อความ "ออก? ความคืบหน้าจะไม่ถูกบันทึก" พร้อมตัวเลือก "ทำต่อ" และ "ออก"

5. WHEN ผู้ใช้เลือก "ออก" ใน confirmation dialog, THE VocabExercise_Screen SHALL navigate กลับโดยไม่เรียก saveStatistic และไม่บันทึกสถิติใด ๆ

6. THE VocabExercise_Screen SHALL หยุด timer interval (clearInterval) เมื่อ component ถูก unmount ไม่ว่าจะจาก session สิ้นสุดหรือผู้ใช้กดออก เพื่อป้องกัน memory leak

---

### ข้อกำหนดที่ 9: การแสดงผล Progress Bar และ Stage Navigation

**User Story:** ในฐานะผู้เรียน ฉันต้องการเห็นความคืบหน้าของ session เพื่อรู้ว่าเหลือด่านอีกเท่าไร

#### เกณฑ์การยอมรับ

1. WHILE Session กำลังดำเนินการ (หลังโหลดเสร็จจนถึงก่อน ResultScreen), THE VocabExercise_Screen SHALL แสดง progress bar บน header ที่มีความกว้างสัดส่วนกับจำนวน stage ที่ทำเสร็จแล้วหารด้วยจำนวน stage ทั้งหมด

2. WHEN stage ปัจจุบันเปลี่ยน, THE VocabExercise_Screen SHALL อัปเดต stage label บน header ให้ตรงกับ stage ปัจจุบัน ตามการ mapping: 'matching' → 'จับคู่', 'spelling' → 'สะกดคำ', 'fillblank' → 'เติมช่องว่าง', 'pronunciation' → 'พูดตาม'

3. IF ผู้ใช้ทำครบทุก stage แล้ว (stageIdx ≥ stages.length), THEN THE VocabExercise_Screen SHALL แสดง ResultScreen แทน stage content

4. THE VocabExercise_Screen SHALL แสดง progress bar ที่มีค่าเพิ่มขึ้นเป็น monotonically increasing ตลอด session สำหรับทุก session ที่มี stages ครบ 4 ด่าน โดยเริ่มต้นที่ 0% และสิ้นสุดที่ 100% หลัง stage สุดท้ายเสร็จ

---

### ข้อกำหนดที่ 10: หน้าสรุปผล (Result Screen)

**User Story:** ในฐานะผู้เรียน ฉันต้องการดูสรุปคะแนนและเวลาที่ใช้หลังทำแบบฝึกหัดเสร็จ

#### เกณฑ์การยอมรับ

1. WHEN ResultScreen แสดง, THE ResultScreen SHALL แสดงข้อมูลครบ: คะแนนรวม (scored/total), เปอร์เซ็นต์ (pct%), เวลาที่ใช้ (MM:SS), และสถานะผ่าน (≥80%) หรือไม่ผ่าน (<80%)

2. WHEN ผู้ใช้กดปุ่ม "กลับรายการแบบฝึกหัด", THE ResultScreen SHALL navigate กลับไปหน้าก่อนหน้า (ExerciseListScreen)

3. WHEN ผู้ใช้กดปุ่ม "ดูสถิติ", THE ResultScreen SHALL navigate ไปหน้า StatsScreen

4. THE ResultScreen SHALL แสดงไอคอน trophy (🏆) สีทอง (#FFD700) ทุกครั้งที่ ResultScreen แสดง ไม่ว่าผลจะผ่านหรือไม่ผ่าน

---

### ข้อกำหนดที่ 11: การบันทึกคำศัพท์โปรด (Favorite Vocabulary)

**User Story:** ในฐานะผู้เรียน ฉันต้องการบันทึกคำศัพท์ที่สนใจลงรายการโปรดระหว่างทำแบบฝึกหัด เพื่อทบทวนภายหลัง

#### เกณฑ์การยอมรับ

1. WHEN ผู้ใช้กดไอคอนหัวใจ (❤️) ใน Spelling_Stage, FillBlank_Stage หรือ Pronunciation_Stage, THE VocabExercise_Screen SHALL บันทึก ExerciseItem ปัจจุบันลงใน Firestore_Service ผ่าน `addFavoriteVocab(email, { id: word.wordId, wordEN: word.wordEN, wordTH: word.wordTH })`

2. WHEN บันทึกคำโปรดสำเร็จ, THE VocabExercise_Screen SHALL แสดง Alert "บันทึกแล้ว — [wordEN] อยู่ในคลังโปรดแล้ว"

3. IF การบันทึกคำโปรดล้มเหลว (Firestore error), THEN THE VocabExercise_Screen SHALL แสดง Alert แจ้งข้อผิดพลาด "ผิดพลาด — ไม่สามารถบันทึกได้"

4. IF ผู้ใช้ยังไม่ได้ login (auth.currentUser เป็น null หรือ undefined), THEN THE VocabExercise_Screen SHALL ไม่เรียก addFavoriteVocab และไม่แสดง Alert ใดๆ

5. IF คำศัพท์นั้นถูกบันทึกในคลังโปรดไปแล้ว (duplicate), THE VocabExercise_Screen SHALL จัดการตาม behavior ที่ addFavoriteVocab กำหนด (overwrite หรือ no-op) โดยไม่ crash และยังแสดง Alert "บันทึกแล้ว" เพื่อให้ผู้ใช้รับรู้ว่าคำนั้นอยู่ในคลังโปรดแล้ว

---

### ข้อกำหนดที่ 12: UI/UX และ Design System

**User Story:** ในฐานะนักพัฒนา ฉันต้องการให้โมดูลฝึกคำศัพท์ใช้ design system เดิมที่สอดคล้องกับแอปโดยรวม

#### เกณฑ์การยอมรับ

1. THE VocabExercise_Screen SHALL ใช้ชุดสีที่สอดคล้องกับ design system ของแอป โดยสี Primary ใช้สำหรับ element ที่เน้น (header, button หลัก), Success สำหรับสถานะถูกต้อง, Error สำหรับสถานะผิดพลาด และ Light variants สำหรับ background

2. THE VocabExercise_Screen SHALL รองรับ safe area ของอุปกรณ์ (notch, status bar) บนทุก platform ที่แอปรองรับ

3. THE VocabExercise_Screen SHALL จัดการ state ภายใน component ด้วย React built-in hooks เท่านั้น โดยไม่ introduce state management library ใหม่

4. THE VocabExercise_Screen SHALL ใช้ card-based layout สำหรับ content ของแต่ละ stage ที่มีลักษณะยกขึ้นจาก background (elevation/shadow) สอดคล้องกับ card design ปัจจุบันของแอป

5. THE VocabExercise_Screen SHALL ใช้ icon library เดียวกับที่แอปใช้งานอยู่แล้ว (@expo/vector-icons Ionicons) สำหรับ icon ทุกตัวใน module นี้

6. THE VocabExercise_Screen SHALL ไม่แก้ไขไฟล์ใดนอกจาก `VocabExerciseScreen.js` เว้นแต่มีการระบุไว้ใน spec นี้โดยเฉพาะ

---

## สรุปคุณสมบัติที่ทดสอบได้ด้วย Property-Based Testing

| ข้อกำหนด | คุณสมบัติที่ทดสอบ | ประเภท |
|---|---|---|
| 1.1 | `result.length === 4` และมี stage ครบ 4 ประเภท | Invariant |
| 1.2–1.3 | `result[0] === 'matching'` สำหรับทุก invocation | Invariant |
| 1.4 | ผลิต 6 permutation ครบเมื่อเรียก 600 ครั้ง | Metamorphic |
| 2.7 | `onComplete(n, n)` เสมอ (ไม่หัก) | Invariant |
| 2.8 | รองรับ n = 1 ถึง 15 | Round-trip |
| 3.7 | `0 ≤ score ≤ words.length` | Invariant |
| 4.5 | choices มี wordEN เสมอ ไม่ cross-contaminate | Invariant |
| 5.8 | `onComplete(0, 0)` เสมอ | Invariant |
| 6.6 | `0 ≤ percentage ≤ 100` | Invariant |
| 6.7 | `totalScore ≤ totalQuestions` | Invariant |
| 9.4 | progress เพิ่มขึ้น monotonically | Invariant |

---

## Edge Cases ที่ต้องทดสอบด้วย Example Test

| กรณี | Stage ที่เกี่ยวข้อง | พฤติกรรมที่คาดหวัง |
|---|---|---|
| distractors เป็น `[]` | FillBlank | แสดงเฉพาะ wordEN ยังทำต่อได้ |
| Speech API ไม่รองรับ | Pronunciation | แสดงข้อความแจ้ง ปุ่ม Skip ยังใช้ได้ |
| ชุดคำศัพท์มี 1 คำ | ทุก Stage | ทำงานได้และส่ง onComplete ถูกต้อง |
| ชุดคำศัพท์มี 15 คำ (max) | ทุก Stage | ไม่เกิด overflow หรือ index error |
| ผู้ใช้ไม่ login | FavoriteVocab | ไม่ crash ไม่บันทึก ไม่แสดง error |
| คะแนนรวมพอดี 80% | ResultScreen | แสดงสถานะ "ผ่านเกณฑ์" |
| คะแนนรวม 79% | ResultScreen | แสดงสถานะ "ยังไม่ผ่าน" |
| totalQuestions = 0 | Score Tracker | percentage = 0 ไม่เกิด division by zero |
| session unmount ระหว่าง timer | Timer | clearInterval ถูกเรียก ไม่เกิด memory leak |
| ช่องพิมพ์ว่างเปล่า กด "ตรวจคำตอบ" | Spelling | ไม่ตรวจ ไม่เปลี่ยน state |
| speech timeout (rec.onend ขณะ listening) | Pronunciation | เปลี่ยนเป็น 'wrong' แสดงปุ่ม "ถัดไป" |
| exercise.items และ exercise.questions เป็น null ทั้งคู่ | Data Loading | แสดงข้อความแจ้ง ไม่ crash |
