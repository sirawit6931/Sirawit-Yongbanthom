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
