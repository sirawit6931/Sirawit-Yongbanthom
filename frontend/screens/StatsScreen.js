// frontend/screens/StatsScreen.js
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, StatusBar,
  ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { auth } from '../firebase';
import {
  getUserStatistics,
  getExercisesByCategory,
} from '../services/firestoreService';
import { quotaMessage, recentQuotaNotice } from '../services/firebaseCache';
const PRIMARY = '#5B4FCF';

// ค่า/สี/ไอคอนของแต่ละหมวด — ตรงกับที่ใช้ใน ExerciseListScreen
const CATEGORIES = [
  { key: 'vocab',     label: 'คำศัพท์',              icon: 'book-outline',    color: PRIMARY,   bg: '#EEF0FF' },
  { key: 'tense',     label: 'Tense',                icon: 'time-outline',    color: '#34C759', bg: '#E8F9ED' },
  { key: 'listening', label: 'การฟังและการดู Tense', icon: 'headset-outline', color: '#FF9500', bg: '#FFF3E0' },
];

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

// เวลาเป็นวินาที → "02:20"
function fmtTime(sec) {
  const m = Math.floor((sec || 0) / 60);
  const s = (sec || 0) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
// createdAt.seconds → "25 ธ.ค."
function fmtDate(seconds) {
  const d = new Date((seconds || 0) * 1000);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`;
}
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function StatsScreen() {
  const [loading, setLoading]   = useState(true);
  const [overall, setOverall]   = useState({ attempted: 0, total: 0, passed: 0, pct: 0 });
  const [cats, setCats]         = useState([]);
  const [expanded, setExpanded] = useState({ vocab: false, tense: false, listening: false });
  const [loadError, setLoadError] = useState('');

  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const email = auth.currentUser?.email;
        if (!email) { if (active) setLoading(false); return; }

        const [stats, exVocab, exTense, exListen] = await Promise.all([
          getUserStatistics(email),
          getExercisesByCategory('vocab'),
          getExercisesByCategory('tense'),
          getExercisesByCategory('listening'),
        ]);

        // record ที่ได้คะแนนดีที่สุดของแต่ละชุด (stats เรียงใหม่→เก่า → ถ้าคะแนนเท่ากันใช้รายการใหม่กว่า)
        const best = {};
        const pctOf = (s) => s.percentage ??
          (s.totalQuestions ? Math.round((s.score / s.totalQuestions) * 100) : 0);
        for (const s of stats) {
          const cur = best[s.exerciseId];
          if (!cur || pctOf(s) > pctOf(cur)) best[s.exerciseId] = s;
        }

        const build = (exercises) => {
          const rows = exercises.map((ex, i) => ({
            idx:    i + 1,
            title:  ex.title || `ชุด ${i + 1}`,
            record: best[ex.id] || null,
          }));
          const done    = rows.filter((r) => r.record);
          const passed  = done.filter((r) => r.record.passed);
          return {
            rows,
            attempted: done.length,
            passed:    passed.length,
            total:     exercises.length,
            progress:  pct(passed.length, exercises.length),
          };
        };

        const v = build(exVocab);
        const t = build(exTense);
        const l = build(exListen);

        const total     = v.total + t.total + l.total;
        const attempted = v.attempted + t.attempted + l.attempted;
        const passed    = v.passed + t.passed + l.passed;

        if (!active) return;
        setCats([
          { ...CATEGORIES[0], ...v },
          { ...CATEGORIES[1], ...t },
          { ...CATEGORIES[2], ...l },
        ]);
        setOverall({ attempted, total, passed, pct: pct(passed, total) });
        // service กลืน quota error แล้วคืน fallback → เช็ค global flag แสดง banner แจ้งเตือน
        const notice = recentQuotaNotice();
        if (notice) setLoadError(notice);
      } catch (err) {
        console.error('[StatsScreen] fetch error:', err?.code, err?.message);
        if (active) {
          // ไม่ crash — แสดง fallback banner + คงค่าเดิมไว้
          setLoadError(quotaMessage(err));
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []));

  const toggle = (key) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* ─── Header ─── */}
      <View style={s.header}>
        <Text style={s.headerTitle}>สถิติการเรียน</Text>
        <Text style={s.headerSub}>ติดตามความก้าวหน้าของคุณ</Text>
      </View>

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          <ResponsiveContainer variant="dashboard" style={{ flexGrow: 1, paddingHorizontal: 0 }}>

          {/* ─── แจ้งเตือนเมื่อโหลดข้อมูลไม่สำเร็จ (เช่น โควต้า Firebase เต็ม) ─── */}
          {loadError ? (
            <View style={s.errorBanner}>
              <Ionicons name="warning-outline" size={18} color="#B45309" />
              <Text style={s.errorBannerText}>{loadError}</Text>
            </View>
          ) : null}

          {/* ─── การ์ดสรุป ─── */}
          <View style={s.summaryCard}>
            <View style={s.summaryTop}>
              <View style={s.summaryCol}>
                <Text style={[s.summaryVal, { color: PRIMARY }]}>
                  {overall.attempted}/{overall.total}
                </Text>
                <Text style={s.summaryLabel}>แบบฝึกที่ทำแล้ว</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryCol}>
                <Text style={[s.summaryVal, { color: '#34C759' }]}>{overall.passed}</Text>
                <Text style={s.summaryLabel}>แบบฝึกที่ผ่าน</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryCol}>
                <Text style={[s.summaryVal, { color: '#FF9500' }]}>{overall.pct}%</Text>
                <Text style={s.summaryLabel}>ความคืบ</Text>
              </View>
            </View>
            <View style={s.summaryBarBg}>
              <View style={[s.summaryBarFill, { width: `${overall.pct}%` }]} />
            </View>
            <Text style={s.summaryCaption}>ความก้าวหน้าการทำแบบฝึกหัดทั้งหมดโดยรวม {overall.pct}%</Text>
          </View>

          {/* ─── ความก้าวหน้าตามหมวด ─── */}
          <Text style={s.sectionTitle}>ความก้าวหน้าตามหมวด</Text>

          {cats.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={s.catCard}
              activeOpacity={0.85}
              onPress={() => toggle(cat.key)}
            >
              <View style={s.catHead}>
                <View style={[s.catIcon, { backgroundColor: cat.bg }]}>
                  <Ionicons name={cat.icon} size={22} color={cat.color} />
                </View>
                <View style={s.catInfo}>
                  <Text style={s.catTitle}>{cat.label}</Text>
                  <Text style={s.catSub}>ผ่าน {cat.passed}/{cat.total}</Text>
                </View>
                <Text style={[s.catPct, { color: cat.color }]}>{cat.progress}%</Text>
                <Ionicons
                  name={expanded[cat.key] ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#999"
                />
              </View>

              {expanded[cat.key] && (
                <View style={s.catBody}>
                  {cat.rows.map((row) => {
                    const r = row.record;
                    return (
                      <View key={row.idx} style={s.row}>
                        <View style={[s.rowNum, { backgroundColor: cat.bg }]}>
                          <Text style={[s.rowNumText, { color: cat.color }]}>{row.idx}</Text>
                        </View>
                        <View style={s.rowBody}>
                          <Text style={s.rowTitle} numberOfLines={2}>{row.title}</Text>
                          <Text style={s.rowMeta}>
                            {r
                              ? `○ ${fmtTime(r.timeSpent)} · ${fmtDate(r.createdAt?.seconds)}`
                              : 'ยังไม่ทำ'}
                          </Text>
                        </View>
                        <View style={s.rowRight}>
                          {r ? (
                            <>
                              <Text style={s.rowScore}>{r.score}/{r.totalQuestions}</Text>
                              {r.passed ? (
                                <View style={s.pillGreen}>
                                  <Ionicons name="checkmark" size={12} color="#fff" />
                                  <Text style={s.pillText}>ทำแล้ว</Text>
                                </View>
                              ) : (
                                <Text style={[s.rowPct, { color: cat.color }]}>{r.percentage}%</Text>
                              )}
                              <View style={s.miniBarBg}>
                                <View
                                  style={[s.miniBarFill,
                                    { width: `${r.percentage}%`,
                                      backgroundColor: r.passed ? '#34C759' : cat.color }]}
                                />
                              </View>
                            </>
                          ) : (
                            <Text style={s.rowDash}>-</Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={s.catStripBg}>
                <View
                  style={[s.catStripFill,
                    { width: `${cat.progress}%`, backgroundColor: cat.color }]}
                />
              </View>
            </TouchableOpacity>
          ))}
          </ResponsiveContainer>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: PRIMARY },
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerSub:   { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  scroll:      { flexGrow: 1, backgroundColor: '#F4F6FF', paddingBottom: 32 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: PRIMARY },

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
    marginBottom: 16,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: '#92400E' },

  // การ์ดสรุป
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  summaryTop:     { flexDirection: 'row', alignItems: 'center' },
  summaryCol:     { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, height: 36, backgroundColor: '#EEE' },
  summaryVal:     { fontSize: 22, fontWeight: 'bold' },
  summaryLabel:   { fontSize: 12, color: '#888', marginTop: 2 },
  summaryBarBg: {
    height: 6, backgroundColor: '#EEE', borderRadius: 3,
    overflow: 'hidden', marginTop: 14,
  },
  summaryBarFill:  { height: 6, borderRadius: 3, backgroundColor: PRIMARY },
  summaryCaption: { fontSize: 12, color: '#888', marginTop: 8, textAlign: 'center' },

  sectionTitle: {
    fontSize: 16, fontWeight: '700', color: '#1A1A2E',
    marginHorizontal: 20, marginTop: 24, marginBottom: 12,
  },

  // การ์ดหมวด (accordion)
  catCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  catHead:  { flexDirection: 'row', alignItems: 'center' },
  catIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  catInfo:  { flex: 1 },
  catTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  catSub:   { fontSize: 12, color: '#888', marginTop: 2 },
  catPct:   { fontSize: 22, fontWeight: 'bold', marginRight: 4 },

  // แถวรายชุด
  catBody: {
    marginTop: 12,
    borderTopWidth: 1, borderTopColor: '#F0F0F0',
    paddingTop: 4,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8,
  },
  rowNum: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  rowNumText: { fontSize: 13, fontWeight: 'bold' },
  rowBody:    { flex: 1 },
  rowTitle:   { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  rowMeta:    { fontSize: 12, color: '#999', marginTop: 1 },
  rowRight:   { alignItems: 'flex-end', minWidth: 70 },
  rowScore:   { fontSize: 13, fontWeight: '700', color: '#1A1A2E' },
  pillGreen: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#34C759',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, marginTop: 3,
  },
  pillText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  rowPct:   { fontSize: 12, fontWeight: '700', marginTop: 3 },
  miniBarBg: {
    width: 56, height: 4, backgroundColor: '#EEE', borderRadius: 2,
    overflow: 'hidden', marginTop: 3,
  },
  miniBarFill: { height: 4, borderRadius: 2 },
  rowDash:   { fontSize: 14, color: '#CCC', marginTop: 4 },

  // แถบความคืบหน้าใต้การ์ดหมวด
  catStripBg: {
    height: 4, backgroundColor: '#F0F0F0', borderRadius: 2,
    overflow: 'hidden', marginTop: 12,
  },
  catStripFill: { height: 4, borderRadius: 2 },
});
