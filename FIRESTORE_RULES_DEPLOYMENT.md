# Firestore Security Rules Deployment Guide

## Problem
Admin dashboard doesn't display data because Firestore Security Rules are not deployed.

## Solution: Deploy Rules to Firebase Console

### Step 1: Get the Rules
Open file: `frontend/firestore.rules.txt`

Copy the entire content (everything after the header comments):

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // vocabulary: อ่านได้ทุกคนที่ login, เขียนได้เฉพาะ admin
    match /vocabulary/{docId} {
      allow read: if request.auth != null;
      allow write: if false; // admin ใช้ Admin SDK เท่านั้น
    }

    // exercises: อ่านได้ทุกคนที่ login
    match /exercises/{docId} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    // statistics: อ่าน/เขียนได้เฉพาะเจ้าของข้อมูล
    match /statistics/{docId} {
      allow read, write: if request.auth != null
        && request.auth.token.email == resource.data.email;
      allow create: if request.auth != null;
    }

    // favoriteVocab: อ่าน/เขียนได้เฉพาะเจ้าของ
    match /favoriteVocab/{docId} {
      allow read, write: if request.auth != null
        && request.auth.token.email == resource.data.email;
      allow create: if request.auth != null;
    }

    // admins: อ่านได้สำหรับตรวจสอบสิทธิ์ admin (login check)
    // เขียนได้เฉพาะ backend (Admin SDK) เท่านั้น
    // ⚠️ Bootstrap: ใช้ POST /api/admin/bootstrap เพื่อสร้าง admin แรก
    match /admins/{document=**} {
      allow read: if request.auth != null;
      allow write: if false; // backend handles admin creation/updates via Admin SDK
    }
  }
}
```

### Step 2: Go to Firebase Console

1. Open: https://console.firebase.google.com/
2. Select your project: **my-eng-auth**
3. Navigate: Firestore Database → Rules

### Step 3: Replace Rules

1. Delete the existing rules (usually allow all)
2. Paste the new rules from Step 1
3. Click **Publish** button (สีฟ้า)

### Step 4: Verify Deployment

After publishing, the rules should show as "Published" with a green checkmark.

Wait 1-2 minutes for rules to propagate globally.

### Step 5: Test Admin Dashboard

1. Refresh admin portal: `http://localhost:5000/admin`
2. Should now see:
   - ✅ Overview stats with counts
   - ✅ All sections load with data
   - ✅ Tables display properly

## What Each Rule Does

| Collection | Read | Write | Notes |
|-----------|------|-------|-------|
| `vocabulary` | ✅ Authenticated users | ❌ None | Admin SDK only |
| `exercises` | ✅ Authenticated users | ❌ None | Admin SDK only |
| `statistics` | ✅ Owner only | ✅ Owner | Users track own progress |
| `favoriteVocab` | ✅ Owner only | ✅ Owner | Users manage favorites |
| `admins` | ✅ Authenticated users | ❌ None | **NEW** Admin login check |

## Troubleshooting

**Q: Rules are published but still not working?**
- A: Wait 2-3 minutes for rules to propagate. Then refresh browser (Ctrl+F5 hard refresh).

**Q: Still getting errors in console?**
- A: Open browser DevTools (F12) → Console and check the exact error message.
  - If it says "Permission denied" — rules are blocking the request
  - If it says "collection does not exist" — no data exists yet, which is normal

**Q: How to add test data?**
- A: Either:
  1. Use Firebase Console → Firestore → Add collection/document manually
  2. Use seed script from backend (if available)
  3. Use admin portal UI to create exercises/vocabulary

**Q: Rule deployment failed?**
- A: Check syntax in rules. Must be valid Firestore syntax. Copy-paste carefully from the file.

## Important Notes

- ⚠️ These rules are for **development/basic security** only
- Production might need more restrictive rules (e.g., rate limiting, additional validations)
- Never use "allow all" rules in production
- Always validate on backend (Admin SDK handles this)

## Reference
- [Firestore Security Rules Documentation](https://firebase.google.com/docs/firestore/security/start)
- [Rules Best Practices](https://firebase.google.com/docs/firestore/security/best-practices)
