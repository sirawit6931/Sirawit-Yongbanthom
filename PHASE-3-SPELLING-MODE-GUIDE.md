# Phase 3 — เพิ่มโหมด Spelling สำหรับคำศัพท์

**สร้างเมื่อ:** 9 กันยายน 2569  
**สถานะ:** ร่างแนวทางการปฏิบัติ  
**นำเสนอต่อ:** Spelling Mode Implementation

---

## 1. ภาพรวม Phase 3

### วัตถุประสงค์
ขยาย VocabSet Wizard (ระบบสร้างชุดคำศัพท์) จาก 2 steps เป็น 3 steps โดยเพิ่ม **Step 3: Spelling Mode**

### ผลลัพธ์ที่คาดหวัง
- ผู้ดูแลสามารถเลือกคำศัพท์ (จาก Master pairs) เพื่อสร้าง Spelling exercises
- ระบบจัดเก็บข้อมูล Spelling ใน Firestore พร้อมข้อมูลเมตา
- Frontend ดึงและแสดงโหมด Spelling ในแบบฝึกหัด VocabExercise

---

## 2. โครงสร้างข้อมูล Spelling

### Firestore Collection: `vocabSets`

**Document ปัจจุบัน (2 steps):**
```javascript
{
  docId: "vocab-set-123",
  title: "คำศัพท์ A1 ชุดที่ 1",
  description: "...",
  level: "A1",
  ttsVoice: "female",
  createdAt: Timestamp,
  status: "published" | "draft",
  
  // Step 1: Matching (Master pairs)
  matchingPairs: [
    { wordEN: "apple", wordTH: "แอปเปิ้ล" },
    { wordEN: "book", wordTH: "หนังสือ" },
    ...
  ],
  
  // Step 2: Fill-in-the-blank
  fillInBlanks: [
    { 
      wordEN: "apple",
      sentence: "I like to eat {blank}",
      sentenceTH: "ฉันชอบกินแอปเปิ้ล"
    },
    ...
  ]
}
```

**เพิ่มใน Step 3:**
```javascript
{
  // ... (เดิม) ...
  
  // Step 3: Spelling (NEW)
  spellingWords: [
    { wordEN: "apple", wordTH: "แอปเปิ้ล" },
    { wordEN: "book", wordTH: "หนังสือ" },
    // ... เลือกจาก matchingPairs มากสุด 10-15 คำ
  ]
}
```

---

## 3. UI/UX Changes (HTML)

### Step 3 Pane Structure

เพิ่ม Pane ใหม่ในไฟล์ `backend/public/admin/index.html` ภายในส่วน vocabset-edit-form:

```html
<!-- Step 3 · Spelling Setup (Module 3 — Selected words from Matching) -->
<div id="vocabset-step-3" class="wiz-pane hidden">
  <div class="manual-section-head">
    <h4>เลือกคำศัพท์สำหรับสะกด (Spelling) <span id="vocabset-spelling-count" class="count-badge">0</span></h4>
  </div>
  <div class="pair-info-alert">
    <span class="pair-info-icon">ℹ️</span>
    <span>เลือกคำศัพท์จากโหมดจับคู่ (Step 1) เพื่อเป็นแบบฝึกหัดสะกด — ผู้เรียนจะต้องสะกดคำศัพท์ให้ถูกตามการฟัง</span>
  </div>
  
  <!-- Checkbox list of words from matching -->
  <div class="spelling-word-list">
    <div class="spelling-item-headers">
      <span style="width: 40px;">เลือก</span>
      <span style="flex: 1;">ภาษาอังกฤษ</span>
      <span style="flex: 1;">ภาษาไทย</span>
    </div>
    <div id="vocabset-spelling-items" class="manual-item-list"></div>
  </div>
  
  <div class="wiz-nav">
    <button type="button" id="vocabset-prev-btn-s3" class="btn-secondary">← ย้อนกลับ</button>
    <span></span>
  </div>

  <div class="toggle-row" style="margin-top:16px;">
    <span class="toggle-label">บันทึกเป็นแบบร่าง</span>
    <label class="toggle-switch">
      <input type="checkbox" id="vocabset-publish-toggle-s3" />
      <span class="toggle-slider"></span>
    </label>
    <span class="toggle-hint">เผยแพร่ทันที</span>
  </div>

  <div id="vocabset-error-s3" class="error-box hidden"></div>
  
  <div class="modal-actions" style="margin-top:24px;">
    <button id="vocabset-cancel-btn-s3" class="btn-secondary">ยกเลิก</button>
    <button id="vocabset-save-btn-s3" class="btn-primary gen-btn">บันทึก</button>
  </div>
</div>
```

