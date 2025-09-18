# Homework Helper (Full Firebase) — Green & Gold

A Firebase-powered study collaboration app with Google sign-in, class sorting, question uploads (with images), replies, “mark helpful” (+10 points), and a leaderboard.

## Quick Start (GitHub Pages)

1. **Create repo** named `homework-helper-full` (or anything).
2. Upload these files/folders to GitHub (drag & drop).
3. In `vite.config.js`, set `base` to `/<your-repo-name>/`.
4. Repo → **Settings** → **Pages** → Source: **GitHub Actions**.
5. Firebase Console → Auth → Sign-in method → **Enable Google**.
6. Firebase Console → Auth → **Authorized domains** → add `your-username.github.io`.
7. Edit `src/App.jsx` → replace Firebase config with your values (Project settings → General → Your apps).

### Collections (auto-created on first write)
- users, classes, questions, posts

### Optional Firestore rules (simplified, tighten for production)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read: if request.auth!=null;
      allow create, update: if request.auth != null && request.auth.uid == uid;
    }
    match /classes/{id} {
      allow read: if true;
      allow create: if request.auth!=null;
    }
    match /questions/{id} {
      allow read: if true;
      allow create, update: if request.auth!=null;
    }
    match /posts/{id} {
      allow read: if true;
      allow create, update: if request.auth!=null;
    }
  }
}
```
