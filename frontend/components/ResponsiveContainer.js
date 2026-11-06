// frontend/components/ResponsiveContainer.js
// Container กลางสำหรับจัด layout ให้สมมาตรทุกแพลตฟอร์ม
// (iPhone / Android / iPad / Tablet / Web) — width 100% + maxWidth + กึ่งกลางจอ
import React from 'react';
import { View } from 'react-native';
import useResponsive from '../hooks/useResponsive';
import { CONTAINER_WIDTH, resolveContainerStyle } from '../utils/responsive';

export { CONTAINER_WIDTH, resolveContainerStyle };

export default function ResponsiveContainer({
  children,
  maxWidth,
  variant = 'form', // 'form' (600) | 'dashboard' (900) | 'exercise' (700)
  style,
  ...rest
}) {
  const { width, height } = useResponsive();
  return (
    <View
      style={[
        resolveContainerStyle(width, height, { maxWidth, variant }),
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
