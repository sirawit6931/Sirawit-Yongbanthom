// frontend/utils/responsive.js
// Logic ล้วนด้าน Responsive layout — ไม่ import react-native
// เพื่อให้ unit test เรียกได้ตรงๆ (jest ของโปรเจกต์นี้ parse โมดูล RN ไม่ได้)
// ตัว UI (hook/component) อยู่ที่ hooks/useResponsive.js และ components/ResponsiveContainer.js

// Breakpoints (สอดคล้องกับ iPad Air 5 กว้าง 820pt แนวตั้ง / 1180pt แนวนอน)
export const BREAKPOINTS = {
  phone: 768,    // < 768  → มือถือ (iPhone / Android)
  desktop: 1024, // > 1024 → Desktop / Web จอกว้าง
};

export const CONTAINER_WIDTH = {
  form: 600,        // Form / Card
  dashboard: 900,   // Dashboard / List
  exercise: 700,    // Stage แบบฝึกหัด
  appPhone: 480,    // ความกว้างสูงสุดบนมือถือ (คงดีไซน์เดิม)
  appTablet: 768,   // ความกว้างสูงสุดบน tablet
  appDesktop: 1100, // ความกว้างสูงสุดบน desktop/web
};

// คำนวณ breakpoint จากขนาดจอ (pure)
export function resolveResponsive(width, height) {
  const isPhone = width < BREAKPOINTS.phone;
  const isTablet = width >= BREAKPOINTS.phone && width <= BREAKPOINTS.desktop;
  const isDesktop = width > BREAKPOINTS.desktop;
  return {
    width,
    height,
    isPhone,
    isTablet,
    isDesktop,
    isLandscape: width > height,
    // จำนวนคอลัมน์สำหรับ grid/list — โทรศัพท์ 1, tablet 2, desktop 3
    numColumns: isDesktop ? 3 : isTablet ? 2 : 1,
    // padding แนวนอนมาตรฐาน — tablet/desktop กว้างกว่าเพื่อความสมมาตร
    hPadding: isPhone ? 16 : 24,
  };
}

// คำนวณ style ของ ResponsiveContainer จาก viewport (pure)
export function resolveContainerStyle(viewportWidth, viewportHeight, { maxWidth, variant = 'form' } = {}) {
  const { isDesktop, hPadding } = resolveResponsive(viewportWidth, viewportHeight);
  const resolvedMax = maxWidth ?? CONTAINER_WIDTH[variant] ?? CONTAINER_WIDTH.form;
  return {
    width: '100%',
    maxWidth: resolvedMax,
    alignSelf: 'center',
    flex: 1,
    paddingHorizontal: hPadding,
    // บน desktop จอกว้างมาก ให้ container ลอยกลางแบบสมมาตร
    ...(isDesktop ? { marginHorizontal: 'auto' } : null),
  };
}
