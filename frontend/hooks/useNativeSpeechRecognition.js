// frontend/hooks/useNativeSpeechRecognition.js
import { Platform, Linking, Alert } from 'react-native';
import { logSpeech, SpeechLogType } from '../services/speechLog';

/**
 * Strategy Pattern Adapter for Native Speech Recognition (iOS & Android).
 *
 * Implements safe probing, graceful fallback, and unified controls using
 * `expo-speech-recognition` when available, without breaking Web, Expo Go,
 * or bare environments missing the native package.
 */

// ── In-memory probe cache (evaluated once per session) ──
let _nativeEngineCache = undefined;

/**
 * Dynamic module loader with try/catch to protect against:
 * 1. Build-time Metro static resolution failures when the package is absent
 * 2. Runtime import errors on platforms lacking the native module (Web, Expo Go)
 */
function getExpoSpeechRecognitionModule() {
  try {
    const moduleName = 'expo-speech-recognition';
    const pkg = require(moduleName);
    return pkg?.ExpoSpeechRecognitionModule ?? pkg?.default?.ExpoSpeechRecognitionModule ?? pkg;
  } catch (err) {
    return null;
  }
}

/**
 * Safe check whether running inside Expo Go client.
 * Uses Constants.expoGoConfig (only present in Expo Go) rather than StoreClient
 * to avoid falsely flagging custom dev builds as Expo Go.
 */
function isRunningInExpoGo() {
  try {
    const Constants = require('expo-constants')?.default ?? require('expo-constants');
    return Boolean(Constants?.expoGoConfig || Constants?.expoRuntimeVersion);
  } catch (_) {
    return false;
  }
}

/**
 * Probe native speech recognition capability on the current device.
 */
export function probeNativeEngine() {
  if (Platform.OS === 'web') {
    return { kind: 'native', available: false, reason: 'unsupported-platform' };
  }

  if (_nativeEngineCache !== undefined) {
    return _nativeEngineCache;
  }

  if (isRunningInExpoGo()) {
    logSpeech(SpeechLogType.INFO, 'probe:expo-go-detected');
    _nativeEngineCache = {
      kind: 'native',
      available: false,
      reason: 'expo-go-no-native-module',
    };
    return _nativeEngineCache;
  }

  const mod = getExpoSpeechRecognitionModule();
  if (!mod || typeof mod.isRecognitionAvailable !== 'function') {
    logSpeech(SpeechLogType.WARN, 'probe:module-not-linked');
    _nativeEngineCache = {
      kind: 'native',
      available: false,
      reason: 'module-not-linked',
    };
    return _nativeEngineCache;
  }

  try {
    const available = Boolean(mod.isRecognitionAvailable());
    logSpeech(SpeechLogType.INFO, 'probe:success', { available });
    _nativeEngineCache = {
      kind: 'native',
      available,
      reason: available ? undefined : 'service-unavailable',
      module: mod,
    };
  } catch (err) {
    logSpeech(SpeechLogType.ERROR, 'probe:error', { error: String(err) });
    _nativeEngineCache = {
      kind: 'native',
      available: false,
      reason: 'service-unavailable',
      error: String(err),
      module: mod,
    };
  }

  return _nativeEngineCache;
}

/**
 * Reset probe cache (for testing or permission state change)
 */
export function resetNativeEngineCache() {
  _nativeEngineCache = undefined;
}

/**
 * Map error codes from ExpoSpeechRecognition to user-friendly Thai messages.
 */
export function mapNativeSpeechErrorToThai(errorCode, rawMessage = '') {
  switch (errorCode) {
    case 'not-allowed':
      return 'ไม่อนุญาตให้ใช้ไมโครโฟน — กรุณาเปิดสิทธิ์ในการตั้งค่า';
    case 'service-not-allowed':
      return 'ระบบรู้จำเสียงพูดไม่พร้อมใช้งานบนอุปกรณ์นี้';
    case 'language-not-supported':
      return 'อุปกรณ์ไม่รองรับการรู้จำภาษาอังกฤษ (en-US)';
    case 'network':
      return 'การเชื่อมต่อเครือข่ายขัดข้อง ไม่สามารถประมวลผลเสียงได้';
    case 'no-speech':
    case 'speech-timeout':
      return 'ไม่ได้ยินเสียงพูด กรุณาลองใหม่อีกครั้ง';
    case 'audio-capture':
      return 'เกิดข้อผิดพลาดในการบันทึกเสียงไมโครโฟน';
    case 'busy':
      return 'ระบบกำลังประมวลผลคำสั่งเสียงอื่นอยู่ กรุณารอสักครู่';
    case 'interrupted':
      return 'การบันทึกเสียงถูกขัดจังหวะ';
    default:
      return rawMessage || 'เกิดข้อผิดพลาดในการรู้จำเสียงพูด';
  }
}

