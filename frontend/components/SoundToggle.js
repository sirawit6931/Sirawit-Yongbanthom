// frontend/components/SoundToggle.js
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getIsMuted,
  subscribeMute,
  toggleMute,
  loadMuteState,
} from '../services/ttsService';

// กู้ค่าที่บันทึกไว้จาก AsyncStorage เพียงครั้งเดียวต่อ session ของแอป
let loadRequested = false;

/**
 * ปุ่มเปิด/ปิดเสียง (Mute/Unmute) TTS
 * - 🔊 (volume-high) เมื่อเปิดเสียง
 * - 🔇 (volume-mute) เมื่อปิดเสียง
 * - ค่า persist ผ่าน ttsService → ใช้ร่วมกันทุกหมวดแบบฝึกหัด
 *
 * @param {string} color      สีไอคอน (ให้เข้ากับธีมของแต่ละจอ)
 * @param {string} background สีพื้นหลังปุ่ม
 */
export default function SoundToggle({ color = '#5B4FCF', background = '#EEF0FF', ...touchableProps }) {
  const [muted, setMuted] = useState(getIsMuted);

  useEffect(() => {
    if (!loadRequested) {
      loadRequested = true;
      loadMuteState(); // fire-and-forget — hydrate จาก AsyncStorage ครั้งเดียว
    }
    const unsubscribe = subscribeMute(setMuted);
    return () => { unsubscribe(); };
  }, []);

  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: background }]}
      onPress={toggleMute}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
      accessibilityHint="แตะเพื่อเปิดหรือปิดเสียงอ่านออกเสียง"
      testID="sound-toggle"
      {...touchableProps}
    >
      <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={15} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
