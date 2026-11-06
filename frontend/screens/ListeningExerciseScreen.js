// frontend/screens/ListeningExerciseScreen.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  ActivityIndicator, ScrollView, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { auth } from '../firebase';
import { saveStatistic } from '../services/firestoreService';
import { speakEnglish } from '../services/ttsService';
import SpeechSpeedToggle from '../components/SpeechSpeedToggle';
import SoundToggle from '../components/SoundToggle';
import ResponsiveContainer from '../components/ResponsiveContainer';
import ConfirmModal, { EXERCISE_EXIT_TEXTS } from '../components/ConfirmModal';

const PRIMARY = '#FF9500';
const SUCCESS = '#34C759';
const ERROR = '#FF3B30';

// สุ่มลำดับคำถามในชุดแบบฝึกหัด (Fisher–Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// แปลงคำถามให้อยู่ในรูปเดียว: { question, choices, answer }
// รองรับทั้ง schema ใหม่ (prompt/options/correctIndex) และ schema เก่า (question/choices/answer)
function normalizeListeningQuestion(q) {
  if (!q) return { question: '', choices: [], answer: '' };
  const choices = Array.isArray(q.options)
    ? q.options.filter(Boolean)
    : (Array.isArray(q.choices) ? q.choices.filter(Boolean) : []);
  let answer = q.answer;
  if ((answer === undefined || answer === null || answer === '') && typeof q.correctIndex === 'number') {
    answer = choices[q.correctIndex];
  }
  return { question: q.prompt || q.question || '', choices, answer: answer || '' };
}

