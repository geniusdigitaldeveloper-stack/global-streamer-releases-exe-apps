# Streamer Editor

Sub-app of Global Streamer: paste a YouTube live replay or game recording, find hook moments, edit, export and post.

Plain static site (no build step). Open `index.html` through any static server.

## Firebase setup
1. Create a Firebase project, enable **Authentication** (Email/Password and Google) and **Firestore**.
2. Register a Web app and paste its config into `firebase-config.js`.
3. Deploy rules: `firebase deploy --only firestore:rules` (from this folder).
4. Add your site domain under Authentication > Settings > Authorized domains.

Until the config is filled in, the app runs in local demo mode.

## Not done yet
- AI hook analysis, cloud rendering and posting (Zernio / Metricool MCP) are still simulated in the UI.
- API keys typed in Settings are stored in the user's own Firestore document. Move them behind a Cloud Function before real use.
- The "registered" notification for Google sign-in needs a Cloud Function or the Trigger Email extension. Email sign-up sends Firebase's verification email.
