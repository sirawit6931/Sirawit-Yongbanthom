// frontend/screens/AdminExerciseScreen.js
// หน้ารายการแบบฝึกหัดของแอดมิน — ค้นหา / กรองหมวด-สถานะ / เพิ่ม / แก้ไข / ลบ
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { adminGetAllExercises, adminDeleteExercise } from '../services/adminService';
import ResponsiveContainer from '../components/ResponsiveContainer';

const PRIMARY = '#1A237E'; // สีน้ำเงินเข้ม — ธีมแอดมิน
// สี/ชื่อเรียกตามหมวดแบบฝึกหัด (ใช้ตอนแสดงจุดสีและ label ในการ์ด)
const CAT_COLOR = { vocab: '#5B4FCF', tense: '#34C759', listening: '#FF9500' };
const CAT_LABEL = { vocab: 'คำศัพท์', tense: 'Tense', listening: 'การฟัง' };

export default function AdminExerciseScreen() {
  const navigation = useNavigation();
  const [exercises, setExercises] = useState([]); // รายการแบบฝึกหัดจาก API
  const [loading, setLoading]     = useState(true); // กำลังโหลดข้อมูล
  const [search, setSearch]       = useState(''); // พิมพ์ค้นหาชื่อชุด
  const [filter, setFilter]       = useState('all'); // กรองหมวด: all/vocab/tense/listening
  const [statusFilter, setStatusFilter] = useState('all'); // กรองสถานะ: all/draft/published

  // โหลดข้อมูลทุกครั้งที่เข้าหน้า หรือเปลี่ยนตัวกรอง
  // (flag `active` กัน setState หลังออกจากหน้าแล้ว)
  useFocusEffect(useCallback(() => {
    let active = true;
    const params = {};
    if (filter !== 'all') params.category = filter;
    if (statusFilter !== 'all') params.status = statusFilter;
    adminGetAllExercises(params)
      .then((data) => { if (active) { setExercises(data); setLoading(false); } })
      .catch((err) => { if (active) { console.error(err); setLoading(false); } });
    return () => { active = false; };
  }, [filter, statusFilter]));

  // กรองซ้ำอีกชั้นฝั่ง client (API กรองให้แล้ว แต่ค้นหาชื่อทำที่นี่)
  const filtered = exercises.filter((ex) => {
    const matchSearch = ex.title?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || ex.category === filter;
    const matchStatus = statusFilter === 'all' || ex.status === statusFilter;
    return matchSearch && matchFilter && matchStatus;
  });

  // ลบแบบฝึกหัด — ยืนยันก่อนเสมอ สถิติของผู้ใช้ไม่ถูกลบตาม
  const handleDelete = (item) => {
    Alert.alert('ลบแบบฝึกหัด', `ต้องการลบ "${item.title}" ใช่หรือไม่?\nข้อมูลสถิติที่มีอยู่จะไม่ถูกลบ`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => {
        await adminDeleteExercise(item.id);
        setExercises((prev) => prev.filter((e) => e.id !== item.id));
      }},
    ]);
  };

  // แปลงสถานะเป็นข้อความ/สีของ badge (เผยแพร่ = เขียว, ร่าง = ส้ม)
  const statusBadge = (st) => {
    if (st === 'published') return { text: 'เผยแพร่', bg: '#E8F9ED', color: '#34C759' };
    return { text: 'ร่าง', bg: '#FFF9E6', color: '#FF9500' };
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      {/* หัวแถบ: ปุ่มกลับ + จำนวนชุด + ปุ่มเพิ่มใหม่ */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>แบบฝึกหัด ({exercises.length})</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AdminExerciseForm', { exercise: null })} style={s.addBtn}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ช่องค้นหา + แถบกรองหมวด */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#888" style={{ marginRight: 8 }} />
        <TextInput style={s.searchInput} placeholder="ค้นหาชื่อชุด..." placeholderTextColor="#aaa"
          value={search} onChangeText={setSearch} />
      </View>
      <View style={s.filterRow}>
        {['all', 'vocab', 'tense', 'listening'].map((f) => (
          <TouchableOpacity key={f} style={[s.filterBtn, filter === f && s.filterBtnActive]}
            onPress={() => setFilter(f)}>
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {f === 'all' ? 'ทั้งหมด' : CAT_LABEL[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.filterRow}>
        {['all', 'published', 'draft'].map((f) => (
          <TouchableOpacity key={f} style={[s.filterBtn, statusFilter === f && s.filterBtnActive]}
            onPress={() => setStatusFilter(f)}>
            <Text style={[s.filterText, statusFilter === f && s.filterTextActive]}>
              {f === 'all' ? 'สถานะทั้งหมด' : f === 'published' ? 'เผยแพร่' : 'ร่าง'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* รายการการ์ดแบบฝึกหัด — แสดง spinner ระหว่างโหลด */}
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={PRIMARY} size="large" /> : (
        <ResponsiveContainer variant="dashboard" style={{ flex: 0, flexGrow: 1, paddingHorizontal: 0 }}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => {
            // ข้อมูลแสดงผลบางอย่าง fallback ให้ครบแม้ข้อมูลเก่าไม่มี field
            const color = CAT_COLOR[item.category] ?? '#888';
            const itemCount = item.items?.length ?? item.questions?.length ?? 0;
            const badge = statusBadge(item.status);
            return (
              // การ์ด 1 ใบ: จุดสีหมวด + ชื่อ + badge สถานะ + ปุ่มแก้/ลบ
              <View style={s.card}>
                <View style={[s.catDot, { backgroundColor: color }]} />
                <View style={s.cardBody}>
                  <Text style={s.cardTitle}>{item.title}</Text>
                  <Text style={s.cardSub}>
                    {CAT_LABEL[item.category] ?? item.category} · {item.level ?? '-'} · {itemCount} ข้อ
                  </Text>
                </View>
                <View style={[s.statusBadge, { backgroundColor: badge.bg }]}>
                  <Text style={[s.statusText, { color: badge.color }]}>{badge.text}</Text>
                </View>
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.iconBtn}
                    onPress={() => navigation.navigate('AdminExerciseForm', { exercise: item })}>
                    <Ionicons name="pencil-outline" size={20} color={PRIMARY} />
                  </TouchableOpacity>
                  <TouchableOpacity style={s.iconBtn} onPress={() => handleDelete(item)}>
                    <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
        </ResponsiveContainer>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: PRIMARY },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:     { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#fff' },
  addBtn:      { padding: 4 },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  filterRow:   { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  filterBtn:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)' },
  filterBtnActive: { backgroundColor: '#fff' },
  filterText:  { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  filterTextActive: { color: PRIMARY },
  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  catDot:      { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  cardBody:    { flex: 1 },
  cardTitle:   { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  cardSub:     { fontSize: 12, color: '#888', marginTop: 3 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8 },
  iconBtn:     { padding: 6 },
});
