// frontend/hooks/useSpeechRate.js
import { useEffect, useState } from 'react';
import {
  SPEED_PRESETS,
  getSpeedPreset,
  subscribeSpeechRate,
  loadSpeechSpeed,
  setSpeechSpeed,
  cycleSpeechSpeed,
} from '../services/ttsService';

// กู้ค่าที่บันทึกไว้จาก AsyncStorage เพียงครั้งเดียวต่อ session ของแอป
let loadRequested = false;

/**
 * Hook อ่าน/เปลี่ยนความเร็วเสียง TTS (ใช้ร่วมกันทุกหมวดแบบฝึกหัด)
 * - preset     : preset ปัจจุบัน { key, label, rateLabel, rate }
 * - rate       : ค่า rate ปัจจุบัน (0.5 | 1.0 | 1.5)
 * - rateLabel  : ข้อความแสดงผล เช่น '1.0x'
 * - cycleSpeed : สลับไปความเร็วถัดไป (ช้า → ปกติ → เร็ว → วนกลับ)
 * - setSpeed   : ตั้งค่าตาม key ('slow' | 'normal' | 'fast')
 */
export default function useSpeechRate() {
  const [preset, setPreset] = useState(getSpeedPreset);

  useEffect(() => {
    if (!loadRequested) {
      loadRequested = true;
      loadSpeechSpeed(); // fire-and-forget — hook จะได้ preset ล่าสุดผ่าน subscription
    }
    const unsubscribe = subscribeSpeechRate(setPreset);
    return () => { unsubscribe(); };
  }, []);

  return {
    preset,
    rate: preset.rate,
    rateLabel: preset.rateLabel,
    presets: SPEED_PRESETS,
    cycleSpeed: cycleSpeechSpeed,
    setSpeed: setSpeechSpeed,
  };
}