// frontend/services/apiConfig.js
// Central API base URL resolver — ห้าม hardcode localhost ในไฟล์เรียก API
// (Android emulator มอง localhost เป็นตัวมันเอง ต้องใช้ 10.0.2.2 แทน)
import { Platform } from 'react-native';

const DEV_ANDROID_EMULATOR_HOST = 'http://10.0.2.2:5000';
const DEV_DEFAULT_HOST = 'http://localhost:5000';

/**
 * คืนค่า base URL ของ Backend:
 * 1. process.env.EXPO_PUBLIC_API_URL (ค่าจริงจาก env / LAN IP) — สำคัญสุด
 * 2. Android emulator fallback → 10.0.2.2 (loopback ของ host)
 * 3. อื่นๆ (iOS simulator / web dev) → localhost
 */
export function getApiBase() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (Platform.OS === 'android') return DEV_ANDROID_EMULATOR_HOST;
  return DEV_DEFAULT_HOST;
}
