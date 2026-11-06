# Project MyEng - Boundaries & Scope Guidelines

## Core Principles
1. **100% Free & Unlimited:** No energy limits, paywalls, or feature locking for end-users.
   *(หมายเหตุต้นทุนนักพัฒนา: การคอมไพล์และติดตั้งแอปบนอุปกรณ์ iOS จริงจำเป็นต้องมีบัญชี Apple Developer Program 99 USD/ปี ของทาง Apple แต่สำหรับการเรียนรู้บน Web, Android, และ iOS Simulator สามารถใช้งานได้ฟรี 100%)*
2. **Target Audience:** Beginner level English learners (CEFR A1–A2).
3. **Strict Compliance:** DO NOT add unapproved features, extra complexities, or third-party paid services. ALWAYS consult and ask the user for approval before adding or modifying anything outside this document.

## System Architecture & Tech Stack
- **Frontend Framework:** React Native with Expo (Supporting Expo Go & Web)
- **Styling:** React Native StyleSheet.create (Primary)
- **Backend & Database:** Firebase Authentication & Cloud Firestore
- **Audio & Speech:** Web Speech API / Native Voice Modules (Text-to-Speech with speed control, Speech Recognition for pronunciation test)

## Detailed Feature Scope

### 1. General & Member Features
- **Authentication:** Email/Password Register, Login, Logout, Forgot Password / Password Reset.
- **Lesson Categories (A1-A2 Level):**
  1. Vocabulary (Everyday words)
  2. Grammar & Tense (Present, Past, Future)
  3. Conversation (Daily situations)
- **Exercise Types:**
  - Thai-English Word Matching
  - Word Spelling
  - Sentence Ordering / Fill-in-the-blank
  - Speech Practice (Listen via TTS and Speak via Speech Recognition)
- **Personal Tools & Analytics:**
  - Favorite Words List (Save/Unsave words)
  - Learning Progress & Score History (Pass threshold set at >= 80%)

### 2. Administrator Features (Admin)
- **Admin Authentication:** Dedicated Admin Login/Logout.
- **Member Management:** View list, Edit, and Delete member accounts.
- **Content Management (CRUD):** Add, Edit, Delete Vocabulary Bank, Tense exercises, Conversation items, and Audio settings.

## Strict Working Rules for AI Agent
- **Rule 1 (Consultation First):** If a task implies altering database schemas, adding new external libraries, or creating new screens not mentioned in this scope, ASK THE USER FIRST.
- **Rule 2 (No Omitting):** Do not omit core requirements (e.g., 80% pass score, speech recognition, admin CRUD, or favorites feature).
- **Rule 3 (Cross-Platform Compatibility):** Always test code to ensure it runs without breaking on both Expo Web and Expo Go (Mobile).