### Stepper Update

เปลี่ยน Stepper จาก 2 ขั้น เป็น 3 ขั้น:

**ปัจจุบัน:**
```html
<div class="wiz-steps" style="margin: 4px 0 20px;">
  <div class="wiz-step active" id="wiz-ind-1">
    <span class="wiz-step-num">1</span>
    <span class="wiz-step-label">โหมดจับคู่<small>Matching · Master</small></span>
  </div>
  <div class="wiz-step-line"></div>
  <div class="wiz-step" id="wiz-ind-2">
    <span class="wiz-step-num">2</span>
    <span class="wiz-step-label">โหมดเติมช่องว่าง<small>Fill-in-the-blank</small></span>
  </div>
</div>
```

**แก้เป็น:**
```html
<div class="wiz-steps" style="margin: 4px 0 20px;">
  <div class="wiz-step active" id="wiz-ind-1">
    <span class="wiz-step-num">1</span>
    <span class="wiz-step-label">โหมดจับคู่<small>Matching · Master</small></span>
  </div>
  <div class="wiz-step-line"></div>
  <div class="wiz-step" id="wiz-ind-2">
    <span class="wiz-step-num">2</span>
    <span class="wiz-step-label">โหมดเติมช่องว่าง<small>Fill-in-the-blank</small></span>
  </div>
  <div class="wiz-step-line"></div>
  <div class="wiz-step" id="wiz-ind-3">
    <span class="wiz-step-num">3</span>
    <span class="wiz-step-label">โหมดสะกด<small>Spelling</small></span>
  </div>
</div>
```

---

## 4. JavaScript Logic Changes (`adminApp.js`)

### 4.1 เริ่มต้น Step 3

```javascript
// When user clicks "Next" from Step 2 (Fill-in-blank)
document.getElementById('vocabset-next-btn').addEventListener('click', function() {
  // Validate Step 2
  if (!validateStep2()) {
    showError('กรุณากรอกประโยคตัวอย่างอย่างน้อย 1 ประโยค');
    return;
  }
  
  // Show Step 3
  document.getElementById('vocabset-step-2').classList.add('hidden');
  document.getElementById('vocabset-step-3').classList.remove('hidden');
  
  // Update stepper
  document.getElementById('wiz-ind-2').classList.remove('active');
  document.getElementById('wiz-ind-3').classList.add('active');
  
  // Populate spelling checkbox list from matchingPairs
  renderSpellingWordList();
});
```

### 4.2 Render Spelling Checkbox List

```javascript
function renderSpellingWordList() {
  const container = document.getElementById('vocabset-spelling-items');
  container.innerHTML = '';
  
  // Get matching pairs from Step 1
  const matchingPairs = getCurrentMatchingPairs();
  
  matchingPairs.forEach((pair, index) => {
    const div = document.createElement('div');
    div.className = 'spelling-item';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '12px';
    div.style.padding = '10px';
    div.style.borderBottom = '1px solid #eee';
    
    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `spelling-word-${index}`;
    checkbox.style.width = '20px';
    checkbox.style.cursor = 'pointer';
    checkbox.dataset.wordEN = pair.wordEN;
    checkbox.dataset.wordTH = pair.wordTH;
    
    // Label: EN
    const labelEN = document.createElement('span');
    labelEN.textContent = pair.wordEN;
    labelEN.style.flex = '1';
    labelEN.style.fontWeight = '500';
    
    // Label: TH
    const labelTH = document.createElement('span');
    labelTH.textContent = pair.wordTH;
    labelTH.style.flex = '1';
    labelTH.style.color = '#666';
    
    div.appendChild(checkbox);
    div.appendChild(labelEN);
    div.appendChild(labelTH);
    container.appendChild(div);
    
    // Listen for changes
    checkbox.addEventListener('change', updateSpellingCount);
  });
}

function updateSpellingCount() {
  const checkedCount = document.querySelectorAll('#vocabset-spelling-items input[type="checkbox"]:checked').length;
  document.getElementById('vocabset-spelling-count').textContent = checkedCount;
}
```

