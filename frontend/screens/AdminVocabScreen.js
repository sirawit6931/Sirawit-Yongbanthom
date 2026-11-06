// frontend/screens/AdminVocabScreen.js
// หน้าจัดการคลังคำศัพท์ของแอดมิน — ค้นหา / เพิ่ม / แก้ไข / ลบ (เปิด-ปิดด้วย Modal)
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert, TextInput, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  adminGetAllVocab, adminAddVocab, adminUpdateVocab, adminDeleteVocab,
} from '../services/adminService';
import { quotaMessage } from '../services/firebaseCache';
import ResponsiveContainer from '../components/ResponsiveContainer';

const PRIMARY = '#1A237E'; // สีน้ำเงินเข้ม — ธีมแอดมิน
const LEVELS  = ['A1', 'A2', 'B1', 'B2']; // ระดับ CEFR ให้เลือกในฟอร์ม

// ค่าฟอร์มเปล่าสำหรับตอนเพิ่มคำใหม่
const EMPTY_FORM = { wordEN: '', wordTH: '', cefrLevel: 'A1', partOfSpeech: '' };

export default function AdminVocabScreen() {
  const navigation = useNavigation();
  const [words, setWords]     = useState([]); // คำศัพท์ทั้งหมดจาก Firestore
  const [loading, setLoading] = useState(true); // กำลังโหลดข้อมูล
  const [loadError, setLoadError] = useState(''); // ข้อความ error ตอนโหลดไม่สำเร็จ
  const [search, setSearch]   = useState(''); // ค้นหาด้วยคำอังกฤษหรือคำไทย
  const [modal, setModal]     = useState(false); // เปิด/ปิด Modal ฟอร์มเพิ่ม-แก้ไข
  const [form, setForm]       = useState(EMPTY_FORM); // ค่าในฟอร์ม
  const [editId, setEditId]   = useState(null); // id ที่กำลังแก้ (null = เพิ่มใหม่)
  const [saving, setSaving]   = useState(false); // กำลังบันทึก

  // โหลดคลังคำศัพท์ทุกครั้งที่เข้าหน้า (flag `active` กัน setState หลังออกจากหน้า)
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoadError('');
    adminGetAllVocab()
      .then((data) => { if (active) { setWords(data); setLoading(false); } })
      .catch((err) => {
        // กัน unhandled rejection + หน้าโหลดค้าง (รวมตอนติดโควต้า Firebase)
        console.error('[AdminVocab] load error:', err?.code, err?.message);
        if (active) { setLoadError(quotaMessage(err)); setLoading(false); }
      });
    return () => { active = false; };
  }, []));

  // กรองคำตามที่พิมพ์ค้นหา (ตรงทั้งอังกฤษและไทย)
  const filtered = words.filter((w) =>
    w.wordEN?.toLowerCase().includes(search.toLowerCase()) ||
    w.wordTH?.includes(search)
  );

  // เปิด Modal แบบเพิ่มใหม่ (ฟอร์มเปล่า)
  const openAdd = () => { setForm(EMPTY_FORM); setEditId(null); setModal(true); };
  // เปิด Modal แบบแก้ไข (เอาค่าเดิมมาใส่ฟอร์ม)
  const openEdit = (item) => { setForm({ wordEN: item.wordEN, wordTH: item.wordTH, cefrLevel: item.cefrLevel ?? 'A1', partOfSpeech: item.partOfSpeech ?? '' }); setEditId(item.id); setModal(true); };

  // บันทึกฟอร์ม — editId มี = อัปเดต, ไม่มี = เพิ่มใหม่ แล้วอัปเดตรายการในหน้าทันที
  const handleSave = async () => {
    if (!form.wordEN.trim() || !form.wordTH.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอก wordEN และ wordTH');
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await adminUpdateVocab(editId, form);
        setWords((prev) => prev.map((w) => w.id === editId ? { ...w, ...form } : w));
      } else {
        const ref = await adminAddVocab(form);
        setWords((prev) => [...prev, { id: ref.id, ...form }]);
      }
      setModal(false);
    } catch (e) { Alert.alert('ผิดพลาด', e.message); }
    setSaving(false);
  };

  // ลบคำศัพท์ — ยืนยันก่อน แล้วเอาออกจาก state เลย (ไม่ reload หน้า)
  const handleDelete = (item) => {
    Alert.alert('ลบคำศัพท์', `ต้องการลบ "${item.wordEN}" ใช่หรือไม่?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: async () => {
        await adminDeleteVocab(item.id);
        setWords((prev) => prev.filter((w) => w.id !== item.id));
      }},
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      {/* หัวแถบ: ปุ่มกลับ + ชื่อหน้า + ปุ่มเพิ่มคำใหม่ */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>คลังคำศัพท์ ({words.length})</Text>
        <TouchableOpacity onPress={openAdd} style={s.addBtn}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ช่องค้นหาคำศัพท์ */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#888" style={{ marginRight: 8 }} />
        <TextInput style={s.searchInput} placeholder="ค้นหาคำศัพท์..." placeholderTextColor="#aaa"
          value={search} onChangeText={setSearch} />
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
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardLeft}>
                <Text style={s.wordEN}>{item.wordEN}</Text>
                <Text style={s.wordTH}>{item.wordTH}</Text>
                <Text style={s.badge}>{item.cefrLevel ?? '-'}</Text>
              </View>
              <View style={s.cardRight}>
                <TouchableOpacity onPress={() => openEdit(item)} style={s.iconBtn}>
                  <Ionicons name="pencil-outline" size={20} color={PRIMARY} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={s.iconBtn}>
                  <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
        </ResponsiveContainer>
      )}

      {/* Modal ฟอร์มเพิ่ม/แก้ไขคำศัพท์ — เลื่อนจากด้านล่าง */}
      <Modal visible={modal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{editId ? 'แก้ไขคำศัพท์' : 'เพิ่มคำศัพท์ใหม่'}</Text>
            {[
              { label: 'คำศัพท์ EN', key: 'wordEN', placeholder: 'เช่น apple' },
              { label: 'คำแปล TH', key: 'wordTH', placeholder: 'เช่น แอปเปิ้ล' },
              { label: 'ประเภทคำ', key: 'partOfSpeech', placeholder: 'noun / verb / adj...' },
            ].map(({ label, key, placeholder }) => (
              <View key={key}>
                <Text style={s.mLabel}>{label}</Text>
                <TextInput style={s.mInput} placeholder={placeholder} placeholderTextColor="#aaa"
                  value={form[key]} onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))} autoCapitalize="none" />
              </View>
            ))}
            <Text style={s.mLabel}>ระดับ CEFR</Text>
            <View style={s.levelRow}>
              {LEVELS.map((lv) => (
                <TouchableOpacity key={lv} style={[s.levelBtn, form.cefrLevel === lv && s.levelBtnActive]}
                  onPress={() => setForm((f) => ({ ...f, cefrLevel: lv }))}>
                  <Text style={[s.levelBtnText, form.cefrLevel === lv && { color: '#fff' }]}>{lv}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.mBtnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModal(false)}>
                <Text style={s.cancelText}>ยกเลิก</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveText}>บันทึก</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
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
  addBtn:      { padding: 4 },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },
  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  cardLeft:    { flex: 1 },
  wordEN:      { fontSize: 16, fontWeight: '700', color: '#1A1A2E' },
  wordTH:      { fontSize: 13, color: '#666', marginTop: 2 },
  badge:       { marginTop: 4, fontSize: 11, fontWeight: '700', color: PRIMARY, backgroundColor: '#EEF0FF', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  cardRight:   { flexDirection: 'row', gap: 8 },
  iconBtn:     { padding: 6 },
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox:    { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: '#1A1A2E', marginBottom: 16 },
  mLabel:      { fontSize: 12, fontWeight: '600', color: '#888', marginTop: 12, marginBottom: 4 },
  mInput:      { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 15 },
  levelRow:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  levelBtn:    { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 10, alignItems: 'center' },
  levelBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  levelBtnText:{ fontSize: 14, fontWeight: '700', color: '#888' },
  mBtnRow:     { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn:   { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 14, alignItems: 'center' },
  cancelText:  { fontSize: 15, color: '#666' },
  saveBtn:     { flex: 1, backgroundColor: PRIMARY, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveText:    { fontSize: 15, fontWeight: '700', color: '#fff' },
});
