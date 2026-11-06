// frontend/screens/VocabExerciseScreen.js
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ActivityIndicator, TextInput, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { auth } from '../firebase';
import { saveStatistic, addFavoriteVocab, getFavoriteVocab, removeFavoriteVocab, getUserProfile } from '../services/firestoreService';
import { speakEnglish, stopSpeaking } from '../services/ttsService';
import { buildQuizSession, shuffleStages, normalizeExerciseItem, MATCHING_PAIRS_MAX, shuffle } from '../utils/learningEngine';
import SpeechSpeedToggle from '../components/SpeechSpeedToggle';
import SoundToggle from '../components/SoundToggle';
import ResponsiveContainer from '../components/ResponsiveContainer';
import ConfirmModal, { EXERCISE_EXIT_TEXTS } from '../components/ConfirmModal';
import {
  probeNativeEngine,
  stopNativeRecognition,
  startNativeRecognition,
  openAppSettings,
} from '../hooks/useNativeSpeechRecognition';

const PRIMARY      = '#5B4FCF';
const PRIMARY_LIGHT= '#EEF0FF';
const SUCCESS      = '#34C759';
const SUCCESS_LIGHT= '#E8F9ED';
const ERROR        = '#FF3B30';
const ERROR_LIGHT  = '#FFEFED';
const FAV_PINK     = '#FF4081'; // สีชมพูของหัวใจคำโปรด (เต็มดวง)

// แจ้งเตือนผู้ใช้ — Web ใช้ window.alert เพราะ Alert.alert เป็น no-op บน React Native Web
const notify = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// ปุ่มหัวใจคำโปรด — คำที่อยู่ในรายการโปรดแล้วแสดงเป็นหัวใจชมพูเต็มดวง (กดซ้ำเพื่อนำออก)
// จับคู่ด้วย wordId เป็นหลัก และ fallback ด้วยข้อความคำ (case-insensitive) เพราะคำเดียวกัน
// อาจมี wordId ไม่เสถียร (built-in fallback เป็น `${qType}_${idx}_${wordEN}`) → จะได้ไม่บันทึกซ้ำ/ลบไม่หมด
const wordKeyOf = (w) => String(w?.wordEN ?? '').trim().toLowerCase();

