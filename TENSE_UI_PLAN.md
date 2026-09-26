# แผนการสร้าง UI Tense / Grammar

## 📋 ความต้องการตามเอกสาร

### แบบฝึกหัด Tense มี 3 โหมด:
1. **เรียงประโยค (Sentence Reordering)** - มีคำที่สับสน ต้องเรียงให้ถูกต้อง
2. **เติมคำในช่องว่าง (Fill-in-blank)** - มีช่องว่างให้เติมคำ
3. **ฟังและพูดตาม (Listen & Repeat)** - ฟังประโยคและพูดตาม (ข้ามได้)

### ข้อกำหนด:
- 1 ชุดมี **10-15 ข้อ**
- แต่ละข้อระบุ **Tense** (Present, Past, Future)
- ระบุระดับ **A1 หรือ A2**
- มีเสียง TTS (ชาย/หญิง)
- **ระบบสุ่มสลับ** โหมดในแต่ละข้อ

---

## 🎯 โครงสร้างข้อมูล

```javascript
{
  "title": "Present Simple ชุดที่ 1",
  "tenseTag": "Present" | "Past" | "Future",
  "level": "A1" | "A2",
  "description": "คำอธิบาย",
  "ttsSystem": "female" | "male",
  "status": "draft" | "published",
  "items": [
    {
      // สำหรับ Reordering (เรียงประโยค)
      "mode": "reorder",
      "targetSentence": "I go to school every day",
      "scrambledWords": ["go", "I", "every", "school", "day", "to"],
      "tenseIndicator": "Present",
      "ttsVoice": "female"
    },
    {
      // สำหรับ Fill-in-blank (เติมคำ)
      "mode": "fillBlank",
      "targetSentence": "She _____ to the park yesterday",
      "missingWord": "went",
      "correctAnswer": "went",
      "tenseIndicator": "Past",
      "ttsVoice": "female"
    },
    {
      // สำหรับ Listen & Repeat (ฟัง-พูด)
      "mode": "listenRepeat",
      "targetSentence": "I will visit my friend tomorrow",
      "tenseIndicator": "Future",
      "ttsVoice": "male"
    }
  ]
}
```

---

## 🎨 UI Design - Modal แบบเดียว (ไม่ต้องใช้ Wizard)

```
┌────────────────────────────────────────────────┐
│ ⏱ สร้างชุดแบบฝึกหัด Tense               [✕]  │
├────────────────────────────────────────────────┤
│ ชื่อชุด: [Present Simple ชุดที่ 1_______]    │
│ หมวด Tense: ○ Present  ○ Past  ○ Future      │
│ ระดับ: ○ A1  ○ A2                             │
│ คำอธิบาย: [____________________________]      │
│ เสียง TTS: ○ หญิง  ○ ชาย                     │
├────────────────────────────────────────────────┤
│ 📝 รายการคำถาม (10-15 ข้อ)                   │
│                                                 │
│ ┌────────────────────────────────────────┐    │
│ │ ข้อที่ 1                          [🗑] │    │
│ │ โหมด: [เรียงประโยค ▼]                 │    │
│ │                                        │    │
│ │ ประโยคเป้าหมาย:                       │    │
│ │ [I go to school every day._______]    │    │
│ │                                        │    │
│ │ คำที่สับสน (คั่นด้วยคอมม่า):        │    │
│ │ [go, I, every, school, day, to____]   │    │
│ │                                        │    │
│ │ Tense: Present  เสียง: หญิง           │    │
│ └────────────────────────────────────────┘    │
│                                                 │
│ ┌────────────────────────────────────────┐    │
│ │ ข้อที่ 2                          [🗑] │    │
│ │ โหมด: [เติมคำในช่องว่าง ▼]            │    │
│ │                                        │    │
│ │ ประโยคที่มีช่องว่าง:                  │    │
│ │ [She _____ to the park yesterday.]    │    │
│ │                                        │    │
│ │ คำที่หายไป: [went]                    │    │
│ │ คำตอบที่ถูก: [went]                   │    │
│ │                                        │    │
│ │ Tense: Past  เสียง: หญิง              │    │
│ └────────────────────────────────────────┘    │
│                                                 │
│ ┌────────────────────────────────────────┐    │
│ │ ข้อที่ 3                          [🗑] │    │
│ │ โหมด: [ฟังและพูดตาม ▼]                │    │
│ │                                        │    │
│ │ ประโยค:                               │    │
│ │ [I will visit my friend tomorrow.]    │    │
│ │                                        │    │
│ │ Tense: Future  เสียง: ชาย             │    │
│ └────────────────────────────────────────┘    │
│                                                 │
│ [+ เพิ่มคำถามใหม่]                            │
├────────────────────────────────────────────────┤
│ สถานะ: ○ แบบร่าง  ○ เผยแพร่                  │
│ [ยกเลิก]                      [บันทึกชุด ✓]  │
└────────────────────────────────────────────────┘
```

