// frontend/screens/ProfileScreen.js
import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, StatusBar, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { updateUsername } from '../services/firestoreService';
import ResponsiveContainer from '../components/ResponsiveContainer';
import ConfirmModal, { SIGN_OUT_TEXTS } from '../components/ConfirmModal';

const PRIMARY = '#5B4FCF';

// แจ้งเตือนผู้ใช้ — Web ใช้ window.alert เพราะ Alert.alert เป็น no-op บน RN Web
const notify = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function ProfileScreen({ user }) {
  const navigation  = useNavigation();
  const displayName = user?.username || user?.displayName || user?.email?.split('@')[0] || 'ผู้ใช้งาน';
  const email       = user?.email || '';

  // ─── แก้ไขชื่อผู้ใช้ ───
  const initialName = user?.username || user?.displayName || user?.email?.split('@')[0] || '';
  const [savedName,  setSavedName]  = useState(initialName); // ชื่อที่บันทึกแล้ว (ใช้แสดงผล header)
  const [nameInput,  setNameInput]  = useState(initialName); // ค่าในช่องกรอก
  const [saving,     setSaving]     = useState(false);
  const [editing,    setEditing]    = useState(false); // โหมดแก้ไข — ต้องกด "แก้ไขชื่อ" ก่อน ปุ่มบันทึกจึงจะแสดง
  const [signOutModalVisible, setSignOutModalVisible] = useState(false); // กล่องยืนยันก่อนออกจากระบบ
  const nameInputRef = useRef(null);

  const trimmedInput = nameInput.trim();
  const canSave = trimmedInput.length > 0 && trimmedInput !== savedName && !saving;

  // กด "แก้ไขชื่อ" → เข้าสู่โหมดแก้ไข (ช่องกรอกใช้งานได้ + แสดงปุ่มบันทึก)
  const handleStartEdit = () => {
    if (saving) return;
    setEditing(true);
    // รอให้ re-render เสร็จ (editable=true) ก่อนโฟกัสช่องกรอก
    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  // ยกเลิกการแก้ไข → คืนค่าช่องกรอกเป็นชื่อเดิมและออกจากโหมดแก้ไข
  const handleCancelEdit = () => {
    if (saving) return;
    setNameInput(savedName);
    setEditing(false);
  };

  const handleSaveName = async () => {
    if (!canSave) return;
    if (!user?.uid) {
      notify('บันทึกไม่สำเร็จ', 'ไม่พบข้อมูลผู้ใช้ กรุณาออกจากระบบแล้วเข้าสู่ระบบอีกครั้ง');
      return;
    }

    setSaving(true);
    try {
      await updateUsername(user.uid, trimmedInput);
      setSavedName(trimmedInput);
      setNameInput(trimmedInput);
      setEditing(false); // บันทึกสำเร็จ → ออกจากโหมดแก้ไข ปุ่มบันทึกจึงซ่อนไป
      notify('บันทึกสำเร็จ', 'อัปเดตชื่อของคุณเรียบร้อยแล้ว');
    } catch (err) {
      console.error('Update username error:', err.message);
      notify('บันทึกไม่สำเร็จ', 'เกิดข้อผิดพลาดในการบันทึกชื่อ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSaving(false);
    }
  };

  // ปุ่ม "ออกจากระบบ" → เปิดกล่องยืนยันแทน (Alert.alert ไม่ทำงานบน web)
  const handleSignOut = () => {
    setSignOutModalVisible(true);
  };

  // กดยืนยันในกล่อง → ออกจากระบบจริง
  const confirmSignOut = async () => {
    setSignOutModalVisible(false);
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout Error:', error.message);
    }
  };

  const MENU_ITEMS = [
    {
      icon: 'book-outline',
      color: '#5B4FCF',
      bg:    '#EEF0FF',
      label: 'คลังคำศัพท์',
      sub:   'รายการคำศัพท์ที่บันทึกไว้',
      onPress: () => navigation.navigate('VocabLibrary'),
    },
    {
      icon: 'bar-chart-outline',
      color: '#34C759',
      bg:    '#E8F9ED',
      label: 'สถิติการเรียน',
      sub:   'ดูความคืบหน้าของคุณ',
      onPress: () => navigation.navigate('Stats'),
    },
  ];
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <ResponsiveContainer variant="form" style={{ flexGrow: 1, paddingHorizontal: 0 }}>

        {/* ─── Avatar + ชื่อ ─── */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>
              {(savedName || displayName).charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={s.name}>{savedName || displayName}</Text>
          <Text style={s.email}>{email}</Text>
        </View>

        {/* ─── ข้อมูลส่วนตัว ─── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>ข้อมูลส่วนตัว</Text>
          <Text style={s.fieldLabel}>ชื่อ *</Text>
          <TextInput
            ref={nameInputRef}
            style={[s.fieldInput, !editing && s.fieldInputReadOnly]}
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="กรอกชื่อของคุณ"
            placeholderTextColor="#aaa"
            maxLength={50}
            editable={editing && !saving}
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={editing && canSave ? handleSaveName : undefined}
          />
          {!editing ? (
            /* ยังไม่ได้กดแก้ไข → แสดงเฉพาะปุ่ม "แก้ไขชื่อ" */
            <TouchableOpacity style={s.editBtn} onPress={handleStartEdit} activeOpacity={0.8}>
              <Ionicons name="pencil-outline" size={16} color={PRIMARY} />
              <Text style={s.editBtnText}>แก้ไขชื่อ</Text>
            </TouchableOpacity>
          ) : (
            /* อยู่ในโหมดแก้ไข → แสดงปุ่มบันทึก + ยกเลิก */
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
                onPress={handleSaveName}
                disabled={!canSave}
                activeOpacity={0.8}
              >
                {saving
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.saveBtnText}>บันทึกชื่อ</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={handleCancelEdit}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={s.cancelBtnText}>ยกเลิก</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── เมนู ─── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>เมนู</Text>
          {MENU_ITEMS.map((item) => (
            <TouchableOpacity key={item.label} style={s.menuRow} onPress={item.onPress} activeOpacity={0.7}>
              <View style={[s.menuIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <View style={s.menuText}>
                <Text style={s.menuLabel}>{item.label}</Text>
                <Text style={s.menuSub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── ปุ่มออกจากระบบ ─── */}
        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color="#FF3B30" />
          <Text style={s.signOutText}>ออกจากระบบ</Text>
        </TouchableOpacity>

        </ResponsiveContainer>
      </ScrollView>

      {/* กล่องยืนยันก่อนออกจากระบบ — โทนสีหลักเดิมของแอป (ต้องอยู่นอก ScrollView เพื่อให้ Modal กลางจอบน Web) */}
      <ConfirmModal
        visible={signOutModalVisible}
        title={SIGN_OUT_TEXTS.title}
        message={SIGN_OUT_TEXTS.message}
        confirmText={SIGN_OUT_TEXTS.confirm}
        cancelText={SIGN_OUT_TEXTS.cancel}
        accentColor={PRIMARY}
        onConfirm={confirmSignOut}
        onCancel={() => setSignOutModalVisible(false)}
        testID="signout-confirm"
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: PRIMARY },
  scroll: { flexGrow: 1, backgroundColor: '#F4F6FF', paddingBottom: 40 },

  // Avatar
  avatarSection: {
    backgroundColor: PRIMARY,
    alignItems: 'center',
    paddingBottom: 32,
    paddingTop: 16,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { fontSize: 34, fontWeight: 'bold', color: '#fff' },
  name:       { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  email:      { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  // Card
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 12, textTransform: 'uppercase' },

  // Field
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#333', marginBottom: 6 },
  fieldInput: {
    backgroundColor: '#F5F5F5', borderRadius: 10,
    borderWidth: 1, borderColor: '#E0E0E0',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#1A1A2E',
  },
  fieldInputReadOnly: { backgroundColor: '#F5F5F5', borderColor: '#EDEDED', color: '#777' },
  actionRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 12, gap: 10,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: PRIMARY, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { backgroundColor: '#C9C6E8' },
  saveBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: '#DDD',
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText:   { color: '#666', fontWeight: '700', fontSize: 15 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 12,
    backgroundColor: '#EEF0FF', borderRadius: 12,
    paddingVertical: 12,
  },
  editBtnText: { color: PRIMARY, fontWeight: '700', fontSize: 15, marginLeft: 6 },

  // Menu
  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  menuIcon:  {
    width: 40, height: 40, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  menuText:  { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  menuSub:   { fontSize: 12, color: '#888', marginTop: 1 },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, marginTop: 20,
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  signOutText: { fontSize: 16, fontWeight: '600', color: '#FF3B30', marginLeft: 8 },
});
