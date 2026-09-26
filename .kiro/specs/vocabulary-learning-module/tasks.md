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
