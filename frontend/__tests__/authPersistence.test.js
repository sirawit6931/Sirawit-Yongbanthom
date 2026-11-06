// frontend/__tests__/authPersistence.test.js
// Regression: Auth persistence ต้องคง session ไว้ข้าม refresh / รีเปิดแอป
//   (ห้ามใช้ inMemoryPersistence — เป็นสาเหตุให้รีเฟรชหน้าแล้วเด้งไปหน้า Login)
// - Web     = default persistence ของ Firebase เอง (IndexedDB → localStorage)
//             → ห้ามเรียก setPersistence ทับด้วย inMemory
// - Native  = AsyncStorage persistence ผ่าน getReactNativePersistence
// - init ซ้ำ (HMR) = fallback ไป getAuth instance เดิม
// Run with: npm test (jest --runInBand)

const fs   = require('fs');
const path = require('path');

// Platform.OS ตั้งค่าได้ระหว่าง test (เจ้าของ mock ชื่อขึ้นต้นด้วย mock* ตามกติกา jest.mock hoist)
const mockPlatform = { OS: 'web' };

jest.mock('react-native', () => ({ Platform: mockPlatform }));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'mock-app' })),
  getApps:       jest.fn(() => []),
  getApp:        jest.fn(() => ({ name: 'mock-app' })),
}));

jest.mock('firebase/auth', () => ({
  initializeAuth:          jest.fn(() => ({ provider: 'initializeAuth' })),
  getAuth:                 jest.fn(() => ({ provider: 'getAuth' })),
  setPersistence:          jest.fn(),
  inMemoryPersistence:     { type: 'NONE' },
  getReactNativePersistence: jest.fn(() => ({ type: 'LOCAL', source: 'AsyncStorage' })),
}));

jest.mock('firebase/firestore', () => ({
  initializeFirestore:   jest.fn(() => ({ provider: 'initializeFirestore' })),
  persistentLocalCache:  jest.fn(() => ({ kind: 'persistentLocalCache' })),
  getFirestore:          jest.fn(() => ({ provider: 'getFirestore' })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem:   jest.fn(),
    setItem:   jest.fn(),
    removeItem: jest.fn(),
  },
}));

/** โหลด ../firebase ใหม่ใน module registry แยก ตาม Platform.OS ที่กำหนด */
function loadFirebase(os) {
  let mod = null;
  let mocks = null;
  jest.isolateModules(() => {
    mockPlatform.OS = os;
    mod = require('../firebase');
    mocks = {
      app:         jest.requireMock('firebase/app'),
      auth:        jest.requireMock('firebase/auth'),
      firestore:   jest.requireMock('firebase/firestore'),
      asyncStorage: jest.requireMock('@react-native-async-storage/async-storage').default,
    };
  });
  return { mod, mocks };
}

describe('Auth persistence — ห้ามใช้ inMemoryPersistence (กันเด้งหน้า Login ตอนรีเฟรช)', () => {
  test('โค้ด firebase.js ไม่มีการ import/เรียก inMemoryPersistence หรือ setPersistence อีกต่อไป', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'firebase.js'), 'utf8');
    // ตัดคอมเมนต์ออกก่อนเช็ค (คอมเมนต์อาจเอ่ยชื่อของเดิมเพื่อบันทึกประวัติ)
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/inMemoryPersistence/);
    expect(code).not.toMatch(/setPersistence/);
  });

  test('Web: ใช้ default persistence ของ Firebase (getAuth) — ไม่เรียก setPersistence ทับ', () => {
    const { mod, mocks } = loadFirebase('web');

    expect(mocks.auth.getAuth).toHaveBeenCalledWith(mocks.app.initializeApp.mock.results[0].value);
    expect(mocks.auth.initializeAuth).not.toHaveBeenCalled();
    expect(mocks.auth.setPersistence).not.toHaveBeenCalled();
    expect(mocks.auth.getReactNativePersistence).not.toHaveBeenCalled();
    expect(mod.auth).toEqual({ provider: 'getAuth' });
    // inMemoryPersistence ห้ามถูกส่งเป็น argument ของ auth API ใด ๆ (session ต้องอยู่ข้าม refresh)
    const receivedArgs = Object.values(mocks.auth)
      .filter((v) => typeof v === 'function' && v.mock)
      .flatMap((fn) => fn.mock.calls.flat());
    expect(receivedArgs).not.toContain(mocks.auth.inMemoryPersistence);
  });

  test('Native (iOS): initializeAuth ได้ persistence เป็น AsyncStorage ผ่าน getReactNativePersistence', () => {
    const { mod, mocks } = loadFirebase('ios');

    expect(mocks.auth.initializeAuth).toHaveBeenCalledTimes(1);
    expect(mocks.auth.getReactNativePersistence).toHaveBeenCalledWith(mocks.asyncStorage);

    const deps = mocks.auth.initializeAuth.mock.calls[0][1];
    expect(deps).toBeDefined();
    expect(deps.persistence).toEqual({ type: 'LOCAL', source: 'AsyncStorage' });
    expect(deps.persistence).not.toBe(mocks.auth.inMemoryPersistence);

    expect(mocks.auth.setPersistence).not.toHaveBeenCalled();
    expect(mod.auth).toEqual({ provider: 'initializeAuth' });
  });

  test('Native (Android): ได้ persistence แบบเดียวกัน (LOCAL จาก AsyncStorage)', () => {
    const { mod, mocks } = loadFirebase('android');

    const deps = mocks.auth.initializeAuth.mock.calls[0][1];
    expect(deps.persistence.type).toBe('LOCAL');
    expect(mocks.auth.setPersistence).not.toHaveBeenCalled();
    expect(mod.auth.provider).toBe('initializeAuth');
  });

  test('Web: Firestore ยังใช้ persistentLocalCache (กันโควต้า) ตามเดิม', () => {
    const { mod, mocks } = loadFirebase('web');

    expect(mocks.firestore.initializeFirestore).toHaveBeenCalledWith(mocks.app.initializeApp.mock.results[0].value, {
      localCache: { kind: 'persistentLocalCache' },
    });
    expect(mod.db).toEqual({ provider: 'initializeFirestore' });
  });

  test('init ซ้ำ (HMR/Reload) ที่ initializeAuth ปา error → fallback ไป getAuth instance เดิม', () => {
    let mod = null;
    let authMock = null;
    jest.isolateModules(() => {
      mockPlatform.OS = 'ios';
      authMock = jest.requireMock('firebase/auth');
      authMock.initializeAuth.mockImplementationOnce(() => {
        throw new Error('auth already initialized');
      });
      mod = require('../firebase');
    });

    expect(authMock.getAuth).toHaveBeenCalled();
    expect(mod.auth).toEqual({ provider: 'getAuth' });
  });
});
