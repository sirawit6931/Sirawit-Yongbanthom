// frontend/screens/AdminDashboardScreen.js
// หน้าแดชบอร์ดแอดมิน — ปุ่มเมนูเข้าจัดการคลังคำศัพท์ / แบบฝึกหัด / สมาชิก
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import ResponsiveContainer from '../components/ResponsiveContainer';

const PRIMARY = '#1A237E'; // สีน้ำเงินเข้ม — แยกธีมแอดมินออกจากหน้าผู้ใช้

// รายการเมนูหลักของแดชบอร์ด (icon / สี / ชื่อ / หน้าปลายทาง)
const MENUS = [
  { icon: 'book-outline',       color: '#5B4FCF', bg: '#EEF0FF', label: 'คลังคำศัพท์',    screen: 'AdminVocab' },
  { icon: 'document-text-outline', color: '#FF9500', bg: '#FFF3E0', label: 'แบบฝึกหัด',  screen: 'AdminExercise' },
  { icon: 'people-outline',     color: '#34C759', bg: '#E8F9ED', label: 'จัดการสมาชิก',  screen: 'AdminUsers' },
];

export default function AdminDashboardScreen({ user }) {
  const navigation = useNavigation();

  // ยืนยันก่อนออกจากระบบ แล้วค่อย signOut ของ Firebase
  const handleSignOut = () => {
    Alert.alert('ออกจากระบบ?', '', [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ออก', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      {/* หัวแถบ: โลโก้ + อีเมลแอดมิน + ปุ่มออกจากระบบ */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Ionicons name="shield-checkmark" size={24} color="#fff" />
          <View style={{ marginLeft: 10 }}>
            <Text style={s.headerTitle}>Admin Dashboard</Text>
            <Text style={s.headerSub}>{user?.email ?? ''}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={s.signOutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* เนื้อหา: รายการเมนูจัดการระบบ */}
      <View style={s.body}>
        <ResponsiveContainer variant="dashboard" style={{ paddingHorizontal: 0 }}>
        <Text style={s.sectionTitle}>จัดการระบบ</Text>
        {/* วนแสดงการ์ดเมนู 1 ใบต่อ 1 หน้าจัดการ */}
        {MENUS.map((m) => (
          <TouchableOpacity
            key={m.label}
            style={s.menuRow}
            onPress={() => navigation.navigate(m.screen)}
            activeOpacity={0.7}
          >
            <View style={[s.menuIcon, { backgroundColor: m.bg }]}>
              <Ionicons name={m.icon} size={22} color={m.color} />
            </View>
            <Text style={s.menuLabel}>{m.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        ))}
        </ResponsiveContainer>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: PRIMARY },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  signOutBtn:  { padding: 6 },

  body:         { flex: 1, backgroundColor: '#F4F6FF', padding: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#888', marginBottom: 12 },
  menuRow:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  menuIcon:     { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  menuLabel:    { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
});
