// backend/seed.js
// รัน: node seed.js
// ใส่ข้อมูล Oxford 3000 (A1–A2) + exercises เข้า Firestore
// รันซ้ำได้ — ใช้ setMerge จะ overwrite เฉพาะที่เปลี่ยน

require('dotenv').config();
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const serviceAccount = require('./serviceAccountKey.json');
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ══════════════════════════════════════════════════════════════════════════════
// Oxford 3000 — A1 Level (100 คำ)
// ══════════════════════════════════════════════════════════════════════════════
const OXFORD_A1 = [
  { id:'a1_001', wordEN:'apple',       wordTH:'แอปเปิ้ล',         level:'A1', cefrLevel:'A1' },
  { id:'a1_002', wordEN:'bag',         wordTH:'กระเป๋า',           level:'A1', cefrLevel:'A1' },
  { id:'a1_003', wordEN:'book',        wordTH:'หนังสือ',            level:'A1', cefrLevel:'A1' },
  { id:'a1_004', wordEN:'cat',         wordTH:'แมว',               level:'A1', cefrLevel:'A1' },
  { id:'a1_005', wordEN:'day',         wordTH:'วัน',               level:'A1', cefrLevel:'A1' },
  { id:'a1_006', wordEN:'dog',         wordTH:'สุนัข',             level:'A1', cefrLevel:'A1' },
  { id:'a1_007', wordEN:'door',        wordTH:'ประตู',              level:'A1', cefrLevel:'A1' },
  { id:'a1_008', wordEN:'egg',         wordTH:'ไข่',               level:'A1', cefrLevel:'A1' },
  { id:'a1_009', wordEN:'family',      wordTH:'ครอบครัว',           level:'A1', cefrLevel:'A1' },
  { id:'a1_010', wordEN:'fish',        wordTH:'ปลา',               level:'A1', cefrLevel:'A1' },
  { id:'a1_011', wordEN:'food',        wordTH:'อาหาร',             level:'A1', cefrLevel:'A1' },
  { id:'a1_012', wordEN:'friend',      wordTH:'เพื่อน',             level:'A1', cefrLevel:'A1' },
  { id:'a1_013', wordEN:'girl',        wordTH:'เด็กผู้หญิง',        level:'A1', cefrLevel:'A1' },
  { id:'a1_014', wordEN:'hand',        wordTH:'มือ',               level:'A1', cefrLevel:'A1' },
  { id:'a1_015', wordEN:'happy',       wordTH:'มีความสุข',          level:'A1', cefrLevel:'A1' },
  { id:'a1_016', wordEN:'house',       wordTH:'บ้าน',              level:'A1', cefrLevel:'A1' },
  { id:'a1_017', wordEN:'love',        wordTH:'รัก',               level:'A1', cefrLevel:'A1' },
  { id:'a1_018', wordEN:'man',         wordTH:'ผู้ชาย',             level:'A1', cefrLevel:'A1' },
  { id:'a1_019', wordEN:'milk',        wordTH:'นม',                level:'A1', cefrLevel:'A1' },
  { id:'a1_020', wordEN:'money',       wordTH:'เงิน',              level:'A1', cefrLevel:'A1' },
  { id:'a1_021', wordEN:'mother',      wordTH:'แม่',               level:'A1', cefrLevel:'A1' },
  { id:'a1_022', wordEN:'name',        wordTH:'ชื่อ',              level:'A1', cefrLevel:'A1' },
  { id:'a1_023', wordEN:'night',       wordTH:'กลางคืน',            level:'A1', cefrLevel:'A1' },
  { id:'a1_024', wordEN:'one',         wordTH:'หนึ่ง',              level:'A1', cefrLevel:'A1' },
  { id:'a1_025', wordEN:'people',      wordTH:'ผู้คน',              level:'A1', cefrLevel:'A1' },
  { id:'a1_026', wordEN:'phone',       wordTH:'โทรศัพท์',           level:'A1', cefrLevel:'A1' },
  { id:'a1_027', wordEN:'rain',        wordTH:'ฝน',                level:'A1', cefrLevel:'A1' },
  { id:'a1_028', wordEN:'read',        wordTH:'อ่าน',              level:'A1', cefrLevel:'A1' },
  { id:'a1_029', wordEN:'road',        wordTH:'ถนน',               level:'A1', cefrLevel:'A1' },
  { id:'a1_030', wordEN:'room',        wordTH:'ห้อง',              level:'A1', cefrLevel:'A1' },
  { id:'a1_031', wordEN:'school',      wordTH:'โรงเรียน',           level:'A1', cefrLevel:'A1' },
  { id:'a1_032', wordEN:'sister',      wordTH:'พี่น้องสาว',         level:'A1', cefrLevel:'A1' },
  { id:'a1_033', wordEN:'sky',         wordTH:'ท้องฟ้า',            level:'A1', cefrLevel:'A1' },
  { id:'a1_034', wordEN:'small',       wordTH:'เล็ก',              level:'A1', cefrLevel:'A1' },
  { id:'a1_035', wordEN:'sun',         wordTH:'ดวงอาทิตย์',         level:'A1', cefrLevel:'A1' },
  { id:'a1_036', wordEN:'teacher',     wordTH:'ครู',               level:'A1', cefrLevel:'A1' },
  { id:'a1_037', wordEN:'time',        wordTH:'เวลา',              level:'A1', cefrLevel:'A1' },
  { id:'a1_038', wordEN:'tree',        wordTH:'ต้นไม้',             level:'A1', cefrLevel:'A1' },
  { id:'a1_039', wordEN:'two',         wordTH:'สอง',               level:'A1', cefrLevel:'A1' },
  { id:'a1_040', wordEN:'water',       wordTH:'น้ำ',               level:'A1', cefrLevel:'A1' },
  { id:'a1_041', wordEN:'woman',       wordTH:'ผู้หญิง',            level:'A1', cefrLevel:'A1' },
  { id:'a1_042', wordEN:'work',        wordTH:'งาน / ทำงาน',        level:'A1', cefrLevel:'A1' },
  { id:'a1_043', wordEN:'year',        wordTH:'ปี',                level:'A1', cefrLevel:'A1' },
  { id:'a1_044', wordEN:'young',       wordTH:'อายุน้อย',           level:'A1', cefrLevel:'A1' },
  { id:'a1_045', wordEN:'boy',         wordTH:'เด็กผู้ชาย',         level:'A1', cefrLevel:'A1' },
  { id:'a1_046', wordEN:'big',         wordTH:'ใหญ่',              level:'A1', cefrLevel:'A1' },
  { id:'a1_047', wordEN:'good',        wordTH:'ดี',                level:'A1', cefrLevel:'A1' },
  { id:'a1_048', wordEN:'new',         wordTH:'ใหม่',              level:'A1', cefrLevel:'A1' },
  { id:'a1_049', wordEN:'old',         wordTH:'เก่า / แก่',         level:'A1', cefrLevel:'A1' },
  { id:'a1_050', wordEN:'red',         wordTH:'สีแดง',             level:'A1', cefrLevel:'A1' },
  { id:'a1_051', wordEN:'white',       wordTH:'สีขาว',             level:'A1', cefrLevel:'A1' },
  { id:'a1_052', wordEN:'black',       wordTH:'สีดำ',              level:'A1', cefrLevel:'A1' },
  { id:'a1_053', wordEN:'blue',        wordTH:'สีน้ำเงิน',          level:'A1', cefrLevel:'A1' },
  { id:'a1_054', wordEN:'green',       wordTH:'สีเขียว',            level:'A1', cefrLevel:'A1' },
  { id:'a1_055', wordEN:'open',        wordTH:'เปิด',              level:'A1', cefrLevel:'A1' },
  { id:'a1_056', wordEN:'close',       wordTH:'ปิด',               level:'A1', cefrLevel:'A1' },
  { id:'a1_057', wordEN:'run',         wordTH:'วิ่ง',               level:'A1', cefrLevel:'A1' },
  { id:'a1_058', wordEN:'walk',        wordTH:'เดิน',              level:'A1', cefrLevel:'A1' },
  { id:'a1_059', wordEN:'eat',         wordTH:'กิน',               level:'A1', cefrLevel:'A1' },
  { id:'a1_060', wordEN:'drink',       wordTH:'ดื่ม',              level:'A1', cefrLevel:'A1' },
  { id:'a1_061', wordEN:'sleep',       wordTH:'นอนหลับ',            level:'A1', cefrLevel:'A1' },
  { id:'a1_062', wordEN:'play',        wordTH:'เล่น',              level:'A1', cefrLevel:'A1' },
  { id:'a1_063', wordEN:'write',       wordTH:'เขียน',             level:'A1', cefrLevel:'A1' },
  { id:'a1_064', wordEN:'speak',       wordTH:'พูด',               level:'A1', cefrLevel:'A1' },
  { id:'a1_065', wordEN:'listen',      wordTH:'ฟัง',               level:'A1', cefrLevel:'A1' },
  { id:'a1_066', wordEN:'go',          wordTH:'ไป',                level:'A1', cefrLevel:'A1' },
  { id:'a1_067', wordEN:'come',        wordTH:'มา',                level:'A1', cefrLevel:'A1' },
  { id:'a1_068', wordEN:'see',         wordTH:'เห็น',              level:'A1', cefrLevel:'A1' },
  { id:'a1_069', wordEN:'know',        wordTH:'รู้',               level:'A1', cefrLevel:'A1' },
  { id:'a1_070', wordEN:'like',        wordTH:'ชอบ',               level:'A1', cefrLevel:'A1' },
  { id:'a1_071', wordEN:'father',      wordTH:'พ่อ',               level:'A1', cefrLevel:'A1' },
  { id:'a1_072', wordEN:'brother',     wordTH:'พี่น้องชาย',         level:'A1', cefrLevel:'A1' },
  { id:'a1_073', wordEN:'child',       wordTH:'เด็ก',              level:'A1', cefrLevel:'A1' },
  { id:'a1_074', wordEN:'city',        wordTH:'เมือง',             level:'A1', cefrLevel:'A1' },
  { id:'a1_075', wordEN:'car',         wordTH:'รถยนต์',            level:'A1', cefrLevel:'A1' },
  { id:'a1_076', wordEN:'chair',       wordTH:'เก้าอี้',            level:'A1', cefrLevel:'A1' },
  { id:'a1_077', wordEN:'table',       wordTH:'โต๊ะ',              level:'A1', cefrLevel:'A1' },
  { id:'a1_078', wordEN:'bed',         wordTH:'เตียง',             level:'A1', cefrLevel:'A1' },
  { id:'a1_079', wordEN:'window',      wordTH:'หน้าต่าง',           level:'A1', cefrLevel:'A1' },
  { id:'a1_080', wordEN:'garden',      wordTH:'สวน',               level:'A1', cefrLevel:'A1' },
  { id:'a1_081', wordEN:'morning',     wordTH:'ตอนเช้า',            level:'A1', cefrLevel:'A1' },
  { id:'a1_082', wordEN:'afternoon',   wordTH:'ตอนบ่าย',            level:'A1', cefrLevel:'A1' },
  { id:'a1_083', wordEN:'evening',     wordTH:'ตอนเย็น',            level:'A1', cefrLevel:'A1' },
  { id:'a1_084', wordEN:'today',       wordTH:'วันนี้',             level:'A1', cefrLevel:'A1' },
  { id:'a1_085', wordEN:'tomorrow',    wordTH:'พรุ่งนี้',            level:'A1', cefrLevel:'A1' },
  { id:'a1_086', wordEN:'yesterday',   wordTH:'เมื่อวาน',           level:'A1', cefrLevel:'A1' },
  { id:'a1_087', wordEN:'beautiful',   wordTH:'สวยงาม',            level:'A1', cefrLevel:'A1' },
  { id:'a1_088', wordEN:'cold',        wordTH:'เย็น / หนาว',        level:'A1', cefrLevel:'A1' },
  { id:'a1_089', wordEN:'hot',         wordTH:'ร้อน',              level:'A1', cefrLevel:'A1' },
  { id:'a1_090', wordEN:'fast',        wordTH:'เร็ว',              level:'A1', cefrLevel:'A1' },
  { id:'a1_091', wordEN:'slow',        wordTH:'ช้า',               level:'A1', cefrLevel:'A1' },
  { id:'a1_092', wordEN:'long',        wordTH:'ยาว',               level:'A1', cefrLevel:'A1' },
  { id:'a1_093', wordEN:'short',       wordTH:'สั้น',              level:'A1', cefrLevel:'A1' },
  { id:'a1_094', wordEN:'high',        wordTH:'สูง',               level:'A1', cefrLevel:'A1' },
  { id:'a1_095', wordEN:'low',         wordTH:'ต่ำ',               level:'A1', cefrLevel:'A1' },
  { id:'a1_096', wordEN:'first',       wordTH:'แรก / อันดับหนึ่ง', level:'A1', cefrLevel:'A1' },
  { id:'a1_097', wordEN:'last',        wordTH:'สุดท้าย',            level:'A1', cefrLevel:'A1' },
  { id:'a1_098', wordEN:'rice',        wordTH:'ข้าว',              level:'A1', cefrLevel:'A1' },
  { id:'a1_099', wordEN:'bread',       wordTH:'ขนมปัง',            level:'A1', cefrLevel:'A1' },
  { id:'a1_100', wordEN:'orange',      wordTH:'ส้ม',               level:'A1', cefrLevel:'A1' },
];

