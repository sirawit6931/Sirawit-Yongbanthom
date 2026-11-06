// frontend/services/ttsService.js
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ══════════════════════════════════════════════════════════════════════════════
// Speech Speed Presets (TTS Rate Control)
// ใช้ร่วมกันทุกหมวดแบบฝึกหัด: คำศัพท์ / ประโยค / บทสนทนา
// ══════════════════════════════════════════════════════════════════════════════
export const SPEED_PRESETS = [
  { key: 'slow',   label: 'ช้า',  rateLabel: '0.5x', rate: 0.5 },
  { key: 'normal', label: 'ปกติ', rateLabel: '1.0x', rate: 1.0 },
  { key: 'fast',   label: 'เร็ว', rateLabel: '1.5x', rate: 1.5 },
];

export const DEFAULT_SPEED_KEY = 'normal';

const SPEED_STORAGE_KEY = '@app:tts_speed';
const MUTE_STORAGE_KEY = '@app_sound_muted';

// ── Global speed state (shared across all exercise screens) ──
let currentSpeedKey = DEFAULT_SPEED_KEY;
const listeners = new Set();

function isValidSpeedKey(key) {
  return SPEED_PRESETS.some((p) => p.key === key);
}

/** preset ความเร็วปัจจุบัน เช่น { key: 'normal', label: 'ปกติ', rateLabel: '1.0x', rate: 1.0 } */
export function getSpeedPreset() {
  return SPEED_PRESETS.find((p) => p.key === currentSpeedKey) ?? SPEED_PRESETS[1];
}

/** ค่า rate ปัจจุบันสำหรับส่งเข้า Speech.speak() */
export function getSpeechRate() {
  return getSpeedPreset().rate;
}

/**
 * ผู้ติดตามการเปลี่ยนความเร็ว (ใช้โดย useSpeechRate hook)
 * @returns {() => void} unsubscribe
 */
