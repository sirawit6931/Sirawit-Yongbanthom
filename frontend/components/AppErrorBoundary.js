// frontend/components/AppErrorBoundary.js
// Error Boundary ระดับ App — ดัก error ที่หลุดมาจนถึง render (เช่น ตอนโควต้า Firebase เต็ม
// แล้วค่าที่ได้เป็น undefined) ไม่ให้แอปขึ้นหน้าจอขาว / crash ทั้งตัว
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

const PRIMARY = '#5B4FCF';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error, info) {
    console.error('[AppErrorBoundary] caught error:', error, info?.componentStack);
  }

  handleRetry = () => {
    // ล้าง state แล้ว render ใหม่ — ถ้ายังพังอีกจะกลับเข้า fallback ใหม่เอง
    this.setState({ hasError: false, message: '' });
  };

  handleReload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    } else {
      this.handleRetry();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.wrap}>
          <Text style={s.title}>เกิดข้อผิดพลาดชั่วคราว</Text>
          <Text style={s.desc}>
            ระบบข้อมูลอาจกำลังหน่วง (เช่น โควต้า Firebase เต็ม) ข้อมูลบางส่วนอาจยังไม่โหลด
          </Text>
          <Text style={s.detail} numberOfLines={3}>{this.state.message}</Text>
          <TouchableOpacity style={s.btn} onPress={this.handleRetry} activeOpacity={0.8}>
            <Text style={s.btnText}>ลองใหม่</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnOutline} onPress={this.handleReload} activeOpacity={0.8}>
            <Text style={s.btnOutlineText}>รีโหลดแอป</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F6FF',
    paddingHorizontal: 32,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#1A1A2E', marginBottom: 12 },
  desc: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 8 },
  detail: { fontSize: 12, color: '#999', textAlign: 'center', marginBottom: 24 },
  btn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 40,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnOutline: {
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 40,
    minWidth: 200,
    alignItems: 'center',
  },
  btnOutlineText: { color: PRIMARY, fontSize: 16, fontWeight: '600' },
});
