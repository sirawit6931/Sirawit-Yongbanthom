// frontend/screens/VocabLibraryScreen.js
// หน้าคลังคำศัพท์โปรด — ดู/ฟังเสียง/ลบคำที่กดหัวใจไว้ระหว่างทำแบบฝึกหัด
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { auth } from '../firebase';
import { getFavoriteVocab, removeFavoriteVocab } from '../services/firestoreService';
import { quotaMessage, recentQuotaNotice } from '../services/firebaseCache';
import { speakEnglish } from '../services/ttsService';
import ResponsiveContainer from '../components/ResponsiveContainer';

const PRIMARY  = '#5B4FCF'; // สีม่วงหลักของแอปผู้ใช้
const FAV_PINK = '#FF4081'; // สีชมพูของหัวใจคำโปรด — ตรงกับหน้าแบบฝึกหัด

// แจ้งเตือนผู้ใช้ — Web ใช้ window.alert เพราะ Alert.alert เป็น no-op บน React Native Web
const notify = (title, message) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// การ์ดแสดงคำศัพท์ 1 คำ: คำอังกฤษ+คำไทย + ปุ่มฟังเสียง + ปุ่มลบออก
function VocabCard({ item, onRemove }) {
  return (
    <View style={s.card}>
      <View style={s.cardLeft}>
        <Text style={s.wordEN}>{item.wordEN}</Text>
        <Text style={s.wordTH}>{item.wordTH}</Text>
      </View>
      <View style={s.cardRight}>
        <TouchableOpacity onPress={() => speakEnglish(item.wordEN)} style={s.iconBtn}>
          <Ionicons name="volume-high-outline" size={22} color={PRIMARY} />
        </TouchableOpacity>
        {/* หัวใจเต็มดวง — กดเพื่อยกเลิก (นำออกจากรายการโปรด) */}
        <TouchableOpacity
          onPress={() => onRemove(item)}
          style={s.iconBtn}
          accessibilityRole="button"
          accessibilityLabel="ลบออกจากรายการโปรด"
        >
          <Ionicons name="heart" size={22} color={FAV_PINK} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function VocabLibraryScreen() {
  const navigation = useNavigation();
  const [words, setWords]   = useState([]); // รายการคำโปรด
  const [loading, setLoading] = useState(true); // กำลังโหลดข้อมูล
  const [loadError, setLoadError] = useState(''); // ข้อความ error (เช่น โควต้า Firebase เต็ม)

  // โหลดคำโปรดของอีเมลที่ล็อกอินอยู่ ทุกครั้งที่เข้าหน้า
  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        setLoading(true);
        setLoadError('');
        const email = auth.currentUser?.email;
        if (!email) { setLoading(false); return; }
        try {
          const data = await getFavoriteVocab(email);
          if (active) {
            setWords(data);
            // service กลืน quota error → เช็ค global flag แสดง banner
            setLoadError(recentQuotaNotice());
            setLoading(false);
          }
        } catch (err) {
          console.error('Load favorites error:', err);
          if (active) {
            setLoadError(quotaMessage(err));
            setLoading(false); // กันหน้าโหลดค้าง (spinner ไม่หยุด)
          }
        }
      }
      load();
      return () => { active = false; };
    }, []),
  );

  // ลบออกจากคลังคำโปรดโดยตรง (ไม่ confirm — confirm ทำที่ handleRemove)
  const doRemove = async (item) => {
    try {
      await removeFavoriteVocab(item.id, auth.currentUser?.email);
      setWords((prev) => prev.filter((w) => w.id !== item.id));
    } catch (err) {
      console.error('Remove favorite error:', err);
      notify('ลบไม่สำเร็จ', quotaMessage(err));
    }
  };

  // ยืนยันก่อนลบออกจากคลังคำโปรด
  const handleRemove = (item) => {
    const message = `ต้องการลบ "${item.wordEN}" ออกจากรายการโปรดหรือไม่?`;

    // Web: Alert.alert() เป็น no-op บน React Native Web → ใช้ window.confirm ของเบราว์เซอร์แทน
    // (ถ้าไม่ทำ ปุ่มยกเลิกหัวใจจะกดไม่ติดบนเว็บ)
    if (Platform.OS === 'web') {
      if (window.confirm(message)) doRemove(item);
      return;
    }

    // Native: ใช้ Alert ปกติ พร้อมปุ่มยกเลิก/ลบ
    Alert.alert('ลบคำโปรด', message, [
      { text: 'ยกเลิก', style: 'cancel' },
      { text: 'ลบ', style: 'destructive', onPress: () => doRemove(item) },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY} />

      {/* หัวแถบ: ปุ่มกลับ + ชื่อหน้า + จำนวนคำ */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>คลังคำศัพท์โปรด</Text>
          <Text style={s.headerSub}>{words.length} คำ</Text>
        </View>
      </View>

      {/* แจ้งเตือนเมื่อโหลดข้อมูลไม่สำเร็จ (เช่น โควต้า Firebase เต็ม) */}
      {loadError ? (
        <View style={s.errorBanner}>
          <Ionicons name="warning-outline" size={18} color="#B45309" />
          <Text style={s.errorBannerText}>{loadError}</Text>
        </View>
      ) : null}

      {/* 3 สถานะ: กำลังโหลด / ยังไม่มีคำ / แสดงรายการ */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : words.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="heart-outline" size={56} color="#ddd" />
          <Text style={s.emptyText}>ยังไม่มีคำศัพท์โปรด</Text>
          <Text style={s.emptySub}>กดไอคอน ❤️ ระหว่างทำแบบฝึกหัดเพื่อบันทึก</Text>
        </View>
      ) : (
        <ResponsiveContainer variant="dashboard" style={{ flex: 0, flexGrow: 1, paddingHorizontal: 0 }}>
        <FlatList
          data={words}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VocabCard item={item} onRemove={handleRemove} />
          )}
          contentContainerStyle={s.list}
        />
        </ResponsiveContainer>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: PRIMARY },

  // แจ้งเตือน error (เช่น โควต้า Firebase เต็ม)
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: '#92400E' },

  header: {
    backgroundColor: PRIMARY,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backBtn:      { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  headerTitle:  { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  headerSub:    { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F6FF' },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#888', marginTop: 16 },
  emptySub:  { fontSize: 13, color: '#aaa', marginTop: 6, textAlign: 'center', paddingHorizontal: 32 },

  list: { backgroundColor: '#F4F6FF', padding: 16, gap: 10 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  cardLeft:  { flex: 1 },
  wordEN:    { fontSize: 18, fontWeight: '700', color: '#1A1A2E' },
  wordTH:    { fontSize: 14, color: '#666', marginTop: 4 },
  cardRight: { flexDirection: 'row', gap: 8 },
  iconBtn:   { padding: 6 },
});
