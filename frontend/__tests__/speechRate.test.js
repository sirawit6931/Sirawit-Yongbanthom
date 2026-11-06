// frontend/__tests__/speechRate.test.js
//
// Tests for the TTS Speech Speed Selection feature (ttsService.js):
// - Speed presets (slow/normal/fast) + default = normal @ 1.0
// - speakEnglish() passes the selected rate into Speech.speak()
// - Persistence via AsyncStorage (load/save) and cycleSpeechSpeed() ordering
//
// expo-speech / AsyncStorage are mocked because Jest runs in jsdom
// (cannot load real React Native modules — same reason shuffleStages.test.js copies logic).

const fc = require('fast-check');

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(),
  isSpeakingAsync: jest.fn().mockResolvedValue(false),
  // Hybrid voice selection: รายการเสียงของเครื่อง (default = ไม่มีเสียงให้เลือก → ใช้ pitch fallback)
  getAvailableVoicesAsync: jest.fn().mockResolvedValue([]),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

let tts;
let Speech;
let AsyncStorage;

beforeEach(() => {
  // Reset module-level speed state between tests (service keeps currentSpeedKey in module scope)
  jest.resetModules();
  tts = require('../services/ttsService');
  Speech = require('expo-speech');
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
  AsyncStorage.getItem.mockResolvedValue(null);
  AsyncStorage.setItem.mockResolvedValue(null);
});

/**
 * Validates: Feature Requirement 1 — speed presets definition
 */