### 4.3 Back Button (Step 3 → Step 2)

```javascript
document.getElementById('vocabset-prev-btn-s3').addEventListener('click', function() {
  // Show Step 2
  document.getElementById('vocabset-step-3').classList.add('hidden');
  document.getElementById('vocabset-step-2').classList.remove('hidden');
  
  // Update stepper
  document.getElementById('wiz-ind-3').classList.remove('active');
  document.getElementById('wiz-ind-2').classList.add('active');
});
```

### 4.4 Save Button (บันทึก vocabSet + Spelling)

```javascript
document.getElementById('vocabset-save-btn-s3').addEventListener('click', async function() {
  // Validate: at least 1 spelling word selected
  const selectedSpellingWords = getSelectedSpellingWords();
  if (selectedSpellingWords.length === 0) {
    showError('กรุณาเลือกคำศัพท์อย่างน้อย 1 คำสำหรับสะกด');
    return;
  }
  
  // Max 10-15 words
  if (selectedSpellingWords.length > 15) {
    showError('เลือกไม่เกิน 15 คำ');
    return;
  }
  
  // Build vocabSet document
  const vocabSetData = {
    title: document.getElementById('vocabset-title').value,
    description: document.getElementById('vocabset-description').value,
    level: 'A1', // or A2
    ttsVoice: 'female', // or male
    createdAt: new Date(),
    status: document.getElementById('vocabset-publish-toggle-s3').checked ? 'published' : 'draft',
    
    matchingPairs: getCurrentMatchingPairs(),
    fillInBlanks: getCurrentFillInBlanks(),
    spellingWords: selectedSpellingWords  // NEW
  };
  
  try {
    // Save to Firestore
    const docRef = await firebase.firestore().collection('vocabSets').add(vocabSetData);
    
    // Also create exercises for each spelling word
    await createSpellingExercises(docRef.id, selectedSpellingWords);
    
    alert('บันทึกชุดคำศัพท์ + โหมดสะกดสำเร็จ!');
    resetVocabSetForm();
    loadVocabSets(); // Reload table
  } catch (error) {
    showError('เกิดข้อผิดพลาด: ' + error.message);
  }
});

function getSelectedSpellingWords() {
  const checkboxes = document.querySelectorAll('#vocabset-spelling-items input[type="checkbox"]:checked');
  const words = [];
  checkboxes.forEach(checkbox => {
    words.push({
      wordEN: checkbox.dataset.wordEN,
      wordTH: checkbox.dataset.wordTH
    });
  });
  return words;
}
```

### 4.5 Create Spelling Exercises

```javascript
async function createSpellingExercises(vocabSetId, spellingWords) {
  const exercisesPromises = spellingWords.map(word => {
    return firebase.firestore().collection('exercises').add({
      vocabSetId: vocabSetId,
      type: 'vocab',
      mode: 'spelling',  // NEW: ระบุว่าเป็นโหมด Spelling
      wordEN: word.wordEN,
      wordTH: word.wordTH,
      question: `พิมพ์คำศัพท์ภาษาอังกฤษ: "${word.wordTH}"`,
      ttsVoice: 'female',
      createdAt: new Date()
    });
  });
  
  await Promise.all(exercisesPromises);
}
```

---

## 5. Frontend Integration (VocabExerciseScreen.js)

### ดึง Spelling Exercises

```javascript
async function loadSpellingExercises(vocabSetId) {
  const snapshot = await firebase
    .firestore()
    .collection('exercises')
    .where('vocabSetId', '==', vocabSetId)
    .where('mode', '==', 'spelling')
    .get();
  
  const exercises = [];
  snapshot.forEach(doc => {
    exercises.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  return exercises;
}
```