// ══════════════════════════════════════════════════════════════════════════════
// Oxford 3000 — A2 Level (100 คำ)
// ══════════════════════════════════════════════════════════════════════════════
const OXFORD_A2 = [
  { id:'a2_001', wordEN:'accident',    wordTH:'อุบัติเหตุ',         level:'A2', cefrLevel:'A2' },
  { id:'a2_002', wordEN:'address',     wordTH:'ที่อยู่',             level:'A2', cefrLevel:'A2' },
  { id:'a2_003', wordEN:'advice',      wordTH:'คำแนะนำ',            level:'A2', cefrLevel:'A2' },
  { id:'a2_004', wordEN:'airport',     wordTH:'สนามบิน',            level:'A2', cefrLevel:'A2' },
  { id:'a2_005', wordEN:'angry',       wordTH:'โกรธ',              level:'A2', cefrLevel:'A2' },
  { id:'a2_006', wordEN:'animal',      wordTH:'สัตว์',              level:'A2', cefrLevel:'A2' },
  { id:'a2_007', wordEN:'answer',      wordTH:'คำตอบ / ตอบ',        level:'A2', cefrLevel:'A2' },
  { id:'a2_008', wordEN:'arm',         wordTH:'แขน',               level:'A2', cefrLevel:'A2' },
  { id:'a2_009', wordEN:'arrive',      wordTH:'มาถึง',              level:'A2', cefrLevel:'A2' },
  { id:'a2_010', wordEN:'ask',         wordTH:'ถาม',               level:'A2', cefrLevel:'A2' },
  { id:'a2_011', wordEN:'bank',        wordTH:'ธนาคาร',             level:'A2', cefrLevel:'A2' },
  { id:'a2_012', wordEN:'bathroom',    wordTH:'ห้องน้ำ',             level:'A2', cefrLevel:'A2' },
  { id:'a2_013', wordEN:'beach',       wordTH:'ชายหาด',             level:'A2', cefrLevel:'A2' },
  { id:'a2_014', wordEN:'begin',       wordTH:'เริ่มต้น',            level:'A2', cefrLevel:'A2' },
  { id:'a2_015', wordEN:'believe',     wordTH:'เชื่อ',              level:'A2', cefrLevel:'A2' },
  { id:'a2_016', wordEN:'bird',        wordTH:'นก',                level:'A2', cefrLevel:'A2' },
  { id:'a2_017', wordEN:'body',        wordTH:'ร่างกาย',            level:'A2', cefrLevel:'A2' },
  { id:'a2_018', wordEN:'boring',      wordTH:'น่าเบื่อ',            level:'A2', cefrLevel:'A2' },
  { id:'a2_019', wordEN:'borrow',      wordTH:'ยืม',               level:'A2', cefrLevel:'A2' },
  { id:'a2_020', wordEN:'bus',         wordTH:'รถบัส',              level:'A2', cefrLevel:'A2' },
  { id:'a2_021', wordEN:'busy',        wordTH:'ยุ่ง',               level:'A2', cefrLevel:'A2' },
  { id:'a2_022', wordEN:'buy',         wordTH:'ซื้อ',              level:'A2', cefrLevel:'A2' },
  { id:'a2_023', wordEN:'call',        wordTH:'โทร / เรียก',         level:'A2', cefrLevel:'A2' },
  { id:'a2_024', wordEN:'clean',       wordTH:'สะอาด / ทำความสะอาด', level:'A2', cefrLevel:'A2' },
  { id:'a2_025', wordEN:'clock',       wordTH:'นาฬิกา',             level:'A2', cefrLevel:'A2' },
  { id:'a2_026', wordEN:'colour',      wordTH:'สี',                level:'A2', cefrLevel:'A2' },
  { id:'a2_027', wordEN:'cook',        wordTH:'ทำอาหาร / พ่อครัว',   level:'A2', cefrLevel:'A2' },
  { id:'a2_028', wordEN:'correct',     wordTH:'ถูกต้อง',            level:'A2', cefrLevel:'A2' },
  { id:'a2_029', wordEN:'country',     wordTH:'ประเทศ',             level:'A2', cefrLevel:'A2' },
  { id:'a2_030', wordEN:'dance',       wordTH:'เต้นรำ',             level:'A2', cefrLevel:'A2' },
  { id:'a2_031', wordEN:'decide',      wordTH:'ตัดสินใจ',            level:'A2', cefrLevel:'A2' },
  { id:'a2_032', wordEN:'different',   wordTH:'แตกต่าง',            level:'A2', cefrLevel:'A2' },
  { id:'a2_033', wordEN:'difficult',   wordTH:'ยาก',               level:'A2', cefrLevel:'A2' },
  { id:'a2_034', wordEN:'dinner',      wordTH:'อาหารเย็น',           level:'A2', cefrLevel:'A2' },
  { id:'a2_035', wordEN:'dirty',       wordTH:'สกปรก',             level:'A2', cefrLevel:'A2' },
  { id:'a2_036', wordEN:'dream',       wordTH:'ความฝัน / ฝัน',       level:'A2', cefrLevel:'A2' },
  { id:'a2_037', wordEN:'drive',       wordTH:'ขับรถ',             level:'A2', cefrLevel:'A2' },
  { id:'a2_038', wordEN:'early',       wordTH:'แต่เช้า / เร็ว',       level:'A2', cefrLevel:'A2' },
  { id:'a2_039', wordEN:'easy',        wordTH:'ง่าย',              level:'A2', cefrLevel:'A2' },
  { id:'a2_040', wordEN:'enjoy',       wordTH:'สนุก / ชอบ',          level:'A2', cefrLevel:'A2' },
  { id:'a2_041', wordEN:'enter',       wordTH:'เข้า',              level:'A2', cefrLevel:'A2' },
  { id:'a2_042', wordEN:'example',     wordTH:'ตัวอย่าง',            level:'A2', cefrLevel:'A2' },
  { id:'a2_043', wordEN:'excited',     wordTH:'ตื่นเต้น',            level:'A2', cefrLevel:'A2' },
  { id:'a2_044', wordEN:'exercise',    wordTH:'ออกกำลังกาย',         level:'A2', cefrLevel:'A2' },
  { id:'a2_045', wordEN:'expensive',   wordTH:'แพง',               level:'A2', cefrLevel:'A2' },
  { id:'a2_046', wordEN:'face',        wordTH:'ใบหน้า',             level:'A2', cefrLevel:'A2' },
  { id:'a2_047', wordEN:'feel',        wordTH:'รู้สึก',             level:'A2', cefrLevel:'A2' },
  { id:'a2_048', wordEN:'finish',      wordTH:'เสร็จ / จบ',          level:'A2', cefrLevel:'A2' },
  { id:'a2_049', wordEN:'flower',      wordTH:'ดอกไม้',             level:'A2', cefrLevel:'A2' },
  { id:'a2_050', wordEN:'fly',         wordTH:'บิน',               level:'A2', cefrLevel:'A2' },
  { id:'a2_051', wordEN:'forget',      wordTH:'ลืม',               level:'A2', cefrLevel:'A2' },
  { id:'a2_052', wordEN:'free',        wordTH:'ฟรี / อิสระ',         level:'A2', cefrLevel:'A2' },
  { id:'a2_053', wordEN:'fruit',       wordTH:'ผลไม้',             level:'A2', cefrLevel:'A2' },
  { id:'a2_054', wordEN:'fun',         wordTH:'สนุกสนาน',           level:'A2', cefrLevel:'A2' },
  { id:'a2_055', wordEN:'give',        wordTH:'ให้',               level:'A2', cefrLevel:'A2' },
  { id:'a2_056', wordEN:'grade',       wordTH:'คะแนน / เกรด',        level:'A2', cefrLevel:'A2' },
  { id:'a2_057', wordEN:'help',        wordTH:'ช่วย',              level:'A2', cefrLevel:'A2' },
  { id:'a2_058', wordEN:'hobby',       wordTH:'งานอดิเรก',           level:'A2', cefrLevel:'A2' },
  { id:'a2_059', wordEN:'holiday',     wordTH:'วันหยุด',             level:'A2', cefrLevel:'A2' },
  { id:'a2_060', wordEN:'hospital',    wordTH:'โรงพยาบาล',          level:'A2', cefrLevel:'A2' },
  { id:'a2_061', wordEN:'hotel',       wordTH:'โรงแรม',             level:'A2', cefrLevel:'A2' },
  { id:'a2_062', wordEN:'hungry',      wordTH:'หิว',               level:'A2', cefrLevel:'A2' },
  { id:'a2_063', wordEN:'important',   wordTH:'สำคัญ',             level:'A2', cefrLevel:'A2' },
  { id:'a2_064', wordEN:'interesting', wordTH:'น่าสนใจ',            level:'A2', cefrLevel:'A2' },
  { id:'a2_065', wordEN:'invite',      wordTH:'เชิญ',              level:'A2', cefrLevel:'A2' },
  { id:'a2_066', wordEN:'join',        wordTH:'เข้าร่วม',            level:'A2', cefrLevel:'A2' },
  { id:'a2_067', wordEN:'journey',     wordTH:'การเดินทาง',          level:'A2', cefrLevel:'A2' },
  { id:'a2_068', wordEN:'jump',        wordTH:'กระโดด',             level:'A2', cefrLevel:'A2' },
  { id:'a2_069', wordEN:'kind',        wordTH:'ใจดี / ประเภท',        level:'A2', cefrLevel:'A2' },
  { id:'a2_070', wordEN:'language',    wordTH:'ภาษา',              level:'A2', cefrLevel:'A2' },
  { id:'a2_071', wordEN:'learn',       wordTH:'เรียน',             level:'A2', cefrLevel:'A2' },
  { id:'a2_072', wordEN:'leave',       wordTH:'ออกไป / ทิ้ง',         level:'A2', cefrLevel:'A2' },
  { id:'a2_073', wordEN:'letter',      wordTH:'จดหมาย / ตัวอักษร',    level:'A2', cefrLevel:'A2' },
  { id:'a2_074', wordEN:'library',     wordTH:'ห้องสมุด',            level:'A2', cefrLevel:'A2' },
  { id:'a2_075', wordEN:'market',      wordTH:'ตลาด',              level:'A2', cefrLevel:'A2' },
  { id:'a2_076', wordEN:'meal',        wordTH:'มื้ออาหาร',           level:'A2', cefrLevel:'A2' },
  { id:'a2_077', wordEN:'message',     wordTH:'ข้อความ',            level:'A2', cefrLevel:'A2' },
  { id:'a2_078', wordEN:'miss',        wordTH:'คิดถึง / พลาด',        level:'A2', cefrLevel:'A2' },
  { id:'a2_079', wordEN:'mountain',    wordTH:'ภูเขา',             level:'A2', cefrLevel:'A2' },
  { id:'a2_080', wordEN:'music',       wordTH:'ดนตรี',             level:'A2', cefrLevel:'A2' },
  { id:'a2_081', wordEN:'need',        wordTH:'ต้องการ',            level:'A2', cefrLevel:'A2' },
  { id:'a2_082', wordEN:'neighbour',   wordTH:'เพื่อนบ้าน',          level:'A2', cefrLevel:'A2' },
  { id:'a2_083', wordEN:'newspaper',   wordTH:'หนังสือพิมพ์',         level:'A2', cefrLevel:'A2' },
  { id:'a2_084', wordEN:'noise',       wordTH:'เสียงรบกวน',          level:'A2', cefrLevel:'A2' },
  { id:'a2_085', wordEN:'office',      wordTH:'สำนักงาน',           level:'A2', cefrLevel:'A2' },
  { id:'a2_086', wordEN:'park',        wordTH:'สวนสาธารณะ',          level:'A2', cefrLevel:'A2' },
  { id:'a2_087', wordEN:'party',       wordTH:'งานปาร์ตี้',           level:'A2', cefrLevel:'A2' },
  { id:'a2_088', wordEN:'passport',    wordTH:'หนังสือเดินทาง',       level:'A2', cefrLevel:'A2' },
  { id:'a2_089', wordEN:'pay',         wordTH:'จ่ายเงิน',            level:'A2', cefrLevel:'A2' },
  { id:'a2_090', wordEN:'picture',     wordTH:'รูปภาพ',             level:'A2', cefrLevel:'A2' },
  { id:'a2_091', wordEN:'plan',        wordTH:'แผน / วางแผน',         level:'A2', cefrLevel:'A2' },
  { id:'a2_092', wordEN:'popular',     wordTH:'เป็นที่นิยม',          level:'A2', cefrLevel:'A2' },
  { id:'a2_093', wordEN:'practice',    wordTH:'ฝึกฝน',             level:'A2', cefrLevel:'A2' },
  { id:'a2_094', wordEN:'prepare',     wordTH:'เตรียม',             level:'A2', cefrLevel:'A2' },
  { id:'a2_095', wordEN:'price',       wordTH:'ราคา',              level:'A2', cefrLevel:'A2' },
  { id:'a2_096', wordEN:'problem',     wordTH:'ปัญหา',             level:'A2', cefrLevel:'A2' },
  { id:'a2_097', wordEN:'programme',   wordTH:'โปรแกรม',            level:'A2', cefrLevel:'A2' },
  { id:'a2_098', wordEN:'quiet',       wordTH:'เงียบ',             level:'A2', cefrLevel:'A2' },
  { id:'a2_099', wordEN:'receive',     wordTH:'รับ',               level:'A2', cefrLevel:'A2' },
  { id:'a2_100', wordEN:'remember',    wordTH:'จำ / จำได้',           level:'A2', cefrLevel:'A2' },
];