function FavoriteHeart({ word, favoriteIds, onPress, btnStyle }) {
  const isFav = !!(favoriteIds?.[word?.wordId] || favoriteIds?.[wordKeyOf(word)]);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={btnStyle}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={isFav ? 'ลบออกจากรายการโปรด' : 'เพิ่มในรายการโปรด'}
    >
      <Ionicons
        name={isFav ? 'heart' : 'heart-outline'}
        size={20}
        color={isFav ? FAV_PINK : ERROR}
      />
    </TouchableOpacity>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Stage 1: Matching — TH (ซ้าย) ↔ EN (ขวา)
// ══════════════════════════════════════════════════════════════════════════════
function MatchingStage({ words, onComplete }) {
  const [matched, setMatched]   = useState([]);
  const [selLeft, setSelLeft]   = useState(null);
  const [selRight, setSelRight] = useState(null);
  const [errorPair, setErrorPair] = useState(null);
  // สุ่มลำดับคอลัมน์ขวา (EN) ให้ไม่ตรงกับซ้าย
  const [rightOrder] = useState(() => {
    const idxs = words.map((_, i) => i);
    for (let i = idxs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
    }
    return idxs;
  });

  // Guard: ไม่มีคำในด่านนี้ → auto-skip (effect ของหน้าหลักจะ advance ต่อไปเอง)
  if (!words || words.length === 0) return null;

  const checkMatch = (li, ri) => {
    if (words[li].wordId === words[ri].wordId) {
      const next = [...matched, words[li].wordId];
      setMatched(next);
      speakEnglish(words[li].speakText || words[li].wordEN, words[li].ttsVoice); // เล่นเสียงเมื่อจับคู่ถูก
      setSelLeft(null); setSelRight(null);
      // การ์ด Matching เป็น 1 การ์ดจาก N การ์ดรวม — ส่งคะแนนเป็น 1/1 เมื่อจับคู่ครบ
      if (next.length === words.length) setTimeout(() => onComplete(1, 1), 400);
    } else {
      setErrorPair({ l: li, r: ri });
      setTimeout(() => { setErrorPair(null); setSelLeft(null); setSelRight(null); }, 800);
    }
  };

  const handleLeft = (idx) => {
    if (matched.includes(words[idx].wordId)) return;
    setErrorPair(null); setSelLeft(idx);
    if (selRight !== null) { checkMatch(idx, selRight); setSelRight(null); }
  };

  const handleRight = (actualIdx) => {
    if (matched.includes(words[actualIdx].wordId)) return;
    setErrorPair(null); setSelRight(actualIdx);
    if (selLeft !== null) { checkMatch(selLeft, actualIdx); setSelLeft(null); }
  };

  const leftStyle = (idx) => {
    const isMatched  = matched.includes(words[idx].wordId);
    const isSelected = selLeft === idx;
    const isError    = errorPair?.l === idx;
    if (isMatched)  return [ms.btn, ms.btnCorrect];
    if (isError)    return [ms.btn, ms.btnWrong];
    if (isSelected) return [ms.btn, ms.btnSelected];
    return [ms.btn];
  };

  const rightStyle = (actualIdx) => {
    const isMatched  = matched.includes(words[actualIdx].wordId);
    const isSelected = selRight === actualIdx;
    const isError    = errorPair?.r === actualIdx;
    if (isMatched)  return [ms.btn, ms.btnCorrect];
    if (isError)    return [ms.btn, ms.btnWrong];
    if (isSelected) return [ms.btn, ms.btnSelected];
    return [ms.btn];
  };

  return (
    <ScrollView contentContainerStyle={ms.wrap}>
      <Text style={ms.stageTitle}>จับคู่คำศัพท์</Text>
      <Text style={ms.stageSub}>เลือกคำอังกฤษ (ซ้าย) จับคู่กับคำไทย (ขวา)</Text>
      <View style={ms.grid}>
        {/* Left Column - English */}
        <View style={ms.col}>
          {words.map((word, idx) => (
            <TouchableOpacity key={`L${idx}`} style={leftStyle(idx)} onPress={() => handleLeft(idx)} activeOpacity={0.7}>
              <Ionicons name="volume-high-outline" size={14} color="#888" style={ms.speakerIcon} onPress={(e) => { e.stopPropagation?.(); speakEnglish(word.speakText || word.wordEN, word.ttsVoice); }} />
              <Text style={ms.btnText}>{word.wordEN}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {/* Right Column - Thai (สุ่มลำดับ) */}
        <View style={ms.col}>
          {rightOrder.map((actualIdx) => (
            <TouchableOpacity key={`R${actualIdx}`} style={rightStyle(actualIdx)} onPress={() => handleRight(actualIdx)} activeOpacity={0.7}>
              <Text style={ms.btnText}>{words[actualIdx].wordTH}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <Text style={ms.progress}>{matched.length}/{words.length} คู่</Text>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Stage 2: Spelling — สะกดจากคำแปลไทย, เฉลยตอบผิดครั้งที่ 2
// ══════════════════════════════════════════════════════════════════════════════
function SpellingStage({ words, onComplete, onFavorite, favoriteIds }) {
  const [index, setIndex]       = useState(0);
  const [input, setInput]       = useState('');
  const [status, setStatus]     = useState('idle');
  const [attempts, setAttempts] = useState(2);
  const [score, setScore]       = useState(0);

  // Guard: ไม่มีคำในด่านนี้ → ไม่ deref words[index] (กัน crash) ให้ auto-skip ทำงานต่อ
  if (!words || words.length === 0) return null;

  const current = words[index];

  const advance = (scored) => {
    const newScore = scored ? score + 1 : score;
    if (index < words.length - 1) {
      setIndex(index + 1); setInput(''); setStatus('idle'); setAttempts(2); setScore(newScore);
    } else {
      onComplete(newScore, words.length);
    }
  };

  const handleCheck = () => {
    if (status === 'correct' || status === 'revealed') return;
    if (input.trim().toLowerCase() === current.wordEN.toLowerCase()) {
      setStatus('correct');       // ตอบถูก → แสดงปุ่ม "ถัดไป" อย่างเดียว (ไม่มีปุ่มข้าม) + ได้คะแนน
      speakEnglish(current.speakText || current.wordEN, current.ttsVoice);
    } else if (attempts > 1) {
      setAttempts(attempts - 1); setStatus('wrong'); // ผิดครั้งแรก → ลองอีกครั้ง (ไม่หักคะแนน)
    } else {
      setStatus('revealed');      // ผิดครั้งที่ 2 → เฉลย + 0 คะแนน แล้วกด "ถัดไป"
    }
  };

  return (
    <ScrollView contentContainerStyle={ss.wrap}>
      <Text style={ss.stageTitle}>สะกดคำศัพท์ภาษาอังกฤษ</Text>
      <View style={ss.dotsRow}>
        {words.map((_, i) => (
          <View key={i} style={[ss.dot, i < index && ss.dotDone, i === index && ss.dotActive]} />
        ))}
      </View>
      <View style={ss.card}>
        <View style={ss.cardTop}>
          <Text style={ss.label}>คำแปลภาษาไทย</Text>
          <FavoriteHeart
            word={current}
            favoriteIds={favoriteIds}
            onPress={() => onFavorite?.(current)}
          />
        </View>
        <Text style={ss.thaiWord}>{current.wordTH}</Text>

        {status === 'revealed' ? (
          <View style={ss.revealBox}>
            <Text style={ss.revealLabel}>เฉลย:</Text>
            <Text style={ss.revealWord}>{current.wordEN}</Text>
          </View>
        ) : (
          <>
            <TextInput
              style={[ss.input, status === 'wrong' && ss.inputError, status === 'correct' && ss.inputCorrect]}
              placeholder="พิมพ์คำศัพท์อังกฤษ..."
              placeholderTextColor="#aaa"
              value={input}
              onChangeText={(v) => { setInput(v); if (status === 'wrong') setStatus('idle'); }}
              onSubmitEditing={handleCheck}
              autoCapitalize="none"
              autoCorrect={false}
              editable={status !== 'correct'}
            />
            {status === 'wrong' && (
              <Text style={ss.wrongText}>ลองอีกครั้ง</Text>
            )}
            {status === 'correct' && (
              <View style={ss.correctRow}>
                <Ionicons name="checkmark-circle" size={18} color={SUCCESS} />
                <Text style={ss.correctText}>ถูกต้อง!</Text>
              </View>
            )}
            <TouchableOpacity style={[ss.checkBtn, (status === 'correct' || status === 'revealed') && ss.checkBtnDisabled]} onPress={handleCheck} disabled={status === 'correct' || status === 'revealed'}>
              <Text style={ss.checkBtnText}>ตรวจคำตอบ</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ถัดไป: แสดงเมื่อตอบถูก (ได้คะแนน) หรือเฉลยแล้ว (0 คะแนน) */}
        {(status === 'correct' || status === 'revealed') && (
          <TouchableOpacity style={ss.nextBtn} onPress={() => advance(status === 'correct')}>
            <Text style={ss.nextBtnText}>ถัดไป</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Stage 3: FillBlank — เติมคำในช่องว่าง
// ══════════════════════════════════════════════════════════════════════════════
function FillBlankStage({ words, onComplete, onFavorite, favoriteIds }) {
  const [index, setIndex]   = useState(0);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('idle');
  const [attempts, setAttempts] = useState(2);
  const [score, setScore]   = useState(0);

  const current = words[index];

  // Guard: ไม่มีคำในด่านนี้ → ไม่ deref words[index] (กัน crash) ให้ auto-skip ทำงานต่อ
  if (!words || words.length === 0) return null;

  // Build choices for the *current* question only: [correct, ...distractors] shuffled.
  // Memoised so the order is stable across re-renders unless the question itself changes
  // — ป้องกันการสลับตำแหน่งปุ่มเลือกตอน Answer Button สลับไปมาเรนดอนท์ทุกเท่าที่หน้าแม่เรนเดอร์
  const choices = useMemo(() => {
    if (!current) return [];
    return shuffle([current.wordEN, ...(current.distractors || []).slice(0, 2)]);
  }, [index, current?.wordId, current?.wordEN]);

  const advance = (scored) => {
    const ns = scored ? score + 1 : score;
    if (index < words.length - 1) {
      setIndex(index + 1); setSelected(null); setStatus('idle'); setAttempts(2); setScore(ns);
    } else {
      onComplete(ns, words.length);
    }
  };

  const handleSelect = (choice) => {
    if (status === 'correct' || status === 'revealed') return;
    setSelected(choice);
    if (choice === current.wordEN) {
      setStatus('correct');       // ตอบถูก → เขียว + ได้คะแนน + "ถัดไป"
      speakEnglish(current.speakText || current.wordEN, current.ttsVoice);
    } else if (attempts > 1) {
      setAttempts(attempts - 1); setStatus('wrong'); // ผิดครั้งแรก → ลองอีกครั้ง (ไม่หักคะแนน)
    } else {
      setStatus('revealed');      // ผิดครั้งที่ 2 → ล็อก + เฉลย + 0 คะแนน + "ถัดไป"
    }
  };

  const sentence = current.sentence || `___ = ${current.wordEN}`;
  const display  = status === 'idle' || status === 'wrong'
    ? sentence.replace(current.wordEN, '______')
    : sentence;

  return (
    <ScrollView contentContainerStyle={fb.wrap}>
      <Text style={fb.stageTitle}>เติมคำในช่องว่าง</Text>
      <View style={ss.dotsRow}>
        {words.map((_, i) => (
          <View key={i} style={[ss.dot, i < index && ss.dotDone, i === index && ss.dotActive]} />
        ))}
      </View>
      <View style={fb.card}>
        <View style={fb.cardTop}>
          <Text style={fb.label}>ประโยค</Text>
          <FavoriteHeart
            word={current}
            favoriteIds={favoriteIds}
            onPress={() => onFavorite?.(current)}
          />
        </View>
        <Text style={fb.sentence}>{display}</Text>
        <Text style={fb.sentenceTH}>{current.sentenceTH}</Text>
        {status === 'revealed' && (
          <View style={ss.revealBox}>
            <Text style={ss.revealLabel}>เฉลย:</Text>
            <Text style={ss.revealWord}>{current.wordEN}</Text>
          </View>
        )}
        {status === 'wrong' && (
          <Text style={ss.wrongText}>ลองอีกครั้ง</Text>
        )}
        <View style={fb.choicesWrap}>
          {choices.map((ch) => {
            const isCorrect  = (status === 'correct' || status === 'revealed') && ch === current.wordEN;
            const isSelected = selected === ch;
            const isWrong    = isSelected && status === 'wrong';
            return (
              <TouchableOpacity
                key={ch}
                style={[fb.choiceBtn,
                  isCorrect && fb.choiceBtnCorrect,
                  isWrong   && fb.choiceBtnWrong,
                  isSelected && status === 'correct' && fb.choiceBtnCorrect,
                ]}
                onPress={() => handleSelect(ch)}
                disabled={status === 'correct' || status === 'revealed'}
                activeOpacity={0.7}
              >
                <Text style={fb.choiceText}>{ch}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ถัดไป: แสดงเมื่อตอบถูก (ได้คะแนน) หรือเฉลยแล้ว (0 คะแนน) */}
        {(status === 'correct' || status === 'revealed') && (
          <TouchableOpacity style={ss.nextBtn} onPress={() => advance(status === 'correct')}>
            <Text style={ss.nextBtnText}>ถัดไป</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Stage 4: Speaking — Cross-Platform Speech Recognition + ข้ามได้
// ══════════════════════════════════════════════════════════════════════════════
// --- Speech normalization & verification --------------------------------------
// normalizeText: lowercase + trim + strip punctuation (keep letters, digits,
// spaces, apostrophes and hyphens) so „Hello!“ matches „hello“.
function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s'’-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// The spoken string is compared against the target word (normalized) in memory,
// and the transcript is shown to the user only when the answer is wrong.
//   Pass      -> ถูกต้อง
//   Try Again -> ไม่ถูกต้อง (พร้อมแสดงคำที่ได้ยิน)
function verifySpeech(spokenText, targetWord) {
  return normalizeText(spokenText) === normalizeText(targetWord);
}

function SpeakingStage({ words, onComplete, onFavorite, favoriteIds }) {
  const [index, setIndex]         = useState(0);
  const [recStatus, setRecStatus] = useState('idle'); // idle | listening | processing | correct | wrong | unsupported
  const [wrongAttempts, setWrongAttempts] = useState(0); // จำนวนครั้งที่พูดไม่ถูกต้อง (ครบ 2 ครั้ง → ซ่อนปุ่มข้าม)
  const [score, setScore]         = useState(0);       // คะแนนสะสมในด่าน pronunciation
  const [transcript, setTranscript] = useState('');
  const [engineError, setEngineError] = useState(null);
  const [canOpenSettings, setCanOpenSettings] = useState(false);
  const recognitionRef = useRef(null);
  const nativeCleanupRef = useRef(null);
  const recStatusRef = useRef(recStatus);
  const evaluateTimerRef = useRef(null);
  const current = words[index];
  recStatusRef.current = recStatus;

  // Dynamic engine detection: web → Web Speech API (100% UNTOUCHED), native → expo-speech-recognition adapter
  const detectEngine = () => {
    if (Platform.OS === 'web') {
      const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
      if (!SR) return { kind: 'web', available: false };
      return { kind: 'web', available: true, SR };
    }
    return probeNativeEngine();
  };

  const engine = detectEngine();

  const stopCurrent = useCallback(() => {
    if (engine.kind === 'web' && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (_) {}
      recognitionRef.current = null;
    } else if (engine.kind === 'native') {
      try { nativeCleanupRef.current?.(); } catch (_) {}
      nativeCleanupRef.current = null;
      stopNativeRecognition(engine.module);
    }
  }, [engine.kind, engine.module]);

  useEffect(() => {
    return () => {
      clearTimeout(evaluateTimerRef.current);
      stopCurrent();
      stopSpeaking();
    };
  }, [stopCurrent]);

  // Guard: ไม่มีคำในด่านนี้ → ไม่ deref words[index] (กัน crash) ให้ auto-skip ทำงานต่อ
  if (!words || words.length === 0) return null;

  const advance = () => {
    clearTimeout(evaluateTimerRef.current);
    stopCurrent();
    stopSpeaking();
    setEngineError(null);
    setTranscript('');
    const wordScore = recStatus === 'correct' ? 1 : 0;
    const newScore = score + wordScore;
    if (index < words.length - 1) {
      setIndex(index + 1);
      setRecStatus('idle');
      setWrongAttempts(0);
      setScore(newScore);
    } else {
      onComplete(newScore, words.length);
    }
  };

  const handleSpeak = () => {
    // ปุ่ม 🔊 — เล่นเสียง TTS อย่างเดียว ไม่เริ่ม speech recognition
    if (recStatus === 'listening' || recStatus === 'processing') return;
    stopCurrent(); // หยุด recognition ที่ค้างไว้ก่อนเล่นเสียง (กัน audio overlap)
    speakEnglish(current.wordEN, current.ttsVoice);
  };

  const handleListen = async () => {
    // ผิดครบ 2 ครั้ง หรือพูดถูกแล้ว → ไม่อนุญาตให้บันทึกเสียงซ้ำ
    if (wrongAttempts >= 2 || recStatus === 'correct') return;
    setEngineError(null);
    setTranscript('');
    setCanOpenSettings(false);

    // Expo Go / managed workflow: no native speech module available.
    // This feature requires a development build or web browser.
    if (engine.kind === 'native' && !engine.available) {
      if (engine.reason === 'expo-go-no-native-module') {
        notify(
          'การตรวจเสียงพูด',
          'การตรวจเสียงพูดเปิดใช้งานเฉพาะบน Development Build หรือ Web Browser'
        );
      } else {
        setRecStatus('unsupported');
        setEngineError('ระบบรู้จำเสียงพูดยังไม่พร้อมใช้งานบนอุปกรณ์นี้');
      }
      return;
    }

    if (!engine.available) {
      setRecStatus('unsupported');
      setEngineError('เบราว์เซอร์นี้ไม่รองรับ Speech Recognition');
      return;
    }

    // ป้องกัน TTS ซ้อนกับเสียงที่กำลังบันทึก (ต้องเงียบก่อนเริ่มฟัง)
    stopSpeaking();
    clearTimeout(evaluateTimerRef.current);
    startListening();
  };

  const finishWithResult = (spoken) => {
    // หยุดรับเสียง แล้วเข้าสู่ขั้น "Processing/Evaluating"
    stopCurrent();
    setTranscript(spoken || '');
    setRecStatus('processing');
    clearTimeout(evaluateTimerRef.current);
    evaluateTimerRef.current = setTimeout(() => {
      const ok = verifySpeech(spoken, current.wordEN);
      setRecStatus(ok ? 'correct' : 'wrong');
      if (!ok) setWrongAttempts((w) => w + 1); // นับจำนวนครั้งที่พูดไม่ถูกต้อง
      if (ok) speakEnglish('Excellent!', current.ttsVoice); // เสียง feedback เมื่อตอบถูก
    }, 600);
  };

  const startListening = () => {
    try {
      if (engine.kind === 'web') {
        const rec = new engine.SR();
        recognitionRef.current = rec;
        rec.lang = 'en-US';
        rec.interimResults = false;
        rec.maxAlternatives = 3;
        setRecStatus('listening');

        rec.onresult = (e) => {
          const spoken = e.results?.[0]?.[0]?.transcript ?? '';
          finishWithResult(spoken);
        };
        rec.onerror = (e) => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            setRecStatus('unsupported');
            setEngineError('ไม่อนุญาตให้ใช้ไมโครโฟน — กรุณาเปิดสิทธิ์ในการตั้งค่า');
          } else {
            setRecStatus('wrong');
            setTranscript('');
          }
        };
        rec.onend = () => {
          // ผู้ใช้เงียบ / พูดจบโดยไม่มีผลลัพธ์ → ให้ลองใหม่
          if (recStatusRef.current === 'listening') {
            setRecStatus('wrong');
            setTranscript('');
          }
        };
        rec.start();
      } else {
        startNativeRecognition({
          module: engine.module,
          onStart: () => setRecStatus('listening'),
          onEnd: () => {
            if (recStatusRef.current === 'listening') {
              setRecStatus('wrong');
            }
          },
          onResult: (spoken) => {
            finishWithResult(spoken);
          },
          onError: ({ message, isPermissionError }) => {
            setRecStatus('unsupported');
            setEngineError(message);
            setCanOpenSettings(Boolean(isPermissionError));
          },
        }).then((cleanup) => {
          nativeCleanupRef.current = cleanup;
        }).catch((err) => {
          setRecStatus('unsupported');
          setEngineError(err?.message || 'ไม่สามารถเริ่มรู้จำเสียงได้');
        });
      }
    } catch (err) {
      setRecStatus('unsupported');
      setEngineError(err?.message || 'เกิดข้อผิดพลาดที่ไม่คาดคิด');
    }
  };

  const isListening = recStatus === 'listening';
  const isProcessing = recStatus === 'processing';
  const isBusy = isListening || isProcessing;
  const showUnsupported = recStatus === 'unsupported';
  // ปิดปุ่มไมค์เมื่อ: กำลังฟัง/ตรวจสอบ, พูดผิดครบ 2 ครั้ง, หรือพูดถูกแล้ว (เหลือแค่ปุ่ม "ถัดไป")
  const micDisabled = isBusy || wrongAttempts >= 2 || recStatus === 'correct';

  return (
    <ScrollView contentContainerStyle={spk.wrap}>
      <Text style={spk.stageTitle}>ฟังและพูดตาม</Text>
      <Text style={spk.stageSub}>🔊 ฟังเสียงคำศัพท์ แล้ว 🎤 พูดตาม • ข้ามได้</Text>
      <View style={ss.dotsRow}>
        {words.map((_, i) => (
          <View key={i} style={[ss.dot, i < index && ss.dotDone, i === index && ss.dotActive]} />
        ))}
      </View>
      <View style={spk.card}>
        <View style={spk.cardTop}>
          <FavoriteHeart
            word={current}
            favoriteIds={favoriteIds}
            onPress={() => onFavorite?.(current)}
            btnStyle={spk.heartBtn}
          />
        </View>
        <View style={spk.micCircle}>
          <Ionicons name={isListening ? 'mic' : isProcessing ? 'sync' : 'mic-outline'} size={40} color={isListening ? ERROR : PRIMARY} />
        </View>

        {/* คำศัพท์ + ปุ่ม 🔊 เล่นเสียง (TTS) แยกจากปุ่ม 🎤 บันทึกเสียง */}
        <View style={spk.wordRow}>
          <Text style={spk.wordEN}>{current.wordEN}</Text>
          <TouchableOpacity
            style={[spk.speakerBtn, isBusy && spk.disabledBtn]}
            onPress={handleSpeak}
            disabled={isBusy}
            accessibilityLabel="ฟังเสียงคำศัพท์"
          >
            <Ionicons name="volume-high" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={spk.wordTH}>{current.wordTH}</Text>

        {showUnsupported && (
          <View style={{ alignItems: 'center', marginVertical: 8 }}>
            <Text style={spk.unsupportedText}>
              {engineError || 'ไม่รองรับ Speech Recognition'}
              {'\n'}กด "ข้ามด่านนี้" เพื่อดำเนินการต่อ
            </Text>
            {canOpenSettings && (
              <TouchableOpacity
                style={{
                  marginTop: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: PRIMARY_LIGHT,
                  borderRadius: 8,
                }}
                onPress={openAppSettings}
              >
                <Text style={{ fontSize: 12, color: PRIMARY, fontWeight: '600' }}>
                  ⚙️ เปิดหน้าการตั้งค่า
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {recStatus === 'listening' && <Text style={spk.listeningText}>🎤 กำลังฟัง... พูดคำศัพท์ได้เลย</Text>}
        {recStatus === 'processing' && <Text style={spk.processingText}>⏳ กำลังตรวจสอบเสียง...</Text>}
        {recStatus === 'correct' && (
          <View style={spk.resultBox}>
            <Ionicons name="checkmark-circle" size={22} color={SUCCESS} />
            <Text style={[spk.resultText, { color: SUCCESS }]}>ถูกต้อง 🎉</Text>
          </View>
        )}
        {recStatus === 'wrong' && (
          <View style={spk.resultBox}>
            <Ionicons name="close-circle" size={22} color={ERROR} />
            <Text style={[spk.resultText, { color: ERROR }]}>ไม่ถูกต้อง</Text>
          </View>
        )}
        {recStatus === 'wrong' && (
          <Text style={spk.transcriptText}>
            ได้ยินเป็น: “{transcript || '— ไม่ได้ยินเสียง —'}”{'\n'}ลองพูดอีกครั้ง
          </Text>
        )}

        {/* ปุ่ม 🎤 หลัก — บันทึกเสียง แล้วประเมินอัตโนมัติ */}
        <TouchableOpacity
          style={[spk.listenBtn, micDisabled && spk.disabledBtn]}
          onPress={handleListen}
          disabled={micDisabled}
        >
          <Ionicons name={isBusy ? 'hourglass-outline' : 'mic'} size={18} color="#fff" />
          <Text style={spk.listenBtnText}>
            {recStatus === 'processing'
              ? 'กำลังตรวจสอบ...'
              : isListening
                ? 'กำลังฟัง...'
                : 'กดเพื่อพูด'}
          </Text>
        </TouchableOpacity>

        <View style={spk.btnRow}>
          {/* ข้าม: แสดงก่อนพยายาม (idle/unsupported) และหลังตอบผิดครั้งแรกเท่านั้น
              — ซ่อนเมื่อพูดถูกต้อง หรือพูดผิดครบ 2 ครั้ง */}
          {recStatus !== 'correct' && wrongAttempts < 2 && (
            <TouchableOpacity style={spk.skipBtn} onPress={advance}>
              <Text style={spk.skipText}>ข้ามด่านนี้</Text>
            </TouchableOpacity>
          )}
          {/* ถัดไป: แสดงเฉพาะเมื่อพูดถูกต้อง หรือพูดผิดครบ 2 ครั้ง
              (หลังผิดครั้งแรกยังไม่แสดง — ผู้ใช้ต้องลองใหม่หรือกดข้าม) */}
          {(recStatus === 'correct' || wrongAttempts >= 2) && (
            <TouchableOpacity style={spk.nextBtn} onPress={advance}>
              <Text style={spk.nextText}>ถัดไป</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Result Screen
// ══════════════════════════════════════════════════════════════════════════════
function ResultScreen({ scores, timeSpent, exercise, onGoList, onGoStats }) {
  const total  = exercise?.totalQuestions ??
                 scores.reduce((s, x) => s + x.total, 0);
  const scored = scores.reduce((s, x) => s + x.score, 0);
  const pct    = total > 0 ? Math.round((scored / total) * 100) : 0;
  const passed = pct >= 80;
  const statusColor = passed ? SUCCESS : ERROR;
  const mins   = Math.floor(timeSpent / 60);
  const secs   = timeSpent % 60;
  const timeStr= `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;

  const [userName, setUserName] = useState(auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || '');
  useEffect(() => {
    (async () => {
      const profile = await getUserProfile(auth.currentUser?.uid);
      if (profile.username) setUserName(profile.username);
    })();
  }, []);
  
  return (
    <ScrollView contentContainerStyle={rs.wrap}>
      <View style={rs.card}>
        {/* ถ้วยรางวัลสีทอง — แสดงทุกครั้งไม่ว่าผลจะผ่านหรือไม่ (ตามดีไซน์ระบบ) */}
        <View style={rs.trophy}>
          <Ionicons name="trophy" size={56} color="#FFD700" />
        </View>
        <Text style={rs.title}>{passed ? `${userName} ยอดเยี่ยมมาก! 🎉` : `${userName} พยายามอีกนิด!`}</Text>
        <Text style={rs.score}>{scored} / {total} ข้อ</Text>
        <Text style={[rs.pct, { color: statusColor }]}>{pct}%</Text>
        <View style={rs.stats}>
          <View style={rs.statItem}>
            <Ionicons name="time-outline" size={24} color={PRIMARY} />
            <Text style={rs.statLabel}>เวลาที่ใช้</Text>
            <Text style={rs.statValue}>{timeStr}</Text>
          </View>
          <View style={rs.statDivider} />
          <View style={rs.statItem}>
            <Ionicons name={passed ? 'checkmark-circle' : 'close-circle'} size={24} color={statusColor} />
            <Text style={rs.statLabel}>สถานะ</Text>
            <Text style={[rs.statValue, { color: statusColor }]}>
              {passed ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่าน'}
            </Text>
          </View>
        </View>
        <Text style={rs.note}>
          {passed
            ? 'คุณผ่านเกณฑ์ 80% แล้ว! ยอดเยี่ยมมาก 🎉'
            : 'ต้องได้ 80% ขึ้นไปเพื่อผ่านเกณฑ์'}
        </Text>
        <View style={rs.buttons}>
          <TouchableOpacity style={rs.btnPrimary} onPress={onGoList} activeOpacity={0.8}>
            <Text style={rs.btnPrimaryText}>รายการแบบฝึกหัด</Text>
          </TouchableOpacity>
          <TouchableOpacity style={rs.btnSecondary} onPress={onGoStats} activeOpacity={0.8}>
            <Text style={rs.btnSecondaryText}>ดูสถิติ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export default function VocabExerciseScreen() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { exercise = {} } = route.params ?? {};

  const [loading, setLoading]   = useState(true);
  const [words, setWords]       = useState([]);
  const [stages, setStages]     = useState([]);       // สุ่มลำดับ
  const [exitModalVisible, setExitModalVisible] = useState(false); // กล่องยืนยันก่อนออกจากแบบฝึกหัด
  const [stageIdx, setStageIdx] = useState(0);
  const [scores, setScores]     = useState([]);       // [{stage, score, total}]
  const [favMap, setFavMap]       = useState({});       // { [wordId|wordKey]: docId[] } — ใช้วาดหัวใจและ toggle นำออก
  const [timeSpent, setTimeSpent] = useState(0);
  const userName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || '';
  // โหลดรายการคำโปรดตอนเข้าหน้า → คำที่เคยเพิ่มไว้จะแสดงหัวใจชมพูเต็มดวงทันที
  useEffect(() => {
    (async () => {
      const email = auth.currentUser?.email;
      if (!email) return;
      try {
        const list = await getFavoriteVocab(email);
        const map = {};
        const push = (key, id) => {
          if (!key || !id) return;
          if (!map[key]) map[key] = [];
          if (!map[key].includes(id)) map[key].push(id);
        };
        for (const f of list) {
          push(f?.wordId, f.id);
          push(String(f?.wordEN ?? '').trim().toLowerCase(), f.id); // fallback index (wordId อาจไม่ตรง)
        }
        setFavMap(map);
      } catch (err) {
        console.error('Load favorites error:', err);
      }
    })();
  }, []);
  const timerRef = useRef(null);

  useEffect(() => {
    const rawItems = exercise.items || exercise.questions || [];
    // Inject exercise-level CEFR tag into items that lack their own level field.
    // buildQuizSession filters the pool by level, so items without a tag would be
    // dropped entirely (→ empty session → "ไม่พบคำศัพท์"). Harmonize the schema here.
    const normalized = rawItems.map((item) =>
      normalizeExerciseItem({
        ...item,
        level: item.level ?? exercise.level ?? '',
        cefrLevel: item.cefrLevel ?? exercise.level ?? '',
      })
    );
    const usablePool = normalized.filter((item) => item.wordEN && item.wordTH);
    // Use the exact item count of the selected exercise set (or fallback to pool length).
    // This ensures the quiz shows all items in the set rather than a fixed default.
    const targetSize = rawItems.length > 0 ? rawItems.length : usablePool.length;
    const session = buildQuizSession({
      exercise,
      vocabPool:        usablePool,
      size:             targetSize,
      spellingWords:    exercise.spellingWords    ?? [],
      listenRepeatWords: exercise.listenRepeatWords ?? [],
      fillInBlankSentences: exercise.fillInBlankSentences ?? [],
    });

    // Defensive fallback: if the session came back empty despite a usable pool
    // (e.g. level filter mismatch), use the normalized pool directly so a
    // populated exercise set can never dead-end on the empty-state screen.
    const finalItems = session.items.length > 0
      ? session.items
      : usablePool.slice(0, 15);

    setWords(finalItems);
    setStages(shuffleStages());
    timerRef.current = setInterval(() => setTimeSpent((t) => t + 1), 1000);
    setLoading(false);
    return () => clearInterval(timerRef.current);
  }, []);

  // Auto-skip stages that have no words (admin selected 0 words for that stage).
  // MUST be placed above all early `if (...) return` statements so hook call
  // order stays constant across renders (React Rules of Hooks).
  useEffect(() => {
    if (stages.length === 0 || stageIdx >= stages.length || words.length === 0) return;
    const currentStage = stages[stageIdx];
    let currentWords;
    if (currentStage === 'matching') {
      currentWords = (words[0]?.matchingPairs ?? []).slice(0, MATCHING_PAIRS_MAX);
    } else if (currentStage === 'spelling') {
      currentWords = words.slice(1).filter((c) => c.questionType === 'spelling');
    } else if (currentStage === 'fillblank') {
      currentWords = words.slice(1).filter((c) => c.questionType === 'fillblank');
    } else if (currentStage === 'pronunciation') {
      currentWords = words.slice(1).filter((c) => c.questionType === 'pronunciation');
    }
    if (currentWords && currentWords.length === 0) {
      handleStageComplete(0, 0);
    }
  }, [stageIdx, stages, words]);

  const currentStage = stages[stageIdx];

  const handleStageComplete = (score, total) => {
    const newScores = [...scores, { stage: currentStage, score: score ?? 0, total: total ?? 0 }];
    setScores(newScores);
    if (stageIdx < stages.length - 1) {
      setStageIdx(stageIdx + 1);
    } else {
      finishExercise(newScores);
    }
  };

  const finishExercise = async (finalScores) => {
    clearInterval(timerRef.current);
    const totalScore = finalScores.reduce((s, x) => s + x.score, 0);
    const totalQ     = exercise.totalQuestions ??
                       finalScores.reduce((s, x) => s + x.total, 0);
    try {
      await saveStatistic(auth.currentUser?.email ?? '', exercise.id, {
        score: totalScore, totalQuestions: totalQ, timeSpent, category: exercise.category,
      });
    } catch (err) { console.error(err); }
    setStageIdx(stages.length); // trigger result
  };

  // กดหัวใจแบบ toggle — ยังไม่ใช่โปรด → เพิ่ม / เป็นโปรดแล้ว → นำออกทั้งหมดของคำนั้น
  const handleFavorite = async (word) => {
    const email = auth.currentUser?.email;
    if (!email) return; // ยังไม่ได้ login → ไม่เรียก Firestore และไม่แจ้งเตือน (ตาม spec)
    const key    = wordKeyOf(word);
    // union ทั้ง 2 ดัชนี → ลบได้ครบทุก doc แม้คำเดียวกันถูกเก็บด้วย wordId ต่างกัน
    const docIds = Array.from(new Set([...(favMap[word.wordId] || []), ...(favMap[key] || [])]));
    try {
      if (docIds.length > 0) {
        // ลบทุก doc ของคำนี้ (กันกรณีมีซ้ำจาก wordId ที่ไม่เสถียร) → คลังต้องไม่มีคำนี้เหลือ
        // ส่ง email เพื่อให้ service ล้าง cache `fav:{email}` ด้วย
        await Promise.all(docIds.map((id) => removeFavoriteVocab(id, email)));
        setFavMap((prev) => {
          const next = { ...prev };
          delete next[word.wordId];
          delete next[key];
          return next;
        });
        notify('นำออกแล้ว', `"${word.wordEN}" ถูกนำออกจากรายการโปรดแล้ว`);
      } else {
        const docId = await addFavoriteVocab(email, { id: word.wordId, wordEN: word.wordEN, wordTH: word.wordTH });
        if (docId) {
          setFavMap((prev) => {
            const next = { ...prev };
            next[word.wordId] = [...(next[word.wordId] || []), docId];
            if (key) next[key] = [...(next[key] || []), docId];
            return next;
          });
        }
        notify('บันทึกแล้ว', `"${word.wordEN}" อยู่ในคลังโปรดแล้ว`);
      }
    } catch (err) {
      console.error('Favorite toggle error:', err);
      notify('ผิดพลาด', 'ไม่สามารถดำเนินการได้');
    }
  };

  // ปุ่ม "ออก" → เปิดกล่องยืนยันแทน (Alert.alert ไม่ทำงานบน web / window.confirm ไม่ทำงานบน native)
  const handleExit = () => {
    setExitModalVisible(true);
  };

  // กดยืนยันในกล่อง → ออกจากแบบฝึกหัดจริง
  const confirmExit = () => {
    setExitModalVisible(false);
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs');
  };

  // Progress อิงตามจำนวนข้อ (ไม่ใช่นับ stage) เพื่อให้ตรงกับ totalQuestions:
  //   Matching = 1 ข้อ, Spelling = 1 ข้อ/คำ, Listen&Repeat = 1 ข้อ/คำ, FIB = 1 ข้อ/ประโยค
  // scores ถูก append 1 รายการต่อ stage ที่จบ (แต่ละรายการมี .total = จำนวนข้อของ stage นั้น)
  // ดังนั้น completedQuestions = ผลรวม .total ทั้งหมด → bar เลื่อนตามจำนวนข้อจริง
  const totalQuestions =
    exercise.totalQuestions ??
    (
      ((words[0]?.matchingPairs ?? []).length > 0 ? 1 : 0) +
      words.slice(1).filter((c) => c.questionType === 'spelling').length +
      words.slice(1).filter((c) => c.questionType === 'fillblank').length +
      words.slice(1).filter((c) => c.questionType === 'pronunciation').length
    );
  const completedQuestions = scores.reduce((s, x) => s + (x.total || 0), 0);
  const progress = totalQuestions > 0 ? Math.min(1, completedQuestions / totalQuestions) : 0;
  const stageLabel = { matching: 'จับคู่', spelling: 'สะกดคำ', fillblank: 'เติมช่องว่าง', pronunciation: 'พูดตาม' };

  if (loading) {
    return (
      <SafeAreaView style={g.safe} edges={['top']}>
        <View style={g.center}><ActivityIndicator size="large" color={PRIMARY} /></View>
      </SafeAreaView>
    );
  }

  // Empty-state guard: ชุดนี้ไม่มีคำศัพท์ที่ใช้ได้ (items ว่าง หรือฟิลด์ wordEN/wordTH ไม่ครบ)
  // ป้องกัน crash ใน stage components (เช่น choices[index].map ใน FillBlankStage)
  if (words.length === 0) {
    return (
      <SafeAreaView style={g.safe} edges={['top']}>
        <View style={g.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#ccc" />
          <Text style={es.text}>ไม่พบคำศัพท์ในชุดแบบฝึกหัดนี้</Text>
          <TouchableOpacity style={es.btn} onPress={() => navigation.goBack()}>
            <Text style={es.btnText}>กลับ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Result
  if (stageIdx >= stages.length && stages.length > 0) {
    return (
      <SafeAreaView style={g.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ResultScreen scores={scores} timeSpent={timeSpent} exercise={exercise} onGoList={() => navigation.goBack()} onGoStats={() => navigation.navigate('Stats')} />
      </SafeAreaView>
    );
  }

  // Map new card structure back to original 4-stage UI:
  // words[0] is the matching card; remaining cards are individual question cards.
  // Cap at MATCHING_PAIRS_MAX (10) — การ์ดรองรับคู่ทั้งหมดที่ dataset มี (dynamic)
  const matchingCards = (words[0]?.matchingPairs ?? []).slice(0, MATCHING_PAIRS_MAX);
  const spellingCards = words.slice(1).filter((c) => c.questionType === 'spelling');
  const fillBlankCards = words.slice(1).filter((c) => c.questionType === 'fillblank');
  const pronunciationCards = words.slice(1).filter((c) => c.questionType === 'pronunciation');

  return (
    <SafeAreaView style={g.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {/* Header */}
      <View style={g.header}>
        <TouchableOpacity style={g.closeBtn} onPress={handleExit}>
          <Ionicons name="close" size={22} color="#000" />
        </TouchableOpacity>
        <Text style={g.stageLabel}>{stageLabel[currentStage] ?? ''}</Text>
        <View style={g.barWrap}>
          <View style={[g.barFill, { width: `${progress * 100}%` }]} />
        </View>
        {/* ความเร็วเสียง TTS + ปิด/เปิดเสียง */}
        <SpeechSpeedToggle color={PRIMARY} background={PRIMARY_LIGHT} />
        <SoundToggle color={PRIMARY} background={PRIMARY_LIGHT} />
        <View style={g.timerPill}>
          <Ionicons name="time-outline" size={13} color={PRIMARY} />
          <Text style={g.timerText}>{String(Math.floor(timeSpent/60)).padStart(2,'0')}:{String(timeSpent%60).padStart(2,'0')}</Text>
        </View>
      </View>

      <ResponsiveContainer variant="exercise" style={{ flexGrow: 1, paddingHorizontal: 0 }}>
      {currentStage === 'matching'  && matchingCards.length > 0 && <MatchingStage  words={matchingCards} onComplete={handleStageComplete} />}
      {currentStage === 'spelling'  && spellingCards.length > 0 && <SpellingStage  words={spellingCards} onComplete={handleStageComplete} onFavorite={handleFavorite} favoriteIds={favMap} />}
      {currentStage === 'fillblank' && fillBlankCards.length > 0 && <FillBlankStage words={fillBlankCards} onComplete={handleStageComplete} onFavorite={handleFavorite} favoriteIds={favMap} />}
      {currentStage === 'pronunciation' && pronunciationCards.length > 0 && <SpeakingStage words={pronunciationCards} onComplete={handleStageComplete} onFavorite={handleFavorite} favoriteIds={favMap} />}
      </ResponsiveContainer>

      {/* กล่องยืนยันก่อนออกจากแบบฝึกหัด — โทนสีหลักของหน้าคลังคำศัพท์ */}
      <ConfirmModal
        visible={exitModalVisible}
        title={EXERCISE_EXIT_TEXTS.title}
        message={EXERCISE_EXIT_TEXTS.message}
        confirmText={EXERCISE_EXIT_TEXTS.confirm}
        cancelText={EXERCISE_EXIT_TEXTS.cancel}
        accentColor={PRIMARY}
        onConfirm={confirmExit}
        onCancel={() => setExitModalVisible(false)}
        testID="vocab-exit-confirm"
      />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════
const g = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: '#fff' },
  center:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#fff', gap: 8 },
  closeBtn:   { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  stageLabel: { fontSize: 12, fontWeight: '700', color: PRIMARY, minWidth: 56 },
  barWrap:    { flex: 1, height: 8, backgroundColor: '#E8E8F0', borderRadius: 4, overflow: 'hidden' },
  barFill:    { height: 8, backgroundColor: SUCCESS, borderRadius: 4 },
  timerPill:  { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: PRIMARY_LIGHT, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  timerText:  { fontSize: 11, fontWeight: '700', color: PRIMARY },
});

const ms = StyleSheet.create({
  wrap:       { padding: 16, paddingBottom: 32 },
  stageTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 4 },
  stageSub:   { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 16 },
  grid:       { flexDirection: 'row', gap: 10 },
  col:        { flex: 1, gap: 8 },
  btn:        { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 12, alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 48, justifyContent: 'center' },
  btnSelected:{ borderColor: PRIMARY, backgroundColor: PRIMARY_LIGHT },
  btnCorrect: { borderColor: SUCCESS, backgroundColor: SUCCESS_LIGHT },
  btnWrong:   { borderColor: ERROR,   backgroundColor: ERROR_LIGHT },
  btnText:    { fontSize: 14, fontWeight: '600', color: '#1A1A2E', textAlign: 'center', flexShrink: 1 },
  speakerIcon:{ flexShrink: 0 },
  progress:   { textAlign: 'center', marginTop: 16, fontSize: 13, color: '#888' },
});

const ss = StyleSheet.create({
  wrap:         { padding: 16, paddingBottom: 32 },
  stageTitle:   { fontSize: 18, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 12 },
  dotsRow:      { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd' },
  dotActive:    { backgroundColor: PRIMARY, width: 20 },
  dotDone:      { backgroundColor: SUCCESS },
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label:        { fontSize: 12, fontWeight: '600', color: '#888' },
  thaiWord:     { fontSize: 28, fontWeight: '900', color: '#000', textAlign: 'center', marginBottom: 20 },
  input:        { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 10 },
  inputError:   { borderColor: ERROR, backgroundColor: ERROR_LIGHT },
  inputCorrect: { borderColor: SUCCESS, backgroundColor: SUCCESS_LIGHT },
  wrongText:    { fontSize: 13, color: ERROR, textAlign: 'center', marginBottom: 8 },
  correctRow:   { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  correctText:  { fontSize: 14, color: SUCCESS, fontWeight: '700' },
  checkBtn:     { backgroundColor: PRIMARY, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 },
  checkBtnDisabled: { backgroundColor: '#ccc' },
  checkBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  revealBox:    { backgroundColor: ERROR_LIGHT, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 4 },
  revealLabel:  { fontSize: 12, color: ERROR, fontWeight: '600' },
  revealWord:   { fontSize: 22, fontWeight: '900', color: ERROR, marginTop: 4 },
  nextBtn:      { backgroundColor: SUCCESS, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 },
  nextBtnText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const fb = StyleSheet.create({
  wrap:         { padding: 16, paddingBottom: 32 },
  stageTitle:   { fontSize: 18, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 12 },
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  cardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label:        { fontSize: 12, fontWeight: '600', color: '#888' },
  sentence:     { fontSize: 18, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 6, lineHeight: 28 },
  sentenceTH:   { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 16 },
  choicesWrap:  { gap: 10 },
  choiceBtn:    { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 14, alignItems: 'center' },
  choiceBtnCorrect: { borderColor: SUCCESS, backgroundColor: SUCCESS_LIGHT },
  choiceBtnWrong:   { borderColor: ERROR,   backgroundColor: ERROR_LIGHT },
  choiceText:   { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
});

const spk = StyleSheet.create({
  wrap:        { padding: 16, paddingBottom: 32 },
  stageTitle:  { fontSize: 18, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 4 },
  stageSub:    { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 12 },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 20, alignItems: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  cardTop:     { alignSelf: 'flex-end', marginBottom: 8 },
  heartBtn:    { padding: 4 },
  micCircle:   { width: 80, height: 80, borderRadius: 40, backgroundColor: PRIMARY_LIGHT, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  wordEN:      { fontSize: 30, fontWeight: '900', color: '#000' },
  wordTH:      { fontSize: 16, color: '#666', marginBottom: 16 },
  wordRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  speakerBtn:  { width: 44, height: 44, borderRadius: 22, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  listeningText:{ fontSize: 14, color: ERROR, fontWeight: '600', marginBottom: 12 },
  processingText:{ fontSize: 14, color: '#8E8E93', fontWeight: '600', marginBottom: 12 },
  transcriptText:{ fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 12, lineHeight: 20 },
  disabledBtn: { opacity: 0.6 },
  resultBox:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  resultText:  { fontSize: 14, fontWeight: '600' },
  unsupportedText: { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 12, lineHeight: 20 },
  listenBtn:   { backgroundColor: PRIMARY, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24, marginBottom: 16 },
  listenBtnText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
  btnRow:      { flexDirection: 'row', gap: 12 },
  skipBtn:     { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  skipText:    { fontSize: 14, color: '#666' },
  nextBtn:     { backgroundColor: SUCCESS, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  nextText:    { fontSize: 14, color: '#fff', fontWeight: '700' },
});

const rs = StyleSheet.create({
  wrap:    { padding: 24, alignItems: 'center', justifyContent: 'center', flexGrow: 1, backgroundColor: '#F4F6FF' },
  card:    { backgroundColor: '#fff', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  trophy:  { width: 100, height: 100, borderRadius: 50, backgroundColor: '#FFF8E1', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  title:   { fontSize: 22, fontWeight: '900', color: '#1A1A2E', marginBottom: 10 },
  score:   { fontSize: 40, fontWeight: '900', color: '#1A1A2E', marginBottom: 2 },
  pct:     { fontSize: 26, fontWeight: '700', marginBottom: 22 },
  stats:   { flexDirection: 'row', alignItems: 'stretch', width: '100%', backgroundColor: '#F7F8FC', borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  statItem:    { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: '#E4E6EF', marginVertical: 4 },
  statLabel:   { fontSize: 12, color: '#666', marginTop: 4 },
  statValue:   { fontSize: 16, fontWeight: 'bold', color: '#1A1A2E', marginTop: 2 },
  note:    { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  buttons: { flexDirection: 'row', width: '100%', gap: 12 },
  btnPrimary:   { flex: 1, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.28, shadowRadius: 5 },
  btnPrimaryText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondary:     { flex: 1, backgroundColor: '#F0F0F0', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  btnSecondaryText: { color: '#333', fontWeight: '700', fontSize: 15 },
});

const es = StyleSheet.create({
  text:    { fontSize: 15, color: '#888', textAlign: 'center', marginVertical: 16, lineHeight: 24 },
  btn:     { backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
