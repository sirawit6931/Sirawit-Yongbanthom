// frontend/components/ConfirmModal.js
// กล่องยืนยัน (Confirm Dialog) แบบ Custom — ใช้แทน Alert.alert / window.confirm
// ตัวสร้างมาจาก View/Text/TouchableOpacity ล้วน → ทำงานได้ทั้ง Web (react-native-web)
// และ Native (iOS/Android) โดยไม่ต้องเขียน Platform.OS check แยก
//
// ทำไมไม่ใช้ Alert.alert / window.confirm:
//   - Alert.alert เป็น no-op บน React Native Web → ปุ่มกดไม่ติดบนเว็บ
//   - window.confirm ไม่มีบน React Native → ไม่ทำงานบนมือถือ
//   - dialog ของระบบนอกหน้าตาไม่ตรงธีมแอป ไม่ผูกโทนสีหลักของแต่ละหมวดได้
import React from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
} from 'react-native';
// helper (สี/ข้อความ) อยู๋ที่ utils/ เพราะ jest ของโปรเจกต์ parse react-native ไม่ได้
// จึงแยก pure logic ออกมาให้ test import ได้ตรง ๆ — component ทำหน้าที่ re-export ต่อไป
import {
  DEFAULT_ACCENT,
  resolveAccentColor,
  EXERCISE_EXIT_TEXTS,
  SIGN_OUT_TEXTS,
} from '../utils/confirmDialog';

// re-export ให้หน้าจอ import จากที่เดียวตามเดิม (ไม่ต้องรู้ว่า logic อยู่ utils/)
export {
  DEFAULT_ACCENT,
  resolveAccentColor,
  EXERCISE_EXIT_TEXTS,
  SIGN_OUT_TEXTS,
};

/**
 * ConfirmModal — กล่องยืนยันกลางจอ ใช้ได้ทั้ง Web และ Native
 *
 * @param {boolean}  visible      แสดง/ซ่อน กล่อง
 * @param {string}   title        หัวข้อ (ตัวหนา)
 * @param {string}   message      รายละเอียด/คำเตือน
 * @param {string}   confirmText  ข้อความปุ่มยืนยัน (default 'ตกลง')
 * @param {string}   cancelText   ข้อความปุ่มยกเลิก (default 'ยกเลิก')
 * @param {string}   accentColor  โทนสีหลัก — ปุ่มยืนยันจะใช้สีนี้ (default DEFAULT_ACCENT)
 * @param {Function} onConfirm    เรียกเมื่อกดยืนยัน
 * @param {Function} onCancel     เรียกเมื่อกดยกเลิก (หรือกด overlay / ปุ่ม X)
 * @param {string}   testID       testID ของกล่อง (ใช้ตอนเทสต์)
 */
export default function ConfirmModal({
  visible = false,
  title = 'ยืนยัน',
  message = '',
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก',
  accentColor,
  onConfirm,
  onCancel,
  testID = 'confirm-modal',
}) {
  const accent = resolveAccentColor(accentColor);

  // กด overlay หรือปุ่ม X → ปิดแบบไม่ยืนยัน (onCancel เป็น optional)
  const handleDismiss = () => { if (typeof onCancel === 'function') onCancel(); };
  const handleConfirm = () => { if (typeof onConfirm === 'function') onConfirm(); };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
      statusBarTranslucent
    >
      <View style={styles.root} testID={testID}>
        {/* Overlay — กดพื้นที่ว่างเพื่อยกเลิก */}
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleDismiss}
          accessibilityLabel="ปิดกล่องยืนยัน"
          testID={`${testID}-backdrop`}
        />

        <View style={styles.centerLayer} pointerEvents="box-none">
          <View style={styles.card}>
            {/* ปุ่มกากบาทมุมขวาบน */}
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleDismiss}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="ปิด"
              testID={`${testID}-close`}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </TouchableOpacity>

            <Text style={styles.title} testID={`${testID}-title`}>{title}</Text>

            {message ? (
              <Text style={styles.message} testID={`${testID}-message`}>{message}</Text>
            ) : null}

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={handleDismiss}
                activeOpacity={0.8}
                accessibilityRole="button"
                testID={`${testID}-cancel`}
              >
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.confirmBtn, { backgroundColor: accent }]}
                onPress={handleConfirm}
                activeOpacity={0.8}
                accessibilityRole="button"
                testID={`${testID}-confirm`}
              >
                <Text style={styles.confirmText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    // เต็ม viewport ของ Modal เสมอทั้ง Native และ Web — ไม่ผูกกับ Scroll ของหน้าจอ
    flex: 1,
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    // zIndex สูงเพื่อไม่ให้ถูก ScrollView / footer ของหน้าจอทับ (สำคัญบน react-native-web)
    zIndex: 1000,
    elevation: 999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  // ชั้นจัดกลาง — absolute เต็ม overlay + จัดกึ่งกลาง (ไม่ใช้ flex:1 อย่างเดียว
  // เพราะบน Native ถ้า parent ไม่มี height ชั้นนี้จะหดแล้วดันการ์ดไปติดขอบบน)
  centerLayer: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    paddingTop: 28,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  closeIcon: { fontSize: 16, color: '#aaa', fontWeight: '600' },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 22,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: '#F0F0F0',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#555',
  },
  confirmBtn: {
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

