// frontend/screens/AdminLoginScreen.js
// หน้าเข้าสู่ระบบแอดมิน — ใช้ "ชื่อผู้ดูแล + รหัสผ่าน" (map เป็นอีเมลภายใน แล้วเช็คสิทธิ์ admin)
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { checkIsAdmin } from '../services/firestoreService';
import ResponsiveContainer from '../components/ResponsiveContainer';

// ── Admin username → อีเมลภายใน (ข้อ 1.3.3: แอดมินเข้าสู่ระบบด้วย "ชื่อ + รหัสผ่าน") ──
// Firebase Auth บังคับใช้อีเมล จึง map ชื่อ → อีเมลภายในโดเมน @local.admin
// (โดเมนปลอม ไม่มีอยู่จริง กันชนกับ user จริง) แล้ว login ด้วยอีเมลนั้น
export const ADMIN_EMAIL_DOMAIN = '@local.admin';
export function adminUsernameToEmail(username) {
  return `${String(username ?? '').trim().toLowerCase()}${ADMIN_EMAIL_DOMAIN}`;
}

const PRIMARY = '#1A237E'; // Navy — แยกสีจาก User

// จำชื่อ admin ไว้ prefill (ไม่เก็บรหัสผ่าน) — session จริงให้ Firebase persistence จำ
const ADMIN_USERNAME_KEY = '@admin:username';

export default function AdminLoginScreen() {
  const navigation = useNavigation();
  const [username, setUsername]   = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false); // กำลังเข้าสู่ระบบ
  const [showPass, setShowPass] = useState(false); // แสดง/ซ่อนรหัสผ่าน

  // เปิดหน้านี้ → ดึงชื่อที่จำไว้มาใส่ช่องกรอก
  React.useEffect(() => {
    AsyncStorage.getItem(ADMIN_USERNAME_KEY)
      .then((saved) => { if (saved) setUsername(saved); })
      .catch(() => {});
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('ข้อผิดพลาด', 'กรุณากรอกชื่อผู้ดูแลและรหัสผ่าน');
      return;
    }
    setLoading(true);
    try {
      // ข้อ 1.3.3: กรอก "ชื่อ + รหัสผ่าน" → map เป็นอีเมลภายในแล้ว login ด้วย Firebase Auth
      const email = adminUsernameToEmail(username);
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const isAdmin = await checkIsAdmin(credential.user.email);
      if (!isAdmin) {
        // ไม่ใช่ Admin → sign out แล้วแจ้ง
        await signOut(auth);
        Alert.alert('ไม่มีสิทธิ์เข้าถึง', 'บัญชีนี้ไม่ใช่ผู้ดูแลระบบ');
        setLoading(false);
        return;
      }
      // Admin ✅ — จำชื่อไว้ prefill รอบหน้า + App.js จะ redirect ไป AdminDashboard อัตโนมัติ
      AsyncStorage.setItem(ADMIN_USERNAME_KEY, username.trim()).catch(() => {});
    } catch (err) {
      let msg = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'ชื่อผู้ดูแลหรือรหัสผ่านไม่ถูกต้อง';
      }
      Alert.alert('ไม่สามารถเข้าสู่ระบบ', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      {/* หัว: โลโก้โล่ + ชื่อระบบ */}
      <View style={s.header}>
        <Ionicons name="shield-checkmark" size={40} color="#fff" />
        <Text style={s.title}>Admin Panel</Text>
        <Text style={s.sub}>ระบบจัดการแอปพลิเคชัน</Text>
      </View>

      {/* ฟอร์ม: ชื่อผู้ดูแล + รหัสผ่าน + ปุ่มเข้าสู่ระบบ */}
      <View style={s.form}>
        <ResponsiveContainer variant="form" style={{ paddingHorizontal: 0 }}>
        <Text style={s.label}>ชื่อผู้ดูแลระบบ</Text>
        <TextInput
          style={s.input}
          placeholder="เช่น admin01"
          placeholderTextColor="#aaa"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={s.label}>Password</Text>
        <View style={s.passWrap}>
          <TextInput
            style={s.inputPass}
            placeholder="รหัสผ่าน"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity onPress={() => setShowPass(!showPass)} style={s.eyeBtn}>
            <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#888" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.loginBtn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.loginBtnText}>เข้าสู่ระบบ Admin</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={s.backBtn} onPress={() => navigation.navigate('Login')}>
          <Ionicons name="chevron-back" size={16} color="#888" />
          <Text style={s.backText}>กลับหน้า Login ผู้ใช้งาน</Text>
        </TouchableOpacity>
        </ResponsiveContainer>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: PRIMARY },
  header: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  title:  { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 12 },
  sub:    { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  form: {
    flex: 1, backgroundColor: '#F8F9FF', borderTopLeftRadius: 28,
    borderTopRightRadius: 28, padding: 28,
  },
  label:  { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 16 },
  input:  { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: '#fff' },
  passWrap: { flexDirection: 'row', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, backgroundColor: '#fff' },
  inputPass:{ flex: 1, padding: 14, fontSize: 15 },
  eyeBtn:   { padding: 14, justifyContent: 'center' },

  loginBtn: {
    backgroundColor: PRIMARY, borderRadius: 14, padding: 16,
    alignItems: 'center', marginTop: 28,
  },
  loginBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 4 },
  backText: { fontSize: 13, color: '#888' },
});
