// frontend/screens/AdminExerciseFormScreen.js
// ฟอร์มเพิ่ม/แก้ไขชุดแบบฝึกหัด (vocab/tense/listening)
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  StatusBar, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { adminUpdateExercise, adminAddExercise } from '../services/adminService';
import ResponsiveContainer from '../components/ResponsiveContainer';

const PRIMARY = '#1A237E'; // สีน้ำเงินเข้ม — ธีมแอดมิน
// ตัวเลือกสำหรับ chips ในฟอร์ม (หมวด / ระดับ / เสียง / สถานะ)
const CATS = ['vocab', 'tense', 'listening'];
const LEVELS = ['A1', 'A2'];
const TTS_OPTIONS = ['female', 'male'];
const STATUS_OPTIONS = ['draft', 'published'];
const TENSE_COLORS = ['#5B4FCF', '#34C759', '#FF9500', '#FF3B30', '#007AFF', '#AF52DE']; // สีสำหรับ tags tense

export default function AdminExerciseFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  // ชุดแบบฝึกหัดเดิมที่ส่งมา = โหมดแก้ไข; ไม่ส่ง = โหมดเพิ่มใหม่
  const existing = route.params?.exercise ?? null;

  // ข้อมูลทั่วไปของชุดแบบฝึกหัด
  const [category, setCategory] = useState(existing?.category ?? 'vocab');
  const [level, setLevel] = useState(existing?.level ?? 'A1');
  const [ttsSystem, setTtsSystem] = useState(existing?.ttsSystem ?? 'female');
  const [status, setStatus] = useState(existing?.status ?? 'draft');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [desc, setDesc] = useState(existing?.description ?? '');
  const [saving, setSaving] = useState(false); // กำลังบันทึก
  const [errors, setErrors] = useState({}); // ข้อผิดพลาดตาม field

  // รายการคำศัพท์ (หมวด vocab) — ถ้ามีของเดิมจะ map ใส่ให้พร้อมแก้ไข
  const [vocabItems, setVocabItems] = useState(
    existing?.items?.length
      ? existing.items.map((it, idx) => ({
          id: it.wordId || `v_${idx}_${Date.now()}`,
          wordEN: it.wordEN || '',
          wordTH: it.wordTH || '',
          sentence: it.sentence || '',
          sentenceTH: it.sentenceTH || '',
          distractors: Array.isArray(it.distractors) ? it.distractors.join(', ') : '',
        }))
      : [{ id: `v_${Date.now()}`, wordEN: '', wordTH: '', sentence: '', sentenceTH: '', distractors: '' }]
  );

  // รายการ tense (หมวด tense)
  const [tenseItems, setTenseItems] = useState(
    existing?.items?.length
      ? existing.items.map((it, idx) => ({
          id: `t_${idx}_${Date.now()}`,
          tenseType: it.tenseType || '',
          tenseColor: it.tenseColor || '#5B4FCF',
          exampleEN: it.exampleEN || '',
          exampleTH: it.exampleTH || '',
          sentenceTH: it.sentenceTH || '',
          sentence: it.sentence || '',
          answer: it.answer || '',
          choices: Array.isArray(it.choices) ? it.choices.join(', ') : '',
          orderWords: Array.isArray(it.orderWords) ? it.orderWords.join(', ') : '',
          speakText: it.speakText || '',
        }))
      : [{ id: `t_${Date.now()}`, tenseType: '', tenseColor: '#5B4FCF', exampleEN: '', exampleTH: '', sentenceTH: '', sentence: '', answer: '', choices: '', orderWords: '', speakText: '' }]
  );

  // บทสนทนา (หมวด listening) — เริ่มด้วย A/B คนละฝั่ง
  const [dialogue, setDialogue] = useState(
    existing?.dialogue?.length
      ? existing.dialogue.map((d, idx) => ({
          id: `d_${idx}_${Date.now()}`,
          speaker: d.speaker || 'A',
          side: d.side || (d.speaker === 'B' ? 'right' : 'left'),
          text: d.text || '',
        }))
      : [
          { id: `d_${Date.now()}_0`, speaker: 'A', side: 'left', text: '' },
          { id: `d_${Date.now()}_1`, speaker: 'B', side: 'right', text: '' },
        ]
  );

  // คำถามความเข้าใจ (หมวด listening) — เริ่ม 3 ข้อ
  const [questions, setQuestions] = useState(
    existing?.questions?.length
      ? existing.questions.map((q, idx) => ({
          id: `q_${idx}_${Date.now()}`,
          question: q.question || '',
          choices: Array.isArray(q.choices) ? q.choices.join(', ') : '',
          answer: q.answer || '',
        }))
      : [
          { id: `q_${Date.now()}_0`, question: '', choices: '', answer: '' },
          { id: `q_${Date.now()}_1`, question: '', choices: '', answer: '' },
          { id: `q_${Date.now()}_2`, question: '', choices: '', answer: '' },
        ]
  );

  // เปลี่ยนหมวด → เคลียร์รายการของหมวดอื่นทิ้ง (เก็บเฉพาะของหมวดที่เลือก)
  useEffect(() => {
    if (category !== 'listening') {
      setDialogue([]);
      setQuestions([]);
    }
    if (category === 'listening') {
      setVocabItems([]);
      setTenseItems([]);
    }
    if (category === 'vocab') {
      setTenseItems([]);
    }
    if (category === 'tense') {
      setVocabItems([]);
    }
    setErrors({});
  }, [category]);

  // ── ฟังก์ชันแก้ไขค่าในรายการ (อัปเดท field เดียวตาม id + เคลียร์ error ของ field นั้น) ──
  const updateVocabItem = (id, field, value) => {
    setVocabItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const updateTenseItem = (id, field, value) => {
    setTenseItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const updateDialogueItem = (id, field, value) => {
    setDialogue((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const updateQuestionItem = (id, field, value) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, [field]: value } : q)));
  };

  // ── เพิ่ม/ลบรายการในฟอร์ม ──
  // บทสนทนาใหม่สลับด้านซ้าย-ขวาอัตโนมัติ (คู่สนทนา A/B)
  const addVocabItem = () => {
    setVocabItems((prev) => [...prev, { id: `v_${Date.now()}`, wordEN: '', wordTH: '', sentence: '', sentenceTH: '', distractors: '' }]);
  };

  const addTenseItem = () => {
    setTenseItems((prev) => [...prev, { id: `t_${Date.now()}`, tenseType: '', tenseColor: '#5B4FCF', exampleEN: '', exampleTH: '', sentenceTH: '', sentence: '', answer: '', choices: '', orderWords: '', speakText: '' }]);
  };

  const addDialogueLine = () => {
    const lastSide = dialogue.length > 0 ? dialogue[dialogue.length - 1].side : 'left';
    const newSide = lastSide === 'left' ? 'right' : 'left';
    setDialogue((prev) => [...prev, { id: `d_${Date.now()}`, speaker: newSide === 'left' ? 'A' : 'B', side: newSide, text: '' }]);
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { id: `q_${Date.now()}_${prev.length}`, question: '', choices: '', answer: '' }]);
  };

  const removeVocabItem = (id) => {
    if (vocabItems.length <= 1) {
      Alert.alert('ไม่สามารถลบ', 'ต้องมีอย่างน้อย 1 ข้อ');
      return;
    }
    setVocabItems((prev) => prev.filter((it) => it.id !== id));
  };

  const removeTenseItem = (id) => {
    if (tenseItems.length <= 1) {
      Alert.alert('ไม่สามารถลบ', 'ต้องมีอย่างน้อย 1 ข้อ');
      return;
    }
    setTenseItems((prev) => prev.filter((it) => it.id !== id));
  };

  const removeDialogueLine = (id) => {
    setDialogue((prev) => prev.filter((d) => d.id !== id));
  };

  const removeQuestion = (id) => {
    if (questions.length <= 3) {
      Alert.alert('ไม่สามารถลบ', 'ต้องมีอย่างน้อย 3 ข้อคำถาม');
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  // ตรวจสอบข้อมูลก่อนบันทึก — ผ่านทุกเงื่อนไขคืน true
  const validate = () => {
    const errs = {};
    if (!title.trim()) errs.title = 'กรุณาใส่ชื่อชุด';

    if (category === 'vocab') {
      const items = vocabItems.filter((it) => it.wordEN.trim() && it.wordTH.trim());
      if (items.length < 1) errs.items = 'ต้องมีอย่างน้อย 1 ข้อที่กรอกข้อมูลครบ';
    }

    if (category === 'tense') {
      const items = tenseItems.filter((it) => it.tenseType.trim() && it.answer.trim());
      if (items.length < 1) errs.items = 'ต้องมีอย่างน้อย 1 ข้อที่กรอกข้อมูลครบ';
    }

    if (category === 'listening') {
      const validDialogue = dialogue.filter((d) => d.text.trim());
      if (validDialogue.length < 1) errs.dialogue = 'ต้องมีบทสนทนาอย่างน้อย 1 บรรทัด';
      const validQuestions = questions.filter((q) => q.question.trim() && q.answer.trim() && q.choices.trim());
      if (validQuestions.length < 3) errs.questions = 'ต้องมีคำถามอย่างน้อย 3 ข้อที่กรอกข้อมูลครบ';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // จัดรูปข้อมูลตามหมวดเพื่อส่งบันทึก (ตัดช่องว่าง, split รายการคั่นด้วย comma)
  const buildPayload = () => {
    const base = {
      category,
      level,
      ttsSystem,
      status,
      title: title.trim(),
      description: desc.trim(),
    };

    if (category === 'vocab') {
      const items = vocabItems
        .filter((it) => it.wordEN.trim() && it.wordTH.trim())
        .map((it) => ({
          wordId: it.id,
          wordEN: it.wordEN.trim(),
          wordTH: it.wordTH.trim(),
          sentence: it.sentence.trim(),
          sentenceTH: it.sentenceTH.trim(),
          distractors: it.distractors
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean),
        }));
      return { ...base, items, dialogue: [], questions: [] };
    }

    if (category === 'tense') {
      const items = tenseItems
        .filter((it) => it.tenseType.trim() && it.answer.trim())
        .map((it) => ({
          tenseType: it.tenseType.trim(),
          tenseColor: it.tenseColor,
          exampleEN: it.exampleEN.trim(),
          exampleTH: it.exampleTH.trim(),
          sentenceTH: it.sentenceTH.trim(),
          sentence: it.sentence.trim(),
          answer: it.answer.trim(),
          choices: it.choices
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
          orderWords: it.orderWords
            .split(',')
            .map((w) => w.trim())
            .filter(Boolean),
          speakText: it.speakText.trim() || it.orderWords.split(',').map((w) => w.trim()).filter(Boolean).join(' '),
        }));
      return { ...base, items, dialogue: [], questions: [] };
    }

    if (category === 'listening') {
      const cleanDialogue = dialogue
        .filter((d) => d.text.trim())
        .map((d) => ({
          speaker: d.speaker,
          side: d.side,
          text: d.text.trim(),
        }));
      const cleanQuestions = questions
        .filter((q) => q.question.trim() && q.answer.trim() && q.choices.trim())
        .map((q) => ({
          question: q.question.trim(),
          choices: q.choices
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean),
          answer: q.answer.trim(),
        }));
      return { ...base, dialogue: cleanDialogue, questions: cleanQuestions, items: [] };
    }

    return base;
  };

  // บันทึก — ถ้ามี id เดิม = อัปเดต, ไม่มี = เพิ่มใหม่ แล้วกลับหน้าก่อนหน้า
  const handleSave = async () => {
    if (!validate()) {
      Alert.alert('ข้อมูลไม่ครบ', 'กรุณาใส่ข้อมูลในฟิลด์ที่จำเป็น');
      return;
    }
    setSaving(true);
    try {
      const data = buildPayload();
      if (existing?.id) {
        await adminUpdateExercise(existing.id, data);
        Alert.alert('สำเร็จ', 'อัปเดตแบบฝึกหัดแล้ว', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      } else {
        await adminAddExercise(data);
        Alert.alert('สำเร็จ', 'เพิ่มแบบฝึกหัดแล้ว', [{ text: 'OK', onPress: () => navigation.goBack() }]);
      }
    } catch (e) {
      Alert.alert('ผิดพลาด', e.message || 'ไม่สามารถบันทึกได้');
    }
    setSaving(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />
      {/* หัวแถบ: ปุ่มกลับ + ชื่อฟอร์ม (เพิ่ม/แก้ไข) */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{existing ? 'แก้ไขแบบฝึกหัด' : 'เพิ่มแบบฝึกหัด'}</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        <ResponsiveContainer variant="form" style={{ flexGrow: 1, paddingHorizontal: 0 }}>
        {/* ── ข้อมูลทั่วไป: หมวด / ระดับ / เสียง / สถานะ / ชื่อ / คำอธิบาย ── */}
        {/* Category */}
        <Text style={s.label}>หมวดหมู่</Text>
        <View style={s.row}>
          {CATS.map((c) => (
            <TouchableOpacity key={c} style={[s.chip, category === c && s.chipActive]} onPress={() => setCategory(c)}>
              <Text style={[s.chipText, category === c && s.chipTextActive]}>
                {c === 'vocab' ? 'คำศัพท์' : c === 'tense' ? 'Tense' : 'การฟัง'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Level */}
        <Text style={s.label}>ระดับ</Text>
        <View style={s.row}>
          {LEVELS.map((lv) => (
            <TouchableOpacity key={lv} style={[s.chip, level === lv && s.chipActive]} onPress={() => setLevel(lv)}>
              <Text style={[s.chipText, level === lv && s.chipTextActive]}>{lv}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* TTS System */}
        <Text style={s.label}>ระบบเสียง (TTS)</Text>
        <View style={s.row}>
          {TTS_OPTIONS.map((tts) => (
            <TouchableOpacity key={tts} style={[s.chip, ttsSystem === tts && s.chipActive]} onPress={() => setTtsSystem(tts)}>
              <Text style={[s.chipText, ttsSystem === tts && s.chipTextActive]}>
                {tts === 'female' ? 'หญิง' : 'ชาย'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Status */}
        <Text style={s.label}>สถานะ</Text>
        <View style={s.row}>
          {STATUS_OPTIONS.map((st) => (
            <TouchableOpacity key={st} style={[s.chip, status === st && s.chipActive]} onPress={() => setStatus(st)}>
              <Text style={[s.chipText, status === st && s.chipTextActive]}>
                {st === 'draft' ? 'ร่าง' : 'เผยแพร่'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.label}>ชื่อชุด *</Text>
        <TextInput
          style={[s.input, errors.title && s.inputError]}
          value={title}
          onChangeText={(v) => { setTitle(v); setErrors((prev) => ({ ...prev, title: undefined })); }}
          placeholder="เช่น คำศัพท์ A1 ชุดที่ 1"
          placeholderTextColor="#aaa"
        />
        {errors.title && <Text style={s.errorText}>{errors.title}</Text>}

        <Text style={s.label}>คำอธิบาย</Text>
        <TextInput
          style={s.input}
          value={desc}
          onChangeText={setDesc}
          placeholder="คำอธิบายสั้นๆ"
          placeholderTextColor="#aaa"
        />

        {/* ── ฟอร์มเฉพาะหมวด: vocab = รายการคำศัพท์ ── */}
        {/* VOCAB FORM */}
        {category === 'vocab' && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>รายการคำศัพท์ ({vocabItems.filter((it) => it.wordEN.trim() && it.wordTH.trim()).length} ข้อ)</Text>
              <TouchableOpacity style={s.addBtn} onPress={addVocabItem}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={s.addBtnText}>เพิ่ม</Text>
              </TouchableOpacity>
            </View>
            {errors.items && <Text style={s.errorText}>{errors.items}</Text>}
            {vocabItems.map((item, idx) => (
              <View key={item.id} style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle}>ข้อที่ {idx + 1}</Text>
                  <TouchableOpacity onPress={() => removeVocabItem(item.id)}>
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
                <Text style={s.fieldLabel}>คำศัพท์ (EN) *</Text>
                <TextInput style={s.input} value={item.wordEN} onChangeText={(v) => updateVocabItem(item.id, 'wordEN', v)} placeholder="hello" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>คำแปล (TH) *</Text>
                <TextInput style={s.input} value={item.wordTH} onChangeText={(v) => updateVocabItem(item.id, 'wordTH', v)} placeholder="สวัสดี" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>ประโยคตัวอย่าง (EN)</Text>
                <TextInput style={s.input} value={item.sentence} onChangeText={(v) => updateVocabItem(item.id, 'sentence', v)} placeholder="Hello, how are you?" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>คำแปลประโยค (TH)</Text>
                <TextInput style={s.input} value={item.sentenceTH} onChangeText={(v) => updateVocabItem(item.id, 'sentenceTH', v)} placeholder="สวัสดีครับ คุณเป็นอย่างไร" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>คำหลอก (distractors) คั่นด้วย comma</Text>
                <TextInput style={s.input} value={item.distractors} onChangeText={(v) => updateVocabItem(item.id, 'distractors', v)} placeholder="hi, hey, greeting" placeholderTextColor="#aaa" />
              </View>
            ))}
          </View>
        )}

        {/* ── ฟอร์มเฉพาะหมวด: tense = รายการประโยคเติมคำ/เรียงคำ ── */}
        {/* TENSE FORM */}
        {category === 'tense' && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>รายการ Tense ({tenseItems.filter((it) => it.tenseType.trim() && it.answer.trim()).length} ข้อ)</Text>
              <TouchableOpacity style={s.addBtn} onPress={addTenseItem}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={s.addBtnText}>เพิ่ม</Text>
              </TouchableOpacity>
            </View>
            {errors.items && <Text style={s.errorText}>{errors.items}</Text>}
            {tenseItems.map((item, idx) => (
              <View key={item.id} style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle}>ข้อที่ {idx + 1}</Text>
                  <TouchableOpacity onPress={() => removeTenseItem(item.id)}>
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
                <Text style={s.fieldLabel}>Tense Type *</Text>
                <TextInput style={s.input} value={item.tenseType} onChangeText={(v) => updateTenseItem(item.id, 'tenseType', v)} placeholder="Present Simple" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>สีป้าย (tenseColor)</Text>
                <View style={s.row}>
                  {TENSE_COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[s.colorChip, item.tenseColor === c && s.colorChipActive, { backgroundColor: c }]}
                      onPress={() => updateTenseItem(item.id, 'tenseColor', c)}
                    />
                  ))}
                </View>
                <Text style={s.fieldLabel}>ตัวอย่าง (EN)</Text>
                <TextInput style={s.input} value={item.exampleEN} onChangeText={(v) => updateTenseItem(item.id, 'exampleEN', v)} placeholder="I eat breakfast." placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>คำแปลตัวอย่าง (TH)</Text>
                <TextInput style={s.input} value={item.exampleTH} onChangeText={(v) => updateTenseItem(item.id, 'exampleTH', v)} placeholder="ฉันกินอาหารเช้า" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>ประโยคภาษาไทย (เพื่อให้เลือกคำ)</Text>
                <TextInput style={s.input} value={item.sentenceTH} onChangeText={(v) => updateTenseItem(item.id, 'sentenceTH', v)} placeholder="เขา... ไปโรงเรียนทุกวัน" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>ประโยคเต็ม (EN)</Text>
                <TextInput style={s.input} value={item.sentence} onChangeText={(v) => updateTenseItem(item.id, 'sentence', v)} placeholder="He goes to school every day." placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>คำตอบ (answer) *</Text>
                <TextInput style={s.input} value={item.answer} onChangeText={(v) => updateTenseItem(item.id, 'answer', v)} placeholder="goes" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>ตัวเลือก (choices) คั่นด้วย comma *</Text>
                <TextInput style={s.input} value={item.choices} onChangeText={(v) => updateTenseItem(item.id, 'choices', v)} placeholder="go, goes, going, went" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>คำเรียงลำดับ (orderWords) คั่นด้วย comma *</Text>
                <TextInput style={s.input} value={item.orderWords} onChangeText={(v) => updateTenseItem(item.id, 'orderWords', v)} placeholder="He, goes, to, school, every, day" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>ข้อความสำหรับอ่านเสียง (speakText)</Text>
                <TextInput style={s.input} value={item.speakText} onChangeText={(v) => updateTenseItem(item.id, 'speakText', v)} placeholder="He goes to school every day" placeholderTextColor="#aaa" />
              </View>
            ))}
          </View>
        )}

        {/* ── ฟอร์มเฉพาะหมวด: listening = บทสนทนา + คำถามความเข้าใจ ── */}
        {/* LISTENING FORM */}
        {category === 'listening' && (
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>บทสนทนา ({dialogue.filter((d) => d.text.trim()).length} บรรทัด)</Text>
              <TouchableOpacity style={s.addBtn} onPress={addDialogueLine}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={s.addBtnText}>เพิ่ม</Text>
              </TouchableOpacity>
            </View>
            {errors.dialogue && <Text style={s.errorText}>{errors.dialogue}</Text>}
            {dialogue.map((d, idx) => (
              <View key={d.id} style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle}>บรรทัดที่ {idx + 1}</Text>
                  <TouchableOpacity onPress={() => removeDialogueLine(d.id)}>
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>ผู้พูด</Text>
                    <View style={s.row}>
                      {['A', 'B'].map((sp) => (
                        <TouchableOpacity key={sp} style={[s.chip, d.speaker === sp && s.chipActive]} onPress={() => updateDialogueItem(d.id, 'speaker', sp)}>
                          <Text style={[s.chipText, d.speaker === sp && s.chipTextActive]}>Speaker {sp}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>ด้าน</Text>
                    <View style={s.row}>
                      {['left', 'right'].map((side) => (
                        <TouchableOpacity key={side} style={[s.chip, d.side === side && s.chipActive]} onPress={() => updateDialogueItem(d.id, 'side', side)}>
                          <Text style={[s.chipText, d.side === side && s.chipTextActive]}>
                            {side === 'left' ? 'ซ้าย' : 'ขวา'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={s.fieldLabel}>ข้อความ *</Text>
                <TextInput style={s.input} value={d.text} onChangeText={(v) => updateDialogueItem(d.id, 'text', v)} placeholder="Hello, how are you?" placeholderTextColor="#aaa" />
              </View>
            ))}

            <View style={s.sectionHeader}>
              <Text style={[s.sectionTitle, { marginTop: 20 }]}>คำถามความเข้าใจ ({questions.filter((q) => q.question.trim() && q.answer.trim() && q.choices.trim()).length} ข้อ)</Text>
              <TouchableOpacity style={s.addBtn} onPress={addQuestion}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={s.addBtnText}>เพิ่ม</Text>
              </TouchableOpacity>
            </View>
            {errors.questions && <Text style={s.errorText}>{errors.questions}</Text>}
            {questions.map((q, idx) => (
              <View key={q.id} style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardTitle}>คำถามที่ {idx + 1}</Text>
                  <TouchableOpacity onPress={() => removeQuestion(q.id)}>
                    <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
                <Text style={s.fieldLabel}>คำถาม *</Text>
                <TextInput style={s.input} value={q.question} onChangeText={(v) => updateQuestionItem(q.id, 'question', v)} placeholder="How is the woman feeling?" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>ตัวเลือก (choices) คั่นด้วย comma *</Text>
                <TextInput style={s.input} value={q.choices} onChangeText={(v) => updateQuestionItem(q.id, 'choices', v)} placeholder="Happy, Sad, Angry, Tired" placeholderTextColor="#aaa" />
                <Text style={s.fieldLabel}>คำตอบ (answer) *</Text>
                <TextInput style={s.input} value={q.answer} onChangeText={(v) => updateQuestionItem(q.id, 'answer', v)} placeholder="Happy" placeholderTextColor="#aaa" />
              </View>
            ))}
          </View>
        )}

        {/* ปุ่มบันทึก — ปิดการกดซ้ำระหว่างกำลังบันทึก */}
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>💾 บันทึกแบบฝึกหัด</Text>}
        </TouchableOpacity>
        </ResponsiveContainer>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: PRIMARY },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn:    { padding: 4, marginRight: 8 },
  headerTitle:{ flex: 1, fontSize: 17, fontWeight: '800', color: '#fff' },
  scroll:     { backgroundColor: '#F4F6FF', padding: 20, paddingBottom: 40 },
  label:      { fontSize: 13, fontWeight: '700', color: '#555', marginTop: 16, marginBottom: 6 },
  input:      { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: '#fff' },
  inputError: { borderColor: '#FF3B30', backgroundColor: '#FFEFED' },
  errorText:  { fontSize: 12, color: '#FF3B30', marginTop: 4, marginBottom: 8 },
  row:        { flexDirection: 'row', gap: 10 },
  chip:       { flex: 1, borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, padding: 10, alignItems: 'center', backgroundColor: '#fff' },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText:   { fontSize: 13, fontWeight: '700', color: '#888' },
  chipTextActive: { color: '#fff' },
  colorChip:  { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#fff', elevation: 1 },
  colorChipActive: { borderColor: '#1A237E', transform: [{ scale: 1.1 }] },
  section:    { marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1A1A2E' },
  addBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  addBtnText:{ color: '#fff', fontSize: 13, fontWeight: '700' },
  card:       { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle:  { fontSize: 14, fontWeight: '700', color: '#1A1A2E' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#555', marginTop: 8, marginBottom: 4 },
  saveBtn:    { backgroundColor: PRIMARY, borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText:{ color: '#fff', fontWeight: '800', fontSize: 16 },
});
