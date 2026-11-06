// frontend/screens/TenseExerciseScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ActivityIndicator, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { auth } from '../firebase';
import { getUserProfile, saveStatistic } from '../services/firestoreService';
import { speakEnglish, stopSpeaking } from '../services/ttsService';
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
import { resolveTenseUserMode, TENSE_UI_MODE } from '../utils/tenseMode';
import { verifySentenceSpeech } from '../utils/speechVerify';

const PRIMARY = '#34C759';
const SUCCESS = '#34C759';
const ERROR = '#FF3B30';

// หน่วงก่อนพาไปหน้าผลลัพธ์ หลังตอบข้อสุดท้าย (ให้ผู้เรียนเห็น feedback ของข้อนั้นก่อนสลับหน้า)
const AUTO_FINISH_DELAY_MS = 1200;

// แจ้งเตือนผู้ใช้ — Web ใช้ window.alert เพราะ Alert.alert เป็น no-op บน React Native Web
// (ใช้เคส Expo Go ที่ยังไม่มี native speech module)
const notify = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// คืนประโยคเต็ม (ตอบถูกแล้ว) สำหรับเล่นเสียง TTS
// ⚠️ speakText จาก Firestore อาจมี "___" ตกค้าง (เช่น mode listenRepeat ที่ backend ไม่ได้แทนที่ช่องว่าง)
//    → ต้อง sanitize โดยแทนที่ช่องว่างด้วยคำตอบที่ถูกต้องเสมอ เพื่อป้องกันการอ่านออกเสียงเพี้ยน
function getFullSentence(item) {
  if (item.mode === TENSE_UI_MODE.REORDER) {
    return Array.isArray(item.orderWords) && item.orderWords.length > 0
      ? item.orderWords.join(' ')
      : (item.speakText || item.sentence || item.targetSentence || '');
  }
  const answer = item.answer || item.correctAnswer || item.missingWord || '';
  const base   = item.speakText || item.sentence || '';
  return base
    .replace(/_{2,}/g, answer) // แทนที่ช่องว่างทุกจุด (รองรับ 2 ขีดขึ้นไป)
    .replace(/\s+/g, ' ')      // ยุบช่องว่างซ้ำ
    .trim();
}

// ตรวจสอบความสมบูรณ์ของข้อมูลโจทย์ Tense (ต้องมี choices และ answer อย่างน้อย)
function isValidTenseItem(item) {
  if (!item || typeof item !== 'object') return false;
  const hasAnswer = Boolean(item.answer || item.correctAnswer || item.missingWord);
  const hasSentence = Boolean(item.sentence || item.targetSentence || item.sentenceTH);
  return hasAnswer && hasSentence;
}

// สุ่มลำดับข้อ/ตัวเลือกในชุดแบบฝึกหัด Tense (Fisher–Yates, non-mutating)
// — สุ่มเฉพาะใน memory ของรอบนั้น ๆ ไม่แตะอาร์เรย์ต้นฉบับ (exercise.items) และไม่กระทบ DB/แอดมิน
// — ตรวจคะแนนแบบ value-based (เทียบค่าคำตอบ ไม่ได้อิง index) → สลับตำแหน่งแล้วคะแนนยังถูกต้อง
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ข้อความบอกวิธีเล่น — สร้างจาก mode
function getInstruction(mode) {
  if (mode === TENSE_UI_MODE.FILL_BLANK) return 'เติมคำในช่องว่างให้ถูกต้อง';
  if (mode === TENSE_UI_MODE.LISTEN_REPEAT) return 'ฟังเสียงและพูดตามประโยค';
  return 'เรียงคำให้เป็นประโยคที่ถูกต้อง';
}

// ══════════════════════════════════════════════════════════════════════════════
// Question Types
// ══════════════════════════════════════════════════════════════════════════════
// โหมดของแต่ละข้อมาจาก item.mode ที่ผู้ดูแลตั้งไว้ในแอดมิน (ไม่ใช้เลขคี่/คู่แล้ว):
//   fillBlank    → Multiple Choice (เติมคำในช่องว่าง)
//   reorder      → Word Ordering    (เรียงประโยค)
//   listenRepeat → Listen & Repeat  (ฟังและพูดตาม)
// resolveTenseUserMode() ใน utils/tenseMode.js เป็นตัวแปลง + fallback ให้ชุดเก่า

