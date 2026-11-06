// frontend/__tests__/ResponsiveContainer.test.js
// ทดสอบ logic ของ ResponsiveContainer + useResponsive (breakpoints / maxWidth / padding)
// — pure functions ล้วน ตาม style test ของโปรเจกต์ (ไม่ต้อง render component)
// Run with: npm test (jest --runInBand)
import { resolveResponsive, resolveContainerStyle, BREAKPOINTS, CONTAINER_WIDTH } from '../utils/responsive';

describe('resolveResponsive breakpoints', () => {
  test('มือถือ iPhone 390pt → isPhone, numColumns 1, padding 16', () => {
    const r = resolveResponsive(390, 844);
    expect(r.isPhone).toBe(true);
    expect(r.isTablet).toBe(false);
    expect(r.isDesktop).toBe(false);
    expect(r.numColumns).toBe(1);
    expect(r.hPadding).toBe(16);
    expect(r.isLandscape).toBe(false);
  });

  test('Android มือถือ 412pt → isPhone', () => {
    const r = resolveResponsive(412, 915);
    expect(r.isPhone).toBe(true);
    expect(r.hPadding).toBe(16);
  });

  test('iPad Air 5 แนวตั้ง 820pt → isTablet, numColumns 2, padding 24', () => {
    const r = resolveResponsive(820, 1180);
    expect(r.isTablet).toBe(true);
    expect(r.isPhone).toBe(false);
    expect(r.isDesktop).toBe(false);
    expect(r.numColumns).toBe(2);
    expect(r.hPadding).toBe(24);
    expect(r.isLandscape).toBe(false);
  });

  test('iPad Air 5 แนวนอน 1180pt → isDesktop (จอเกิน breakpoint)', () => {
    const r = resolveResponsive(1180, 820);
    expect(r.isDesktop).toBe(true);
    expect(r.numColumns).toBe(3);
    expect(r.isLandscape).toBe(true);
  });

  test('Desktop/Web 1280pt → isDesktop, numColumns 3, padding 24', () => {
    const r = resolveResponsive(1280, 800);
    expect(r.isDesktop).toBe(true);
    expect(r.isTablet).toBe(false);
    expect(r.numColumns).toBe(3);
    expect(r.hPadding).toBe(24);
  });

  test('ขอบเขต breakpoint ชัดเจน: 767=phone, 768=tablet, 1024=tablet, 1025=desktop', () => {
    expect(resolveResponsive(767, 800).isPhone).toBe(true);
    expect(resolveResponsive(768, 800).isTablet).toBe(true);
    expect(resolveResponsive(1024, 800).isTablet).toBe(true);
    expect(resolveResponsive(1025, 800).isDesktop).toBe(true);
    expect(BREAKPOINTS.phone).toBe(768);
    expect(BREAKPOINTS.desktop).toBe(1024);
  });
});

describe('resolveContainerStyle', () => {
  test('default variant=form → maxWidth 600', () => {
    const style = resolveContainerStyle(390, 844);
    expect(style.maxWidth).toBe(600);
    expect(CONTAINER_WIDTH.form).toBe(600);
  });

  test('variant=dashboard → 900 / exercise → 700', () => {
    expect(resolveContainerStyle(820, 1180, { variant: 'dashboard' }).maxWidth).toBe(900);
    expect(resolveContainerStyle(820, 1180, { variant: 'exercise' }).maxWidth).toBe(700);
    expect(CONTAINER_WIDTH.dashboard).toBe(900);
    expect(CONTAINER_WIDTH.exercise).toBe(700);
  });

  test('maxWidth prop override variant', () => {
    expect(resolveContainerStyle(390, 844, { maxWidth: 500 }).maxWidth).toBe(500);
  });

  test('มือถือ → padding 16, ไม่มี marginHorizontal auto', () => {
    const style = resolveContainerStyle(390, 844);
    expect(style.paddingHorizontal).toBe(16);
    expect(style.marginHorizontal).toBeUndefined();
    expect(style.width).toBe('100%');
    expect(style.alignSelf).toBe('center');
    expect(style.flex).toBe(1);
  });

  test('desktop → padding 24 + marginHorizontal auto (กึ่งกลางจอ)', () => {
    const style = resolveContainerStyle(1280, 800);
    expect(style.paddingHorizontal).toBe(24);
    expect(style.marginHorizontal).toBe('auto');
  });

  test('iPad 820pt → padding 24 ไม่มี auto margin, container จำกัด maxWidth', () => {
    const style = resolveContainerStyle(820, 1180, { variant: 'dashboard' });
    expect(style.paddingHorizontal).toBe(24);
    expect(style.marginHorizontal).toBeUndefined();
    expect(style.maxWidth).toBe(900);
  });
});