/**
 * Open device system settings for this app.
 */
export function openAppSettings() {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Linking.openSettings().catch(() => {
      Alert.alert('การตั้งค่า', 'ไม่สามารถเปิดหน้าการตั้งค่าได้โดยอัตโนมัติ กรุณาเปิดการตั้งค่าของเครื่องด้วยตนเอง');
    });
  }
}

/**
 * Request speech and microphone permissions.
 */
export async function requestNativePermissions(module) {
  if (!module) return { granted: false, canAskAgain: false };
  try {
    if (typeof module.requestPermissionsAsync === 'function') {
      const res = await module.requestPermissionsAsync();
      logSpeech(SpeechLogType.INFO, 'permission:request', res);
      return {
        granted: Boolean(res?.granted),
        canAskAgain: res?.canAskAgain ?? true,
      };
    }
    return { granted: true, canAskAgain: true };
  } catch (err) {
    logSpeech(SpeechLogType.ERROR, 'permission:error', { error: String(err) });
    return { granted: false, canAskAgain: false };
  }
}

/**
 * Stop or abort any active native speech recognition session.
 */
export function stopNativeRecognition(module) {
  const mod = module || getExpoSpeechRecognitionModule();
  if (!mod) return;
  try {
    if (typeof mod.abort === 'function') {
      mod.abort();
    } else if (typeof mod.stop === 'function') {
      mod.stop();
    }
  } catch (err) {
    logSpeech(SpeechLogType.WARN, 'abort:error', { error: String(err) });
  }
}

/**
 * Start listening via expo-speech-recognition with standard options:
 * - Language fixed to 'en-US' (app vocabulary target)
 * - Safe iOS category set to 'playAndRecord' to prevent muting expo-speech TTS
 * - Single-phrase continuous=false & interimResults=false
 */
export async function startNativeRecognition({
  module,
  onStart,
  onEnd,
  onResult,
  onError,
}) {
  const mod = module || getExpoSpeechRecognitionModule();
  if (!mod || typeof mod.start !== 'function') {
    throw new Error('Native speech recognition module is unavailable');
  }

  const perm = await requestNativePermissions(mod);
  if (!perm.granted) {
    const errorMsg = 'ไม่อนุญาตให้ใช้ไมโครโฟน — กรุณาเปิดสิทธิ์ในการตั้งค่า';
    onError?.({ error: 'not-allowed', message: errorMsg, isPermissionError: true });
    return;
  }

  let subStart = null;
  let subEnd = null;
  let subResult = null;
  let subError = null;

  const cleanupListeners = () => {
    try { subStart?.remove?.(); } catch (_) {}
    try { subEnd?.remove?.(); } catch (_) {}
    try { subResult?.remove?.(); } catch (_) {}
    try { subError?.remove?.(); } catch (_) {}
  };

  try {
    if (typeof mod.addListener === 'function') {
      subStart = mod.addListener('start', () => onStart?.());
      subEnd = mod.addListener('end', () => {
        cleanupListeners();
        onEnd?.();
      });
      subResult = mod.addListener('result', (ev) => {
        const transcript = ev?.results?.[0]?.transcript ?? '';
        cleanupListeners();
        onResult?.(transcript, ev);
      });
      subError = mod.addListener('error', (ev) => {
        cleanupListeners();
        const msg = mapNativeSpeechErrorToThai(ev?.error, ev?.message);
        onError?.({
          error: ev?.error || 'unknown',
          message: msg,
          isPermissionError: ev?.error === 'not-allowed',
        });
      });
    }

    logSpeech(SpeechLogType.INFO, 'start:initiating');
    mod.start({
      lang: 'en-US',
      interimResults: false,
      continuous: false,
      maxAlternatives: 3,
      iosCategory: 'playAndRecord',
    });
  } catch (err) {
    cleanupListeners();
    logSpeech(SpeechLogType.ERROR, 'start:failed', { error: String(err) });
    onError?.({
      error: 'unknown',
      message: String(err?.message || err),
      isPermissionError: false,
    });
  }

  return cleanupListeners;
}