// ══════════════════════════════════════════════════════════════════════════════
// Multiple Choice Component
// ══════════════════════════════════════════════════════════════════════════════
function MultipleChoiceQuestion({ item, onAnswer, answered, isCorrect, wrongAttempts }) {
  // choices อาจว่างได้ในชุดเก่า → fallback ด้วยคำตอบเดียว กัน crash ([...undefined])
  const [options] = useState(() => {
    const list = Array.isArray(item.choices) && item.choices.length > 0
      ? item.choices
      : [item.answer || item.correctAnswer || ''];
    return shuffle(list);
  });
  const [selected, setSelected] = useState(null);
  const isLocked = !!answered;
  const showWrong = !isLocked && wrongAttempts === 1; // ผิดครั้งแรก → feedback + ลองใหม่
  const fullSentence = getFullSentence(item); // ประโยคเต็ม (ตอบถูกแล้ว) สำหรับเล่นเสียง
  
  return (
    <View style={s.questionContainer}>
      {/* Tense Type Badge */}
      <View style={[s.tenseBadge, { backgroundColor: item.tenseColor }]}>
        <Text style={s.tenseBadgeText}>{item.tenseType}</Text>
      </View>
      
      <Text style={s.questionLabel}>ข้อ {item.questionNum}</Text>
      
      {/* How to play / Instruction */}
      <View style={s.instructionCard}>
        <View style={s.instructionHeader}>
          <Ionicons name="game-controller-outline" size={16} color={PRIMARY} />
          <Text style={s.instructionLabel}>วิธีเล่น:</Text>
        </View>
        <Text style={s.instructionText}>{getInstruction(item.mode)}</Text>
      </View>
      
      {/* Question */}
      <View style={s.questionCard}>
        <Text style={s.sentence}>{isCorrect ? fullSentence : item.sentence}</Text>
        <Text style={s.sentenceTH}>{item.sentenceTH}</Text>
        {/* ปุ่มฟังเสียง — แสดงเมื่อตอบแล้ว (ทั้งตอบถูกและตอบผิด) วงกลมเส้นเขียว + ลำโพงเขียว */}
        {answered && (
          <TouchableOpacity
            style={s.replayBtn}
            onPress={() => speakEnglish(fullSentence, item.ttsVoice)}
            activeOpacity={0.7}
            accessibilityLabel="ฟังเสียงประโยค"
          >
            <Ionicons name="volume-high" size={22} color={PRIMARY} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Options - Grid 2x2 */}
      <View style={s.optionsGrid}>
        {options.map((opt, idx) => {
          const isSelected = selected === opt;
          const isRevealCorrect = answered && opt === item.answer;
          const isRevealWrong = answered && isSelected && opt !== item.answer;

          const bgColor = isRevealCorrect
            ? SUCCESS
            : isRevealWrong
              ? ERROR
              : (isSelected ? '#EEF0FF' : (answered ? '#F5F5F5' : '#fff'));
          const textColor = (isRevealCorrect || isRevealWrong) ? '#fff' : '#333';
          const borderColor = isRevealCorrect
            ? SUCCESS
            : isRevealWrong
              ? ERROR
              : (isSelected ? '#5B4FCF' : '#E0E0E0');
          
          return (
            <TouchableOpacity
              key={idx}
              style={[s.optionBtn, { backgroundColor: bgColor, borderColor }]}
              onPress={() => {
                if (isLocked) return;
                setSelected(opt);
                speakEnglish(opt, item.ttsVoice); // 🔊 อ่านคำที่กดเลือกทันที
              }}
              disabled={isLocked}
              activeOpacity={0.7}
            >
              <Text style={[s.optionText, { color: textColor }]}>{opt}</Text>
              {isRevealCorrect && (
                <Ionicons name="checkmark-circle" size={20} color="#fff" style={s.optionIcon} />
              )}
              {isRevealWrong && (
                <Ionicons name="close-circle" size={20} color="#fff" style={s.optionIcon} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Error feedback — ผิดครั้งแรก (ไม่เฉลย ยังเลือกใหม่ได้) */}
      {showWrong && (
        <Text style={s.wrongFeedbackText}>ไม่ถูกต้อง ลองใหม่อีกครั้ง</Text>
      )}

      {/* Submit/Confirm — เลือกคำตอบก่อน แล้วกด "ตอบ" */}
      {!isLocked && (
        <TouchableOpacity
          style={[s.submitBtn, { marginTop: 12, opacity: selected ? 1 : 0.5 }]}
          onPress={() => onAnswer(selected)}
          disabled={!selected}
        >
          <Text style={s.submitBtnText}>ตอบ</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Word Ordering Component
// ══════════════════════════════════════════════════════════════════════════════
function WordOrderingQuestion({ item, onAnswer, answered, isCorrect, wrongAttempts }) {
  const [selectedWords, setSelectedWords] = useState([]);
  const [availableWords, setAvailableWords] = useState([]);
  const isLocked = !!answered;
  const showWrong = !isLocked && wrongAttempts === 1; // ผิดครั้งแรก → feedback + ลองใหม่
  const fullSentence = getFullSentence(item); // ประโยคเต็ม (ตอบถูกแล้ว) สำหรับเล่นเสียง

  const orderWords = Array.isArray(item.orderWords) ? item.orderWords : [];

  useEffect(() => {
    if (answered) {
      setSelectedWords(answered.split(' '));
      setAvailableWords([]);
    } else {
      setAvailableWords(shuffle(orderWords));
      setSelectedWords([]);
    }
  }, [item, answered]);

  const handleSelectWord = (word, idx) => {
    if (isLocked) return;
    speakEnglish(word, item.ttsVoice); // 🔊 อ่านคำที่กดเลือกทันที
    setSelectedWords([...selectedWords, word]);
    setAvailableWords(availableWords.filter((_, i) => i !== idx));
  };

  const handleRemoveWord = (idx) => {
    if (isLocked) return;
    const word = selectedWords[idx];
    setSelectedWords(selectedWords.filter((_, i) => i !== idx));
    setAvailableWords([...availableWords, word]);
  };

  const handleSubmit = () => {
    if (isLocked) return;
    const answer = selectedWords.join(' ');
    onAnswer(answer);
  };

  const canSubmit = selectedWords.length === orderWords.length;

  return (
    <View style={s.questionContainer}>
      {/* Tense Type Badge */}
      <View style={[s.tenseBadge, { backgroundColor: item.tenseColor }]}>
        <Text style={s.tenseBadgeText}>{item.tenseType}</Text>
      </View>
      
      <Text style={s.questionLabel}>ข้อ {item.questionNum}</Text>
      
      {/* How to play / Instruction */}
      <View style={s.instructionCard}>
        <View style={s.instructionHeader}>
          <Ionicons name="game-controller-outline" size={16} color={PRIMARY} />
          <Text style={s.instructionLabel}>วิธีเล่น:</Text>
        </View>
        <Text style={s.instructionText}>{getInstruction(item.mode)}</Text>
      </View>
      
      {/* Question */}
      <View style={s.questionCard}>
        <Text style={s.sentenceTHOrderMode}>{item.sentenceTH}</Text>
      </View>
      
      {/* Answer Area */}
      <View style={[s.answerArea, { borderColor: answered ? (isCorrect ? SUCCESS : ERROR) : '#ddd' }]}>
        {selectedWords.length === 0 ? (
          <Text style={s.placeholderText}>เลือกคำแล้วลากมาวางที่นี่</Text>
        ) : (
          <View style={s.selectedWordsRow}>
            {selectedWords.map((word, idx) => (
              <TouchableOpacity
                key={idx}
                style={[s.wordChip, { backgroundColor: answered ? (isCorrect ? '#E8F5E9' : '#FFEBEE') : '#EEF0FF' }]}
                onPress={() => handleRemoveWord(idx)}
                disabled={isLocked}
              >
                <Text style={s.wordChipText}>{word}</Text>
                {!isLocked && (
                  <Ionicons name="close" size={16} color="#666" style={s.wordChipIcon} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
        
        {answered && (
          <View style={[s.resultBadge, { backgroundColor: isCorrect ? SUCCESS : ERROR }]}>
            <Ionicons 
              name={isCorrect ? 'checkmark' : 'close'} 
              size={16 
            } color="#fff" />
            <Text style={s.resultText}>
              {isCorrect ? 'ถูกต้อง' : 'ผิด'} (คำตอบ: {item.orderWords.join(' ')})
            </Text>
          </View>
        )}
        {/* ปุ่มฟังเสียง — แสดงเมื่อตอบแล้ว (ทั้งตอบถูกและตอบผิด) วงกลมเส้นเขียว + ลำโพงเขียว */}
        {answered && (
          <TouchableOpacity
            style={s.replayBtn}
            onPress={() => speakEnglish(fullSentence, item.ttsVoice)}
            activeOpacity={0.7}
            accessibilityLabel="ฟังเสียงประโยค"
          >
            <Ionicons name="volume-high" size={22} color={PRIMARY} />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Available Words */}
      {!isLocked && (
        <View style={s.availableWords}>
          {availableWords.map((word, idx) => (
            <TouchableOpacity
              key={idx}
              style={s.wordChip}
              onPress={() => handleSelectWord(word, idx)}
            >
              <Text style={s.wordChipText}>{word}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      
      {/* Error feedback — ผิดครั้งแรก (ไม่เฉลย ยังเรียงใหม่ได้) */}
      {showWrong && (
        <Text style={s.wrongFeedbackText}>ไม่ถูกต้อง ลองใหม่อีกครั้ง</Text>
      )}

      {/* Submit Button */}
      {!isLocked && (
        <TouchableOpacity
          style={[s.submitBtn, { opacity: canSubmit ? 1 : 0.5 }]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={s.submitBtnText}>ตอบ</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Listen & Repeat Component (mode: listenRepeat)
// ผู้เรียนฟังเสียงประโยค → พูดตาม → ระบบตรวจเสียงจริง (Speech Recognition)
// พฤติกรรมเหมือนด่าน "ฟังและพูดตาม" ของหมวดคำศัพท์:
//   พูดถูก = 1 คะแนน / พูดผิด 2 ครั้ง หรือกดข้าม = 0 คะแนน
//   ปุ่ม "ข้ามด่านนี้" ใช้ได้ทุกสถานะ, รองรับ Web + Native, และ fallback แบบไม่ crash
// ══════════════════════════════════════════════════════════════════════════════
function ListenRepeatQuestion({ item, onAnswer, answered, isCorrect, questionIndex = 0, totalQuestions = 0 }) {
  const isLocked = !!answered;
  const fullSentence = getFullSentence(item);
  const sentenceTH = String(item.sentenceTH || '').trim();

  // ── Speech Recognition state (เหมือนด่าน "ฟังและพูดตาม" ของหมวดคำศัพท์) ──
  const [recStatus, setRecStatus] = useState('idle'); // idle | listening | processing | correct | wrong | unsupported
  const [wrongAttempts, setWrongAttempts] = useState(0); // พูดผิดกี่ครั้ง (ครบ 2 ครั้ง = 0 คะแนน)
  const [transcript, setTranscript] = useState('');
  const [engineError, setEngineError] = useState(null);
  const [canOpenSettings, setCanOpenSettings] = useState(false);
  const recognitionRef = useRef(null);
  const nativeCleanupRef = useRef(null);
  const recStatusRef = useRef(recStatus);
  const evaluateTimerRef = useRef(null);
  recStatusRef.current = recStatus;

  // ตรวจจับ engine ตามแพลตฟอร์ม: web → Web Speech API, native → expo-speech-recognition adapter
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

  // cleanup ตอนออกจากข้อ/หน้าจอ — หยุดรับเสียง + หยุด TTS + ยกเลิก timer
  useEffect(() => {
    return () => {
      clearTimeout(evaluateTimerRef.current);
      stopCurrent();
      stopSpeaking();
    };
  }, [stopCurrent]);

  // เล่นเสียงอัตโนมัติรอบแรกเมื่อเปิดข้อนี้ (ยังไม่ตอบ)
  useEffect(() => {
    if (!isLocked) speakEnglish(fullSentence, item.ttsVoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔊 ปุ่มเล่นเสียง — เล่น TTS อย่างเดียว ไม่เริ่มบันทึกเสียง
  const handleSpeak = () => {
    if (recStatus === 'listening' || recStatus === 'processing') return;
    stopCurrent();
    speakEnglish(fullSentence, item.ttsVoice);
  };

  // ประเมินผลหลังได้ยินเสียง → แจ้งคะแนนกลับ parent (ถูก = 1, ผิดครบ 2 ครั้ง = 0)
  const finishWithResult = (spoken) => {
    stopCurrent();
    setTranscript(spoken || '');
    setRecStatus('processing');
    clearTimeout(evaluateTimerRef.current);
    evaluateTimerRef.current = setTimeout(() => {
      const ok = verifySentenceSpeech(spoken, fullSentence);
      setRecStatus(ok ? 'correct' : 'wrong');
      if (ok) {
        onAnswer(fullSentence, { isCorrect: true });
      } else {
        const next = wrongAttempts + 1;
        setWrongAttempts(next);
        if (next >= 2) onAnswer(fullSentence, { isCorrect: false });
      }
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
            if (recStatusRef.current === 'listening') setRecStatus('wrong');
          },
          onResult: (spoken) => finishWithResult(spoken),
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

  const handleListen = async () => {
    // พูดถูกแล้ว หรือผิดครบ 2 ครั้ง → ไม่อนุญาตให้บันทึกเสียงซ้ำ
    if (wrongAttempts >= 2 || recStatus === 'correct') return;
    setEngineError(null);
    setTranscript('');
    setCanOpenSettings(false);

    // Expo Go / managed workflow: ไม่มี native speech module → แจ้งเตือนแบบไม่ crash
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

    // ต้องให้ TTS เงียบก่อนเริ่มรับเสียง (กันเสียงซ้อนกัน)
    stopSpeaking();
    clearTimeout(evaluateTimerRef.current);
    startListening();
  };

  // ปุ่มข้าม — ใช้ได้ทุกสถานะ (ยังไม่ตอบ) → 0 คะแนน
  const handleSkip = () => {
    clearTimeout(evaluateTimerRef.current);
    stopCurrent();
    stopSpeaking();
    onAnswer(fullSentence, { isCorrect: false });
  };

  const isListening = recStatus === 'listening';
  const isProcessing = recStatus === 'processing';
  const isBusy = isListening || isProcessing;
  const showUnsupported = recStatus === 'unsupported';
  // ปิดปุ่มไมค์เมื่อ: กำลังฟัง/ตรวจเสียง, พูดผิดครบ 2 ครั้ง, หรือตรวจว่าถูกแล้ว
  const micDisabled = isBusy || wrongAttempts >= 2 || recStatus === 'correct';

  return (
    <View style={s.speakWrap}>
      {/* หัวด่าน — ลอกเลย์เอาต์ด่าน "ฟังและพูดตาม" ของหมวดคำศัพท์ (รูป 2) */}
      <Text style={s.stageTitle}>ฟังและพูดตาม</Text>
      <Text style={s.stageSub}>🔊 ฟังเสียงประโยค แล้ว 🎤 พูดตาม • ข้ามได้</Text>

      {/* Dots ความคืบหน้า — ชี้ตำแหน่งข้อปัจจุบันของแบบฝึกหัด */}
      {totalQuestions > 0 && (
        <View style={s.dotsRow}>
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <View
              key={i}
              style={[s.dot, i < questionIndex && s.dotDone, i === questionIndex && s.dotActive]}
            />
          ))}
        </View>
      )}

      <View style={s.speakCard}>
        {/* วงกลมไมค์ขนาดใหญ่กลางการ์ด */}
        <View style={s.micCircle}>
          <Ionicons
            name={isListening ? 'mic' : isProcessing ? 'sync' : 'mic-outline'}
            size={40}
            color={isListening ? ERROR : PRIMARY}
          />
        </View>

        {/* ประโยค + ปุ่ม 🔊 เล่นเสียง (แยกจากปุ่ม 🎤 บันทึกเสียง) */}
        <View style={s.sentenceRow}>
          <Text style={s.sentenceBig}>{fullSentence}</Text>
          <TouchableOpacity
            style={[s.speakerBtn, isBusy && s.disabledOpacity]}
            onPress={handleSpeak}
            disabled={isBusy}
            activeOpacity={0.8}
            accessibilityLabel="ฟังเสียงประโยคซ้ำ"
          >
            <Ionicons name="volume-high" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        {sentenceTH ? <Text style={s.sentenceTHSpeak}>{sentenceTH}</Text> : null}

        {/* ── ส่วนตรวจเสียง (แสดงเฉพาะตอนยังไม่ตอบ) ── */}
        {!isLocked && (
          <View style={s.speakBody}>
          {showUnsupported && (
            <View style={s.unsupportedBox}>
              <Text style={s.unsupportedText}>
                {engineError || 'ไม่รองรับ Speech Recognition'}
                {'\n'}กด "ข้ามด่านนี้" เพื่อดำเนินการต่อ
              </Text>
              {canOpenSettings && (
                <TouchableOpacity style={s.settingsBtn} onPress={openAppSettings}>
                  <Text style={s.settingsBtnText}>⚙️ เปิดหน้าการตั้งค่า</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {recStatus === 'listening' && (
            <Text style={s.listeningText}>🎤 กำลังฟัง... พูดประโยคได้เลย</Text>
          )}
          {recStatus === 'processing' && (
            <Text style={s.processingText}>⏳ กำลังตรวจสอบเสียง...</Text>
          )}
          {recStatus === 'correct' && (
            <View style={s.inlineResultBox}>
              <Ionicons name="checkmark-circle" size={22} color={SUCCESS} />
              <Text style={[s.inlineResultText, { color: SUCCESS }]}>ถูกต้อง 🎉</Text>
            </View>
          )}
          {recStatus === 'wrong' && (
            <View style={s.inlineResultBox}>
              <Ionicons name="close-circle" size={22} color={ERROR} />
              <Text style={[s.inlineResultText, { color: ERROR }]}>ไม่ถูกต้อง</Text>
            </View>
          )}
          {recStatus === 'wrong' && (
            <Text style={s.transcriptText}>
              ได้ยินเป็น: “{transcript || '— ไม่ได้ยินเสียง —'}”{'\n'}ลองพูดอีกครั้ง
            </Text>
          )}

          {/* ปุ่ม 🎤 หลัก — บันทึกเสียง แล้วประเมินอัตโนมัติ */}
          <TouchableOpacity
            style={[s.listenBtn, micDisabled && s.disabledOpacity]}
            onPress={handleListen}
            disabled={micDisabled}
            activeOpacity={0.8}
          >
            <Ionicons name={isBusy ? 'hourglass-outline' : 'mic'} size={18} color="#fff" />
            <Text style={s.listenBtnText}>
              {isProcessing
                ? 'กำลังตรวจสอบ...'
                : isListening
                  ? 'กำลังฟัง...'
                  : 'กดเพื่อพูด'}
            </Text>
          </TouchableOpacity>

          {/* ข้ามด่านนี้: ใช้ได้ทุกสถานะ จนกว่าจะพูดถูกหรือผิดครบ 2 ครั้ง */}
          {recStatus !== 'correct' && wrongAttempts < 2 && (
            <TouchableOpacity style={s.skipOutlineBtn} onPress={handleSkip} activeOpacity={0.8}>
              <Text style={s.skipOutlineText}>ข้ามด่านนี้</Text>
            </TouchableOpacity>
          )}
          </View>
        )}

        {/* ผลลัพธ์หลังตอบแล้ว — ถูก = 1 คะแนน, ผิด/ข้าม = 0 คะแนน */}
        {isLocked && (
          <View style={[s.resultBadge, { backgroundColor: isCorrect ? SUCCESS : ERROR }]}>
            <Ionicons name={isCorrect ? 'checkmark-circle' : 'close-circle'} size={18} color="#fff" />
            <Text style={[s.resultText, s.listenResultText]}>
              {isCorrect ? 'ถูกต้อง 🎉' : `ไม่ผ่าน — ประโยคที่ถูกต้อง: ${fullSentence}`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Result Summary Screen
// ══════════════════════════════════════════════════════════════════════════════
function ResultSummary({ score, total, timeSpent, passed, onRetry, onGoList, onGoStats }) {
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const minutes = Math.floor(timeSpent / 60);
  const seconds = timeSpent % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, '0')}`;
  const statusColor = passed ? SUCCESS : ERROR;
  const [userName, setUserName] = useState(auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || '');
    useEffect(() => {
      (async () => {
        const profile = await getUserProfile(auth.currentUser?.uid);
        if (profile?.username) setUserName(profile.username);
      })();
    },[]);

  return (
    <View style={s.resultContainer}>
      <View style={s.resultCard}>
        {/* ถ้วยรางวัลสีทอง — แสดงทุกครั้งไม่ว่าผลจะผ่านหรือไม่ (ตามดีไซน์ระบบ) */}
        <View style={s.resultIcon}>
          <Ionicons name="trophy" size={56} color="#FFD700" />
        </View>

        <Text style={s.resultTitle}>
          {passed ? userName + ' ยอดเยี่ยมมาก! 🎉' : userName + ' พยายามอีกนิด!'}
        </Text>

        <Text style={s.scoreText}>
          {score} / {total} ข้อ
        </Text>

        <Text style={[s.scorePercentage, { color: statusColor }]}>
          {percentage}%
        </Text>

        <View style={s.resultStats}>
          <View style={s.statItem}>
            <Ionicons name="time-outline" size={24} color={PRIMARY} />
            <Text style={s.statLabel}>เวลาที่ใช้</Text>
            <Text style={s.statValue}>{timeStr}</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Ionicons
              name={passed ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={statusColor}
            />
            <Text style={s.statLabel}>สถานะ</Text>
            <Text style={[s.statValue, { color: statusColor }]}>
              {passed ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่าน'}
            </Text>
          </View>
        </View>

        <Text style={s.resultNote}>
          {passed
            ? 'คุณผ่านเกณฑ์ 80% แล้ว! ยอดเยี่ยมมาก 🎉'
            : 'ต้องได้ 80% ขึ้นไปเพื่อผ่านเกณฑ์'
          }
        </Text>

        {/* เริ่มทำใหม่ — รอบใหม่สุ่มลำดับข้อ/ตัวเลือกใหม่ทั้งหมด (in-memory ไม่แตะ DB) */}
        <TouchableOpacity style={s.tryAgainBtn} onPress={onRetry} activeOpacity={0.8}>
          <Text style={s.tryAgainBtnText}>ลองทำอีกครั้ง</Text>
        </TouchableOpacity>

        <View style={s.resultButtons}>
          <TouchableOpacity style={s.retryBtn} onPress={onGoList} activeOpacity={0.8}>
            <Text style={s.retryBtnText}>รายการแบบฝึกหัด</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.backBtn} onPress={onGoStats} activeOpacity={0.8}>
            <Text style={s.backBtnText}>ดูสถิติ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export default function TenseExerciseScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { exercise } = route.params;

  const [loading, setLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [timeSpent, setTimeSpent] = useState(0);
  
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [attempts, setAttempts] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  // ตัวแปรติดตามว่าผู้ใช้ยืนยันออกจากแบบฝึกหัดแล้ว เพื่อให้ navigation ผ่าน beforeRemove ได้
  const exitConfirmedRef = useRef(false);
  // action ที่ถูกกันไว้ (ยังไม่ได้ dispatch) — ใช้ตอนผู้ใช้กดยืนยันในกล่อง ConfirmModal
  const pendingExitActionRef = useRef(null);
  const [exitModalVisible, setExitModalVisible] = useState(false); // แสดง/ซ่อนกล่องยืนยันก่อนออก


  // เตรียมข้อสอบสำหรับ 1 รอบการทำ — สุ่มลำดับข้อใหม่ทุกครั้ง (Fisher–Yates, in-memory)
  // questionNum ถูก assign หลังสุ่ม (1..N ตามลำดับใหม่) → answers/attempts/progress/ผลสอบ
  // ที่อ้าง questionNum ยังสอดคล้องกันครบ ไม่กระทบการคิดคะแนนและไม่แตะ exercise.items ต้นฉบับ
  const prepareQuestions = useCallback((items) => {
    const rawItems = Array.isArray(items) ? items : [];
    // กรองเฉพาะโจทย์ที่สมบูรณ์ (ป้องกันชุดข้อมูลผิดพลาดทำให้หน้าจอพัง)
    const validItems = shuffle(rawItems.filter(isValidTenseItem));

    return validItems.map((item, idx) => {
      const questionNum = idx + 1;
      // โหมดมาจาก item.mode ที่ผู้ดูแลตั้งในแอดมิน → ตรงกับฟอร์มแก้ไขเสมอ
      // (ชุดเก่าที่ไม่มี mode → derive ใน resolveTenseUserMode)
      const mode = resolveTenseUserMode(item);
      return { ...item, questionNum, mode };
    });
  }, []);

  useEffect(() => {
    setQuestions(prepareQuestions(exercise?.items));
    setStartTime(Date.now());
    setLoading(false);
  }, [exercise, prepareQuestions]);

  useEffect(() => {
    if (!startTime || showResult) return;
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, showResult]);

  // ── ดักจับการออกจากแบบฝึกหัด (header back / hardware back / iOS swipe) ──
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // โหลดอยู่ หรือทำเสร็จแล้ว หรือยืนยันออกแล้ว → ปล่อย navigate ได้ตามปกติ
      if (loading || showResult || exitConfirmedRef.current) return;

      // ยังทำแบบฝึกหัดอยู่ → กันการออก + ถามยืนยัน
      e.preventDefault();

      // เก็บ action ไว้ก่อน แล้วเปิดกล่องยืนยัน — ถ้ายืนยันค่อย dispatch เอง
      // (ต้องทำแบบนี้เพราะ listener เป็น sync ไม่สามารถรอผู้ใช้กดปุ่มใน Alert ได้)
      pendingExitActionRef.current = e.data.action;
      setExitModalVisible(true);
    });

    return unsubscribe;
  }, [navigation, loading, showResult]);

  // กด "ออกจากแบบฝึกหัด" ในกล่องยืนยัน → ปล่อย navigation ที่กันไว้
  const confirmExit = useCallback(() => {
    const action = pendingExitActionRef.current;
    exitConfirmedRef.current = true;
    setExitModalVisible(false);
    pendingExitActionRef.current = null;
    if (action) navigation.dispatch(action);
  }, [navigation]);

  // กด "ยกเลิก" / กด overlay → ปิดกล่อง อยู่ต่อในแบบฝึกหัด (navigation ถูก prevent ไว้อยู่แล้ว)
  const cancelExit = useCallback(() => {
    pendingExitActionRef.current = null;
    setExitModalVisible(false);
  }, []);

  const handleAnswer = useCallback((questionNum, answer, isCorrectOverride) => {
    const question = questions.find(q => q.questionNum === questionNum);
    if (!question) return;

    // โหมด "ฟังและพูดตาม": ด่านตรวจเสียงประเมินผลแล้ว → บันทึกคะแนนตรง ๆ
    // (ข้าม attempts 2 ครั้งของ parent เพราะด่านนับจำนวนครั้งที่พูดผิดเองอยู่แล้ว)
    if (typeof isCorrectOverride === 'boolean') {
      setAnswers(prev => ({
        ...prev,
        [questionNum]: { answer, isCorrect: isCorrectOverride },
      }));
      if (isCorrectOverride) {
        // 🔊 อ่านประโยคเต็มเมื่อผ่าน (ให้ผู้เรียนได้ยินประโยคที่ถูกต้องอีกครั้ง)
        speakEnglish(getFullSentence(question), question.ttsVoice);
      }
      return;
    }

    let isCorrect = false;
    if (question.mode === TENSE_UI_MODE.FILL_BLANK) {
      isCorrect = answer === question.answer;
    } else if (question.mode === TENSE_UI_MODE.REORDER) {
      const orderWords = Array.isArray(question.orderWords) ? question.orderWords : [];
      isCorrect = answer === orderWords.join(' ');
    } else if (question.mode === TENSE_UI_MODE.LISTEN_REPEAT) {
      // ฟังและพูดตาม: ปกติผลตรวจเสียงจะส่งผ่าน isCorrectOverride ด้านบนแล้ว
      // (branch นี้เป็น fallback เผื่อผู้เรียกไม่ส่ง override → ถือว่าผ่าน)
      isCorrect = true;
    }

    if (isCorrect) {
      setAnswers(prev => ({
        ...prev,
        [questionNum]: { answer, isCorrect: true }
      }));
      // 🔊 อ่านประโยคเต็มเมื่อตอบถูก
      speakEnglish(getFullSentence(question), question.ttsVoice);
      return;
    }

    const nextAttempt = (attempts[questionNum] || 0) + 1;
    setAttempts(prev => ({ ...prev, [questionNum]: nextAttempt }));

    if (nextAttempt === 1) {
      Alert.alert('ลองอีกครั้ง', 'ไม่ถูกต้อง ลองใหม่อีกครั้ง');
      return;
    }

    setAnswers(prev => ({
      ...prev,
      [questionNum]: { answer, isCorrect: false }
    }));
  }, [questions, attempts]);

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = useCallback(async () => {
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      Alert.alert('ยังทำไม่ครบ', `ตอบไปแล้ว ${answeredCount}/${questions.length} ข้อ`);
      return;
    }

    const score = Object.values(answers).filter(a => a.isCorrect).length;
    const passed = (score / questions.length) * 100 >= 80;
    
    try {
      const userEmail = auth.currentUser?.email ?? '';
      await saveStatistic(userEmail, exercise.id, {
        score,
        totalQuestions: questions.length,
        timeSpent,
        category: exercise.category,
      });
    } catch (err) {
      console.error('Error saving statistic:', err);
    }

    setShowResult(true);
  }, [answers, questions, exercise, timeSpent]);

  // ── ตอบข้อสุดท้ายเสร็จ → ไปหน้าผลลัพธ์อัตโนมัติ (ไม่ต้องกดปุ่ม) ──
  //  - หน่วง AUTO_FINISH_DELAY_MS เพื่อให้เห็นผลของข้อสุดท้ายก่อนสลับหน้า
  //  - ใช้ ref ชี้ handleFinish ตัวล่าสุด เพื่อไม่ให้ effect ถูกรีสตาร์ททุกวินาที (timeSpent เปลี่ยน)
  const handleFinishRef = useRef(handleFinish);
  handleFinishRef.current = handleFinish;
  const finishTriggeredRef = useRef(false);
  useEffect(() => {
    if (loading || showResult || finishTriggeredRef.current) return;
    if (questions.length === 0) return;
    if (Object.keys(answers).length < questions.length) return;

    finishTriggeredRef.current = true;
    const timer = setTimeout(() => { handleFinishRef.current(); }, AUTO_FINISH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [answers, questions.length, loading, showResult]);

  const handleGoList = () => {
    navigation.goBack();
  };

  const handleGoStats = () => {
    navigation.navigate('Stats');
  };

  // ── เริ่มทำใหม่: ล้างผลรอบเก่า + สุ่มลำดับข้อใหม่ (ตัวเลือกสุ่มใหม่ตอน component แต่ละข้อ mount) ──
  const handleRetry = useCallback(() => {
    setAnswers({});
    setAttempts({});
    setCurrentQuestionIndex(0);
    setTimeSpent(0);
    setStartTime(Date.now());
    finishTriggeredRef.current = false; // รีเซ็ต ไม่งั้น auto-finish รอบใหม่ไม่ทำงาน
    setShowResult(false);
    setQuestions(prepareQuestions(exercise?.items));
    window.scrollTo?.(0, 0);
  }, [exercise, prepareQuestions]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
        <View style={s.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={s.loadingText}>กำลังโหลด...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showResult) {
    const score = Object.values(answers).filter(a => a.isCorrect).length;
    const passed = (score / questions.length) * 100 >= 80;
    
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
        <ResultSummary
          score={score}
          total={questions.length}
          timeSpent={timeSpent}
          passed={passed}
          onRetry={handleRetry}
          onGoList={handleGoList}
          onGoStats={handleGoStats}
        />
      </SafeAreaView>
    );
  }

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === questions.length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{exercise.title}</Text>
          <Text style={s.headerSub}>
            ด่านที่ {currentQuestionIndex + 1}/{questions.length} · {Math.floor(timeSpent / 60)}:{String(timeSpent % 60).padStart(2, '0')}
          </Text>
        </View>
        <View style={s.headerRight}>
          <SpeechSpeedToggle color="#fff" background="rgba(255,255,255,0.22)" />
          <SoundToggle color="#fff" background="rgba(255,255,255,0.22)" />
          <View style={s.headerBtn}>
            <Ionicons name="time-outline" size={24} color="#fff" />
          </View>
        </View>
      </View>

      {/* Current Question */}
      <ResponsiveContainer variant="exercise" style={{ flexGrow: 1, paddingHorizontal: 0 }}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        {questions.length > 0 && (() => {
          const q = questions[currentQuestionIndex];
          const answerData = answers[q.questionNum];
          const answered = answerData?.answer;
          const isCorrect = answerData?.isCorrect;
          const wrongAttempts = attempts[q.questionNum] || 0;

          if (q.mode === TENSE_UI_MODE.FILL_BLANK) {
            return (
              <MultipleChoiceQuestion
                key={q.questionNum}
                item={q}
                onAnswer={(ans) => handleAnswer(q.questionNum, ans)}
                answered={answered}
                isCorrect={isCorrect}
                wrongAttempts={wrongAttempts}
              />
            );
          } else if (q.mode === TENSE_UI_MODE.LISTEN_REPEAT) {
            return (
              <ListenRepeatQuestion
                key={q.questionNum}
                item={q}
                onAnswer={(ans, meta) => handleAnswer(q.questionNum, ans, meta?.isCorrect)}
                answered={answered}
                isCorrect={isCorrect}
                questionIndex={currentQuestionIndex}
                totalQuestions={questions.length}
              />
            );
          } else {
            return (
              <WordOrderingQuestion
                key={q.questionNum}
                item={q}
                onAnswer={(ans) => handleAnswer(q.questionNum, ans)}
                answered={answered}
                isCorrect={isCorrect}
                wrongAttempts={wrongAttempts}
              />
            );
          }
        })()}
      </ScrollView>
      </ResponsiveContainer>

      {/* Next Button — ซ่อนที่ข้อสุดท้าย เพราะระบบพาไปหน้าผลลัพธ์อัตโนมัติ */}
      {answers[questions[currentQuestionIndex]?.questionNum] && currentQuestionIndex < questions.length - 1 && (
        <View style={s.footer}>
          <TouchableOpacity
            style={s.nextBtn}
            onPress={handleNextQuestion}
          >
            <Text style={s.nextBtnText}>ด่านถัดไป →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* กล่องยืนยันก่อนออกจากแบบฝึกหัด — โทนสีหลักของหน้าอัตรานเวลา */}
      <ConfirmModal
        visible={exitModalVisible}
        title={EXERCISE_EXIT_TEXTS.title}
        message={EXERCISE_EXIT_TEXTS.message}
        confirmText={EXERCISE_EXIT_TEXTS.confirm}
        cancelText={EXERCISE_EXIT_TEXTS.cancel}
        accentColor={PRIMARY}
        onConfirm={confirmExit}
        onCancel={cancelExit}
        testID="tense-exit-confirm"
      />
    </SafeAreaView>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════════════════════
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6FF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerBtn: {
    width: 40, height: 40,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  // Scroll (เปลี่ยนเป็น ScrollView เพื่อรองรับด่าน "ฟังและพูดตาม" ที่มีเนื้อหาสูงกว่าโหมดอื่น)
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 96 },

  // Question Container
  questionContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
  },

  // Tense Badge
  tenseBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  tenseBadgeText: {
    fontSize: 12, fontWeight: 'bold', color: '#fff',
  },

  questionLabel: {
    fontSize: 14, fontWeight: '700', color: PRIMARY, marginBottom: 12,
  },

  // Instruction Card (แทนที่ Example Card เดิม)
  instructionCard: {
    backgroundColor: '#F0F9F1',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E0F2E2',
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  instructionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    fontWeight: '500',
  },

  // Question Card (โจทย์หลัก: ตัวใหญ่ชัดเจน ดูง่าย / คำแปลอยู่ด้านล่าง)
  questionCard: {
    backgroundColor: '#FFFDF0',
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFE082',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sentence: {
    fontSize: 21,
    fontWeight: '500',
    color: '#1A1A2E',
    lineHeight: 30,
    letterSpacing: 0.3,
  },
  sentenceTH: {
    fontSize: 15,
    fontWeight: 'normal',
    color: '#777',
    marginTop: 10,
    lineHeight: 22,
  },
  sentenceTHOrderMode: {
    fontSize: 19,
    fontWeight: '500',
    color: '#1A1A2E',
    lineHeight: 28,
  },

  // Options (Multiple Choice) - Grid 2x2
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  optionBtn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '48%',
    minHeight: 60,
  },
  optionText: {
    fontSize: 15, fontWeight: '600', color: '#333',
  },
  optionIcon: {
    marginLeft: 8,
  },

  // Answer Area (Word Ordering)
  answerArea: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    padding: 12,
    minHeight: 60,
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 14, color: '#999', textAlign: 'center',
  },
  selectedWordsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wordChip: {
    backgroundColor: '#EEF0FF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wordChipText: {
    fontSize: 15, fontWeight: '600', color: '#333',
  },
  wordChipIcon: {
    marginLeft: 4,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 8,
    marginTop: 8,
  },
  resultText: {
    fontSize: 14, fontWeight: '600', color: '#fff',
  },
  wrongFeedbackText: {
    fontSize: 13, fontWeight: '600', color: ERROR, textAlign: 'center', marginTop: 12,
  },
  // ปุ่มเล่นเสียงประโยค — วงกลมเส้นสีเขียว พื้นหลังขาว ลำโพงสีเขียว
  replayBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },

  // Available Words
  availableWords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },

  // Submit Button
  submitBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    fontSize: 15, fontWeight: 'bold', color: '#fff',
  },

  // Skip Button (ใช้ในโหมด Listen & Repeat — ข้ามได้โดยไม่มีคำตอบผิด)
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  skipBtnText: {
    fontSize: 14, fontWeight: '600', color: '#888',
  },

  // ── Listen & Repeat: Speech Recognition (เหมือนด่าน "ฟังและพูดตาม" ของหมวดคำศัพท์) ──
  // ── เลย์เอาต์ด่าน "ฟังและพูดตาม" (แบบเดียวกับหมวดคำศัพท์) ──
  speakWrap: {
    marginBottom: 8,
  },
  stageTitle: {
    fontSize: 18, fontWeight: '700', color: '#1A1A2E', textAlign: 'center', marginBottom: 4,
  },
  stageSub: {
    fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 12,
  },
  dotsRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#ddd',
  },
  dotDone: {
    backgroundColor: '#B8E6C2',
  },
  dotActive: {
    backgroundColor: PRIMARY, width: 20,
  },
  speakCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  micCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#E8F9ED',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  sentenceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, marginBottom: 6, flexWrap: 'wrap',
  },
  sentenceBig: {
    fontSize: 24, fontWeight: '900', color: '#000', textAlign: 'center',
  },
  sentenceTHSpeak: {
    fontSize: 16, color: '#666', marginBottom: 16, textAlign: 'center',
  },
  speakerBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PRIMARY,
    justifyContent: 'center', alignItems: 'center',
    elevation: 2, shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
  speakBody: {
    alignItems: 'center', width: '100%',
  },
  skipOutlineBtn: {
    borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 20, marginTop: 4,
  },
  skipOutlineText: {
    fontSize: 14, color: '#666',
  },
  disabledOpacity: {
    opacity: 0.5,
  },
  listenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginTop: 12,
  },
  listenBtnText: {
    fontSize: 16, fontWeight: 'bold', color: '#fff',
  },
  listeningText: {
    fontSize: 13, fontWeight: '600', color: ERROR, textAlign: 'center', marginTop: 12,
  },
  processingText: {
    fontSize: 13, fontWeight: '600', color: '#888', textAlign: 'center', marginTop: 12,
  },
  inlineResultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  inlineResultText: {
    fontSize: 15, fontWeight: '700',
  },
  transcriptText: {
    fontSize: 13, color: '#666', textAlign: 'center', marginTop: 6, lineHeight: 20,
  },
  unsupportedBox: {
    alignItems: 'center', marginTop: 12,
  },
  unsupportedText: {
    fontSize: 13, color: ERROR, textAlign: 'center', lineHeight: 20,
  },
  settingsBtn: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E8F9ED',
    borderRadius: 8,
  },
  settingsBtnText: {
    fontSize: 12, fontWeight: '600', color: PRIMARY,
  },
  listenResultText: {
    flexShrink: 1, textAlign: 'center',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  finishBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  finishBtnText: {
    fontSize: 16, fontWeight: 'bold', color: '#fff',
  },

  // Next Button
  nextBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    margin: 16,
    marginTop: 0,
  },
  nextBtnText: {
    fontSize: 16, fontWeight: 'bold', color: '#fff',
  },

  // Result Screen
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  resultIcon: {
    width: 100, height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF8E1', // วงกลมทองอ่อน รองรับไอคอนถ้วยรางวัลสีทอง
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 18,
  },
  resultTitle: {
    fontSize: 22, fontWeight: 'bold', color: '#1A1A2E',
    marginBottom: 10,
  },
  scoreText: {
    fontSize: 40, fontWeight: 'bold', color: '#1A1A2E',
    marginBottom: 2,
  },
  scorePercentage: {
    fontSize: 26, fontWeight: '700', color: '#666',
    marginBottom: 22,
  },
  resultStats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    backgroundColor: '#F7F8FC',
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E4E6EF',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 12, color: '#666', marginTop: 4,
  },
  statValue: {
    fontSize: 16, fontWeight: 'bold', color: '#1A1A2E', marginTop: 2,
  },
  resultNote: {
    fontSize: 14, color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  resultButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  retryBtn: {
    flex: 1,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
  },
  retryBtnText: {
    fontSize: 15, fontWeight: 'bold', color: '#fff',
  },
  backBtn: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 15, fontWeight: 'bold', color: '#333',
  },
  // ปุ่ม "🔁 เริ่มทำใหม่" (full-width ด้านบนแถวปุ่มผลลัพธ์) — กดแล้วเริ่มรอบใหม่พร้อมสุ่มข้อ/คำตอบใหม่
  tryAgainBtn: {
    width: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
  },
  tryAgainBtnText: {
    fontSize: 15, fontWeight: 'bold', color: '#fff',
  },
});
