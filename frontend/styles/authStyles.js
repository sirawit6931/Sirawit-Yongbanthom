// frontend/styles/authStyles.js
import { StyleSheet } from 'react-native';

export const PRIMARY = '#5B4FCF';
const GRAY   = '#F5F5F5';
const BORDER = '#E0E0E0';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    alignSelf: 'center',
    // maxWidth/paddingHorizontal ย้ายไป ResponsiveContainer แล้ว
    // (คุม maxWidth 600 + padding 16/24 ตามขนาดจอ — กันซ้ำกับ container)
    paddingBottom: 40,
    paddingTop: 20,
  },

  // หัวข้อ
  welcomeTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  welcomeSub: {
    fontSize: 14,
    textAlign: 'center',
    color: '#888',
    marginBottom: 28,
  },

  // ฟอร์ม
  formContainer: {
    width: '100%',
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GRAY,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    marginBottom: 14,
    height: 52,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  inputIcon: {
    marginRight: 10,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A2E',
  },
  eyeIcon: {
    paddingLeft: 8,
  },
  matchError: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 4,
  },

  // ลืมรหัสผ่าน
  forgotRow: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  forgotText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '500',
  },

  // ปุ่มหลัก
  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  disabledBtn: {
    opacity: 0.7,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  // "หรือ"
  orText: {
    textAlign: 'center',
    color: '#aaa',
    marginVertical: 14,
    fontSize: 14,
  },

  // ปุ่มขอบ (Sign Up จากหน้า Login)
  outlineBtn: {
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: PRIMARY,
  },
  outlineBtnText: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: 'bold',
  },

  // ลิงก์ "มีบัญชีแล้ว?"
  loginLinkRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#666',
  },
  loginLinkBold: {
    color: PRIMARY,
    fontWeight: 'bold',
  },

  // ปุ่มกลับ
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginBottom: 8,
  },
  backBtnText: {
    fontSize: 16,
    color: PRIMARY,
    fontWeight: '600',
  },
formError: {
    backgroundColor: '#FDECEA',
    borderColor: '#F5C6C0',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 20,
    color: '#D93025',
    textAlign: 'center',
  },
});
