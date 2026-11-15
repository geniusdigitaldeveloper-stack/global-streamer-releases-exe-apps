# Streamer Editor

Sub-app of Global Streamer: paste a YouTube live replay or game recording, find hook moments, edit, export and post.

Plain static site (no build step). Open `index.html` through any static server.

## Accounts and admin
- Public app: `index.html`. Anyone can register. Login is handled by Firebase Auth (passwords are never stored in Firestore); Firestore `users/{uid}` holds email, plan (`free`/`pro`), status (`active`/`disabled`), settings.
- Admin app: `admin/index.html` (same Firebase project). Only accounts listed in Firestore `admins/{uid}` get in. Clients cannot write `admins`.
- Make yourself admin: register/log in once in the public app, then run `GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/make-admin.mjs your@email` or create the doc `admins/<your uid>` in the Firebase console.
- Admin can list users, switch plan, and disable or enable accounts. A disabled user is signed out and cannot start jobs.

## Firebase setup
1. Create a Firebase project, enable **Authentication** (Email/Password and Google) and **Firestore**.
2. Register a Web app and paste its config into `firebase-config.js`.
3. Deploy rules: `firebase deploy --only firestore:rules` (from this folder).
4. Add your site domain under Authentication > Settings > Authorized domains.

Until the config is filled in, the app runs in local demo mode.

## Analysis pipeline (real hook finding)
Flow: app -> Cloud Function `createJob` -> GitHub Actions (`.github/workflows/streamer-editor-analyze.yml`) -> yt-dlp captions -> Claude -> Firestore `users/{uid}/jobs/{id}` -> app.
Needs (all secrets, never in code):
- Function secret `GH_DISPATCH_TOKEN` (`firebase functions:secrets:set GH_DISPATCH_TOKEN`): fine-grained GitHub token with Contents read/write on this repo.
- Repo Actions secrets `ANTHROPIC_API_KEY` and `FIREBASE_SERVICE_ACCOUNT` (service account JSON of the Firebase project).
- Deploy: `firebase deploy --only functions,firestore:rules`. Limit is 10 jobs per user per day (`MAX_JOBS_PER_DAY`).
Test the pure logic: `cd pipeline && node test.mjs`.
Known limits: it reads YouTube captions, so a video with no captions gives no result. YouTube may block downloads from GitHub runners; if so, move the worker to a small server.

## Not done yet
- Cloud rendering (cutting, effects, export) and posting (Zernio / Metricool) are still simulated in the UI.
- API keys typed in Settings are stored in the user's own Firestore document. Move them behind a Cloud Function before real use.
- The "registered" notification for Google sign-in needs a Cloud Function or the Trigger Email extension. Email sign-up sends Firebase's verification email.
