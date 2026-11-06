// frontend/screens/HomeScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, StatusBar, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveContainer from '../components/ResponsiveContainer';
import {
  getExercisesByCategory,
  getUserProgressMap,
  getAllVocabulary,
} from '../services/firestoreService';
import { isQuotaError, quotaMessage, recentQuotaNotice } from '../services/firebaseCache';
import { countEncounteredWords } from '../utils/encounteredWords';

const PRIMARY = '#5B4FCF';

const CATEGORIES = [
  {
    id:    'vocab',
    icon:  'book-outline',
    color: '#5B4FCF',
    bg:    '#EEF0FF',
    title: 'คำศัพท์',
    desc:  'จับคู่, สะกดคำ, เติมคำ, ฝึกพูด',
  },
  {
    id:    'tense',
    icon:  'time-outline',
    color: '#34C759',
    bg:    '#E8F9ED',
    title: 'Tense',
    desc:  'เติมคำ, เรียงประโยค, ฝึกพูดประโยค',
  },
  {
    id:    'listening',
    icon:  'headset-outline',
    color: '#FF9500',
    bg:    '#FFF3E0',
    title: 'การฟังและการดู Tense',
    desc:  'ดูและฟังบทสนทนาและตอบคำถาม',
  },
];

export default function HomeScreen({ navigation, user }) {
  const displayName = user?.username || user?.displayName || user?.email?.split('@')[0] || 'ผู้ใช้งาน';
  const userEmail   = user?.email ?? '';

  const [stats,   setStats]   = useState({ done: 0, vocabCount: 0, pct: 0 });
  const [loading, setLoading] = useState(true);
  const [loadNotice, setLoadNotice] = useState('');

  const fetchSummary = useCallback(async () => {
    if (!userEmail) {
      setLoading(false);
      return;
    }
    try {
      setLoadNotice('');
      // ดึงแยก query + default กันแต่ละตัว ถ้าตัวใดตัวหนึ่งพัง ตัวอื่นยังแสดงได้
      let quotaHit = false;
      const safe = async (p, fallback) => {
        try { return await p; }
        catch (e) {
          console.error('[HomeScreen] fetch failed:', e.code, e.message);
          if (isQuotaError(e)) quotaHit = true;
          return fallback;
        }
      };

      const t0 = Date.now();
      const [exVocab, exTense, exListen, progressMap, libraryDocs] = await Promise.all([
        safe(getExercisesByCategory('vocab'), []),
        safe(getExercisesByCategory('tense'), []),
        safe(getExercisesByCategory('listening'), []),
        safe(getUserProgressMap(userEmail), {}),
        safe(getAllVocabulary(), []),
      ]);

      // แบบฝึกที่ทำ = จำนวนที่ผ่านเกณฑ์ (≥80%) เท่านั้น
      const allEx = [...exVocab, ...exTense, ...exListen];
      let passedCount = 0;
      for (const ex of allEx) {
        if (progressMap[ex.id]?.passed) passedCount += 1;
      }
      const overallPct = allEx.length === 0 ? 0 : Math.round((passedCount / allEx.length) * 100);

      // คำศัพท์ที่เจอ = คำไม่ซ้ำจากคลังคำศัพท์ของแอดมิน (collection `vocabulary`)
      // ที่ปรากฏในแบบฝึกหัดทุกหมวดที่ผู้ใช้เคยทำจบแล้ว (ทำซ้ำกี่รอบก็นับ 1 ต่อคำ)
      const { count: encounteredWordCount } = countEncounteredWords({
        vocabulary: libraryDocs,
        exercises: allEx,
        progressMap,
      });

      console.log(`[HomeScreen] summary in ${Date.now() - t0}ms | total=${allEx.length} passed=${passedCount} pct=${overallPct}% words=${encounteredWordCount}`);
      setStats({ done: passedCount, vocabCount: encounteredWordCount, pct: overallPct });
      // cachedFetch กลืน quota error ไว้ → เช็คจาก global flag ว่าเพิ่งติดโควต้าหรือไม่
      if (quotaHit) {
        setLoadNotice(quotaMessage({ code: 'resource-exhausted' }));
      } else {
        setLoadNotice(recentQuotaNotice());
      }
    } catch (err) {
      console.error('[HomeScreen] fetchSummary unexpected error:', err.code, err.message);
      // ไม่ crash — แสดง banner แจ้งเตือนแทน
      setLoadNotice(quotaMessage(err));
    }
    finally { setLoading(false); }
  }, [userEmail]);

  useFocusEffect(useCallback(() => { setLoading(true); fetchSummary(); }, [fetchSummary]));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <ResponsiveContainer variant="dashboard" style={{ flexGrow: 1, paddingHorizontal: 0 }}>

        {/* ─── Header ─── */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>สวัสดี, {displayName} 👋</Text>
            <Text style={s.greetingSub}>พร้อมฝึกภาษาอังกฤษแล้วหรือยัง?</Text>
          </View>
        </View>

        {/* ─── แจ้งเตือนเมื่อโหลดข้อมูลไม่สำเร็จ (เช่น โควต้า Firebase เต็ม) ─── */}
        {loadNotice ? (
          <View style={s.noticeBanner}>
            <Ionicons name="warning-outline" size={18} color="#B45309" />
            <Text style={s.noticeBannerText}>{loadNotice}</Text>
          </View>
        ) : null}

        {/* ─── Summary Card ─── */}
        <View style={s.summaryCard}>
          <View style={s.summaryItem}>
            {loading ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Text style={s.summaryNum}>{stats.done}</Text>
            )}
            <Text style={s.summaryLabel}>แบบฝึกที่ผ่าน</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            {loading ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Text style={s.summaryNum}>{stats.pct}%</Text>
            )}
            <Text style={s.summaryLabel}>ความคืบหน้า</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            {loading ? (
              <ActivityIndicator size="small" color={PRIMARY} />
            ) : (
              <Text style={s.summaryNum}>{stats.vocabCount}</Text>
            )}
            <Text style={s.summaryLabel}>คำศัพท์ที่พบเจอ</Text>
          </View>
        </View>

        {/* ─── เลือกหมวดหมู่ ─── */}
        <Text style={s.sectionTitle}>เลือกหมวดหมู่ที่ต้องการฝึก</Text>

        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={s.catCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ExerciseList', { category: cat.id })}
          >
            <View style={[s.catIcon, { backgroundColor: cat.bg }]}>
              <Ionicons name={cat.icon} size={28} color={cat.color} />
            </View>
            <View style={s.catText}>
              <Text style={s.catTitle}>{cat.title}</Text>
              <Text style={s.catDesc}>{cat.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        ))}

        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PRIMARY,
  },
  // แจ้งเตือน error (เช่น โควต้า Firebase เต็ม)
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 12,
  },
  noticeBannerText: { flex: 1, fontSize: 13, color: '#92400E' },
  scroll: {
    flexGrow: 1,
    backgroundColor: '#F4F6FF',
    paddingBottom: 32,
  },

  // Header
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  greetingSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: -16,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNum: {
    fontSize: 22,
    fontWeight: 'bold',
    color: PRIMARY,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
    textAlign: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#eee',
  },

  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },

  // Category Card
  catCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  catIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  catText: {
    flex: 1,
  },
  catTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  catDesc: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});
