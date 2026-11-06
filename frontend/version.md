> **CRITICAL BOUNDARY:** All development tasks MUST strictly adhere to `frontend/PROJECT_SCOPE.md`. Never introduce unapproved dependencies, new features, or architectural changes without prior user consultation.

# Project Agent Guide — frontend

## Framework Versions
- Expo SDK: **v57**
- React Native: **0.86.3**
- React: **19.2.3**
- React DOM: **19.2.3**
- Firebase: **v12** (modular SDK)

Always read the exact versioned docs before writing code:
- https://docs.expo.dev/versions/v57.0.0/
- https://rnfirebase.io/ (v12)

## Environment Variables
All runtime config lives in `.env` using the `EXPO_PUBLIC_` prefix so values are inlined at build time by Expo.

Required keys:
```
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
```

Access via `process.env.EXPO_PUBLIC_*`. Never hardcode IPs, API URLs, or Firebase credentials in source files.

## Security
- `.env` is gitignored. Never commit secrets.
- Backend URLs and Firebase config must come from `.env`.
- Do not log tokens, passwords, or PII.

## App Architecture

### Entry
- `index.js` — registers root component via `expo.registerRootComponent(App)`.
- `firebase.js` — initializes Firebase App + Auth + Firestore once. Re-exports auth helpers.
- `polyfills.js` — Hermes/JSC compatibility shims (e.g., `DOMException`). Loaded via `require('./polyfills')` in `index.js` **before** any other imports.

### Navigation
- **AuthStack**: `Login`, `Register`, `ForgotPassword`, `AdminLogin`
- **MainTab** (inside MainStack): `Home`, `Stats`, `Profile`
- **MainStack** (wraps MainTab): adds `ExerciseList`, `VocabExercise`, `TenseExercise`, `ListeningExercise`, `VocabLibrary`, `Dev`
- **AdminStack**: `AdminDashboard`, `AdminVocab`, `AdminExercise`, `AdminExerciseForm`, `AdminUsers`, `Dev`

Auth gating in `App.js`:
- Unauthenticated → `AuthNavigator`
- Authenticated admin → `AdminNavigator`
- Authenticated standard user → `MainNavigator`

User object shape (merged in `App.js`):
```
{
  uid, email, displayName,
  username: string,
  role: 'admin' | 'user'
}
```

### DevScreen Access Control
`DevScreen` is registered in both `MainStack` and `AdminStack`, but access is enforced at render time:
```js
const canAccess = __DEV__ || user?.role === 'admin';
if (!canAccess) return null;
```
UI entry points (e.g., Profile menu) must use the same guard:
```js
if (__DEV__ || user?.role === 'admin') {
  MENU_ITEMS.push({ label: 'Dev Tools', ... });
}
```

### Services & Hooks
- `services/firestoreService.js` — Firestore helpers (vocabulary, exercises, statistics, favorites, admin checks).
- `services/ttsService.js` — Text-to-speech with speed controls and mute support.
- `services/adminService.js` — Admin-specific API/service logic.
- `services/adminApi.js` — Admin API fetch utilities.
- `services/speechLog.js` — Lightweight in-memory speech recognition event logger.
- `hooks/useSpeechRate.js` — Hook for listening and setting TTS speed presets.
- `hooks/useNativeSpeechRecognition.js` — Cross-platform Strategy Pattern adapter for native speech recognition (`expo-speech-recognition`) with graceful fallback.
- `utils/learningEngine.js` — Pure learning session quiz builder, shuffling, and normalization engine.
- `scripts/seedFirestore.js` — Seed data into Firestore (development only).

### Styling
- StyleSheet.create per file.
- Shared constants (e.g., `PRIMARY = '#5B4FCF'`) are defined locally in each file.
- `styles/authStyles.js` provides shared auth-screen styles.

### Testing
- Jest + `@testing-library/react-native`.
- Tests live in `__tests__/`.
- Run: `npm test`
- Babel config supports both Expo preset (app) and Jest preset (tests).

## Conventions
- Use functional components + hooks.
- Import Firebase only from `firebase.js`; do not call `initializeApp` elsewhere.
- Keep comments in Thai where the existing codebase uses Thai; otherwise English.
- Do not add new dependencies without checking `package.json` first.
