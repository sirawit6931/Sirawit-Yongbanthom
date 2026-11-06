// frontend/screens/ExerciseListScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  StyleSheet, StatusBar, ActivityIndicator,
  RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { auth } from '../firebase';
import { getExercisesByCategory, getUserProgressMap } from '../services/firestoreService';
import { quotaMessage } from '../services/firebaseCache';
import ResponsiveContainer from '../components/ResponsiveContainer';

// ─── Palette ──────────────────────────────────────────────────────────────────
const CATEGORY_CONFIG = {
  vocab: {
    title:    'หมวดคำศัพท์',
    icon:     'book-outline',
    color:    '#5B4FCF',
    bg:       '#EEF0FF',
    headerBg: '#5B4FCF',
  },
  tense: {
    title:    'หมวด Tense',
    icon:     'time-outline',
    color:    '#34C759',
    bg:       '#E8F9ED',
    headerBg: '#2AA84A',
  },
  listening: {
    title:    'หมวดการฟังและการดู Tense',
    icon:     'headset-outline',
    color:    '#FF9500',
    bg:       '#FFF3E0',
    headerBg: '#CC7800',
  },
};

// ─── Mock Data (ชั่วคราว) ─────────────────────────────────────────────────────
// NOTE: items array ต้องมี structure ตามที่ VocabExerciseScreen คาดหวัง:
//   { wordId, wordEN, wordTH, sentence, sentenceTH, distractors: [] }
// โครงสร้าง 5 ชุด: 10, 15, 10, 15, 10 ข้อ
const MOCK_EXERCISES = [
  {
    id: 'mock_001',
    title: 'แบบฝึกหัดคำศัพท์ ชุดที่ 1',
    description: 'คำศัพท์พื้นฐานระดับ A1 (10 ข้อ)',
    category: 'vocab',
    level: 'A1',
    ttsSystem: 'female',
    items: [
      { wordId: 'm1_001', wordEN: 'apple', wordTH: 'แอปเปิ้ล', sentence: 'I eat an apple.', sentenceTH: 'ฉันกินแอปเปิ้ล', distractors: ['banana', 'orange'] },
      { wordId: 'm1_002', wordEN: 'book', wordTH: 'หนังสือ', sentence: 'I read a book.', sentenceTH: 'ฉันอ่านหนังสือ', distractors: ['pen', 'bag'] },
      { wordId: 'm1_003', wordEN: 'cat', wordTH: 'แมว', sentence: 'The cat is cute.', sentenceTH: 'แมวน่ารัก', distractors: ['dog', 'bird'] },
      { wordId: 'm1_004', wordEN: 'dog', wordTH: 'สุนัข', sentence: 'I have a dog.', sentenceTH: 'ฉันมีสุนัข', distractors: ['cat', 'fish'] },
      { wordId: 'm1_005', wordEN: 'egg', wordTH: 'ไข่', sentence: 'I cook an egg.', sentenceTH: 'ฉันทำไข่', distractors: ['milk', 'bread'] },
      { wordId: 'm1_006', wordEN: 'fish', wordTH: 'ปลา', sentence: 'The fish swims.', sentenceTH: 'ปลาว่ายน้ำ', distractors: ['bird', 'dog'] },
      { wordId: 'm1_007', wordEN: 'green', wordTH: 'สีเขียว', sentence: 'The grass is green.', sentenceTH: 'หญ้าสีเขียว', distractors: ['red', 'blue'] },
      { wordId: 'm1_008', wordEN: 'house', wordTH: 'บ้าน', sentence: 'My house is big.', sentenceTH: 'บ้านของฉันใหญ่', distractors: ['car', 'room'] },
      { wordId: 'm1_009', wordEN: 'ice', wordTH: 'น้ำแข็ง', sentence: 'I want ice.', sentenceTH: 'ฉันอยากได้น้ำแข็ง', distractors: ['water', 'milk'] },
      { wordId: 'm1_010', wordEN: 'juice', wordTH: 'น้ำผลไม้', sentence: 'I drink juice.', sentenceTH: 'ฉันดื่มน้ำผลไม้', distractors: ['water', 'milk'] },
    ],
  },
  {
    id: 'mock_002',
    title: 'แบบฝึกหัดคำศัพท์ ชุดที่ 2',
    description: 'คำศัพท์พื้นฐานระดับ A1 (15 ข้อ)',
    category: 'vocab',
    level: 'A1',
    ttsSystem: 'female',
    items: [
      { wordId: 'm2_001', wordEN: 'kind', wordTH: 'ใจดี', sentence: 'She is kind.', sentenceTH: 'เธอใจดี', distractors: ['mean', 'shy'] },
      { wordId: 'm2_002', wordEN: 'love', wordTH: 'รัก', sentence: 'I love you.', sentenceTH: 'ฉันรักคุณ', distractors: ['like', 'hate'] },
      { wordId: 'm2_003', wordEN: 'moon', wordTH: 'พระจันทร์', sentence: 'The moon is bright.', sentenceTH: 'พระจันทร์สว่าง', distractors: ['sun', 'star'] },
      { wordId: 'm2_004', wordEN: 'name', wordTH: 'ชื่อ', sentence: 'My name is John.', sentenceTH: 'ฉันชื่อจอห์น', distractors: ['age', 'place'] },
      { wordId: 'm2_005', wordEN: 'open', wordTH: 'เปิด', sentence: 'Open the door.', sentenceTH: 'เปิดประตู', distractors: ['close', 'lock'] },
      { wordId: 'm2_006', wordEN: 'pen', wordTH: 'ปากกา', sentence: 'I have a pen.', sentenceTH: 'ฉันมีปากกา', distractors: ['pencil', 'book'] },
      { wordId: 'm2_007', wordEN: 'queen', wordTH: 'ราชินี', sentence: 'The queen is beautiful.', sentenceTH: 'ราชินีสวยงาม', distractors: ['king', 'prince'] },
      { wordId: 'm2_008', wordEN: 'red', wordTH: 'สีแดง', sentence: 'The rose is red.', sentenceTH: 'กุหลาบสีแดง', distractors: ['blue', 'white'] },
      { wordId: 'm2_009', wordEN: 'sun', wordTH: 'ดวงอาทิตย์', sentence: 'The sun is hot.', sentenceTH: 'ดวงอาทิตย์ร้อน', distractors: ['moon', 'star'] },
      { wordId: 'm2_010', wordEN: 'tree', wordTH: 'ต้นไม้', sentence: 'The tree is tall.', sentenceTH: 'ต้นไม้สูง', distractors: ['flower', 'grass'] },
      { wordId: 'm2_011', wordEN: 'under', wordTH: 'ใต้', sentence: 'The cat is under the table.', sentenceTH: 'แมวอยู่ใต้โต๊ะ', distractors: ['on', 'above'] },
      { wordId: 'm2_012', wordEN: 'very', wordTH: 'มาก', sentence: 'She is very happy.', sentenceTH: 'เธอมีความสุขมาก', distractors: ['too', 'so'] },
      { wordId: 'm2_013', wordEN: 'water', wordTH: 'น้ำ', sentence: 'I drink water.', sentenceTH: 'ฉันดื่มน้ำ', distractors: ['juice', 'milk'] },
      { wordId: 'm2_014', wordEN: 'yellow', wordTH: 'สีเหลือง', sentence: 'The sun is yellow.', sentenceTH: 'ดวงอาทิตย์สีเหลือง', distractors: ['red', 'orange'] },
      { wordId: 'm2_015', wordEN: 'zero', wordTH: 'ศูนย์', sentence: 'Start from zero.', sentenceTH: 'เริ่มจากศูนย์', distractors: ['one', 'ten'] },
    ],
  },
  {
    id: 'mock_003',
    title: 'แบบฝึกหัดคำศัพท์ ชุดที่ 3',
    description: 'คำศัพท์พื้นฐานระดับ A1 (10 ข้อ)',
    category: 'vocab',
    level: 'A1',
    ttsSystem: 'female',
    items: [
      { wordId: 'm3_001', wordEN: 'umbrella', wordTH: 'ร่ม', sentence: 'I need an umbrella.', sentenceTH: 'ฉันต้องการร่ม', distractors: ['hat', 'bag'] },
      { wordId: 'm3_002', wordEN: 'voice', wordTH: 'เสียง', sentence: 'Her voice is sweet.', sentenceTH: 'เสียงของเธอหวาน', distractors: ['face', 'smile'] },
      { wordId: 'm3_003', wordEN: 'bread', wordTH: 'ขนมปัง', sentence: 'I eat bread.', sentenceTH: 'ฉันกินขนมปัง', distractors: ['rice', 'cake'] },
      { wordId: 'm3_004', wordEN: 'chair', wordTH: 'เก้าอี้', sentence: 'Sit on the chair.', sentenceTH: 'นั่งบนเก้าอี้', distractors: ['table', 'bed'] },
      { wordId: 'm3_005', wordEN: 'door', wordTH: 'ประตู', sentence: 'Close the door.', sentenceTH: 'ปิดประตู', distractors: ['window', 'wall'] },
      { wordId: 'm3_006', wordEN: 'friend', wordTH: 'เพื่อน', sentence: 'She is my friend.', sentenceTH: 'เธอเป็นเพื่อนฉัน', distractors: ['enemy', 'stranger'] },
      { wordId: 'm3_007', wordEN: 'garden', wordTH: 'สวน', sentence: 'The garden is beautiful.', sentenceTH: 'สวนสวยงาม', distractors: ['park', 'forest'] },
      { wordId: 'm3_008', wordEN: 'happy', wordTH: 'มีความสุข', sentence: 'I am happy.', sentenceTH: 'ฉันมีความสุข', distractors: ['sad', 'angry'] },
      { wordId: 'm3_009', wordEN: 'kitchen', wordTH: 'ห้องครัว', sentence: 'Mom is in the kitchen.', sentenceTH: 'แม่อยู่ในห้องครัว', distractors: ['bedroom', 'bathroom'] },
      { wordId: 'm3_010', wordEN: 'light', wordTH: 'แสงสว่าง', sentence: 'Turn on the light.', sentenceTH: 'เปิดไฟ', distractors: ['dark', 'lamp'] },
    ],
  },
  {
    id: 'mock_004',
    title: 'แบบฝึกหัดคำศัพท์ ชุดที่ 4',
    description: 'คำศัพท์พื้นฐานระดับ A1 (15 ข้อ)',
    category: 'vocab',
    level: 'A1',
    ttsSystem: 'female',
    items: [
      { wordId: 'm4_001', wordEN: 'mother', wordTH: 'แม่', sentence: 'My mother is kind.', sentenceTH: 'แม่ของฉันใจดี', distractors: ['father', 'sister'] },
      { wordId: 'm4_002', wordEN: 'night', wordTH: 'กลางคืน', sentence: 'Good night.', sentenceTH: 'ราตรีสวัสดิ์', distractors: ['morning', 'evening'] },
      { wordId: 'm4_003', wordEN: 'ocean', wordTH: 'มหาสมุทร', sentence: 'The ocean is blue.', sentenceTH: 'มหาสมุทรสีน้ำเงิน', distractors: ['river', 'lake'] },
      { wordId: 'm4_004', wordEN: 'phone', wordTH: 'โทรศัพท์', sentence: 'I have a phone.', sentenceTH: 'ฉันมีโทรศัพท์', distractors: ['computer', 'tablet'] },
      { wordId: 'm4_005', wordEN: 'rain', wordTH: 'ฝน', sentence: 'It will rain tomorrow.', sentenceTH: 'พรุ่งนี้จะฝนตก', distractors: ['snow', 'wind'] },
      { wordId: 'm4_006', wordEN: 'school', wordTH: 'โรงเรียน', sentence: 'I go to school.', sentenceTH: 'ฉันไปโรงเรียน', distractors: ['home', 'work'] },
      { wordId: 'm4_007', wordEN: 'table', wordTH: 'โต๊ะ', sentence: 'The book is on the table.', sentenceTH: 'หนังสืออยู่บนโต๊ะ', distractors: ['chair', 'desk'] },
      { wordId: 'm4_008', wordEN: 'car', wordTH: 'รถยนต์', sentence: 'I drive a car.', sentenceTH: 'ฉันขับรถยนต์', distractors: ['bus', 'bike'] },
      { wordId: 'm4_009', wordEN: 'city', wordTH: 'เมือง', sentence: 'I live in a city.', sentenceTH: 'ฉันอยู่ในเมือง', distractors: ['village', 'town'] },
      { wordId: 'm4_010', wordEN: 'family', wordTH: 'ครอบครัว', sentence: 'My family is big.', sentenceTH: 'ครอบครัวของฉันใหญ่', distractors: ['friend', 'group'] },
      { wordId: 'm4_011', wordEN: 'girl', wordTH: 'เด็กผู้หญิง', sentence: 'The girl is smart.', sentenceTH: 'เด็กผู้หญิงฉลาด', distractors: ['boy', 'woman'] },
      { wordId: 'm4_012', wordEN: 'hand', wordTH: 'มือ', sentence: 'Wash your hands.', sentenceTH: 'ล้างมือของคุณ', distractors: ['foot', 'head'] },
      { wordId: 'm4_013', wordEN: 'food', wordTH: 'อาหาร', sentence: 'I love Thai food.', sentenceTH: 'ฉันชอบอาหารไทย', distractors: ['drink', 'fruit'] },
      { wordId: 'm4_014', wordEN: 'money', wordTH: 'เงิน', sentence: 'I need money.', sentenceTH: 'ฉันต้องการเงิน', distractors: ['time', 'work'] },
      { wordId: 'm4_015', wordEN: 'road', wordTH: 'ถนน', sentence: 'The road is long.', sentenceTH: 'ถนนยาว', distractors: ['street', 'path'] },
    ],
  },
  {
    id: 'mock_005',
    title: 'แบบฝึกหัดคำศัพท์ ชุดที่ 5',
    description: 'คำศัพท์พื้นฐานระดับ A1 (10 ข้อ)',
    category: 'vocab',
    level: 'A1',
    ttsSystem: 'female',
    items: [
      { wordId: 'm5_001', wordEN: 'room', wordTH: 'ห้อง', sentence: 'My room is clean.', sentenceTH: 'ห้องของฉันสะอาด', distractors: ['house', 'kitchen'] },
      { wordId: 'm5_002', wordEN: 'sister', wordTH: 'พี่น้องหญิง', sentence: 'My sister is tall.', sentenceTH: 'พี่สาวของฉันสูง', distractors: ['brother', 'mother'] },
      { wordId: 'm5_003', wordEN: 'teacher', wordTH: 'ครู', sentence: 'The teacher is kind.', sentenceTH: 'ครูใจดี', distractors: ['student', 'doctor'] },
      { wordId: 'm5_004', wordEN: 'window', wordTH: 'หน้าต่าง', sentence: 'Open the window.', sentenceTH: 'เปิดหน้าต่าง', distractors: ['door', 'curtain'] },
      { wordId: 'm5_005', wordEN: 'flower', wordTH: 'ดอกไม้', sentence: 'The flower is red.', sentenceTH: 'ดอกไม้สีแดง', distractors: ['tree', 'leaf'] },
      { wordId: 'm5_006', wordEN: 'color', wordTH: 'สี', sentence: 'I like this color.', sentenceTH: 'ฉันชอบสีนี้', distractors: ['shape', 'size'] },
      { wordId: 'm5_007', wordEN: 'body', wordTH: 'ร่างกาย', sentence: 'Exercise is good for the body.', sentenceTH: 'ออกกำลังกายดีต่อร่างกาย', distractors: ['mind', 'health'] },
      { wordId: 'm5_008', wordEN: 'mind', wordTH: 'จิตใจ', sentence: 'She has a kind mind.', sentenceTH: 'เธอมีจิตใจที่ดี', distractors: ['heart', 'soul'] },
      { wordId: 'm5_009', wordEN: 'heart', wordTH: 'หัวใจ', sentence: 'My heart beats fast.', sentenceTH: 'หัวใจของฉันเต็นเร็ว', distractors: ['brain', 'lung'] },
      { wordId: 'm5_010', wordEN: 'world', wordTH: 'โลก', sentence: 'The world is beautiful.', sentenceTH: 'โลกสวยงาม', distractors: ['earth', 'country'] },
    ],
  },
];

