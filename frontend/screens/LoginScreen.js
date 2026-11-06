// frontend/screens/LoginScreen.js
// หน้าเข้าสู่ระบบผู้ใช้ทั่วไป — Firebase Auth (อีเมล + รหัสผ่าน)
import React, { useState } from 'react';
import {
  Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
  StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import Logo from '../components/Logo';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { styles } from '../styles/authStyles';
import { Ionicons } from '@expo/vector-icons';

import { getApiBase } from '../services/apiConfig';

const API_URL = getApiBase(); // ที่อยู่ backend จาก .env

export default function LoginScreen({ navigation }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false); // แสดง/ซ่อนรหัสผ่าน
  const [loading, setLoading]   = useState(false); // กำลังเข้าสู่ระบบ
  const [errorMsg, setErrorMsg] = useState(''); // ข้อความ error แสดงใต้หัวข้อ

  // เช็คข้อมูล → Firebase Auth → (สำเร็จ) App.js จะสลับหน้าให้เอง
  const handleLogin = async () => {
    const trimmedEmail = email.trim(); // ตัดช่องว่างหัว-ท้ายก่อน submit
    setErrorMsg('');
    if (!trimmedEmail || !password) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      // ส่ง Token ไป Backend (ไม่บังคับ — ถ้า offline ก็ไม่พัง)
      try {
        const idToken = await userCredential.user.getIdToken();
        await fetch(`${API_URL}/api/protected-data`, {
          method:  'GET',
          headers: { Authorization: `Bearer ${idToken}` },
        });
      } catch (_) {}
      // Navigation จัดการโดย onAuthStateChanged ใน App.js อัตโนมัติ
    } catch (error) {
      console.error('Firebase Login Error:', error.code, error.message);
      let msg = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      if (
        error.code === 'auth/user-not-found' ||
        error.code === 'auth/wrong-password'  ||
        error.code === 'auth/invalid-credential'
      ) {
        msg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (error.code === 'auth/user-disabled') {
        msg = 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
      } else if (error.code === 'auth/operation-not-allowed') {
        msg = 'การเข้าสู่ระบบด้วยอีเมลถูกปิดใช้งาน (disabled auth provider)';
      } else if (error.code === 'auth/network-request-failed') {
        msg = 'การเชื่อมต่ออินเทอร์เน็ตไม่เสถียร กรุณาลองใหม่';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่';
      } else if (error.message) {
        msg = error.message;
      }
      setErrorMsg(msg);
      Alert.alert('เข้าสู่ระบบไม่สำเร็จ', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {/* ปรับพื้นที่ตามคีย์บอร์ด (iOS ใช้ padding, Android ใช้ height) */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ResponsiveContainer variant="form" style={{ flexGrow: 1 }}>
          <Logo />

          <Text style={styles.welcomeTitle}>ยินดีต้อนรับ</Text>
          <Text style={styles.welcomeSub}>ฝึกภาษาอังกฤษพื้นฐาน</Text>

          <View style={styles.formContainer}>
            <Text style={styles.sectionLabel}>เข้าสู่ระบบ</Text>

            {errorMsg ? (
              <Text style={styles.formError}>{errorMsg}</Text>
            ) : null}

            {/* อีเมล */}
            <Text style={styles.fieldLabel}>อีเมล</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="กรอกอีเมลของคุณ"
                placeholderTextColor="#bbb"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* รหัสผ่าน */}
            <Text style={styles.fieldLabel}>รหัสผ่าน</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="กรอกรหัสผ่าน"
                placeholderTextColor="#bbb"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Ionicons
                  name={showPass ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            {/* ลืมรหัสผ่าน */}
            <TouchableOpacity
              style={styles.forgotRow}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotText}>ลืมรหัสผ่าน?</Text>
            </TouchableOpacity>

            {/* ปุ่มเข้าสู่ระบบ */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.disabledBtn]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>เข้าสู่ระบบ</Text>}
            </TouchableOpacity>

            {/* หรือ */}
            <Text style={styles.orText}>หรือ</Text>

            {/* ปุ่มสมัครสมาชิก */}
            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => navigation.navigate('Register')}
            >
              <Text style={styles.outlineBtnText}>สมัครสมาชิกใหม่</Text>
            </TouchableOpacity>

          </View>
          </ResponsiveContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
