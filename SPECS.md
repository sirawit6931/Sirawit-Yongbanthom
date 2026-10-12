# SPECS (archived from .kiro)

_archived: 2026-10-10 - source: .kiro/specs/* - รวม 4 ไฟล์ต้นฉบับไว้ไฟล์เดียวที่ root เพื่อลบ .kiro ได้อย่างปลอดภัย_

---


## 1. spelling-mode-phase-3 - requirements

_Source: .kiro/specs/spelling-mode-phase-3/requirements.md_

---

# Requirements Document

## Introduction

This feature extends the vocabulary learning module by adding a Spelling Mode as the third step in the VocabSet Wizard. Administrators can select vocabulary words from existing matching pairs to create spelling exercises where learners listen to words and type the correct spelling.

## Glossary

- **VocabSet_Wizard**: The administrative interface for creating vocabulary learning sets
- **VocabSet**: A collection of vocabulary words organized for learning exercises
- **Matching_Pairs**: Word pairs (English-Thai) created in Step 1 of the VocabSet Wizard
- **Spelling_Exercise**: A learning activity where users listen to a word and type its correct spelling
- **Firestore_Exercises**: Collection in Firebase Firestore storing exercise data
- **Spelling_Words**: Selected words from matching pairs used for spelling exercises
- **Admin_Interface**: The administrative dashboard for managing learning content
- **Learner_Interface**: The mobile application interface for users to complete exercises

## Requirements

### Requirement 1: Extend VocabSet Wizard to Three Steps

**User Story:** As an administrator, I want to create vocabulary sets with spelling exercises, so that learners can practice spelling words they've learned.

#### Acceptance Criteria

1. THE VocabSet_Wizard SHALL have three sequential steps: Matching, Fill-in-the-blank, and Spelling
2. WHEN an administrator navigates from Step 2, THE VocabSet_Wizard SHALL display Step 3
3. THE Stepper_Component SHALL display three steps with clear labels
4. WHEN Step 3 is active, THE Stepper_Component SHALL highlight the third step

### Requirement 2: Select Words for Spelling Exercises

**User Story:** As an administrator, I want to select specific words from matching pairs for spelling exercises, so that I can curate appropriate spelling practice.

#### Acceptance Criteria

1. WHEN Step 3 is displayed, THE Admin_Interface SHALL show a checkbox list of all words from Step 1 Matching_Pairs
2. FOR EACH word in Matching_Pairs, THE Admin_Interface SHALL display English and Thai translations
3. WHEN an administrator selects words, THE Selection_Counter SHALL update to show the count
4. IF no words are selected, THEN THE Save_Button SHALL be disabled
5. IF more than 15 words are selected, THEN THE Save_Button SHALL be disabled
6. THE Selection_Validation SHALL require at least 1 word and at most 15 words

### Requirement 3: Store Spelling Data in Firestore

**User Story:** As an administrator, I want spelling data saved properly in Firestore, so that learners can access spelling exercises.

#### Acceptance Criteria

1. WHEN a VocabSet is saved, THE Firestore_Database SHALL store spellingWords as an array field
2. EACH spellingWords item SHALL contain wordEN and wordTH properties
3. THE spellingWords array SHALL contain only selected words from Step 3
4. WHEN spellingWords is saved, THE Exercise_Generator SHALL create corresponding exercises in the exercises collection
5. EACH spelling exercise SHALL have type: 'vocab' and mode: 'spelling'

### Requirement 4: Create Spelling Exercises

**User Story:** As an administrator, I want spelling exercises automatically created, so that learners have proper spelling practice activities.

#### Acceptance Criteria

1. FOR EACH selected spelling word, THE Exercise_Generator SHALL create a Firestore_Exercise
2. EACH spelling exercise SHALL include the vocabSetId for reference
3. EACH spelling exercise SHALL include wordEN and wordTH for answer validation
4. EACH spelling exercise SHALL have a question prompt indicating spelling mode
5. EACH spelling exercise SHALL specify ttsVoice for text-to-speech functionality

### Requirement 5: Display Spelling Exercises to Learners

**User Story:** As a learner, I want to practice spelling vocabulary words, so that I can improve my spelling skills.

#### Acceptance Criteria

1. WHEN a learner accesses a VocabSet with spelling exercises, THE Learner_Interface SHALL display spelling mode exercises
2. FOR EACH spelling exercise, THE Learner_Interface SHALL provide a TTS button to hear the word
3. THE Learner_Interface SHALL provide a text input field for typing the answer
4. WHEN a learner submits an answer, THE Answer_Validator SHALL check spelling accuracy
5. IF the answer matches wordEN (case-insensitive), THEN THE Learner_Interface SHALL display correct feedback
6. IF the answer does not match wordEN, THEN THE Learner_Interface SHALL display incorrect feedback

### Requirement 6: Validate Spelling Answers

**User Story:** As a learner, I want immediate feedback on my spelling attempts, so that I can learn from my mistakes.

#### Acceptance Criteria

1. THE Answer_Validator SHALL compare user input to wordEN with case-insensitive matching
2. THE Answer_Validator SHALL trim whitespace from user input before comparison
3. WHEN validation is complete, THE Learner_Interface SHALL display appropriate feedback
4. THE Feedback_System SHALL show "✓ ถูกต้อง!" for correct answers
5. THE Feedback_System SHALL show "✗ ไม่ถูกต้อง ลองใหม่" for incorrect answers
6. AFTER validation, THE Learner_Interface SHALL enable navigation to the next exercise

### Requirement 7: Maintain Data Consistency

**User Story:** As an administrator, I want consistent data across all steps, so that vocabulary sets are properly structured.

#### Acceptance Criteria

1. THE VocabSet_Document SHALL maintain all fields from previous steps when adding spellingWords
2. WHEN spellingWords are saved, THE VocabSet_Document SHALL preserve matchingPairs and fillInBlanks data
3. THE Status_Field SHALL reflect draft or published state based on administrator selection
4. ALL VocabSet fields SHALL be validated before saving to Firestore

### Requirement 8: Provide User Guidance

**User Story:** As an administrator, I want clear guidance when creating spelling exercises, so that I understand the process.

#### Acceptance Criteria

1. WHEN Step 3 is displayed, THE Admin_Interface SHALL show instructional text about spelling exercise creation
2. THE Instructional_Text SHALL explain that words are selected from Step 1 matching pairs
3. THE Instructional_Text SHALL indicate maximum word limit (10-15 words)
4. THE Selection_Counter SHALL be prominently displayed to show selected count
5. ERROR messages SHALL be clear and actionable when validation fails

### Requirement 9: Support Existing Functionality

**User Story:** As an administrator, I want spelling mode to integrate seamlessly with existing features, so that the system remains stable.

#### Acceptance Criteria

1. THE Spelling_Mode SHALL not interfere with existing Matching and Fill-in-the-blank functionality
2. EXISTING VocabSet documents SHALL remain compatible after schema update
3. THE Admin_Interface SHALL maintain all existing navigation and validation
4. THE Save_Process SHALL handle all three steps without data loss
5. EXISTING learner exercises SHALL continue to function normally


---

## 2. vocabulary-learning-module - requirements

_Source: .kiro/specs/vocabulary-learning-module/requirements.md_

---

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

5. IF Speech_Recognizer ไม่รองรับบน platform ปัจจุบัน (Web: SpeechRecognition = undefined, Native: Expo Go หรือโมดูล `expo-speech-recognition` ยังไม่ได้เชื่อมต่อ) หรือเกิด error 'not-allowed', THEN THE Pronunciation_Stage SHALL แสดงข้อความแจ้งว่าไม่รองรับอย่างสุภาพ พร้อมปุ่ม "เปิดหน้าการตั้งค่า" (เมื่อเกิด error สิทธิ์ไมโครโฟน) และปุ่ม "ข้ามด่านนี้" ต้องยังคงใช้งานได้เสมอ
*(สถาปัตยกรรมรองรับ 2 Strategy: Web ใช้ Web Speech API เดิม 100%, Native iOS/Android ใช้ `expo-speech-recognition` ผ่าน Strategy Pattern Adapter `useNativeSpeechRecognition.js`)*

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


---

## 3. vocabulary-learning-module - design

_Source: .kiro/specs/vocabulary-learning-module/design.md_

---

# Design Document — Vocabulary Learning Module

## Overview

โมดูลฝึกคำศัพท์ (`VocabExerciseScreen.js`) เป็นหน้าจอหลักที่ควบคุม session flow ครบ 4 ด่านต่อเนื่องในแอปฝึกภาษาอังกฤษสำหรับผู้เริ่มต้น (A1–A2) บน React Native (Expo) + Firebase Firestore

**เป้าหมายของ design นี้:**

1. แก้ไข Bug หลัก — ฟังก์ชัน `shuffleStages()` สุ่ม `matching` รวมกับ stage อื่นอย่างผิดกฎ และใช้ชื่อ stage ผิด (`'speaking'` แทน `'pronunciation'`)
2. เปลี่ยนชื่อ stage key จาก `'speaking'` เป็น `'pronunciation'` ในทุกจุดที่ใช้งานภายในไฟล์เดียว (`VocabExerciseScreen.js`)
3. ไม่แก้ไขไฟล์อื่นใด ตาม Requirement 12.6

---

## Architecture

```
VocabExerciseScreen.js (ไฟล์เดียวที่แก้)
│
├── shuffleStages()          ← [BUG FIX] ฟังก์ชันกำหนดลำดับ stage
│
├── Components (ไม่เปลี่ยน logic)
│   ├── MatchingStage
│   ├── SpellingStage
│   ├── FillBlankStage
│   └── SpeakingStage        ← [RENAME KEY] key = 'speaking' → 'pronunciation'
│
└── Main Screen
    ├── stageLabel mapping   ← [FIX] เพิ่ม 'pronunciation' key
    └── Conditional render   ← [FIX] เปลี่ยน currentStage === 'speaking'
```

### หลักการออกแบบ

- **Single File Change**: การแก้ไขทั้งหมดอยู่ใน `VocabExerciseScreen.js` เท่านั้น
- **Minimal Diff**: เปลี่ยนเฉพาะจุดที่จำเป็น ไม่ refactor ส่วนที่ไม่เกี่ยวข้อง
- **Backward Compatible**: `SpeakingStage` component ยังคงชื่อ component เดิม เปลี่ยนเฉพาะ stage key string ที่ใช้ใน routing

---

## Components and Interfaces

### 1. `shuffleStages()` — จุดหลักที่ต้องแก้

**โค้ดปัจจุบัน (ผิด):**
```js
function shuffleStages() {
  const base = ['matching', 'spelling', 'fillblank'];
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return [...base, 'speaking']; // speaking อยู่ท้ายเสมอ (ข้ามได้)
}
```

**ปัญหา:**
1. `'matching'` ถูกรวมใน `base` array → ถูกสุ่มลำดับได้ ขัดกับ Requirement 1.2–1.3
2. ชื่อ stage ใช้ `'speaking'` แทน `'pronunciation'` ตาม Requirement 1.1
3. 3 stages กลางไม่ถูกสุ่มอย่างถูกต้อง (base มีแค่ 2 ตัว → pool จริง = ['spelling','fillblank'] เท่านั้น)

**โค้ดที่ถูกต้อง:**
```js
function shuffleStages() {
  const pool = ['spelling', 'fillblank', 'pronunciation'];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return ['matching', ...pool];
}
```

**หลักการ (Fisher-Yates Shuffle):**
- `pool` = เฉพาะ 3 stages ที่สุ่ม: `['spelling', 'fillblank', 'pronunciation']`
- สุ่มใน `pool` โดย `i` วิ่งจาก `pool.length - 1` ถึง `1`
- ผลลัพธ์ = `['matching', ...pool]` → `matching` อยู่ index[0] เสมอ

### 2. `stageLabel` mapping — จุดที่ 2

**โค้ดปัจจุบัน (ผิด):**
```js
const stageLabel = {
  matching: 'จับคู่',
  spelling: 'สะกดคำ',
  fillblank: 'เติมช่องว่าง',
  speaking: 'พูดตาม'   // ← ผิด
};
```

**โค้ดที่ถูกต้อง:**
```js
const stageLabel = {
  matching: 'จับคู่',
  spelling: 'สะกดคำ',
  fillblank: 'เติมช่องว่าง',
  pronunciation: 'พูดตาม'  // ← แก้ key
};
```

### 3. Conditional Rendering — จุดที่ 3

**โค้ดปัจจุบัน (ผิด):**
```jsx
{currentStage === 'speaking' && (
  <SpeakingStage words={words} onComplete={() => handleStageComplete(0, 0)} onFavorite={handleFavorite} />
)}
```

**โค้ดที่ถูกต้อง:**
```jsx
{currentStage === 'pronunciation' && (
  <SpeakingStage words={words} onComplete={() => handleStageComplete(0, 0)} onFavorite={handleFavorite} />
)}
```

> **หมายเหตุ:** Component ยังชื่อ `SpeakingStage` เนื่องจากเป็นชื่อ React component ที่ใช้ภายใน ไม่มีผลต่อ stage key ที่ใช้ routing

### 4. Comment บน shuffleStages() — จุดที่ 4

**โค้ดปัจจุบัน (ผิด):**
```js
// สุ่มลำดับ stages ทุกครั้ง (matching, spelling, fillblank, speaking)
```

**โค้ดที่ถูกต้อง:**
```js
// สุ่มลำดับ stages ทุกครั้ง: matching (fixed ที่ index 0) + สุ่ม [spelling, fillblank, pronunciation]
```

---

## Data Models

### Stage Key Type

```
StageKey = 'matching' | 'spelling' | 'fillblank' | 'pronunciation'
```

| Stage Key       | Component       | นับคะแนน | ข้ามได้ |
|-----------------|-----------------|-----------|---------|
| `'matching'`    | MatchingStage   | ✅ (n/n)  | ❌      |
| `'spelling'`    | SpellingStage   | ✅        | ❌      |
| `'fillblank'`   | FillBlankStage  | ✅        | ❌      |
| `'pronunciation'`| SpeakingStage  | ❌ (0/0)  | ✅      |

### Stage Sequence

```
stages: StageKey[] = ['matching', shuffle(['spelling', 'fillblank', 'pronunciation'])[0..2]]
```

ตัวอย่าง permutation ที่ valid (6 แบบ):
1. `['matching', 'spelling', 'fillblank', 'pronunciation']`
2. `['matching', 'spelling', 'pronunciation', 'fillblank']`
3. `['matching', 'fillblank', 'spelling', 'pronunciation']`
4. `['matching', 'fillblank', 'pronunciation', 'spelling']`
5. `['matching', 'pronunciation', 'spelling', 'fillblank']`
6. `['matching', 'pronunciation', 'fillblank', 'spelling']`

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Stage Sequencer — Structure Invariant

*For any* invocation of `shuffleStages()`, the result SHALL be an array of exactly length 4 containing each of `'matching'`, `'spelling'`, `'fillblank'`, and `'pronunciation'` exactly once, with no duplicates and no omissions.

**Validates: Requirements 1.1**

---

### Property 2: Stage Sequencer — Matching Fixed First

*For any* invocation of `shuffleStages()`, `result[0]` SHALL equal `'matching'` — regardless of when or how many times the function is called.

**Validates: Requirements 1.2, 1.3**

---

### Property 3: Stage Sequencer — Permutation Completeness

*For any* set of 600 invocations of `shuffleStages()`, the distinct permutations of `result.slice(1)` SHALL include all 6 possible orderings of `['spelling', 'fillblank', 'pronunciation']` (3! = 6), meaning no permutation is permanently locked or excluded.

**Validates: Requirements 1.4**

---

### Property 4: Matching Stage — Perfect Score Invariant

*For any* word list of size n (1 ≤ n ≤ 15), after the user correctly matches all n pairs, `onComplete` SHALL be called with arguments `(n, n)` — score always equals total in the Matching stage.

**Validates: Requirements 2.7, 2.8**

---

### Property 5: Spelling Stage — Score Bounds Invariant

*For any* word list of size `m` and any sequence of user answers (correct/incorrect), the final score passed to `onComplete(score, m)` SHALL satisfy `0 ≤ score ≤ m`.

**Validates: Requirements 3.7**

---

### Property 6: FillBlank Stage — Choices Integrity Invariant

*For any* list of `ExerciseItem` objects, the `choices` array generated for each item SHALL contain `item.wordEN` (the correct answer) at least once, and SHALL NOT contain `wordEN` values from any other item in the list.

**Validates: Requirements 4.5, 4.6**

---

### Property 7: Pronunciation Stage — Score Zero Invariant

*For any* pronunciation session outcome (correct, wrong, skipped, unsupported), `onComplete` SHALL always be called with `(0, 0)` — ensuring this stage never contributes to the pass/fail calculation.

**Validates: Requirements 5.8, 6.2**

---

### Property 8: Score Tracker — Percentage Bounds Invariant

*For any* collection of stage scores (including the edge case where totalQuestions = 0), the calculated `percentage` SHALL satisfy `0 ≤ percentage ≤ 100`.

**Validates: Requirements 6.6**

---

### Property 9: Score Tracker — Score Never Exceeds Total

*For any* set of valid stage scores where each individual `score_i ≤ total_i`, the aggregated `totalScore = Σ score_i` SHALL satisfy `totalScore ≤ totalQuestions = Σ total_i`.

**Validates: Requirements 6.7**

---

### Property 10: Progress Bar — Monotonically Increasing

*For any* 4-stage session with stages fully initialized, the progress value at `stageIdx + 1` SHALL be strictly greater than at `stageIdx`, forming a monotonically increasing sequence from 0% to 100%.

**Validates: Requirements 9.4**

---

## Error Handling

| สถานการณ์ | พฤติกรรมที่ต้องการ | จุดใน code |
|---|---|---|
| `shuffleStages()` ให้ pool ผิด | ไม่เกิดอีกหลังแก้ไข | `shuffleStages()` |
| `currentStage === 'speaking'` ไม่ match | SpeakingStage ไม่ render → stage ค้าง | conditional render (แก้ key แล้ว) |
| `stageLabel['speaking']` undefined | header แสดง `''` แทน 'พูดตาม' | stageLabel map (แก้ key แล้ว) |
| `distractors` เป็น `[]` | FillBlankStage แสดง wordEN อย่างเดียว — ไม่ crash | FillBlankStage (ไม่แก้) |
| `SpeechRecognition` undefined | แสดงข้อความ unsupported + ปุ่ม skip ยังใช้ได้ | SpeakingStage (ไม่แก้) |
| `totalQuestions = 0` | `percentage = 0` — ไม่ divide by zero | ResultScreen (ไม่แก้) |

---

## Testing Strategy

### แนวทางการทดสอบแบบ Dual Testing

เนื่องจากโมดูลนี้มีทั้ง pure function logic (`shuffleStages`, score calculation) และ UI component จึงใช้สองแนวทางร่วมกัน:

**Unit Tests** — ตรวจสอบ behavior เฉพาะเจาะจง:
- การ render stage ที่ถูกต้องตาม `currentStage`
- edge cases: empty distractor, ช่องพิมพ์ว่าง, Speech API ไม่รองรับ
- timer cleanup เมื่อ unmount

**Property-Based Tests** — ตรวจสอบ universal properties ข้าม input หลาย ๆ ตัว

### Property-Based Testing Library

ใช้ **`fast-check`** (JavaScript PBT library ที่เข้ากันได้กับ Jest/Vitest):

```
npm install --save-dev fast-check
```

แต่ละ property test ต้องรัน **อย่างน้อย 100 iterations** ผ่านการตั้งค่า:
```js
fc.assert(fc.property(...), { numRuns: 600 }); // สำหรับ Property 3
fc.assert(fc.property(...), { numRuns: 100 }); // สำหรับ Properties อื่น ๆ
```

### รายการ Property Tests

| Property | Test Tag | Iterations |
|---|---|---|
| Property 1: Structure Invariant | `Feature: vocabulary-learning-module, Property 1: shuffleStages result has length 4 with all stages` | 100 |
| Property 2: Matching Fixed First | `Feature: vocabulary-learning-module, Property 2: result[0] is always matching` | 100 |
| Property 3: Permutation Completeness | `Feature: vocabulary-learning-module, Property 3: all 6 permutations appear in 600 runs` | 600 |
| Property 4: Matching Perfect Score | `Feature: vocabulary-learning-module, Property 4: matching onComplete always called with (n, n)` | 100 |
| Property 5: Spelling Score Bounds | `Feature: vocabulary-learning-module, Property 5: spelling score 0 <= score <= words.length` | 100 |
| Property 6: FillBlank Choices Integrity | `Feature: vocabulary-learning-module, Property 6: each item choices contains its own wordEN only` | 100 |
| Property 7: Pronunciation Score Zero | `Feature: vocabulary-learning-module, Property 7: pronunciation onComplete always (0,0)` | 100 |
| Property 8: Percentage Bounds | `Feature: vocabulary-learning-module, Property 8: 0 <= percentage <= 100` | 100 |
| Property 9: Score Never Exceeds Total | `Feature: vocabulary-learning-module, Property 9: totalScore <= totalQuestions` | 100 |
| Property 10: Progress Monotonic | `Feature: vocabulary-learning-module, Property 10: progress monotonically increases` | 100 |

### รายการ Example Tests

| Test | ประเภท | สิ่งที่ตรวจสอบ |
|---|---|---|
| ช่องพิมพ์ว่าง กด "ตรวจคำตอบ" | Edge Case | state ไม่เปลี่ยน |
| distractors = [] | Edge Case | แสดง wordEN เดียว ไม่ crash |
| Speech API = undefined | Edge Case | แสดงข้อความ unsupported, skip ใช้ได้ |
| totalQuestions = 0 | Edge Case | percentage = 0 |
| คะแนนรวมพอดี 80% | Example | แสดง "ผ่านเกณฑ์" |
| คะแนนรวม 79% | Example | แสดง "ยังไม่ผ่าน" |
| session unmount ระหว่าง timer | Example | clearInterval ถูกเรียก |
| ชุดคำ 1 คำ ทุก stage | Edge Case | onComplete ถูกต้อง |
| ชุดคำ 15 คำ ทุก stage | Edge Case | ไม่เกิด overflow |

### ขอบเขตการทดสอบสำหรับ Bug Fix นี้

การเปลี่ยนแปลงหลักคือ `shuffleStages()` และ stage key renaming ดังนั้น Property 1, 2, 3 คือ tests ที่สำคัญที่สุดและต้องรันก่อน

**ลำดับความสำคัญของการทดสอบ:**
1. Property 2 (matching fixed first) — ทดสอบ bug fix โดยตรง
2. Property 1 (structure) — ทดสอบ completeness
3. Property 3 (permutation) — ทดสอบ randomness
4. Unit test: render `SpeakingStage` เมื่อ `currentStage === 'pronunciation'` — ทดสอบ key renaming
5. Unit test: `stageLabel['pronunciation'] === 'พูดตาม'` — ทดสอบ label mapping


---

## 4. vocabulary-learning-module - tasks

_Source: .kiro/specs/vocabulary-learning-module/tasks.md_

---

# Implementation Plan: Vocabulary Learning Module

## Overview

แก้ไข Bug ใน `VocabExerciseScreen.js` จำนวน 4 จุด ได้แก่ ฟังก์ชัน `shuffleStages()` ที่สุ่ม `matching` รวมกับ stage อื่นอย่างผิดกฎ, การ rename stage key จาก `'speaking'` เป็น `'pronunciation'` ใน `stageLabel` mapping และ conditional render และเขียน property-based tests ด้วย `fast-check` เพื่อตรวจสอบ Properties 1–3 ที่เกี่ยวข้องกับ `shuffleStages()` โดยตรง

**ขอบเขต:** แก้ไขเฉพาะ `frontend/screens/VocabExerciseScreen.js` เท่านั้น ห้ามแก้ไขไฟล์อื่น

---

## Tasks

- [x] 1. ตั้งค่า Test Framework สำหรับ Property-Based Testing
  - [x] 1.1 ติดตั้ง Jest และ fast-check ใน frontend project
    - รัน `npm install --save-dev jest jest-environment-jsdom @testing-library/react-native fast-check babel-jest @babel/preset-env @babel/preset-react` ใน `frontend/`
    - สร้างไฟล์ `frontend/jest.config.js` ที่ตั้งค่า transform และ testEnvironment เป็น `jsdom`
    - สร้างไฟล์ `frontend/babel.config.js` (หรืออัปเดต) ให้รองรับ Jest transformation
    - สร้างไฟล์ `frontend/__tests__/shuffleStages.test.js` เปล่าเพื่อทดสอบ setup
    - ตรวจสอบว่า `npm test` รันได้โดยไม่ error
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. แก้ไข shuffleStages() และเขียน Property Tests
  - [x] 2.1 แก้ไข comment และ logic ของ shuffleStages() ใน VocabExerciseScreen.js
    - เปลี่ยน comment บนฟังก์ชันจาก `// สุ่มลำดับ stages ทุกครั้ง (matching, spelling, fillblank, speaking)` เป็น `// สุ่มลำดับ stages ทุกครั้ง: matching (fixed ที่ index 0) + สุ่ม [spelling, fillblank, pronunciation]`
    - เปลี่ยนชื่อตัวแปร `base` เป็น `pool`
    - เปลี่ยนค่า array จาก `['matching', 'spelling', 'fillblank']` เป็น `['spelling', 'fillblank', 'pronunciation']`
    - เปลี่ยน loop index ให้ iterate บน `pool` แทน `base` (`pool.length - 1`, `pool`)
    - เปลี่ยน return จาก `[...base, 'speaking']` เป็น `['matching', ...pool]`
    - ลบ inline comment `// speaking อยู่ท้ายเสมอ (ข้ามได้)` ออก
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x]* 2.2 เขียน property test สำหรับ Property 1: Structure Invariant
    - เพิ่ม test ใน `frontend/__tests__/shuffleStages.test.js`
    - ใช้ `fc.assert(fc.property(fc.constant(null), () => { ... }), { numRuns: 100 })`
    - ตรวจสอบว่า `result.length === 4`
    - ตรวจสอบว่า result มี `'matching'`, `'spelling'`, `'fillblank'`, `'pronunciation'` ครบทั้ง 4 ตัว ไม่ซ้ำ
    - ตั้งชื่อ test ว่า `Feature: vocabulary-learning-module, Property 1: shuffleStages result has length 4 with all stages`
    - **Property 1: Structure Invariant**
    - **Validates: Requirements 1.1**

  - [x]* 2.3 เขียน property test สำหรับ Property 2: Matching Fixed First
    - เพิ่ม test ใน `frontend/__tests__/shuffleStages.test.js`
    - ใช้ `fc.assert(fc.property(fc.constant(null), () => { ... }), { numRuns: 100 })`
    - ตรวจสอบว่า `result[0] === 'matching'` เสมอ
    - ตั้งชื่อ test ว่า `Feature: vocabulary-learning-module, Property 2: result[0] is always matching`
    - **Property 2: Matching Fixed First**
    - **Validates: Requirements 1.2, 1.3**

  - [x]* 2.4 เขียน property test สำหรับ Property 3: Permutation Completeness
    - เพิ่ม test ใน `frontend/__tests__/shuffleStages.test.js`
    - เรียก `shuffleStages()` 600 ครั้งแล้วเก็บ `result.slice(1).join(',')` ของแต่ละครั้ง
    - ตรวจสอบว่า distinct permutations ที่ได้ครบทั้ง 6 แบบ (3! = 6) ของ `['spelling', 'fillblank', 'pronunciation']`
    - ใช้ `fc.assert(fc.property(fc.constant(null), () => { ... }), { numRuns: 1 })` (loop 600 ภายใน property)
    - ตั้งชื่อ test ว่า `Feature: vocabulary-learning-module, Property 3: all 6 permutations appear in 600 runs`
    - **Property 3: Permutation Completeness**
    - **Validates: Requirements 1.4**

- [x] 3. Checkpoint — ตรวจสอบ shuffleStages() fix และ property tests
  - รัน `npm test -- --testPathPattern=shuffleStages` ใน `frontend/`
  - ตรวจสอบว่า Property 1, 2, 3 ผ่านครบทั้งหมด ถามผู้ใช้หากมีข้อสงสัย

- [x] 4. แก้ไข stageLabel mapping และ conditional render ใน VocabExerciseScreen.js
  - [x] 4.1 แก้ไข stageLabel object — เปลี่ยน key 'speaking' เป็น 'pronunciation'
    - ค้นหา `speaking: 'พูดตาม'` ใน `stageLabel` object ใกล้ส่วน MAIN SCREEN
    - เปลี่ยนเป็น `pronunciation: 'พูดตาม'`
    - ตรวจสอบว่าไม่มี key `speaking` เหลืออยู่ใน `stageLabel`
    - _Requirements: 9.2_

  - [x] 4.2 แก้ไข conditional render — เปลี่ยน currentStage === 'speaking' เป็น 'pronunciation'
    - ค้นหา `{currentStage === 'speaking' && <SpeakingStage`
    - เปลี่ยนเงื่อนไขเป็น `{currentStage === 'pronunciation' && <SpeakingStage`
    - component ชื่อ `SpeakingStage` คงเดิม เปลี่ยนเฉพาะ string ที่ใช้ match กับ currentStage
    - _Requirements: 9.2, 5.1_

  - [ ]* 4.3 เขียน unit test ตรวจสอบ stageLabel และ conditional render
    - เพิ่ม test ใน `frontend/__tests__/shuffleStages.test.js` หรือสร้าง `frontend/__tests__/vocabExerciseScreen.test.js`
    - Test case 1: `stageLabel['pronunciation'] === 'พูดตาม'` (ตรวจ label mapping)
    - Test case 2: `stageLabel['speaking']` เป็น `undefined` (ตรวจว่า key เก่าถูกลบแล้ว)
    - _Requirements: 9.2_

- [x] 5. Final Checkpoint — ตรวจสอบทุก test ผ่านครบ
  - รัน `npm test` ใน `frontend/` เพื่อรัน test ทั้งหมด
  - ตรวจสอบว่าไม่มี test ที่ fail
  - ตรวจสอบว่าการแก้ไขทั้ง 4 จุดใน `VocabExerciseScreen.js` ครบถ้วน ถามผู้ใช้หากมีข้อสงสัย

---

## Notes

- Tasks ที่มีเครื่องหมาย `*` เป็น optional สามารถข้ามได้สำหรับ MVP ที่เร็วขึ้น
- แต่ละ task อ้างอิง requirements เฉพาะเจาะจงเพื่อ traceability
- Checkpoint ช่วยตรวจสอบความถูกต้องแบบ incremental
- Property tests ตรวจสอบ universal correctness properties
- Unit tests ตรวจสอบ specific examples และ edge cases
- **สำคัญ:** ห้ามแก้ไขไฟล์ใดนอกจาก `VocabExerciseScreen.js` และไฟล์ test ที่สร้างใหม่ ตาม Requirements 12.6

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3"] }
  ]
}
```