// สร้างชุดข้อสอบ 1 ข้อ = 1 บทสนทนา (dialogues[]) + คำถามของบทสนทนานั้น
// รองรับข้อมูลเก่า: dialogue[] (ชุดเดียว) + questions[] (หลายข้อ) → บทสนทนาเดิม × จำนวนคำถาม
function buildListeningItems(exercise) {
  const nameA = exercise.speakerA?.name || 'A';
  const nameB = exercise.speakerB?.name || 'B';
  const mapLine = (l) => {
    const isB = l && l.speaker === 'B';
    const speakerKey = isB ? 'B' : 'A';
    return {
      side: speakerKey === 'B' ? 'right' : 'left',
      speakerKey,
      speaker: speakerKey === 'B' ? nameB : nameA,
      text: (l && l.text) || '',
    };
  };

  if (Array.isArray(exercise.dialogues) && exercise.dialogues.length > 0) {
    return exercise.dialogues.map((d) => ({
      lines: Array.isArray(d.lines) ? d.lines.map(mapLine) : [],
      question: normalizeListeningQuestion(d.question),
    }));
  }

  // ── fallback: ข้อมูลเก่า (flat schema) ──
  const legacyLines = Array.isArray(exercise.dialogue) ? exercise.dialogue.map(mapLine) : [];
  const legacyQs = Array.isArray(exercise.questions) && exercise.questions.length
    ? exercise.questions
    : [{ prompt: '', options: [], correctIndex: 0 }];
  return legacyQs.map((q) => ({ lines: legacyLines, question: normalizeListeningQuestion(q) }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Dialogue Bubble Component
// ══════════════════════════════════════════════════════════════════════════════
function DialogueBubble({ item, voice }) {
  const isLeft = item.side === 'left';
  
  return (
    <View style={[s.dialogueRow, { justifyContent: isLeft ? 'flex-start' : 'flex-end' }]}>
      {!isLeft && <Text style={s.speakerName}>{item.speaker}</Text>}
      <View style={[s.bubble, { 
        backgroundColor: isLeft ? '#E8F5E9' : '#EEF0FF',
        borderTopLeftRadius: isLeft ? 4 : 20,
        borderTopRightRadius: isLeft ? 20 : 4,
      }]}>
        <Text style={s.bubbleText}>{item.text}</Text>
        <TouchableOpacity onPress={() => speakEnglish(item.text, voice)} style={s.bubbleSpeaker}>
          <Ionicons name="volume-high-outline" size={14} color="#888" />
        </TouchableOpacity>
      </View>
      {isLeft && <Text style={s.speakerName}>{item.speaker}</Text>}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Question Component (Multiple Choice)
// ══════════════════════════════════════════════════════════════════════════════
function QuestionItem({ item, questionNum, selected, evaluated, isCorrect, onSelect }) {
  // สุ่มลำดับตัวเลือก (Fisher-Yates) — non-mutating, ตรวจคะแนนแบบ value-based จึงปลอดภัย
  const [options] = useState(() => shuffle(item.choices));

  return (
    <View style={s.questionContainer}>
      <Text style={s.questionLabel}>คำถามที่ {questionNum}</Text>
      <Text style={s.questionText}>{item.question}</Text>

      <View style={s.optionsList}>
        {options.map((opt, idx) => {
          const isSelected = selected === opt;
          const isCorrectChoice = evaluated && opt === item.answer;
          const isWrongChoice = evaluated && isSelected && opt !== item.answer;

          let bgColor = '#fff';
          let textColor = '#333';
          let borderColor = '#E0E0E0';

          if (evaluated) {
            if (isCorrectChoice) {
              bgColor = SUCCESS; textColor = '#fff'; borderColor = SUCCESS;
            } else if (isWrongChoice) {
              bgColor = ERROR; textColor = '#fff'; borderColor = ERROR;
            } else {
              bgColor = '#F5F5F5';
            }
          } else if (isSelected) {
            bgColor = '#FFF3E0';
            textColor = '#1A1A2E';
            borderColor = PRIMARY;
          }

          return (
            <TouchableOpacity
              key={idx}
              style={[s.optionBtn, { backgroundColor: bgColor, borderColor }]}
              onPress={() => !evaluated && onSelect(opt)}
              disabled={evaluated}
              activeOpacity={0.7}
            >
              <Text style={[s.optionText, { color: textColor }]}>{opt}</Text>
              {isCorrectChoice && (
                <Ionicons name="checkmark-circle" size={20} color="#fff" style={s.optionIcon} />
              )}
              {isWrongChoice && (
                <Ionicons name="close-circle" size={20} color="#fff" style={s.optionIcon} />
              )}
            </TouchableOpacity>
          );
        })}
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

  return (
    <View style={s.resultContainer}>
      <View style={s.resultCard}>
        {/* ถ้วยรางวัลสีทอง — แสดงทุกครั้งไม่ว่าผลจะผ่านหรือไม่ (ตามดีไซน์ระบบ) */}
        <View style={s.resultIcon}>
          <Ionicons name="trophy" size={56} color="#FFD700" />
        </View>

        <Text style={s.resultTitle}>
          {passed ? 'ยอดเยี่ยมมาก! 🎉' : 'พยายามอีกนิด!'}
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
          <Text style={s.tryAgainBtnText}>เริ่มทำใหม่</Text>
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
export default function ListeningExerciseScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { exercise } = route.params;

  // 🔊 เพศเสียงตามผู้พูด: A → speakerA.ttsVoice, B → speakerB.ttsVoice
  // (ผู้พูดไม่ระบุ/ชุดเก่าไม่มีค่า → '' = โทนปกติของเครื่อง ไม่ crash)
  const speakerVoice = (sp) => (sp === 'B' ? exercise.speakerB?.ttsVoice : exercise.speakerA?.ttsVoice) || '';

  const [loading, setLoading] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [timeSpent, setTimeSpent] = useState(0);

  // สร้างชุดข้อสอบ (1 ข้อ = 1 บทสนทนา + คำถามของบทสนทนานั้น) แล้วสุ่มลำดับข้อ
  // (มี setter เพื่อให้ปุ่ม "เริ่มทำใหม่" สุ่มข้อใหม่ได้รอบ 2 — in-memory ไม่แตะ exercise)
  const [items, setItems] = useState(() => shuffle(buildListeningItems(exercise)));
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answers, setAnswers] = useState({});

  // ตัวแปรติดตามว่าผู้ใช้ยืนยันออกจากแบบฝึกหัดแล้ว เพื่อให้ navigation ผ่าน beforeRemove ได้
  const exitConfirmedRef = useRef(false);
  // action ที่ถูกกันไว้ (ยังไม่ได้ dispatch) — ใช้ตอนผู้ใช้กดยืนยันในกล่อง ConfirmModal
  const pendingExitActionRef = useRef(null);
  const [exitModalVisible, setExitModalVisible] = useState(false); // แสดง/ซ่อนกล่องยืนยันก่อนออก

  useEffect(() => {
    setStartTime(Date.now());
    setLoading(false);
  }, [exercise]);

  // ดักจับการออกจากแบบฝึกหัด (header back / hardware back / iOS swipe)
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

  useEffect(() => {
    if (!startTime || showResult) return;
    const interval = setInterval(() => {
      setTimeSpent(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, showResult]);

  // เลือกตัวเลือก (ยังไม่เฉลย)
  const handleSelect = (option) => {
    setSelectedAnswer(option);
  };

  // ตรวจคำตอบของข้อปัจจุบัน (ประเมิน + แสดงเฉลย)
  const handleConfirm = () => {
    if (!selectedAnswer) return;
    const currentItem = items[currentQuestionIndex];
    const question = currentItem && currentItem.question;
    if (!question) return;

    const isCorrect = selectedAnswer === question.answer;
    const questionNum = currentQuestionIndex + 1;
    setAnswers(prev => ({
      ...prev,
      [questionNum]: { answer: selectedAnswer, isCorrect }
    }));
  };

  // ไปข้อถัดไป (หรือจบเมื่อถึงข้อสุดท้าย)
  const handleNext = () => {
    if (currentQuestionIndex < items.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
    } else {
      handleFinish();
    }
  };

  const handleFinish = useCallback(async () => {
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < items.length) {
      Alert.alert('ยังทำไม่ครบ', `ตอบไปแล้ว ${answeredCount}/${items.length} ข้อ`);
      return;
    }

    const score = Object.values(answers).filter(a => a.isCorrect).length;
    const passed = (score / items.length) * 100 >= 80;
    
    try {
      const userEmail = auth.currentUser?.email ?? '';
      await saveStatistic(userEmail, exercise.id, {
        score,
        totalQuestions: items.length,
        timeSpent,
        category: exercise.category,
      });
    } catch (err) {
      console.error('Error saving statistic:', err);
    }

    setShowResult(true);
  }, [answers, items, exercise, timeSpent]);

  const handleGoList = () => {
    navigation.goBack();
  };

  const handleGoStats = () => {
    navigation.navigate('Stats');
  };

  // ── เริ่มทำใหม่: ล้างผลรอบเก่า + สุ่มลำดับข้อใหม่ (ตัวเลือกสุ่มใหม่ตอน QuestionItem mount) ──
  const handleRetry = useCallback(() => {
    setAnswers({});
    setSelectedAnswer(null);
    setCurrentQuestionIndex(0);
    setTimeSpent(0);
    setStartTime(Date.now());
    setShowResult(false);
    setItems(shuffle(buildListeningItems(exercise))); // Re-shuffle โจทย์รอบใหม่
    window.scrollTo?.(0, 0);
  }, [exercise]);

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
    const passed = (score / items.length) * 100 >= 80;
    
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
        <ResultSummary
          score={score}
          total={items.length}
          timeSpent={timeSpent}
          passed={passed}
          onRetry={handleRetry}
          onGoList={handleGoList}
          onGoStats={handleGoStats}
        />
      </SafeAreaView>
    );
  }

  // Step-by-step: Dialogue (top) + Active Question (bottom)
  const currentItem = items[currentQuestionIndex];
  const currentQuestion = currentItem && currentItem.question;
  const questionNum = currentQuestionIndex + 1;
  const answerData = answers[questionNum];
  const evaluated = !!answerData;
  const isCorrect = answerData?.isCorrect;
  const isLastQuestion = currentQuestionIndex === items.length - 1;

  let actionLabel = 'ตรวจคำตอบ';
  let actionDisabled = !selectedAnswer;
  let onActionPress = handleConfirm;
  if (evaluated) {
    actionLabel = isLastQuestion ? 'ดูผลลัพธ์' : 'ข้อถัดไป';
    actionDisabled = false;
    onActionPress = isLastQuestion ? handleFinish : handleNext;
  }

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
            ข้อที่ {questionNum}/{items.length} · {Math.floor(timeSpent / 60)}:{String(timeSpent % 60).padStart(2, '0')}
          </Text>
        </View>
        {/* ความเร็วเสียง TTS + ปิด/เปิดเสียง */}
        <View style={s.headerRight}>
          <SpeechSpeedToggle color="#fff" background="rgba(255,255,255,0.22)" />
          <SoundToggle color="#fff" background="rgba(255,255,255,0.22)" />
        </View>
      </View>

      {/* Dialogue (Top) + Active Question (Bottom) */}
      <ResponsiveContainer variant="exercise" style={{ flexGrow: 1, paddingHorizontal: 0 }}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <Text style={s.sectionTitle}>บทสนทนา</Text>
        <View style={s.dialogueContainer}>
          {(currentItem?.lines || []).map((item, idx) => (
            <DialogueBubble key={idx} item={item} voice={speakerVoice(item.speakerKey)} />
          ))}
        </View>

        <Text style={[s.sectionTitle, s.questionsSectionTitle]}>คำถาม</Text>
        {currentQuestion && (
          <QuestionItem
            key={questionNum}
            item={currentQuestion}
            questionNum={questionNum}
            selected={selectedAnswer}
            evaluated={evaluated}
            isCorrect={isCorrect}
            onSelect={handleSelect}
          />
        )}
      </ScrollView>
      </ResponsiveContainer>

      {/* Bottom Action Footer (sticky) */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.finishBtn, { opacity: actionDisabled ? 0.5 : 1 }]}
          onPress={onActionPress}
          disabled={actionDisabled}
        >
          <Text style={s.finishBtnText}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* กล่องยืนยันก่อนออกจากแบบฝึกหัด — โทนสีหลักของหน้าฟังและอ่าน */}
      <ConfirmModal
        visible={exitModalVisible}
        title={EXERCISE_EXIT_TEXTS.title}
        message={EXERCISE_EXIT_TEXTS.message}
        confirmText={EXERCISE_EXIT_TEXTS.confirm}
        cancelText={EXERCISE_EXIT_TEXTS.cancel}
        accentColor={PRIMARY}
        onConfirm={confirmExit}
        onCancel={cancelExit}
        testID="listening-exit-confirm"
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

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },

  // Section Headers
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 12,
  },
  questionsSectionTitle: {
    marginTop: 24,
  },

  // Dialogue
  dialogueContainer: {
    gap: 16,
  },
  dialogueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  speakerName: {
    fontSize: 12, fontWeight: '600', color: '#666',
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '70%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  bubbleText: {
    fontSize: 15, color: '#1A1A2E',
    lineHeight: 22,
  },
  bubbleSpeaker: {
    alignSelf: 'flex-end', marginTop: 4,
  },

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
  questionLabel: {
    fontSize: 14, fontWeight: '700', color: PRIMARY, marginBottom: 8,
  },
  questionText: {
    fontSize: 16, fontWeight: '600', color: '#1A1A2E',
    marginBottom: 16,
  },

  // Options
  optionsList: {
    gap: 10,
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
  },
  optionText: {
    fontSize: 15, fontWeight: '600', color: '#333',
  },
  optionIcon: {
    marginLeft: 8,
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
