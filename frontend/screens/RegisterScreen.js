// frontend/screens/RegisterScreen.js
// หน้าสมัครสมาชิก — สร้างบัญชีด้วย Firebase Auth แล้วบันทึกชื่อผู้ใช้ลง Firestore
import React, { useState } from 'react';
import {
  Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
  StatusBar, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { updateUsername } from '../services/firestoreService';
import Logo from '../components/Logo';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { styles } from '../styles/authStyles';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen({ navigation }) {
  const [username, setUsername]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState(''); // ยืนยันรหัสผ่านซ้ำ
  const [showPass, setShowPass]       = useState(false); // แสดง/ซ่อนรหัสผ่าน
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]         = useState(false); // กำลังสมัคร

  // ตรวจสอบข้อมูลในฟอร์ม แล้วสร้างบัญชีผ่าน Firebase Auth
  const handleSignUp = async () => {
    if (!username.trim() || !email.trim() || !password || !confirm) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    if (password.length < 6) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (password !== confirm) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      // เอกสารบทที่ 3 ข้อ 3.1.1(1): สมัครสมาชิกต้องใช้ข้อมูล ชื่อผู้ใช้/อีเมล/รหัสผ่าน
      // บันทึกชื่อผู้ใช้ลง Auth displayName + โปรไฟล์ Firestore (users/{uid}) แบบ best-effort
      // (ถ้าบันทึกโปรไฟล์ล้มเหลว การสมัครยังถือว่าสำเร็จ — ผู้ใช้แก้ชื่อทีหลังใน Profile ได้)
      const displayName = username.trim();
      try {
        await updateProfile(userCredential.user, { displayName });
      } catch (profileErr) {
        console.warn('[RegisterScreen] updateProfile displayName failed:', profileErr?.code, profileErr?.message);
      }
      try {
        await updateUsername(userCredential.user.uid, displayName);
      } catch (profileErr) {
        console.warn('[RegisterScreen] updateUsername failed:', profileErr?.code, profileErr?.message);
      }
      await signOut(auth);
      Alert.alert('สมัครสมาชิกสำเร็จ', 'กรุณาเข้าสู่ระบบด้วยบัญชีที่สมัครไว้', [
        { text: 'ตกลง', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error) {
      let msg = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      if (error.code === 'auth/email-already-in-use') {
        msg = 'อีเมลนี้ถูกใช้งานแล้ว';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'รูปแบบอีเมลไม่ถูกต้อง';
      } else if (error.code === 'auth/weak-password') {
        msg = 'รหัสผ่านไม่ปลอดภัยพอ กรุณาใช้อย่างน้อย 6 ตัวอักษร';
      }
      Alert.alert('สมัครสมาชิกไม่สำเร็จ', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <ResponsiveContainer variant="form" style={{ flexGrow: 1 }}>
          {/* ปุ่มกลับ */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>‹ กลับ</Text>
          </TouchableOpacity>

          {/* โลโก้ + หัวข้อต้อนรับ */}
          <Logo />

          <Text style={styles.welcomeTitle}>สร้างบัญชีใหม่</Text>
          <Text style={styles.welcomeSub}>กรอกข้อมูลเพื่อเริ่มต้นใช้งาน</Text>

          <View style={styles.formContainer}>
            {/* ชื่อผู้ใช้ */}
            <Text style={styles.fieldLabel}>ชื่อผู้ใช้ *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="กรอกชื่อของคุณ"
                placeholderTextColor="#bbb"
                value={username}
                onChangeText={setUsername}
              />
            </View>

            {/* อีเมล */}
            <Text style={styles.fieldLabel}>อีเมล *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="example@email.com"
                placeholderTextColor="#bbb"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* รหัสผ่าน */}
            <Text style={styles.fieldLabel}>รหัสผ่าน *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="อย่างน้อย 6 ตัวอักษร"
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

            {/* ยืนยันรหัสผ่าน */}
            <Text style={styles.fieldLabel}>ยืนยันรหัสผ่าน *</Text>
            <View style={[
              styles.inputWrapper,
              confirm.length > 0 && password !== confirm && styles.inputError,
            ]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="ยืนยันรหัสผ่านอีกครั้ง"
                placeholderTextColor="#bbb"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            {confirm.length > 0 && password !== confirm && (
              <Text style={styles.matchError}>รหัสผ่านไม่ตรงกัน</Text>
            )}

            {/* ปุ่มสมัครสมาชิก */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.disabledBtn, { marginTop: 10 }]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.primaryBtnText}>สมัครสมาชิก</Text>}
            </TouchableOpacity>

            {/* มีบัญชีแล้ว */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.loginLinkRow}
            >
              <Text style={styles.loginLinkText}>
                มีบัญชีแล้ว?{' '}
                <Text style={styles.loginLinkBold}>เข้าสู่ระบบ</Text>
              </Text>
            </TouchableOpacity>
          </View>
          </ResponsiveContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
