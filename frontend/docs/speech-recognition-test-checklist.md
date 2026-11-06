# Manual Test Checklist: Speech Recognition (Web & Native)

เอกสารสำหรับทีม QA / Dev ทดสอบฟีเจอร์ฟังและพูดตาม (Pronunciation Stage) ทั้งบน Web, Expo Go, และ Native Dev Client ก่อน release ทุกเวอร์ชัน

---

## 1. Web Environment (Chrome / Safari / Edge)
- [ ] **1.1 Web Regression**: เข้าหน้าแบบฝึกหัดคำศัพท์ → ด่าน "ฟังและพูดตาม"
- [ ] **1.2 Mic Permission Prompt**: เบราว์เซอร์ต้องถามขอสิทธิ์เข้าถึงไมโครโฟนเมื่อกดบันทึกเสียงครั้งแรก
- [ ] **1.3 Correct Pronunciation**: ออกเสียงตรงกับคำศัพท์ → ต้องขึ้นสถานะ "ถูกต้อง 🎉" (สีเขียว) + เสียง feedback "Excellent!"
- [ ] **1.4 Incorrect Pronunciation**: ออกเสียงผิด → ต้องขึ้น "ไม่ถูกต้อง" (สีแดง) พร้อมข้อความ "ได้ยินเป็น: ..."
- [ ] **1.5 Skip Button**: ปุ่ม "ข้ามด่านนี้" ต้องกดได้ทุกสถานะ (idle, wrong, listening)
- [ ] **1.6 Denied Permission**: ปฏิเสธไมโครโฟนในเบราว์เซอร์ → ต้องขึ้นข้อความ "ไม่อนุญาตให้ใช้ไมโครโฟน" สุภาพ ไม่ crash

---

## 2. Expo Go (iOS & Android)
- [ ] **2.1 Graceful Fallback**: เปิดแอปใน Expo Go เข้าด่าน "ฟังและพูดตาม"
- [ ] **2.2 No Crash**: แอปต้องไม่ crash ตอนเข้าหน้านี้ (ตรวจจับว่าไม่มี native module อย่างปลอดภัย)
- [ ] **2.3 Descriptive Alert / Message**: เมื่อกดบันทึกเสียง ต้องแสดงข้อความแจ้งเตือนชัดเจนว่า "การตรวจเสียงพูดเปิดใช้งานเฉพาะบน Development Build หรือ Web Browser"
- [ ] **2.4 Skip Continues**: ผู้ใช้สามารถกด "ข้ามด่านนี้" เพื่อผ่านไปด่านถัดไปหรือดูผลลัพธ์ได้ตามปกติ

---

## 3. Native Dev Build (Real iOS Device)
- [ ] **3.1 Mic Permission Dialog**: กดบันทึกเสียงครั้งแรก → iOS แสดง popup ขอสิทธิ์ไมโครโฟนตาม `NSMicrophoneUsageDescription`
- [ ] **3.2 Speech Recognition Permission Dialog**: iOS แสดง popup ขอสิทธิ์การจดจำเสียงพูดตาม `NSSpeechRecognitionUsageDescription`
- [ ] **3.3 Denied Permission Handling**: หากกด "ไม่อนุญาต" → ต้องขึ้นสถานะ unsupported พร้อมข้อความ "ไม่อนุญาตให้ใช้ไมโครโฟน — กรุณาเปิดสิทธิ์ในการตั้งค่า" และมีปุ่มเปิด App Settings ได้
- [ ] **3.4 Audio Session & TTS Concurrency**:
  - กดปุ่ม 🔊 เพื่อฟังเสียงคำศัพท์ (TTS)
  - กดปุ่ม 🎤 ทันที → TTS ต้องหยุดทันที และระบบเริ่มฟังเสียง
  - พูดถูก → ระบบเล่นเสียง "Excellent!" (TTS) ออกมาได้ชัดเจน ไม่ติดขัด
- [ ] **3.5 Transcript Accuracy**: พูดคำศัพท์ภาษาอังกฤษทั่วไป (เช่น "cat", "computer") แล้วได้ transcript ตรง

---

## 4. Native Dev Build (Real Android Device)
- [ ] **4.1 RECORD_AUDIO Permission**: Android แสดง popup ขอสิทธิ์บันทึกเสียง
- [ ] **4.2 Google Speech Services**: เครื่องที่มี Google App / Speech Services ต้องเริ่มฟังและรับ transcript ได้
- [ ] **4.3 Without Google Speech Services (Device Edge Case)**: เครื่องที่ไม่มี Google Services ต้องขึ้นสถานะไม่รองรับอย่างสุภาพ ไม่ค้าง
- [ ] **4.4 Network Interruption**: ปิด Wi-Fi/4G ระหว่างตรวจจับเสียง → ต้องแสดง error สุภาพและอนุญาตให้กดข้ามหรือลองใหม่ได้

---

## 5. Audio Concurrency & Memory Leaks
- [ ] **5.1 Rapid Stage Switching**: กดข้ามด่านอย่างรวดเร็วระหว่างที่กำลังฟังเสียง (`listening`) → ระบบต้องหยุดการฟังทันที ไม่ปล่อย listener ค้าง
- [ ] **5.2 Screen Exit**: กดย้อนกลับ / ออกจากหน้าแบบฝึกหัดระหว่างกำลังบันทึกเสียง → ไมโครโฟนต้องถูกปล่อย (ไอคอนส้ม/เขียวบน iOS status bar ต้องดับลง)