export function subscribeSpeechRate(listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notifyRateChanged() {
  listeners.forEach((listener) => {
    try { listener(getSpeedPreset()); } catch (err) { console.warn('ttsService listener error:', err); }
  });
}

/**
 * ตั้งค่าความเร็วเสียง + บันทึกลง AsyncStorage เพื่อใช้ต่อในแบบฝึกหัดถัดไป
 * @param {'slow'|'normal'|'fast'} key
 */
export async function setSpeechSpeed(key) {
  if (!isValidSpeedKey(key)) return getSpeedPreset(); // ไม่รู้จัก key → ไม่เปลี่ยน
  if (key !== currentSpeedKey) {
    currentSpeedKey = key;
    notifyRateChanged();
  }
  try {
    await AsyncStorage.setItem(SPEED_STORAGE_KEY, key);
  } catch (err) {
    console.warn('ttsService: บันทึกความเร็วเสียงไม่สำเร็จ', err);
  }
  return getSpeedPreset();
}

/** สลับไปความเร็วถัดไป: ช้า (0.5x) → ปกติ (1.0x) → เร็ว (1.5x) → วนกลับ */
export function cycleSpeechSpeed() {
  const idx = SPEED_PRESETS.findIndex((p) => p.key === currentSpeedKey);
  const next = SPEED_PRESETS[(Math.max(idx, 0) + 1) % SPEED_PRESETS.length];
  setSpeechSpeed(next.key); // persist แบบ fire-and-forget (state เปลี่ยนทันที)
  return next;
}

/** โหลดความเร็วที่บันทึกไว้จาก AsyncStorage (เรียกครั้งเดียวพอ) */
export async function loadSpeechSpeed() {
  try {
    const saved = await AsyncStorage.getItem(SPEED_STORAGE_KEY);
    if (saved && isValidSpeedKey(saved) && saved !== currentSpeedKey) {
      currentSpeedKey = saved;
      notifyRateChanged();
    }
  } catch (err) {
    console.warn('ttsService: โหลดความเร็วเสียงไม่สำเร็จ', err);
  }
  return getSpeedPreset();
}

// ══════════════════════════════════════════════════════════════════════════════
// Global Mute State (shared across all exercise screens)
// ══════════════════════════════════════════════════════════════════════════════
let isMuted = false;
const muteListeners = new Set();

/** muted อยู่หรือไม่ */
export function getIsMuted() {
  return isMuted;
}

/** ผู้ติดตามการเปลี่ยนสถานะ mute (ใช้โดย SoundToggle) */
export function subscribeMute(listener) {
  muteListeners.add(listener);
  return () => { muteListeners.delete(listener); };
}

function notifyMuteChanged() {
  muteListeners.forEach((listener) => {
    try { listener(isMuted); } catch (err) { console.warn('ttsService mute listener error:', err); }
  });
}

/**
 * ตั้งค่า mute + บันทึกลง AsyncStorage
 * @param {boolean} muted
 */
export async function setMuted(muted) {
  const next = !!muted;
  if (next !== isMuted) {
    isMuted = next;
    if (next) Speech.stop(); // ปิดเสียง → หยุดเสียงที่กำลังเล่นอยู่ทันที
    notifyMuteChanged();
  }
  try {
    await AsyncStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
  } catch (err) {
    console.warn('ttsService: บันทึกสถานะปิดเสียงไม่สำเร็จ', err);
  }
  return isMuted;
}

/** สลับ mute ↔ unmute (state เปลี่ยนทันที, persist แบบ fire-and-forget) */
export function toggleMute() {
  const next = !isMuted;
  setMuted(next);
  return next;
}

/** โหลดสถานะ mute ที่บันทึกไว้ (เรียกครั้งเดียวพอ) */
export async function loadMuteState() {
  try {
    const saved = await AsyncStorage.getItem(MUTE_STORAGE_KEY);
    const next = saved === '1';
    if (next !== isMuted) {
      isMuted = next;
      notifyMuteChanged();
    }
  } catch (err) {
    console.warn('ttsService: โหลดสถานะปิดเสียงไม่สำเร็จ', err);
  }
  return isMuted;
}

// ══════════════════════════════════════════════════════════════════════════════
// Hybrid Voice Selection (OS Voice Identifier + Pitch Modulation)
// ชั้นที่ 1: หาเสียงของ OS ที่ตรงเพศ (หญิง/ชาย) จาก name/identifier แล้วส่ง options.voice
// ชั้นที่ 2: ปรับ pitch เสริม → เจอเสียงจริงใช้ pitch ต่างนิดเดียว / ไม่เจอใช้ pitch ดันให้ต่างชัด
// หมายเหตุ: expo-speech ไม่มีข้อมูลเพศของเสียง จึงต้องเดาจากชื่อเสียงของแต่ละ OS (heuristic)
//           และไม่ใช้ 'siri' เพราะกำกวมทั้งสองเพศ + iOS ไม่เปิดให้แอปอื่นใช้เสียง Siri
// ══════════════════════════════════════════════════════════════════════════════
export const VOICE_PROFILES = {
  female: {
    pitchWithVoice: 1.18, // เจอเสียงหญิงจริงของ OS → ปรับเพิ่มเล็กน้อย (โทนหญิงชัดขึ้น)
    pitchFallback:  1.32, // ไม่เจอเสียงหญิง → ดัน pitch ให้แหลม/กระชับขึ้นชัดเจน
    namePattern: /female|samantha|karen|zira|victoria|jenny|aria|michelle|fiona|allison|ava|serena|kate/i,
  },
  male: {
    pitchWithVoice: 0.97, // เจอเสียงชายจริงของ OS → ปรับลงเล็กน้อย (โทนชายชัดขึ้น)
    pitchFallback:  0.82, // ไม่เจอเสียงชาย → ดัน pitch ให้ทุ้มลงชัดเจน
    namePattern: /male|daniel|alex|david|george|fred|thomas|guy|ryan|aaron|oliver|mark/i,
  },
};

// ── Cache รายการเสียงของเครื่อง (โหลดครั้งเดียวตอน import โมดูล) ──
let voicesCache = null; // Array<Voice> | null (null = ยังโหลดไม่เสร็จ)
let voicesPromise = null;

/**
 * โหลดรายการเสียงของ OS แบบ Asynchronous (idempotent — เรียกกี่ครั้งก็โหลดครั้งเดียว)
 * ถ้าโหลดไม่สำเร็จ จะเก็บเป็น [] แล้ว speakEnglish จะถอยไปใช้ pitch fallback แทน
 * @returns {Promise<Array>} รายการเสียงของเครื่อง (ว่างถ้าโหลดไม่ได้)
 */
export function initVoices() {
  if (!voicesPromise) {
    voicesPromise = Promise.resolve()
      .then(() => (typeof Speech.getAvailableVoicesAsync === 'function'
        ? Speech.getAvailableVoicesAsync()
        : []))
      .then((list) => {
        voicesCache = Array.isArray(list) ? list : [];
        return voicesCache;
      })
      .catch((err) => {
        console.warn('ttsService: โหลดรายการเสียงของเครื่องไม่สำเร็จ', err);
        voicesCache = [];
        return voicesCache;
      });
  }
  return voicesPromise;
}

// เริ่มโหลดตั้งแต่ตอน import โมดูล → ผู้ใช้กดปุ่มครั้งแรกมักมี cache พร้อมแล้ว
initVoices();

/** รายการเสียงของเครื่องที่ cache ไว้ (null = ยังโหลดไม่เสร็จ) */
export function getCachedVoices() {
  return voicesCache;
}

/**
 * หาเสียงของ OS ที่ตรงเพศที่ต้องการ (เฉพาะภาษาอังกฤษ เพื่อไม่ให้ได้เสียงภาษาอื่นมาอ่าน)
 * ให้ความสำคัญ en-US ก่อน แล้วค่อยภาษาอื่นที่เป็น en*
 * @param {'female'|'male'} gender
 * @returns {{identifier: string, language: string, name?: string}|null} null = ไม่พบ → ใช้ pitch fallback
 */
export function findVoiceForGender(gender) {
  const profile = VOICE_PROFILES[gender];
  if (!profile || !Array.isArray(voicesCache)) return null;

  const pool = voicesCache.filter((v) => {
    const lang = String(v?.language || '');
    if (!lang.toLowerCase().startsWith('en')) return false;
    return profile.namePattern.test(`${v?.name || ''} ${v?.identifier || ''}`);
  });

  return pool.find((v) => /^en-us/i.test(String(v.language))) || pool[0] || null;
}

/**
 * คืนค่า pitch สำหรับเพศเสียง
 * @param {'female'|'male'} [voice]
 * @param {boolean} [hasVoiceId] true เมื่อเจอเสียงของ OS ที่ตรงเพศแล้ว (ปรับ pitch แค่เล็กน้อย)
 * @returns {number} ภายในช่วง 0.5–2.0 (ไม่ระบุ/ค่าไม่รู้จัก → 1.0 = โทนปกติของเครื่อง)
 */
export function getPitchForVoice(voice, hasVoiceId = false) {
  const profile = VOICE_PROFILES[voice];
  if (!profile) return 1.0;
  const pitch = hasVoiceId ? profile.pitchWithVoice : profile.pitchFallback;
  return Math.min(2.0, Math.max(0.5, pitch));
}

/**
 * พูดคำ/ประโยคภาษาอังกฤษด้วยความเร็วที่ผู้ใช้เลือกไว้ + เสียงตามเพศ (หญิง/ชาย) แบบ Hybrid
 * 1) ถ้าเจอเสียงของ OS ที่ตรงเพศ → ส่ง options.voice (identifier) + ปรับ pitch เล็กน้อย
 * 2) ถ้าไม่เจอ → ไม่ส่ง voice แล้วดัน pitch ให้ต่างชัดเจนแทน
 * เมื่อปิดเสียง (muted) จะ return ทันทีโดยไม่พูดอะไรเลย
 * @param {string} text
 * @param {'female'|'male'} [voice] - เพศเสียงจากแบบฝึกหัด (ไม่ระบุ → โทนปกติ 1.0 ไม่กระทบหน้าอื่น)
 */
export function speakEnglish(text, voice) {
  if (isMuted || !text) return;
  Speech.stop();
  const matched = findVoiceForGender(voice);
  const options = {
    language: matched?.language || 'en-US',
    rate: getSpeechRate(),
    pitch: getPitchForVoice(voice, !!matched),
  };
  if (matched) options.voice = matched.identifier; // ใส่เฉพาะเมื่อเจอเสียงจริง (ไม่กระทบเคสเดิม)
  Speech.speak(text, options);
}

/**
 * หยุดเสียงที่กำลังเล่นอยู่
 */
export function stopSpeaking() {
  Speech.stop();
}
