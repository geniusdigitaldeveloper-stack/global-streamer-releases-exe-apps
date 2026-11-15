// Usage: GOOGLE_APPLICATION_CREDENTIALS=key.json node make-admin.mjs you@example.com
// Registers an existing Auth user as admin (writes /admins/{uid}). Run it only for your own account.
import admin from "firebase-admin";
admin.initializeApp({ projectId: "streamer-editor" });
const user = await admin.auth().getUserByEmail(process.argv[2]);
await admin.firestore().doc(`admins/${user.uid}`).set({ email: user.email, since: admin.firestore.FieldValue.serverTimestamp() });
console.log("admin added:", user.email, user.uid);
