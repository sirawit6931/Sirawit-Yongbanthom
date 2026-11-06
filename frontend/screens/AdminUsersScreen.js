// frontend/screens/AdminUsersScreen.js
// หน้าจัดการสมาชิกของแอดมิน — ดูรายการ/ค้นหา/แก้ชื่อผู้ใช้/ลบโปรไฟล์
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, TextInput, Modal, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  adminGetUserSummary, adminGetUserByEmail, adminUpdateUser, adminDeleteUser,
} from '../services/adminService';
import { quotaMessage } from '../services/firebaseCache';
import ResponsiveContainer from '../components/ResponsiveContainer';

const PRIMARY = '#1A237E'; // สีน้ำเงินเข้ม — ธีมแอดมิน

export default function AdminUsersScreen() {
  const navigation = useNavigation();
  const [users, setUsers]     = useState([]); // รายชื่อสมาชิกทั้งหมด
  const [loading, setLoading] = useState(true); // กำลังโหลดข้อมูล
  const [loadError, setLoadError] = useState(''); // ข้อความ error ตอนโหลดไม่สำเร็จ
  const [search, setSearch]   = useState(''); // ค้นหาด้วยอีเมล
  const [modal, setModal]     = useState(false); // เปิด/ปิด Modal แก้ไขชื่อ
  const [editEmail, setEditEmail] = useState(''); // อีเมลของผู้ใช้ที่กำลังแก้
  const [editUid, setEditUid]     = useState(''); // uid ของผู้ใช้ที่กำลังแก้
  const [editUsername, setEditUsername] = useState(''); // ชื่อผู้ใช้ใหม่ในฟอร์ม
  const [saving, setSaving]   = useState(false); // กำลังบันทึก

  // โหลดรายชื่อสมาชิกทุกครั้งที่เข้าหน้า (flag `active` กัน setState หลังออกจากหน้า)
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoadError('');
    adminGetUserSummary()
      .then((data) => { if (active) { setUsers(data); setLoading(false); } })
      .catch((err) => {
        // กัน unhandled rejection + หน้าโหลดค้าง (รวมตอนติดโควต้า Firebase)
        console.error('[AdminUsers] load error:', err?.code, err?.message);
        if (active) { setLoadError(quotaMessage(err)); setLoading(false); }
      });
    return () => { active = false; };
  }, []));

  // ค้นหาด้วยอีเมลหรือรหัสสมาชิก (Numeric ID)
  const q = search.trim().toLowerCase();
  const filtered = users.filter((u) =>
    u.email?.toLowerCase().includes(q)
  );

  // เปิด Modal แก้ไข — ดึงโปรไฟล์ Firestore ของผู้ใช้ก่อน (summary ไม่มี uid)
  const openEdit = async (item) => {
    const profile = await adminGetUserByEmail(item.email);
    if (!profile) {
      Alert.alert('ผิดพลาด', 'ไม่พบโปรไฟล์ผู้ใช้ในระบบ');
      return;
    }
    setEditEmail(item.email);
    setEditUid(profile.uid);
    setEditUsername(profile.username ?? '');
    setModal(true);
  };

  // บันทึกชื่อผู้ใช้ใหม่ (แก้เฉพาะ username ใน Firestore)
  const handleSaveEdit = async () => {
    if (!editUsername.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อผู้ใช้งาน');
      return;
    }
    setSaving(true);
    try {
      await adminUpdateUser(editUid, { username: editUsername.trim() });
      setUsers((prev) => prev.map((u) => u.email === editEmail ? { ...u } : u));
      setModal(false);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    setSaving(false);
  };

  // ลบโปรไฟล์ผู้ใช้ — ยืนยันก่อน สถิติการเรียนไม่ถูกลบตาม
  const handleDelete = (item) => {
    Alert.alert('ลบผู้ใช้งาน', `ต้องการลบโปรไฟล์ของ "${item.email}" ใช่หรือไม่?\nข้อมูลสถิติจะไม่ถูกลบ`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => {
        const profile = await adminGetUserByEmail(item.email);
        if (!profile) return;
        await adminDeleteUser(profile.uid);
        setUsers((prev) => prev.filter((u) => u.email !== item.email));
      }},
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      {/* หัวแถบ: ปุ่มกลับ + ชื่อหน้า */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>สมาชิก ({users.length} คน)</Text>
      </View>

      {/* Summary bar */}
      <View style={s.summaryBar}>
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{users.length}</Text>
          <Text style={s.summaryLabel}>สมาชิก</Text>
        </View>
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{users.reduce((s, u) => s + u.totalSessions, 0)}</Text>
          <Text style={s.summaryLabel}>ครั้งที่ทำ</Text>
        </View>
        <View style={s.summaryItem}>
          <Text style={s.summaryVal}>{users.reduce((s, u) => s + u.passed, 0)}</Text>
          <Text style={s.summaryLabel}>ผ่านรวม</Text>
        </View>
      </View>

      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#888" style={{ marginRight: 8 }} />
        <TextInput style={s.searchInput} placeholder="ค้นหา email..." placeholderTextColor="#aaa"
          value={search} onChangeText={setSearch} autoCapitalize="none" />
      </View>

      {/* แจ้งเตือนเมื่อโหลดไม่สำเร็จ (เช่น โควต้า Firebase เต็ม) */}
      {loadError ? (
        <View style={s.errorBanner}>
          <Ionicons name="warning-outline" size={18} color="#B45309" />
          <Text style={s.errorBannerText}>{loadError}</Text>
        </View>
      ) : null}

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={PRIMARY} size="large" /> : (
        <ResponsiveContainer variant="dashboard" style={{ flex: 0, flexGrow: 1, paddingHorizontal: 0 }}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.email}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => {
            const passRate = item.totalSessions > 0
              ? Math.round((item.passed / item.totalSessions) * 100)
              : 0;
            return (
              <View style={s.card}>
                <View style={s.avatar}>
                  <Ionicons name="person-outline" size={22} color={PRIMARY} />
                </View>
                <View style={s.cardBody}>
                  <Text style={s.email}>{item.email}</Text>
                  <Text style={s.sub}>ทำแล้ว {item.totalSessions} ครั้ง · ผ่าน {item.passed} ครั้ง</Text>
                </View>
                <View style={s.rateWrap}>
                  <Text style={[s.rate, { color: passRate >= 80 ? '#34C759' : '#FF9500' }]}>{passRate}%</Text>
                  <Text style={s.rateLabel}>pass rate</Text>
                </View>
                <View style={s.cardActions}>
                  <TouchableOpacity style={s.iconBtn} onPress={() => openEdit(item)}>
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

      {/* Modal แก้ไขผู้ใช้งาน */}
      <Modal visible={modal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>แก้ไขผู้ใช้งาน</Text>
            <Text style={s.mLabel}>Email</Text>
            <TextInput style={[s.mInput, { backgroundColor: '#F5F5F5' }]} value={editEmail} editable={false} autoCapitalize="none" />
            <Text style={s.mLabel}>ชื่อผู้ใช้งาน</Text>
            <TextInput style={s.mInput} placeholder="กรอกชื่อผู้ใช้งาน" placeholderTextColor="#aaa"
              value={editUsername} onChangeText={setEditUsername} autoCapitalize="none" />
            <View style={s.mBtnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(false)}>
                <Text style={s.cancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveEdit} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveText}>บันทึก</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: PRIMARY },
  // แจ้งเตือน error (เช่น โควต้า Firebase เต็ม)
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: '#92400E' },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:     { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '800', color: '#fff' },
  summaryBar:  { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  summaryItem: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: 12, alignItems: 'center' },
  summaryVal:  { fontSize: 22, fontWeight: '900', color: '#fff' },
  summaryLabel:{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  avatar:      { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF0FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardBody:    { flex: 1 },
  email:       { fontSize: 14, fontWeight: '600', color: '#1A1A2E' },
  sub:         { fontSize: 12, color: '#888', marginTop: 2 },
  rateWrap:    { alignItems: 'center' },
  rate:        { fontSize: 16, fontWeight: '800' },
  rateLabel:   { fontSize: 10, color: '#aaa', marginTop: 1 },
  cardActions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  iconBtn:     { padding: 6 },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:    { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 16 },
  mLabel:      { fontSize: 12, fontWeight: '600', color: '#888', marginTop: 12, marginBottom: 4 },
  mInput:      { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15 },
  mBtnRow:     { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:   { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelText:  { fontSize: 15, color: '#666' },
  saveBtn:     { flex: 1, backgroundColor: PRIMARY, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
});