### แสดง Spelling Stage

```javascript
function renderSpellingStage(exercise) {
  return (
    <View style={styles.stageContainer}>
      <Text style={styles.stageTitle}>🔤 โหมดสะกด</Text>
      <Text style={styles.question}>{exercise.question}</Text>
      
      {/* TTS Button */}
      <TouchableOpacity onPress={() => speak(exercise.wordEN)}>
        <Text style={styles.button}>🔊 ฟังเสียง</Text>
      </TouchableOpacity>
      
      {/* Text Input */}
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="พิมพ์คำศัพท์..."
        onChangeText={setUserAnswer}
        value={userAnswer}
        editable={!isAnswered}
      />
      
      {/* Feedback */}
      {feedback && <Text style={[styles.feedback, feedback.correct ? styles.correct : styles.incorrect]}>{feedback.message}</Text>}
      
      {/* Action Buttons */}
      <View style={styles.buttonGroup}>
        {!isAnswered && (
          <TouchableOpacity onPress={handleSubmit} style={styles.btnSubmit}>
            <Text>ตอบ</Text>
          </TouchableOpacity>
        )}
        {isAnswered && (
          <TouchableOpacity onPress={handleNext} style={styles.btnNext}>
            <Text>ถัดไป</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function handleSubmit() {
  const correct = userAnswer.toLowerCase().trim() === exercise.wordEN.toLowerCase();
  setIsAnswered(true);
  setFeedback({
    correct,
    message: correct ? '✓ ถูกต้อง!' : '✗ ไม่ถูกต้อง ลองใหม่'
  });
}
```

---

## 6. Testing Checklist

### Unit Tests
- [ ] `getSelectedSpellingWords()` ส่งคืนคำศัพท์ที่เลือกเท่านั้น
- [ ] `validateSpellingCount()` ปฏิเสธ < 1 หรือ > 15 คำ
- [ ] `createSpellingExercises()` สร้าง exercises ด้วย `mode: 'spelling'`

### Integration Tests
- [ ] ผู้ดูแลเปิด VocabSet → Step 3 แสดง checkbox list ครบถ้วน
- [ ] เลือกคำศัพท์ → count badge อัปเดต
- [ ] บันทึก → Firestore มี document พร้อม `spellingWords` field
- [ ] Frontend ดึงและแสดง Spelling exercises

### End-to-End Tests
- [ ] สมาชิกเล่นแบบฝึกหัด Spelling → ฟังเสียง → พิมพ์คำ → บันทึกคะแนน

---

## 7. ไฟล์ที่ต้องแก้ไข

| ไฟล์ | บรรทัดโดยประมาณ | การเปลี่ยนแปลง |
|-----|-----------------|------------------|
| `backend/public/admin/index.html` | +80 | เพิ่ม Step 3 Pane + Stepper update |
| `backend/public/admin/js/adminApp.js` | +200 | Event listeners + validation logic |
| `frontend/screens/VocabExerciseScreen.js` | +50 | Render Spelling stage + handle answer |
| `frontend/services/firestoreService.js` | +20 | `loadSpellingExercises()` function |

---

## 8. ลำดับการดำเนินการ

```
1. เพิ่ม Step 3 UI (HTML) ✅ ต้องทำ
   ↓
2. เขียน JavaScript logic (adminApp.js) ✅ ต้องทำ
   ↓
3. เขียน Frontend rendering (VocabExerciseScreen.js) ✅ ต้องทำ
   ↓
4. Test ทั้งหมด ✅ ต้องทำ
   ↓
5. อัปเดต planadmin.md + PROGRESS.md
```

---

## 9. ประมาณการเวลา

| ขั้นตอน | เวลา |
|--------|------|
| เพิ่ม UI | 30 นาที |
| JavaScript logic | 60 นาที |
| Frontend integration | 45 นาที |
| Testing | 45 นาที |
| **รวม** | **180 นาที (~3 ชั่วโมง)** |