// ─── Progress Bar (Small) ─────────────────────────────────────────────────────
function SmallProgressBar({ pct, color }) {
  return (
    <View style={s.smallBarBg}>
      <View style={[s.smallBarFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

// ─── Exercise Card (New Design) ───────────────────────────────────────────────
function ExerciseCard({ item, index = 0, config, progressMap, onPress }) {
  // Defensive access + fallbacks — กันข้อมูลเก่าที่ title/description ว่าง render เปล่า
  const raw = item ?? {};
  const title = raw.title || raw.name || `ชุดคำศัพท์ ${index + 1}`;
  const description = raw.description || `คำศัพท์ระดับ ${raw.level || raw.vocabularyLevel || 'A1'}`;

  const prog = progressMap[raw.id || raw._id];
  const hasAttempted = !!prog; // เคยทำ = มี record คะแนน (ไม่ว่าจะผ่านหรือไม่)
  const passed = prog?.passed ?? false;
  const pct = prog?.percentage ?? 0;

  // Badge 3 สถานะ: ผ่าน (เขียว) / ไม่ผ่าน-ทำแล้วแต่ตก (แดง) / ยังไม่ได้ทำ (เทา)
  const badge = passed
    ? { bg: '#E8F5E9', color: '#34C759', icon: 'checkmark-circle', text: 'ผ่าน' }
    : hasAttempted
      ? { bg: '#FDECEA', color: '#D32F2F', icon: 'close-circle', text: 'ไม่ผ่าน' }
      : { bg: '#F5F5F5', color: '#999', icon: 'time-outline', text: 'ยังไม่ได้ทำ' };
  
  const lastScore = prog
    ? `${prog.score}/${prog.totalQuestions}`
    : null;
  
  const timeStr = prog?.timeSpent
    ? `${Math.floor(prog.timeSpent / 60)}:${String(prog.timeSpent % 60).padStart(2,'0')}`
    : null;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      {/* Title */}
      <Text style={s.cardTitle}>{title}</Text>
      <Text style={s.cardDesc}>{description}</Text>

      {/* Progress Info */}
      <View style={s.cardProgress}>
        {lastScore ? (
          <Text style={s.cardScore}>ตอบถูก {lastScore}</Text>
        ) : (
          <Text style={[s.cardScore, { color: '#aaa' }]}>ยังไม่ได้ทำ</Text>
        )}
        {timeStr && <Text style={s.cardTime}>{timeStr} นาที</Text>}
      </View>

      {/* Small Progress Bar */}
      <SmallProgressBar pct={passed ? 100 : pct} color={config.color} />

      {/* Status Badge */}
      <View style={[
        s.statusBadge,
        { backgroundColor: badge.bg }
      ]}>
        <Ionicons 
          name={badge.icon} 
          size={14} 
          color={badge.color} 
        />
        <Text style={[
          s.statusText,
          { color: badge.color }
        ]}>
          {badge.text}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export default function ExerciseListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { category } = route.params;
  const config = CATEGORY_CONFIG[category];

  const [exercises, setExercises] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');

  const userEmail = auth.currentUser?.email ?? '';

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setFetchError('');
    try {
      const [exList, pMap] = await Promise.all([
        getExercisesByCategory(category),
        getUserProgressMap(userEmail),
      ]);
      console.log(`[ExerciseList] category=${category} got ${exList.length} exercises`);
      
      // ถ้าไม่มีข้อมูลจาก Firestore ใช้ Mock Data
      if (exList.length === 0) {
        console.log('[ExerciseList] No exercises from Firestore, using mock data');
        setExercises(MOCK_EXERCISES);
      } else {
        setExercises(exList);
      }
      setProgressMap(pMap);
    } catch (err) {
      console.error('ExerciseListScreen fetch error:', err);
      setFetchError(quotaMessage(err));
      // ถ้า error ใช้ Mock Data
      setExercises(MOCK_EXERCISES);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category, userEmail]);

  useFocusEffect(useCallback(() => { setLoading(true); fetchData(); }, [fetchData]));

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ── Filter by Search ───────────────────────────────────────────────
  const filtered = exercises.filter((ex) => {
    const title = (ex?.title || ex?.name || '').toString().toLowerCase();
    const matchSearch = search.trim() === '' ||
      title.includes(search.toLowerCase());
    return matchSearch;
  });

  // สรุป progress
  const totalEx = filtered.length;
  const passedEx = filtered.filter((ex) => progressMap[ex.id]?.passed).length;
  const overallPct = totalEx > 0 ? Math.round((passedEx / totalEx) * 100) : 0;

  // ── Render Card ───────────────────────────────────────────────────────────
  const renderCard = ({ item, index }) => (
    <ExerciseCard
      item={item}
      index={index}
      config={config}
      progressMap={progressMap}
      onPress={() => {
        if (category === 'vocab') {
          navigation.navigate('VocabExercise', { exercise: item });
        } else {
          const screen = category === 'listening' ? 'ListeningExercise' : 'TenseExercise';
          navigation.navigate(screen, { exercise: item });
        }
      }}
    />
  );

  // ── JSX ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={config.headerBg} />

      {/* Header (Purple Background) */}
      <View style={[s.header, { backgroundColor: config.headerBg }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{config.title}</Text>
        <View style={s.headerSpacer} />
      </View>

      {/* Overall Progress Bar in Header */}
      <View style={[s.headerProgress, { backgroundColor: config.headerBg }]}>
        <View style={s.headerProgressContent}>
          <Text style={s.headerProgressText}>
            ผ่านแล้ว {passedEx}/{totalEx} แบบฝึกหัด
          </Text>
          <View style={s.headerProgressBar}>
            <View style={[s.headerProgressFill, { width: `${overallPct}%`, backgroundColor: '#fff' }]} />
          </View>
        </View>
      </View>

      {/* Content Area (White Background with Rounded Corners - Bottom Sheet Style) */}
      <View style={s.content}>
        <ResponsiveContainer variant="dashboard" style={{ flexGrow: 1, paddingHorizontal: 0 }}>
          {/* Search Box */}
         <View style={s.searchContainer}>
           <Ionicons name="search-outline" size={18} color="#999" style={{ marginRight: 8 }} />
           <TextInput
             style={s.searchInput}
             placeholder="ค้นหาแบบฝึกหัด..."
             placeholderTextColor="#aaa"
             value={search}
             onChangeText={setSearch}
           />
           {search.length > 0 && (
             <TouchableOpacity onPress={() => setSearch('')}>
               <Ionicons name="close-circle" size={18} color="#ccc" />
             </TouchableOpacity>
           )}
         </View>

         {/* Exercise Count */}
        <Text style={s.countText}>
          รายการแบบฝึกหัด ({filtered.length})
        </Text>

        {/* แจ้งเตือนเมื่อโหลดข้อมูลไม่สำเร็จ (เช่น โควต้า Firebase เต็ม) */}
        {!loading && fetchError ? (
          <View style={s.errorBanner}>
            <Ionicons name="warning-outline" size={18} color="#B45309" />
            <Text style={s.errorBannerText}>{fetchError}</Text>
          </View>
        ) : null}

        {/* Loading */}
        {loading && (
          <View style={s.center}>
            <ActivityIndicator size="large" color={config.color} />
            <Text style={s.loadingText}>กำลังโหลด...</Text>
          </View>
        )}

        {/* List */}
        {!loading && (
          <FlatList
            data={filtered}
            keyExtractor={(item, index) => item?._id || item?.id || String(index)}
            renderItem={renderCard}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={config.color}
              />
            }
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="document-text-outline" size={56} color="#ccc" />
                <Text style={s.emptyTitle}>ไม่พบแบบฝึกหัด</Text>
                <Text style={s.emptyDesc}>
                  {search.trim()
                    ? `ไม่พบผลการค้นหา "${search}"`
                    : 'ยังไม่มีแบบฝึกหัดในหมวดนี้'}
                </Text>
              </View>
            }
          />
        )}
        </ResponsiveContainer>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6FF' },

  // แจ้งเตือน error (เช่น โควต้า Firebase เต็ม)
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: '#92400E' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20, fontWeight: 'bold', color: '#fff',
  },
  headerSpacer: { width: 40 },

  // Header Progress
  headerProgress: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerProgressContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerProgressText: {
    fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600',
  },
  headerProgressBar: {
    flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3, overflow: 'hidden',
  },
  headerProgressFill: {
    height: 6, borderRadius: 3,
  },

  // Content (Bottom Sheet Style)
  content: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },

  // Count Text
  countText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 16,
  },

  // List Content
  listContent: {
    paddingBottom: 24,
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
  },
  cardProgress: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardScore: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  cardTime: {
    fontSize: 12,
    color: '#888',
  },

  // Small Progress Bar
  smallBarBg: {
    height: 4,
    backgroundColor: '#F0F0F0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  smallBarFill: {
    height: 4,
    borderRadius: 2,
  },

  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Loading
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#555',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#aaa',
    textAlign: 'center',
  },
});
