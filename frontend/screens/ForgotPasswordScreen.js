// frontend/screens/ForgotPasswordScreen.js
import React, { useState, useRef } from 'react';
import {
  Text, View, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView,
  StatusBar, KeyboardAvoidingView, Platform,
  StyleSheet, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../firebase';
import { signInWithCustomToken, updatePassword, signOut } from 'firebase/auth';
import { styles as authStyles, PRIMARY } from '../styles/authStyles';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { Ionicons } from '@expo/vector-icons';

import { getApiBase } from '../services/apiConfig';

const API_URL = getApiBase();

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function StepBar({ step }) {
  const steps = ['กรอกอีเมล', 'ยืนยัน OTP', 'รีเซ็ตใหม่'];
  return (
    <View style={s.stepRow}>
      {steps.map((label, i) => {
        const idx          = i + 1;
        const done         = idx < step;
        const active       = idx === step;
        const circleColor  = done || active ? PRIMARY : '#D0D0D0';
        const textColor    = done || active ? PRIMARY : '#999';
        return (
          <React.Fragment key={idx}>
            <View style={s.stepItem}>
              <View style={[s.stepCircle, { backgroundColor: circleColor }]}>
                {done
                  ? <Ionicons name="checkmark" size={14} color="#fff" />
                  : <Text style={s.stepNum}>{idx}</Text>}
              </View>
              <Text style={[s.stepLabel, { color: textColor }]}>{label}</Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[s.stepLine, { backgroundColor: done ? PRIMARY : '#D0D0D0' }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// ─── Shared Header ────────────────────────────────────────────────────────────
function Header({ onBack }) {
  return (
    <>
      {onBack && (
        <TouchableOpacity style={authStyles.backBtn} onPress={onBack}>
          <Text style={authStyles.backBtnText}>‹ กลับ</Text>
        </TouchableOpacity>
      )}
      <View style={s.iconWrap}>
        <Ionicons name="lock-open-outline" size={56} color={PRIMARY} />
      </View>
      <Text style={authStyles.welcomeTitle}>ลืมรหัสผ่าน?</Text>
      <Text style={[authStyles.welcomeSub, { marginHorizontal: 8 }]}>
        ไม่ต้องกังวล เราจะช่วยให้คุณรีเซ็ตรหัสผ่านใหม่
      </Text>
    </>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep]           = useState(1);   // 1 | 2 | 3
  const [email, setEmail]         = useState('');
  const [otp, setOtp]             = useState(['', '', '', '', '', '']); // 6 หลัก
  const [newPass, setNewPass]     = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [customToken, setCustomToken] = useState(''); // รับจาก verify-otp

  const otpRefs = Array.from({ length: 6 }, () => useRef(null));

  // ── Step 1: ส่ง OTP ผ่าน Backend ──────────────────────────────────────────
  const handleSendOtp = async () => {
    if (!email.trim()) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกอีเมลของคุณ');
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000); // กันปุ่มหมุนค้างถ้า IP/เน็ตผิด
    try {
      const res  = await fetch(`${API_URL}/api/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
        signal:  ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setStep(2);
      } else {
        Alert.alert('ส่ง OTP ไม่สำเร็จ', data.message || `เกิดข้อผิดพลาด (${res.status})`);
      }
    } catch (err) {
      Alert.alert(
        'เกิดข้อผิดพลาด',
        err?.name === 'AbortError'
          ? `เชื่อมต่อ Server เกิน 15 วินาที (${API_URL}) — ตรวจว่า backend รันอยู่และ IP ตรงกับเครื่อง`
          : `ไม่สามารถเชื่อมต่อ Server ได้ (${API_URL}) กรุณาลองใหม่`,
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  // ── Step 2: ยืนยัน OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกรหัส OTP ให้ครบ 6 หลัก');
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res  = await fetch(`${API_URL}/api/verify-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), otp: code }),
        signal:  ctrl.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setCustomToken(data.customToken);
        setStep(3);
      } else {
        Alert.alert('OTP ไม่ถูกต้อง', data.message || `เกิดข้อผิดพลาด (${res.status})`);
      }
    } catch (err) {
      Alert.alert(
        'เกิดข้อผิดพลาด',
        err?.name === 'AbortError'
          ? `เชื่อมต่อ Server เกิน 15 วินาที (${API_URL}) — ตรวจว่า backend รันอยู่และ IP ตรงกับเครื่อง`
          : `ไม่สามารถเชื่อมต่อ Server ได้ (${API_URL}) กรุณาลองใหม่`,
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  };

  // ── Step 3: ตั้งรหัสผ่านใหม่ ──────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!newPass || !confirmPass) {
      Alert.alert('แจ้งเตือน', 'กรุณากรอกรหัสผ่านให้ครบ');
      return;
    }
    if (newPass.length < 6) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (newPass !== confirmPass) {
      Alert.alert('แจ้งเตือน', 'รหัสผ่านไม่ตรงกัน');
      return;
    }
    setLoading(true);
    try {
      // Login ด้วย Custom Token แล้วเปลี่ยนรหัสผ่าน
      const credential = await signInWithCustomToken(auth, customToken);
      await updatePassword(credential.user, newPass);
      // Sign out หลังเปลี่ยนรหัสผ่านสำเร็จ เพื่อให้ user login ใหม่
      await signOut(auth);
      Alert.alert('สำเร็จ', 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่', [
        { text: 'ตกลง', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      let msg = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      if (err.code === 'auth/requires-recent-login') {
        msg = 'Session หมดอายุ กรุณาขอ OTP ใหม่';
      } else if (err.code === 'auth/weak-password') {
        msg = 'รหัสผ่านไม่ปลอดภัยพอ กรุณาใช้อย่างน้อย 6 ตัวอักษร';
      }
      Alert.alert('เปลี่ยนรหัสผ่านไม่สำเร็จ', msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ─────────────────────────────────────────────────────────────
  const handleResend = async () => {
    setLoading(true);
    setOtp(['', '', '', '', '', '']);
    try {
      const res  = await fetch(`${API_URL}/api/send-otp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        Alert.alert('ส่ง OTP ใหม่สำเร็จ', 'กรุณาตรวจสอบกล่องจดหมายของคุณ');
      } else {
        Alert.alert('เกิดข้อผิดพลาด', data.message || 'ลองใหม่อีกครั้ง');
      }
    } catch {
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อ Server ได้');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input handlers ─────────────────────────────────────────────────────
  const handleOtpChange = (text, index) => {
    const val  = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[index] = val;
    setOtp(next);
    if (val && index < 5) otpRefs[index + 1].current?.focus();
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: STEP 1 — กรอกอีเมล
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 1) {
    return (
      <SafeAreaView style={authStyles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={authStyles.scrollContent} keyboardShouldPersistTaps="handled">
            <ResponsiveContainer variant="form" style={{ flexGrow: 1 }}>
            <Header onBack={() => navigation.navigate('Login')} />
            <StepBar step={1} />

            <View style={authStyles.formContainer}>
              <Text style={s.stepTitle}>กรอกอีเมลของคุณ</Text>
              <Text style={s.stepDesc}>เราจะส่งรหัส OTP ไปยังอีเมลที่ลงทะเบียนไว้</Text>

              <Text style={authStyles.fieldLabel}>อีเมล</Text>
              <View style={authStyles.inputWrapper}>
                <Ionicons name="mail-outline" size={18} color="#999" style={authStyles.inputIcon} />
                <TextInput
                  style={authStyles.inputField}
                  placeholder="กรอกอีเมลของคุณ"
                  placeholderTextColor="#bbb"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[authStyles.primaryBtn, loading && authStyles.disabledBtn, { marginTop: 8 }]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={authStyles.primaryBtnText}>ส่งรหัส OTP →</Text>}
              </TouchableOpacity>
            </View>
            </ResponsiveContainer>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: STEP 2 — กรอก OTP
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 2) {
    return (
      <SafeAreaView style={authStyles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={authStyles.scrollContent} keyboardShouldPersistTaps="handled">
            <ResponsiveContainer variant="form" style={{ flexGrow: 1 }}>
            <Header onBack={() => setStep(1)} />
            <StepBar step={2} />

            <View style={authStyles.formContainer}>
              <Text style={s.stepTitle}>ยืนยันรหัส OTP</Text>
              <Text style={s.stepDesc}>
                ส่ง OTP ไปที่{' '}
                <Text style={{ color: PRIMARY, fontWeight: '600' }}>{email}</Text>
              </Text>

              {/* OTP 6 ช่อง */}
              <View style={s.otpRow}>
                {otp.map((val, i) => (
                  <TextInput
                    key={i}
                    ref={otpRefs[i]}
                    style={[s.otpBox, val ? s.otpBoxFilled : null]}
                    value={val}
                    onChangeText={(t) => handleOtpChange(t, i)}
                    onKeyPress={(e) => handleOtpKeyPress(e, i)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[authStyles.primaryBtn, loading && authStyles.disabledBtn, { marginTop: 24 }]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={authStyles.primaryBtnText}>ยืนยัน OTP →</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.resendRow} onPress={handleResend} disabled={loading}>
                {loading
                  ? <ActivityIndicator size="small" color={PRIMARY} />
                  : <Text style={s.resendText}>
                      ไม่ได้รับรหัส?{' '}
                      <Text style={{ color: PRIMARY, fontWeight: '600' }}>ส่งอีกครั้ง</Text>
                    </Text>}
              </TouchableOpacity>
            </View>
            </ResponsiveContainer>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: STEP 3 — ตั้งรหัสผ่านใหม่
  // ════════════════════════════════════════════════════════════════════════════
  if (step === 3) {
    return (
      <SafeAreaView style={authStyles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={authStyles.scrollContent} keyboardShouldPersistTaps="handled">
            <ResponsiveContainer variant="form" style={{ flexGrow: 1 }}>
            <Header onBack={null} />
            <StepBar step={3} />

            <View style={authStyles.formContainer}>
              <Text style={s.stepTitle}>ตั้งรหัสผ่านใหม่</Text>
              <Text style={s.stepDesc}>รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</Text>

              {/* รหัสผ่านใหม่ */}
              <Text style={authStyles.fieldLabel}>รหัสผ่านใหม่</Text>
              <View style={authStyles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color="#999" style={authStyles.inputIcon} />
                <TextInput
                  style={authStyles.inputField}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  placeholderTextColor="#bbb"
                  value={newPass}
                  onChangeText={setNewPass}
                  secureTextEntry={!showPass}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                  <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#999" />
                </TouchableOpacity>
              </View>

              {/* ยืนยันรหัสผ่าน */}
              <Text style={authStyles.fieldLabel}>ยืนยันรหัสผ่าน</Text>
              <View style={[
                authStyles.inputWrapper,
                confirmPass.length > 0 && newPass !== confirmPass && authStyles.inputError,
              ]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#999" style={authStyles.inputIcon} />
                <TextInput
                  style={authStyles.inputField}
                  placeholder="ยืนยันรหัสผ่านอีกครั้ง"
                  placeholderTextColor="#bbb"
                  value={confirmPass}
                  onChangeText={setConfirmPass}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                  <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color="#999" />
                </TouchableOpacity>
              </View>
              {confirmPass.length > 0 && newPass !== confirmPass && (
                <Text style={authStyles.matchError}>รหัสผ่านไม่ตรงกัน</Text>
              )}
              {confirmPass.length > 0 && newPass === confirmPass && newPass.length >= 6 && (
                <Text style={s.matchOk}>✓ รหัสผ่านตรงกัน</Text>
              )}

              <TouchableOpacity
                style={[authStyles.primaryBtn, loading && authStyles.disabledBtn, { marginTop: 16 }]}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={authStyles.primaryBtnText}>✓ รีเซ็ตรหัสผ่าน</Text>}
              </TouchableOpacity>
            </View>
            </ResponsiveContainer>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER: STEP 4 — สำเร็จ
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={authStyles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView contentContainerStyle={[authStyles.scrollContent, s.centerContent]}>
        <ResponsiveContainer variant="form" style={{ flexGrow: 1 }}>
        <Header onBack={null} />
        <StepBar step={3} />

        <View style={s.successCard}>
          <View style={s.successIconCircle}>
            <Ionicons name="checkmark" size={36} color="#fff" />
          </View>
          <Text style={s.successTitle}>รีเซ็ตสำเร็จ!</Text>
          <Text style={s.successDesc}>
            รหัสผ่านของคุณถูกเปลี่ยนเรียบร้อยแล้ว{'\n'}
            กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่
          </Text>
          <TouchableOpacity
            style={[authStyles.primaryBtn, { marginTop: 24 }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={authStyles.primaryBtnText}>เข้าสู่ระบบ</Text>
          </TouchableOpacity>
        </View>
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  stepItem: {
    alignItems: 'center',
    width: 72,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepNum: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginBottom: 18,
    marginHorizontal: 2,
  },
  iconWrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 13,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  otpBox: {
    width: 44,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    backgroundColor: '#F5F5F5',
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A2E',
  },
  otpBoxFilled: {
    borderColor: PRIMARY,
    backgroundColor: '#EEF0FF',
  },
  resendRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  resendText: {
    fontSize: 13,
    color: '#666',
  },
  matchOk: {
    color: '#34C759',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 4,
  },
  centerContent: {
    flexGrow: 1,
  },
  successCard: {
    marginTop: 8,
    backgroundColor: '#F8F9FF',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8EAFF',
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  successDesc: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
});