// ══════════════════════════════════════════════════════════════════════════════
// รวมคำศัพท์ทั้งหมด
// ══════════════════════════════════════════════════════════════════════════════
const ALL_VOCAB = [...OXFORD_A1, ...OXFORD_A2]; // CEFR A1–A2 เท่านั้น (scope)

// ══════════════════════════════════════════════════════════════════════════════
// Helper: สร้าง exercise sets อัตโนมัติตามจำนวนข้อที่กำหนด
// ══════════════════════════════════════════════════════════════════════════════
// chunkSizes: อาร์เรย์กำหนดจำนวนข้อของแต่ละชุด เช่น [10, 15, 10, 15, 10]
// รวมต้องไม่เกิน vocabList.length
function buildVocabExercises(vocabList, level, chunkSizes = [10]) {
  const sets = [];
  let offset = 0;
  for (let s = 0; s < chunkSizes.length; s++) {
    const chunkSize = chunkSizes[s];
    const chunk = vocabList.slice(offset, offset + chunkSize);
    if (chunk.length === 0) break; // คำไม่พอ → หยุด

    const setNum = s + 1;
    const allOtherEN = vocabList
      .filter((_, idx) => idx < offset || idx >= offset + chunkSize)
      .map((v) => v.wordEN);

    const items = chunk.map((v) => {
      // สุ่ม distractors 2 คำจาก level เดียวกัน
      const pool  = allOtherEN.filter((w) => w !== v.wordEN);
      const dist  = pool.sort(() => 0.5 - Math.random()).slice(0, 2);
      return {
        wordId:      v.id,
        wordEN:      v.wordEN,
        wordTH:      v.wordTH,
        sentence:    `I know the word "${v.wordEN}".`,
        sentenceTH:  `ฉันรู้จักคำว่า "${v.wordTH}"`,
        distractors: dist,
      };
    });

    sets.push({
      id:          `vex_${level.toLowerCase()}_${String(setNum).padStart(2,'0')}`,
      category:    'vocab',
      level,
      title:       `คำศัพท์ ${level} ชุดที่ ${setNum}`,
      description: `คำศัพท์ Oxford 3000 ระดับ ${level} ชุดที่ ${setNum}`,
      ttsSystem:   'female',
      items,
    });

    offset += chunkSize;
  }
  return sets;
}

