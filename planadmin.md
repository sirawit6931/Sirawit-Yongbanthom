# แผนการทำงาน: Web Admin Portal

## สถานะ: ✅ เสร็จสมบูรณ์ (Phase 1 + Phase 2 ครบทุก Step)

---

## สิ่งที่ทำแล้ว (Phase 1 — โครงสร้างหลัก)

- [x] `server.js` — serve `/admin` static + fallback + bind `0.0.0.0`
- [x] `public/admin/index.html` — SPA login + dashboard
- [x] `public/admin/css/style.css` — UI Kanit font
- [x] `public/admin/js/adminApp.js` — Firebase auth + Firestore

---

## สิ่งที่ทำแล้ว (Phase 2 — ฟีเจอร์ครบ)

### Step 1 — แก้ไข/ลบ สมาชิก ✅
- ตาราง Users + ปุ่ม Edit/Delete
- Edit Modal: แก้ displayName, email → `updateDoc`
- Delete: `deleteDoc` + confirm

### Step 2 — เพิ่ม/แก้ไข/ลบ แบบฝึกหัด ✅
- ตาราง Exercises + ปุ่ม Add/Edit/Delete
- Add/Edit Modal: ชื่อ, ประเภท (vocab/tense/listening), คำอธิบาย
- `addDoc` / `updateDoc` / `deleteDoc`

### Step 3 — แก้ไขคำศัพท์ในคลัง ✅
- ตาราง Vocabulary + ปุ่ม Add/Edit/Delete
- Modal: wordEN, wordTH, ttsVoice
- `addDoc` / `updateDoc` / `deleteDoc`

### Step 4 — ดูคะแนน/ความคืบหน้าสมาชิก ✅
- Nav "📈 สถิติสมาชิก"
- ตาราง Statistics: email / ประเภท / ชื่อแบบฝึก / คะแนน / % / เวลา / ผล / วันที่
- กรองด้วยอีเมล + ประเภท

### Step 5 — จัดการ Admin หลายคน ✅
- Nav "🛡 จัดการ Admin"
- ตาราง admins collection
- Add Admin Modal → `setDoc('admins/{email}')`
- ป้องกันลบตัวเอง

### Step 6 — Pagination ✅
- `renderPage()` helper — 20 rows/page
- ปุ่มหน้า ‹ › พร้อม ellipsis
- ใช้กับทุกตาราง: Users, Exercises, Vocab, Stats

---

## URL
```
http://localhost:5000/admin
http://192.168.1.117:5000/admin
```

## Firestore Collections
| Collection   | ใช้ใน                        |
|--------------|------------------------------|
| `admins`     | login check + จัดการ admin   |
| `users`      | สมาชิก CRUD                  |
| `exercises`  | แบบฝึกหัด CRUD               |
| `vocabulary` | คำศัพท์ CRUD                 |
| `statistics` | ดูคะแนน + กรอง              |
