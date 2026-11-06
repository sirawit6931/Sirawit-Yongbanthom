// frontend/components/SpeechSpeedToggle.js
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useSpeechRate from '../hooks/useSpeechRate';

/**
 * ปุ่มเลือกความเร็วเสียง TTS (ช้า / ปกติ / เร็ว)
 * - แสดงความเร็วปัจจุบัน เช่น '1.0x'
 * - แตะเพื่อสลับ: 0.5x → 1.0x → 1.5x → 0.5x
 * - ค่าที่เลือก persist ผ่าน ttsService → ใช้ร่วมกันทุกหมวดแบบฝึกหัด
 *
 * @param {string} color      สีไอคอน/ข้อความ (ให้เข้ากับธีมของแต่ละจอ)
 * @param {string} background สีพื้นหลังปุ่ม
 */
export default function SpeechSpeedToggle({ color = '#5B4FCF', background = '#EEF0FF', ...touchableProps }) {
  const { rateLabel, cycleSpeed, preset } = useSpeechRate();

  return (
    <TouchableOpacity
      style={[styles.pill, { backgroundColor: background }]}
      onPress={cycleSpeed}
      activeOpacity={0.7}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={`ความเร็วเสียง ${preset.label} ${rateLabel}`}
      accessibilityHint="แตะเพื่อสลับความเร็วเสียง ช้า ปกติ เร็ว"
      testID="speech-speed-toggle"
      {...touchableProps}
    >
      <Ionicons name="speedometer-outline" size={13} color={color} />
      <Text style={[styles.text, { color }]}>{rateLabel}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
  },
});