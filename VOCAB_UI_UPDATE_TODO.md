# รายการแก้ไข UI คำศัพท์ให้ครบ 4 โหมด

## ✅ สิ่งที่ทำเสร็จแล้ว

1. ✅ อัปเดต HTML Stepper เป็น 4 steps
2. ✅ เพิ่ม Step 3 (Listen & Repeat) ใน HTML
3. ✅ เปลี่ยนลำดับเป็น: จับคู่ → สะกด → ฟัง-พูด → เติมช่องว่าง
4. ✅ อัปเดตฟังก์ชัน `showVocabStep()` ให้รองรับ 4 steps

## 📝 สิ่งที่ต้องทำต่อ

### 1. เพิ่มฟังก์ชัน `renderListenRepeatList()`
```javascript
function renderListenRepeatList() {
  const container = document.getElementById('vocabset-listen-items');
  if (!container) return;
  container.innerHTML = '';
  
  const matchingPairs = vocabsetItems.filter(item => 
    item && item.wordEN && item.wordTH && 
    item.wordEN.trim() && item.wordTH.trim()
  );
  
  if (matchingPairs.length === 0) {
    // Show empty message
    return;
  }
  
  matchingPairs.forEach((pair, index) => {
    // Create checkbox list similar to spelling
  });
  
  updateListenCount();
}
```

### 2. เพิ่มฟังก์ชัน helper
```javascript
function updateListenCount() {
  const checkedCount = document.querySelectorAll('#vocabset-listen-items input[type="checkbox"]:checked').length;
  document.getElementById('vocabset-listen-count').textContent = checkedCount;
}

function getSelectedListenWords() {
  const checkboxes = document.querySelectorAll('#vocabset-listen-items input[type="checkbox"]:checked');
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

### 3. แก้ไข Event Listeners ปุ่ม Navigation

#### Step 1 → Step 2
```javascript
document.getElementById('vocabset-next-btn').addEventListener('click', () => {
  // Validate: อย่างน้อย 10 คู่
  if (vocabsetItems.length < 10) {
    showVocabSetError('ต้องมีอย่างน้อย 10 คู่คำศัพท์');
    return;
  }
  showVocabStep(2); // ไป Spelling
});
```

#### Step 2 → Step 3
```javascript
document.getElementById('vocabset-next-btn-s2').addEventListener('click', () => {
  // Optional validation
  showVocabStep(3); // ไป Listen & Repeat
});
```

#### Step 3 → Step 4
```javascript
document.getElementById('vocabset-next-btn-s3').addEventListener('click', () => {
  // Optional validation
  showVocabStep(4); // ไป Fill-in-blank
});
```

#### Step 2 ← Step 1
```javascript
document.getElementById('vocabset-prev-btn').addEventListener('click', () => {
  showVocabStep(1);
});
```

#### Step 3 ← Step 2
```javascript
document.getElementById('vocabset-prev-btn-s3').addEventListener('click', () => {
  showVocabStep(2);
});
```

#### Step 4 ← Step 3
```javascript
document.getElementById('vocabset-prev-btn-s4').addEventListener('click', () => {
  showVocabStep(3);
});
```

### 4. แก้ไขฟังก์ชัน Save

ต้องรวบรวมข้อมูลจากทุก step:

```javascript
document.getElementById('vocabset-save-btn').addEventListener('click', async () => {
  const title = vocabsetTitle.value.trim();
  const description = vocabsetDesc.value.trim();
  const speed = parseFloat(vocabsetSpeed.value);
  const status = vocabsetPubToggle.checked ? 'published' : 'draft';
  
  // Step 1: Matching pairs (MASTER)
  const matchingPairs = vocabsetItems.filter(item => 
    item.wordEN && item.wordTH
  );
  
  // Step 2: Spelling words (selected)
  const spellingWords = getSelectedSpellingWords();
  
  // Step 3: Listen & Repeat words (selected)
  const listenRepeatWords = getSelectedListenWords();
  
  // Step 4: Fill-in-blank sentences
  const fillInBlankSentences = vocabsetSentenceRows.filter(row => 
    row.sentence && row.sentence.trim()
  );
  
  const payload = {
    title,
    description,
    level: 'A2', // or from selector
    speed,
    status,
    matchingPairs,
    spellingWords,
    listenRepeatWords,
    fillInBlankSentences,
    updatedAt: serverTimestamp()
  };
  
  if (!vocabsetEditId) {
    payload.createdAt = serverTimestamp();
  }
  
  try {
    const token = await auth.currentUser.getIdToken();
    const url = vocabsetEditId 
      ? `/api/admin/vocabulary-sets/${vocabsetEditId}` 
      : '/api/admin/vocabulary-sets';
    const method = vocabsetEditId ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    
    hideVocabSetEdit();
    await loadVocabSets();
    await loadStats();
  } catch (err) {
    showVocabSetError(err.message);
  }
});
```

### 5. เพิ่มฟังก์ชัน `showVocabSetError()`

```javascript
function showVocabSetError(msg) {
  vocabsetErr.textContent = msg;
  vocabsetErr.classList.remove('hidden');
}
```

### 6. อัปเดต Backend API

Backend ต้องรองรับโครงสร้างข้อมูลใหม่:

```javascript
POST/PUT /api/admin/vocabulary-sets
{
  "title": "ชุดที่ 1",
  "description": "คำศัพท์พื้นฐาน",
  "level": "A2",
  "speed": 1.0,
  "status": "published",
  "matchingPairs": [
    { "wordEN": "Apple", "wordTH": "แอปเปิ้ล" },
    ...
  ],
  "spellingWords": [
    { "wordEN": "Apple", "wordTH": "แอปเปิ้ล" },
    ...
  ],
  "listenRepeatWords": [
    { "wordEN": "Apple", "wordTH": "แอปเปิ้ล" },
    ...
  ],
  "fillInBlankSentences": [
    {
      "linkIdx": 0,
      "sentence": "I eat an _____ every day",
      "sentenceTH": "ฉันกิน___ทุกวัน"
    },
    ...
  ]
}
```

---

## 🎯 ลำดับการทำงาน

1. ✅ เพิ่มฟังก์ชัน `renderListenRepeatList()`
2. ✅ เพิ่ม helper functions
3. ✅ เพิ่ม event listeners ทั้งหมด
4. ✅ แก้ไขฟังก์ชัน save ให้รวบรวมข้อมูลจาก 4 steps
5. ⏳ ทดสอบ UI ว่าทำงานครบทุก step
6. ⏳ แก้ไข Backend API ให้รองรับโครงสร้างใหม่

---

## 📌 หมายเหตุ

- จำนวนคำศัพท์ขั้นต่ำใน Step 1: **10 คู่** (ตามเอกสาร 10-15 ข้อ)
- ใน Step 2, 3, 4 ให้เลือกได้ตามต้องการ (ไม่บังคับทุกคำ)
- ผู้ใช้สามารถข้ามโหมดฟัง-พูดตามได้ (ระบบจะจัดการในแอป)