---

## 🔨 การ Implementation

### 1. HTML Structure (มีอยู่แล้ว ✅)
- Modal: `#tenseset-modal`
- Form fields: title, tenseTag, level, description, ttsSystem
- Item list: `#tenseset-item-editor-list`
- Buttons: add, save, cancel

### 2. JavaScript Functions (ต้องสร้างใหม่)

```javascript
// Variables
let tensesetItems = [];
let tensesetEditId = null;

// Functions
function openTenseSetModal(mode, data)
function closeTenseSetModal()
function renderTenseSetItems()
function addTenseSetItem()
function deleteTenseSetItem(index)
function updateTenseSetItem(index, field, value)
function saveTenseSet()

// Event Listeners
document.getElementById('add-tenseset-btn').addEventListener('click', ...)
document.getElementById('tenseset-add-item-btn').addEventListener('click', ...)
document.getElementById('tenseset-save-btn').addEventListener('click', ...)
```

### 3. Item Card Template

แต่ละข้อจะมี UI ที่แตกต่างกันตาม mode:

#### Mode: Reorder (เรียงประโยค)
```html
<div class="tense-item-card">
  <div class="item-header">
    <span>ข้อที่ 1</span>
    <button class="delete-btn">🗑</button>
  </div>
  <select class="mode-selector">
    <option value="reorder" selected>เรียงประโยค</option>
    <option value="fillBlank">เติมคำ</option>
    <option value="listenRepeat">ฟัง-พูด</option>
  </select>
  <input placeholder="ประโยคเป้าหมาย" />
  <input placeholder="คำที่สับสน (คั่นด้วยคอมม่า)" />
  <select tense>Present/Past/Future</select>
  <select voice>หญิง/ชาย</select>
</div>
```

#### Mode: Fill-in-blank (เติมคำ)
```html
<div class="tense-item-card">
  ...
  <input placeholder="ประโยคที่มีช่องว่าง (ใช้ _____ )" />
  <input placeholder="คำที่หายไป" />
  <input placeholder="คำตอบที่ถูกต้อง" />
  ...
</div>
```

#### Mode: Listen & Repeat (ฟัง-พูด)
```html
<div class="tense-item-card">
  ...
  <input placeholder="ประโยคให้ฟัง" />
  (ไม่ต้องกรอกอะไรเพิ่ม - แค่ประโยคเดียว)
  ...
</div>
```

---

## 📝 Validation Rules

1. ต้องกรอกชื่อชุด
2. ต้องมี 10-15 ข้อ
3. แต่ละข้อต้องกรอกให้ครบตาม mode:
   - **Reorder:** targetSentence + scrambledWords
   - **FillBlank:** targetSentence + missingWord + correctAnswer
   - **ListenRepeat:** targetSentence เท่านั้น

---

## 🎯 Next Steps

1. ✅ สร้าง JavaScript functions พื้นฐาน
2. ✅ สร้าง renderTenseSetItems() พร้อม dynamic UI ตาม mode
3. ✅ เพิ่ม event listeners ครบ
4. ✅ เพิ่ม validation
5. ✅ เชื่อม API save/update
6. ⏳ ทดสอบ end-to-end
