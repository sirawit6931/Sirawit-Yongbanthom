// frontend/hooks/useResponsive.js
// Hook กลางสำหรับ Responsive layout — ใช้ useWindowDimensions (built-in)
// เพื่อ re-render อัตโนมัติเมื่อ rotate / resize / เปลี่ยนอุปกรณ์
// (logic ล้วนอยู่ที่ utils/responsive.js เพื่อให้ unit test เรียกได้โดยไม่ต้องพึ่ง RN)
import { useWindowDimensions } from 'react-native';
import { BREAKPOINTS, CONTAINER_WIDTH, resolveResponsive } from '../utils/responsive';

export { BREAKPOINTS, CONTAINER_WIDTH, resolveResponsive };

export default function useResponsive() {
  const { width, height } = useWindowDimensions();
  return resolveResponsive(width, height);
}