describe('Speech speed presets', () => {
  test('defines exactly slow / normal / fast in ascending rate order', () => {
    expect(tts.SPEED_PRESETS.map((p) => p.key)).toEqual(['slow', 'normal', 'fast']);
    const rates = tts.SPEED_PRESETS.map((p) => p.rate);
    expect(rates[0]).toBeLessThan(rates[1]);
    expect(rates[1]).toBeLessThan(rates[2]);
  });

  test('normal (1.0) is the default speed', () => {
    expect(tts.getSpeedPreset().key).toBe('normal');
    expect(tts.getSpeechRate()).toBe(1.0);
  });

  test('property: every preset rate is valid for expo-speech and matches its label', () => {
    fc.assert(
      fc.property(fc.constantFrom(...tts.SPEED_PRESETS), (preset) => {
        expect(preset.rate).toBeGreaterThan(0);
        expect(preset.rate).toBeLessThanOrEqual(2);
        expect(parseFloat(preset.rateLabel)).toBe(preset.rate);
        expect(preset.rateLabel.endsWith('x')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * Validates: Feature Requirement 3 — expo-speech integration (rate parameter)
 */
describe('speakEnglish rate integration', () => {
  test('passes current speed rate + en-US language into Speech.speak', async () => {
    await tts.setSpeechSpeed('slow');
    tts.speakEnglish('hello world');
    expect(Speech.speak).toHaveBeenCalledWith('hello world', {
      language: 'en-US',
      rate: 0.5,
      pitch: 1.0,
    });
  });

  test('rate follows the selected speed at call time (not a hardcoded value)', async () => {
    const expected = new Map([
      ['slow', 0.5],
      ['normal', 1.0],
      ['fast', 1.5],
    ]);
    await tts.setSpeechSpeed('fast');
    tts.speakEnglish('a');
    expect(Speech.speak.mock.calls[0][1].rate).toBe(expected.get('fast'));

    await tts.setSpeechSpeed('normal');
    tts.speakEnglish('b');
    expect(Speech.speak.mock.calls[1][1].rate).toBe(expected.get('normal'));
  });

  test('stops ongoing speech before speaking', () => {
    tts.speakEnglish('hi');
    expect(Speech.stop).toHaveBeenCalled();
    expect(Speech.speak.mock.invocationCallOrder[0])
      .toBeGreaterThan(Speech.stop.mock.invocationCallOrder[0]);
  });

  test('ignores empty text', () => {
    tts.speakEnglish('');
    tts.speakEnglish(null);
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  test('stopSpeaking delegates to Speech.stop', () => {
    tts.stopSpeaking();
    expect(Speech.stop).toHaveBeenCalled();
  });
});

/**
 * Validates: Feature Requirement 1 — persistence in AsyncStorage
 */
describe('speed persistence', () => {
  test('setSpeechSpeed stores the key in AsyncStorage', async () => {
    await tts.setSpeechSpeed('fast');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@app:tts_speed', 'fast');
    expect(tts.getSpeechRate()).toBe(1.5);
  });

  test('unknown speed keys are ignored (no state change, no persist)', async () => {
    await tts.setSpeechSpeed('turbo');
    expect(tts.getSpeechRate()).toBe(1.0);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  test('loadSpeechSpeed restores a persisted speed', async () => {
    AsyncStorage.getItem.mockResolvedValue('slow');
    await tts.loadSpeechSpeed();
    expect(tts.getSpeechRate()).toBe(0.5);
  });

  test('loadSpeechSpeed falls back to normal for invalid stored values', async () => {
    AsyncStorage.getItem.mockResolvedValue('bogus');
    await tts.loadSpeechSpeed();
    expect(tts.getSpeechRate()).toBe(1.0);
  });

  test('loadSpeechSpeed survives storage errors', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('storage unavailable'));
    await expect(tts.loadSpeechSpeed()).resolves.toMatchObject({ key: 'normal' });
  });
});

/**
 * Validates: Feature Requirement 2 — cycle button behavior (Slow → Normal → Fast → Slow)
 */
describe('cycleSpeechSpeed', () => {
  test('cycles in preset order and wraps around', () => {
    expect(tts.getSpeedPreset().key).toBe('normal'); // start: normal
    expect(tts.cycleSpeechSpeed().key).toBe('fast');
    expect(tts.cycleSpeechSpeed().key).toBe('slow');
    expect(tts.cycleSpeechSpeed().key).toBe('normal'); // wrapped
  });

  test('property: cycling n times from any preset lands on (startIdx + n) % 3', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...tts.SPEED_PRESETS.map((p) => p.key)),
        fc.nat(50),
        (startKey, n) => {
          jest.resetModules();
          const fresh = require('../services/ttsService');
          fresh.setSpeechSpeed(startKey);
          const startIdx = tts.SPEED_PRESETS.findIndex((p) => p.key === startKey);
          let last = fresh.getSpeedPreset();
          for (let i = 0; i < n; i++) last = fresh.cycleSpeechSpeed();
          const expectedKey = tts.SPEED_PRESETS[(startIdx + n) % tts.SPEED_PRESETS.length].key;
          expect(last.key).toBe(expectedKey);
          expect(fresh.getSpeedPreset().key).toBe(expectedKey);
        }
      ),
      { numRuns: 30 }
    );
  });

  test('cycling persists each step', () => {
    tts.cycleSpeechSpeed();
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('@app:tts_speed', 'fast');
  });
});

/**
 * Validates: Feature Requirement 1 — shared state across screens (pub/sub)
 */
describe('subscribeSpeechRate', () => {
  test('notifies listeners when speed changes', async () => {
    const listener = jest.fn();
    tts.subscribeSpeechRate(listener);
    await tts.setSpeechSpeed('slow');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ key: 'slow', rate: 0.5 }));
  });

  test('unsubscribe stops notifications', async () => {
    const listener = jest.fn();
    const unsubscribe = tts.subscribeSpeechRate(listener);
    unsubscribe();
    await tts.setSpeechSpeed('slow');
    expect(listener).not.toHaveBeenCalled();
  });

  test('setting the same key does not re-notify', async () => {
    const listener = jest.fn();
    tts.subscribeSpeechRate(listener);
    await tts.setSpeechSpeed('normal'); // already normal
    expect(listener).not.toHaveBeenCalled();
  });
});

/**
 * Validates: Global Mute/Unmute Toggle — speakEnglish is suppressed when muted
 */
describe('mute state', () => {
  test('defaults to unmuted', () => {
    expect(tts.getIsMuted()).toBe(false);
  });

  test('speakEnglish is suppressed while muted (returns without stop/speak)', async () => {
    await tts.setMuted(true);
    Speech.speak.mockClear();
    Speech.stop.mockClear();
    tts.speakEnglish('hello world');
    expect(Speech.speak).not.toHaveBeenCalled();
    expect(Speech.stop).not.toHaveBeenCalled();
  });

  test('speakEnglish resumes after unmuting', async () => {
    await tts.setMuted(true);
    await tts.setMuted(false);
    tts.speakEnglish('hello');
    expect(Speech.speak).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ language: 'en-US' })
    );
  });

  test('muting stops any currently playing speech', async () => {
    await tts.setMuted(true);
    expect(Speech.stop).toHaveBeenCalled();
  });

  test('setMuted persists the flag to AsyncStorage', async () => {
    await tts.setMuted(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@app_sound_muted', '1');
    await tts.setMuted(false);
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith('@app_sound_muted', '0');
  });

  test('toggleMute flips state and returns the new value', () => {
    expect(tts.toggleMute()).toBe(true);
    expect(tts.getIsMuted()).toBe(true);
    expect(tts.toggleMute()).toBe(false);
    expect(tts.getIsMuted()).toBe(false);
  });

  test('loadMuteState restores a persisted muted flag', async () => {
    AsyncStorage.getItem.mockResolvedValue('1');
    await tts.loadMuteState();
    expect(tts.getIsMuted()).toBe(true);
  });

  test('loadMuteState treats non-"1" values as unmuted', async () => {
    AsyncStorage.getItem.mockResolvedValue('0');
    await tts.loadMuteState();
    expect(tts.getIsMuted()).toBe(false);
  });

  test('loadMuteState survives storage errors', async () => {
    AsyncStorage.getItem.mockRejectedValue(new Error('storage unavailable'));
    await expect(tts.loadMuteState()).resolves.toBe(false);
  });

  test('subscribeMute notifies listeners and unsubscribe stops them', async () => {
    const listener = jest.fn();
    const unsubscribe = tts.subscribeMute(listener);
    await tts.setMuted(true);
    expect(listener).toHaveBeenCalledWith(true);
    unsubscribe();
    await tts.setMuted(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
/**
 * Validates: Hybrid Voice Selection (OS Voice Identifier + Pitch Modulation)
 * - ชั้นที่ 1: เจอเสียงของ OS ที่ตรงเพศ (เดาจาก name/identifier เพราะ expo-speech ไม่มี field เพศ)
 *            → ส่ง options.voice + ปรับ pitch เล็กน้อย (pitchWithVoice)
 * - ชั้นที่ 2: ไม่เจอเสียงที่ตรงเพศ/ไม่มีเสียงอังกฤษ → ไม่ส่ง voice + ดัน pitch (pitchFallback)
 * - ไม่ระบุเพศ/ค่าไม่รู้จัก → pitch 1.0 โทนปกติ (ไม่กระทบหน้าอื่น)
 * - rate ยังคงตามความเร็วที่เลือก ไม่ถูก voice/pitch รบกวน
 */
describe('hybrid voice selection (female/male)', () => {
  const FEMALE_US = { identifier: 'com.apple.voice.compact.en-US.Samantha', language: 'en-US', name: 'Samantha', quality: 'Default' };
  const MALE_GB = { identifier: 'com.apple.voice.compact.en-GB.Daniel', language: 'en-GB', name: 'Daniel', quality: 'Default' };

  /**
   * โหลด ttsService ใหม่พร้อมจำลองรายการเสียงของเครื่อง
   * (โมดูลเรียก getAvailableVoicesAsync ตอน import จึงต้องตั้ง mock ก่อน require)
   */
  async function loadTtsWithVoices(voices) {
    jest.resetModules();
    Speech = require('expo-speech');
    Speech.getAvailableVoicesAsync.mockResolvedValue(voices);
    tts = require('../services/ttsService');
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.getItem.mockResolvedValue(null);
    AsyncStorage.setItem.mockResolvedValue(null);
    await tts.initVoices(); // ให้ cache รายการเสียงพร้อมก่อนทดสอบ
    return tts;
  }

  test('exports VOICE_PROFILES with both pitch levels per gender (female higher than male)', () => {
    const { female, male } = tts.VOICE_PROFILES;
    expect(female.pitchWithVoice).toBeGreaterThan(male.pitchWithVoice);
    expect(female.pitchFallback).toBeGreaterThan(male.pitchFallback);
    // เจอเสียงจริง → ปรับ pitch แค่เล็กน้อย / ไม่เจอ → ปรับแรงกว่า (ห่างจาก 1.0 มากกว่า)
    [female, male].forEach((p) => {
      expect(p.pitchWithVoice).toBeGreaterThan(0.5);
      expect(p.pitchFallback).toBeGreaterThan(0.5);
      expect(p.pitchFallback).toBeLessThanOrEqual(2.0);
      expect(Math.abs(p.pitchWithVoice - 1)).toBeLessThan(Math.abs(p.pitchFallback - 1));
    });
  });

  test('getPitchForVoice returns fallback pitch per gender when no OS voice matched', () => {
    expect(tts.getPitchForVoice('female')).toBe(1.32);
    expect(tts.getPitchForVoice('male')).toBe(0.82);
  });

  test('getPitchForVoice returns the gentler pitch when an OS voice matched', () => {
    expect(tts.getPitchForVoice('female', true)).toBe(1.18);
    expect(tts.getPitchForVoice('male', true)).toBe(0.97);
  });

  test('getPitchForVoice returns neutral 1.0 for undefined/null/unknown genders', () => {
    expect(tts.getPitchForVoice(undefined)).toBe(1.0);
    expect(tts.getPitchForVoice(null)).toBe(1.0);
    expect(tts.getPitchForVoice('unknown')).toBe(1.0);
    expect(tts.getPitchForVoice('unknown', true)).toBe(1.0);
  });

  test('speakEnglish uses the OS female voice + its language + gentler pitch', async () => {
    await loadTtsWithVoices([MALE_GB, FEMALE_US]);
    tts.speakEnglish('I go to school', 'female');
    expect(Speech.speak).toHaveBeenCalledWith('I go to school', {
      language: 'en-US',
      rate: 1.0,
      pitch: 1.18,
      voice: FEMALE_US.identifier,
    });
  });

  test('speakEnglish uses the OS male voice + its language (en-GB) for male items', async () => {
    await loadTtsWithVoices([FEMALE_US, MALE_GB]);
    tts.speakEnglish('I went to school', 'male');
    expect(Speech.speak).toHaveBeenCalledWith('I went to school', {
      language: 'en-GB',
      rate: 1.0,
      pitch: 0.97,
      voice: MALE_GB.identifier,
    });
  });

  test('ignores a matching voice name in a non-English language and falls back to pitch', async () => {
    const thaiSamantha = { identifier: 'th-TH-Samantha', language: 'th-TH', name: 'Samantha' };
    await loadTtsWithVoices([thaiSamantha]);
    tts.speakEnglish('Fallback female', 'female');
    const options = Speech.speak.mock.calls[0][1];
    expect(options.pitch).toBe(1.32);
    expect(options.language).toBe('en-US');
    expect(options).not.toHaveProperty('voice');
  });

  test('prefers en-US over other English locales when both match the gender', async () => {
    const femaleGb = { identifier: 'en-GB-Kate', language: 'en-GB', name: 'Kate' };
    const femaleUs = { identifier: 'en-US-Samantha', language: 'en-US', name: 'Samantha' };
    await loadTtsWithVoices([femaleGb, femaleUs]);
    tts.speakEnglish('Priority check', 'female');
    expect(Speech.speak.mock.calls[0][1].voice).toBe(femaleUs.identifier);
  });

  test('without the voice parameter keeps the exact neutral options (backward compatible)', async () => {
    await loadTtsWithVoices([FEMALE_US, MALE_GB]);
    tts.speakEnglish('Neutral sentence');
    expect(Speech.speak).toHaveBeenCalledWith('Neutral sentence', {
      language: 'en-US',
      rate: 1.0,
      pitch: 1.0,
    });
  });

  test('keeps the selected speed rate while applying the hybrid voice', async () => {
    await loadTtsWithVoices([FEMALE_US, MALE_GB]);
    await tts.setSpeechSpeed('slow');
    tts.speakEnglish('Slow male voice', 'male');
    expect(Speech.speak).toHaveBeenCalledWith(
      'Slow male voice',
      expect.objectContaining({ rate: 0.5, pitch: 0.97, voice: MALE_GB.identifier })
    );

    await tts.setSpeechSpeed('fast');
    tts.speakEnglish('Fast female voice', 'female');
    expect(Speech.speak).toHaveBeenCalledWith(
      'Fast female voice',
      expect.objectContaining({ rate: 1.5, pitch: 1.18, voice: FEMALE_US.identifier })
    );
  });

  test('initVoices caches the device voice list and calls the native API only once', async () => {
    await loadTtsWithVoices([FEMALE_US]);
    expect(Speech.getAvailableVoicesAsync).toHaveBeenCalledTimes(1);
    await tts.initVoices();
    expect(Speech.getAvailableVoicesAsync).toHaveBeenCalledTimes(1);
    expect(tts.getCachedVoices()).toEqual([FEMALE_US]);
  });

  test('initVoices survives a rejected voice list and falls back to pitch', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.resetModules();
    Speech = require('expo-speech');
    Speech.getAvailableVoicesAsync.mockRejectedValue(new Error('voices unavailable'));
    tts = require('../services/ttsService');
    await expect(tts.initVoices()).resolves.toEqual([]);
    tts.speakEnglish('Still speaks', 'female');
    expect(Speech.speak).toHaveBeenCalledWith(
      'Still speaks',
      expect.objectContaining({ language: 'en-US', pitch: 1.32 })
    );
    expect(Speech.speak.mock.calls[0][1]).not.toHaveProperty('voice');
    warn.mockRestore();
  });

  test('matches realistic iOS/Windows voice lists without cross-gender leakage', async () => {
    const deviceVoices = [
      { identifier: 'com.apple.ttsbundle.Samantha-compact', language: 'en-US', name: 'Samantha' },
      { identifier: 'com.apple.ttsbundle.Karen-compact', language: 'en-AU', name: 'Karen' },
      { identifier: 'com.apple.ttsbundle.Daniel-compact', language: 'en-GB', name: 'Daniel' },
      { identifier: 'com.apple.ttsbundle.Alex-compact', language: 'en-US', name: 'Alex' },
      { identifier: 'Microsoft Zira Desktop', language: 'en-US', name: 'Microsoft Zira' },
      { identifier: 'Microsoft David Desktop', language: 'en-US', name: 'Microsoft David' },
      { identifier: 'de-DE-Daniel', language: 'de-DE', name: 'Daniel' }, // ชื่อซ้ำภาษาอื่น → ต้องไม่ถูกเลือก
    ];
    await loadTtsWithVoices(deviceVoices);

    const female = tts.findVoiceForGender('female');
    expect(female.language).toBe('en-US');
    expect(female.name).toMatch(tts.VOICE_PROFILES.female.namePattern);

    const male = tts.findVoiceForGender('male');
    expect(male.language).toBe('en-US');
    expect(male.name).toMatch(tts.VOICE_PROFILES.male.namePattern);
    // ห้ามจับคู่ข้ามเพศ
    expect(female.name).not.toMatch(tts.VOICE_PROFILES.male.namePattern);
    expect(male.name).not.toMatch(tts.VOICE_PROFILES.female.namePattern);
  });

  test('falls back to pitch when the device only exposes gender-less voice names (e.g. Google TTS)', async () => {
    const genericVoices = [
      { identifier: 'en-us-x-sfg-local', language: 'en-US', name: 'English (United States)' },
      { identifier: 'en-US-language', language: 'en-US', name: 'English (United States)' },
    ];
    await loadTtsWithVoices(genericVoices);
    expect(tts.findVoiceForGender('female')).toBeNull();
    tts.speakEnglish('Generic voice', 'male');
    expect(Speech.speak).toHaveBeenCalledWith(
      'Generic voice',
      expect.objectContaining({ pitch: 0.82 })
    );
    expect(Speech.speak.mock.calls[0][1]).not.toHaveProperty('voice');
  });

  test('muted state still suppresses speech even when voice is specified', async () => {
    await loadTtsWithVoices([FEMALE_US, MALE_GB]);
    await tts.setMuted(true);
    Speech.speak.mockClear();
    tts.speakEnglish('Should not speak', 'male');
    expect(Speech.speak).not.toHaveBeenCalled();
  });

  test('empty voice (exercise docs without ttsVoice) keeps the exact neutral options', async () => {
    await loadTtsWithVoices([FEMALE_US, MALE_GB]);
    tts.speakEnglish('No gender given', '');
    expect(Speech.speak).toHaveBeenCalledWith('No gender given', {
      language: 'en-US',
      rate: 1.0,
      pitch: 1.0,
    });
    expect(Speech.speak.mock.calls[0][1]).not.toHaveProperty('voice');
  });

  test('non-gender voice values (legacy/word-bank strings) degrade to the neutral options', async () => {
    await loadTtsWithVoices([FEMALE_US, MALE_GB]);
    expect(tts.findVoiceForGender('en-US-female')).toBeNull();
    tts.speakEnglish('Legacy value', 'en-US-female');
    expect(Speech.speak).toHaveBeenCalledWith(
      'Legacy value',
      expect.objectContaining({ language: 'en-US', rate: 1.0, pitch: 1.0 })
    );
    expect(Speech.speak.mock.calls[0][1]).not.toHaveProperty('voice');
  });
});