// ══════════════════════════════════════════════════════════════════════════════
// ข้อมูล: ชุดแบบฝึกหัด Tense
// ══════════════════════════════════════════════════════════════════════════════
const TENSE_EXERCISES = [
  {
    id: 'tex001', category: 'tense',
    title: 'แบบฝึกหัด Tense ชุดที่ 1', description: 'Present Simple',
    ttsSystem: 'female',
    items: [
      {
        tenseType:'Present Simple', tenseColor:'#5B4FCF',
        exampleEN:'She goes to school every day.', exampleTH:'เธอไปโรงเรียนทุกวัน',
        sentenceTH:'ฉันไปโรงเรียนทุกวัน',
        sentence:'I ___ to school every day.',
        answer:'go', choices:['go','went','going'],
        orderWords:['I','go','to','school','every','day'],
        speakText:'I go to school every day.',
      },
      {
        tenseType:'Present Simple', tenseColor:'#5B4FCF',
        exampleEN:'He eats rice for lunch.', exampleTH:'เขากินข้าวตอนกลางวัน',
        sentenceTH:'เธอกินแอปเปิ้ลตอนกลางวัน',
        sentence:'She ___ an apple for lunch.',
        answer:'eats', choices:['eat','eats','eaten'],
        orderWords:['She','eats','an','apple','for','lunch'],
        speakText:'She eats an apple for lunch.',
      },
      {
        tenseType:'Present Simple', tenseColor:'#5B4FCF',
        exampleEN:'They play football every weekend.', exampleTH:'พวกเขาเล่นฟุตบอลทุกสุดสัปดาห์',
        sentenceTH:'ฉันดูทีวีทุกคืน',
        sentence:'I ___ TV every night.',
        answer:'watch', choices:['watch','watched','watching'],
        orderWords:['I','watch','TV','every','night'],
        speakText:'I watch TV every night.',
      },
      {
        tenseType:'Present Continuous', tenseColor:'#007AFF',
        exampleEN:'She is reading a book.', exampleTH:'เธอกำลังอ่านหนังสืออยู่',
        sentenceTH:'เขากำลังเล่นฟุตบอลอยู่',
        sentence:'He ___ playing football.',
        answer:'is', choices:['is','are','was'],
        orderWords:['He','is','playing','football'],
        speakText:'He is playing football.',
      },
      {
        tenseType:'Present Continuous', tenseColor:'#007AFF',
        exampleEN:'We are having dinner.', exampleTH:'พวกเรากำลังทานอาหารเย็นอยู่',
        sentenceTH:'พวกเขากำลังเรียนภาษาอังกฤษอยู่',
        sentence:'They ___ studying English.',
        answer:'are', choices:['is','are','were'],
        orderWords:['They','are','studying','English'],
        speakText:'They are studying English.',
      },
    ],
  },
  {
    id: 'tex002', category: 'tense',
    title: 'แบบฝึกหัด Tense ชุดที่ 2', description: 'Past Simple',
    ttsSystem: 'female',
    items: [
      {
        tenseType:'Past Simple', tenseColor:'#FF9500',
        exampleEN:'He ate rice for lunch.', exampleTH:'เขากินข้าวตอนกลางวัน',
        sentenceTH:'พวกเขาเล่นฟุตบอลเมื่อวาน',
        sentence:'They ___ football yesterday.',
        answer:'played', choices:['play','played','will play'],
        orderWords:['They','played','football','yesterday'],
        speakText:'They played football yesterday.',
      },
      {
        tenseType:'Past Simple', tenseColor:'#FF9500',
        exampleEN:'We watched a movie last night.', exampleTH:'พวกเราดูหนังเมื่อคืน',
        sentenceTH:'ฉันเดินทางไปเชียงใหม่เมื่อปีที่แล้ว',
        sentence:'I ___ to Chiang Mai last year.',
        answer:'went', choices:['go','went','will go'],
        orderWords:['I','went','to','Chiang','Mai','last','year'],
        speakText:'I went to Chiang Mai last year.',
      },
      {
        tenseType:'Past Simple', tenseColor:'#FF9500',
        exampleEN:'She studied hard for the test.', exampleTH:'เธอเรียนหนักเพื่อสอบ',
        sentenceTH:'เขาซื้อหนังสือเล่มใหม่เมื่อวาน',
        sentence:'He ___ a new book yesterday.',
        answer:'bought', choices:['buy','buys','bought'],
        orderWords:['He','bought','a','new','book','yesterday'],
        speakText:'He bought a new book yesterday.',
      },
      {
        tenseType:'Past Continuous', tenseColor:'#FF6B6B',
        exampleEN:'I was reading when she called.', exampleTH:'ฉันกำลังอ่านหนังสือตอนที่เธอโทรมา',
        sentenceTH:'เธอกำลังทำอาหารตอนที่ฝนตก',
        sentence:'She ___ cooking when it rained.',
        answer:'was', choices:['was','were','is'],
        orderWords:['She','was','cooking','when','it','rained'],
        speakText:'She was cooking when it rained.',
      },
      {
        tenseType:'Past Simple', tenseColor:'#FF9500',
        exampleEN:'They arrived at 8 o\'clock.', exampleTH:'พวกเขามาถึงตอน 8 โมง',
        sentenceTH:'เราออกจากบ้านแต่เช้า',
        sentence:'We ___ home early.',
        answer:'left', choices:['leave','left','leaving'],
        orderWords:['We','left','home','early'],
        speakText:'We left home early.',
      },
    ],
  },
  {
    id: 'tex003', category: 'tense',
    title: 'แบบฝึกหัด Tense ชุดที่ 3', description: 'Future Simple',
    ttsSystem: 'female',
    items: [
      {
        tenseType:'Future Simple', tenseColor:'#34C759',
        exampleEN:'I will travel to Japan next year.', exampleTH:'ฉันจะเดินทางไปญี่ปุ่นปีหน้า',
        sentenceTH:'เธอจะโทรหาคุณพรุ่งนี้',
        sentence:'She ___ call you tomorrow.',
        answer:'will', choices:['will','did','does'],
        orderWords:['She','will','call','you','tomorrow'],
        speakText:'She will call you tomorrow.',
      },
      {
        tenseType:'Future Simple', tenseColor:'#34C759',
        exampleEN:'They will visit us next week.', exampleTH:'พวกเขาจะมาเยี่ยมสัปดาห์หน้า',
        sentenceTH:'ฉันจะซื้อหนังสือใหม่พรุ่งนี้',
        sentence:'I will ___ a new book tomorrow.',
        answer:'buy', choices:['buy','bought','buying'],
        orderWords:['I','will','buy','a','new','book','tomorrow'],
        speakText:'I will buy a new book tomorrow.',
      },
      {
        tenseType:'Future Simple', tenseColor:'#34C759',
        exampleEN:'He will finish the project soon.', exampleTH:'เขาจะทำโปรเจกต์เสร็จเร็วๆ นี้',
        sentenceTH:'พวกเราจะไปชายหาดในวันหยุด',
        sentence:'We will ___ to the beach on holiday.',
        answer:'go', choices:['go','went','going'],
        orderWords:['We','will','go','to','the','beach','on','holiday'],
        speakText:'We will go to the beach on holiday.',
      },
      {
        tenseType:'Future Continuous', tenseColor:'#00C7BE',
        exampleEN:'I will be working at 9 tomorrow.', exampleTH:'ฉันจะกำลังทำงานตอน 9 โมงพรุ่งนี้',
        sentenceTH:'เธอจะกำลังเรียนตอนบ่ายพรุ่งนี้',
        sentence:'She will be ___ tomorrow afternoon.',
        answer:'studying', choices:['study','studied','studying'],
        orderWords:['She','will','be','studying','tomorrow','afternoon'],
        speakText:'She will be studying tomorrow afternoon.',
      },
      {
        tenseType:'Future Simple', tenseColor:'#34C759',
        exampleEN:'It will rain tonight.', exampleTH:'คืนนี้จะมีฝน',
        sentenceTH:'เขาจะช่วยคุณในวันพรุ่งนี้',
        sentence:'He ___ help you tomorrow.',
        answer:'will', choices:['will','would','won\'t'],
        orderWords:['He','will','help','you','tomorrow'],
        speakText:'He will help you tomorrow.',
      },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// ข้อมูล: ชุดแบบฝึกหัดการฟัง
// ══════════════════════════════════════════════════════════════════════════════
const LISTENING_EXERCISES = [
  {
    id: 'lex001', category: 'listening',
    title: 'การฟังและการดู Tense ชุดที่ 1', description: 'บทสนทนาในชีวิตประจำวัน',
    ttsSystem: 'female',
    dialogue: [
      { speaker:'Anna',  side:'left',  text:'Hi! How are you today?' },
      { speaker:'David', side:'right', text:'I am fine, thank you! And you?' },
      { speaker:'Anna',  side:'left',  text:'I am great! What do you usually do on weekends?' },
      { speaker:'David', side:'right', text:'I like to go to the park and read books.' },
      { speaker:'Anna',  side:'left',  text:'That sounds fun! I usually go shopping.' },
    ],
    questions: [
      {
        question: 'David ทำอะไรในวันหยุดสุดสัปดาห์?',
        choices:  ['ไปสวนสาธารณะและอ่านหนังสือ','ไปช้อปปิ้ง','ดูหนัง'],
        answer:   'ไปสวนสาธารณะและอ่านหนังสือ',
      },
      {
        question: 'Anna ทำอะไรในวันหยุดสุดสัปดาห์?',
        choices:  ['ไปช้อปปิ้ง','อ่านหนังสือ','ไปสวนสาธารณะ'],
        answer:   'ไปช้อปปิ้ง',
      },
      {
        question: 'บทสนทนานี้ใช้ Tense ใดเป็นหลัก?',
        choices:  ['Present Simple','Past Simple','Future Simple'],
        answer:   'Present Simple',
      },
    ],
  },
  {
    id: 'lex002', category: 'listening',
    title: 'การฟังและการดู Tense ชุดที่ 2', description: 'เล่าเรื่องในอดีต',
    ttsSystem: 'female',
    dialogue: [
      { speaker:'Sara', side:'left',  text:'Where did you go last weekend?' },
      { speaker:'Tom',  side:'right', text:'I went to the beach with my family.' },
      { speaker:'Sara', side:'left',  text:'Did you swim in the sea?' },
      { speaker:'Tom',  side:'right', text:'Yes, I swam for two hours! It was amazing!' },
      { speaker:'Sara', side:'left',  text:'That sounds wonderful! I stayed home last weekend.' },
    ],
    questions: [
      {
        question: 'Tom ไปที่ไหนสุดสัปดาห์ที่ผ่านมา?',
        choices:  ['ชายหาด','ภูเขา','ห้างสรรพสินค้า'],
        answer:   'ชายหาด',
      },
      {
        question: 'Sara ทำอะไรสุดสัปดาห์ที่ผ่านมา?',
        choices:  ['อยู่บ้าน','ไปชายหาด','ไปช้อปปิ้ง'],
        answer:   'อยู่บ้าน',
      },
      {
        question: 'บทสนทนานี้ใช้ Tense ใดเป็นหลัก?',
        choices:  ['Past Simple','Present Simple','Future Simple'],
        answer:   'Past Simple',
      },
    ],
  },
  {
    id: 'lex003', category: 'listening',
    title: 'การฟังและการดู Tense ชุดที่ 3', description: 'แผนสำหรับอนาคต',
    ttsSystem: 'female',
    dialogue: [
      { speaker:'Mike', side:'left',  text:'What will you do next summer?' },
      { speaker:'Lisa', side:'right', text:'I will travel to Japan with my friends.' },
      { speaker:'Mike', side:'left',  text:'That\'s exciting! Will you learn Japanese?' },
      { speaker:'Lisa', side:'right', text:'Yes, I will take a short language course before I go.' },
      { speaker:'Mike', side:'left',  text:'I will visit you there if I can!' },
    ],
    questions: [
      {
        question: 'Lisa จะทำอะไรในฤดูร้อนหน้า?',
        choices:  ['เดินทางไปญี่ปุ่น','เรียนภาษาจีน','อยู่บ้าน'],
        answer:   'เดินทางไปญี่ปุ่น',
      },
      {
        question: 'Lisa จะเรียนอะไรก่อนเดินทาง?',
        choices:  ['คอร์สภาษาสั้นๆ','ว่ายน้ำ','ทำอาหาร'],
        answer:   'คอร์สภาษาสั้นๆ',
      },
      {
        question: 'บทสนทนานี้ใช้ Tense ใดเป็นหลัก?',
        choices:  ['Future Simple','Past Simple','Present Continuous'],
        answer:   'Future Simple',
      },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// SEED FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════════

async function seedVocabulary() {
  console.log('\n📚 Seeding Oxford 3000 vocabulary (CEFR A1–A2 only)...');
  // Firestore batch จำกัด 500 ops — แบ่งเป็น chunk
  const chunkSize = 400;
  for (let i = 0; i < ALL_VOCAB.length; i += chunkSize) {
    const chunk = ALL_VOCAB.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const v of chunk) {
      const ref = db.collection('vocabulary').doc(v.id);
      batch.set(ref, { wordEN: v.wordEN, wordTH: v.wordTH, cefrLevel: v.level, level: v.level, ttsVoice: '' });
    }
    await batch.commit();
  }
  console.log(`   ✅ ${ALL_VOCAB.length} คำศัพท์ (A1:${OXFORD_A1.length} A2:${OXFORD_A2.length}) — scope A1–A2 เท่านั้น`);
}

async function seedExercises() {
  console.log('\n📝 Seeding exercises...');

  // สร้าง vocab exercise sets ให้เหลือ 5 ชุดพอดี ตามโครงสร้าง:
  //   ชุดที่ 1: 10 ข้อ, ชุดที่ 2: 15 ข้อ, ชุดที่ 3: 10 ข้อ, ชุดที่ 4: 15 ข้อ, ชุดที่ 5: 10 ข้อ
  // รวม = 60 คำ ใช้จาก OXFORD_A1 (มี 100 คำ พอสมควร)
  const vocabSets = buildVocabExercises(OXFORD_A1, 'A1', [10, 15, 10, 15, 10]);

  const allExercises = [...vocabSets, ...TENSE_EXERCISES, ...LISTENING_EXERCISES];

  // seed exercises (batch 400)
  const chunkSize = 400;
  for (let i = 0; i < allExercises.length; i += chunkSize) {
    const chunk = allExercises.slice(i, i + chunkSize);
    const batch = db.batch();
    // batch.set แบบ overwrite เต็ม doc → ต้องเติม field มาตรฐาน (SCHEMA.md) ที่ชุด seed
    // ไม่ได้นิยามไว้เอง เพื่อไม่ให้ re-seed ลบสถานะ draft/published หรือ sourceVersion
    for (const ex of chunk) {
      const { id, ...data } = ex;
      const ref = db.collection('exercises').doc(id);
      const payload = {
        ...data,
        status: data.status ?? 'published',   // ชุด seed = พร้อมใช้ (เผยแพร่แล้ว)
        createdAt: new Date(),
      };
      if (data.category === 'vocab') {
        payload.sourceVersion = data.sourceVersion ?? 1;
        payload.vocabularyLevel = data.vocabularyLevel ?? data.level;
      }
      batch.set(ref, payload);
    }
    await batch.commit();
  }

  console.log(`   ✅ vocab sets: ${vocabSets.length} ชุด (ข้อ: ${vocabSets.map(s => s.items.length).join(', ')}) — 5 ชุดพอดี`);
  console.log(`   ✅ tense sets: ${TENSE_EXERCISES.length} ชุด`);
  console.log(`   ✅ listening sets: ${LISTENING_EXERCISES.length} ชุด`);
}

// ══════════════════════════════════════════════════════════════════════════════
// Scope enforcement: ลบ docs ที่อยู่นอกขอบเขต CEFR A1–A2 (untagged หรือระดับอื่น)
// ══════════════════════════════════════════════════════════════════════════════
const VALID_LEVELS = ['A1', 'A2'];

async function cleanupOutOfScope() {
  console.log('\n🧹 Enforcing CEFR A1–A2 scope (removing out-of-scope docs)...');

  // vocabulary: ลบทุก doc ที่ cefrLevel ไม่ใช่ A1/A2
  const vSnap = await db.collection('vocabulary').get();
  let vBatch = db.batch();
  let vCount = 0;
  let vOps = 0;
  for (const d of vSnap.docs) {
    if (!VALID_LEVELS.includes(d.data().cefrLevel)) {
      vBatch.delete(d.ref);
      vCount += 1;
      if (++vOps === 400) { await vBatch.commit(); vBatch = db.batch(); vOps = 0; }
    }
  }
  if (vOps > 0) await vBatch.commit();
  console.log(`   🗑  vocabulary นอกขอบเขต: ลบ ${vCount} docs`);

  // exercises: ลบชุดที่ level/vocabularyLevel ไม่ใช่ A1/A2 (รวม id scheme เก่า vex_b1_/vex_b2_)
  const exSnap = await db.collection('exercises').get();
  let eBatch = db.batch();
  let eCount = 0;
  let eOps = 0;
  for (const d of exSnap.docs) {
    const c = d.data();
    const outOfScope =
      (c.level && !VALID_LEVELS.includes(c.level)) ||
      (c.vocabularyLevel && !VALID_LEVELS.includes(c.vocabularyLevel)) ||
      /^vex_b[12]_/.test(d.id);
    if (outOfScope) {
      eBatch.delete(d.ref);
      eCount += 1;
      if (++eOps === 400) { await eBatch.commit(); eBatch = db.batch(); eOps = 0; }
    }
  }
  if (eOps > 0) await eBatch.commit();
  console.log(`   🗑  exercises นอกขอบเขต: ลบ ${eCount} docs`);
}

async function main() {
  console.log('🚀 เริ่ม Seed Oxford 3000 (CEFR A1–A2) เข้า Firestore...');
  try {
    await cleanupOutOfScope();
    await seedVocabulary();
    await seedExercises();
    console.log('\n🎉 Seed เสร็จสมบูรณ์!');
    console.log('   ตรวจสอบได้ที่ Firebase Console → Firestore Database');
  } catch (err) {
    console.error('\n❌ Seed ล้มเหลว:', err.message);
    console.error(err);
    process.exit(1);
  }
  process.exit(0);
}

main();
