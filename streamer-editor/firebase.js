// Firebase glue: exposes window.SE_FB for the app. Does nothing until firebase-config.js is filled in.
const cfg = window.FIREBASE_CONFIG;
if (cfg && !/^PASTE/.test(cfg.apiKey || "PASTE")) {
  const V = "10.12.2", B = `https://www.gstatic.com/firebasejs/${V}/`;
  const { initializeApp } = await import(B + "firebase-app.js");
  const A = await import(B + "firebase-auth.js");
  const F = await import(B + "firebase-firestore.js");
  const FN = await import(B + "firebase-functions.js");
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const fns = FN.getFunctions(app, cfg.functionsRegion || "us-central1");
  let unsub = null;
  const ref = (u) => F.doc(db, "users", u.uid);
  window.SE_FB = {
    login: (e, p) => A.signInWithEmailAndPassword(auth, e, p),
    // Registration also sends a verification email to the new address.
    register: async (e, p) => {
      const c = await A.createUserWithEmailAndPassword(auth, e, p);
      try { await A.sendEmailVerification(c.user); } catch (_) {}
      return c;
    },
    // Google: always shows the account chooser. New Google users must then set a password (linked to the same account).
    google: async () => {
      const pr = new A.GoogleAuthProvider();
      pr.setCustomParameters({ prompt: "select_account" });
      const c = await A.signInWithPopup(auth, pr);
      const hasPw = c.user.providerData.some((p) => p.providerId === "password");
      return { email: c.user.email, needsPassword: !hasPw };
    },
    setPassword: async (p) => {
      const u = auth.currentUser;
      await A.linkWithCredential(u, A.EmailAuthProvider.credential(u.email, p));
    },
    saveSettings: (d) => F.setDoc(ref(auth.currentUser), { settings: d }, { merge: true }),
    // Starts a cloud analysis job and streams its progress. cb gets the job document each time it changes.
    startJob: async (url, mode, cb) => {
      if (unsub) unsub();
      const r = await FN.httpsCallable(fns, "createJob")({ url, mode });
      unsub = F.onSnapshot(F.doc(db, "users", auth.currentUser.uid, "jobs", r.data.jobId), (d) => cb(d.data()));
    },
    // Queues an edit job for the user's own local worker and streams its status. cb gets the job document each time it changes.
    submitJob: async (spec, cb) => {
      if (unsub) unsub();
      const col = F.collection(db, "users", auth.currentUser.uid, "jobs");
      const d = await F.addDoc(col, { ...spec, kind: "edit", status: "queued", msg: "queued", createdAt: F.serverTimestamp() });
      unsub = F.onSnapshot(d, (s) => cb(s.data()));
    },
    // OAuth tokens live in a private doc that only the owner can read (admins cannot).
    saveToken: (id, t) => F.setDoc(F.doc(db, "users", auth.currentUser.uid, "private", "oauth"), { [id]: t }, { merge: true }),
    dropToken: (id) => F.setDoc(F.doc(db, "users", auth.currentUser.uid, "private", "oauth"), { [id]: F.deleteField() }, { merge: true }),
    // Each user brings their own Anthropic key. The key doc is write-only from the app (rules deny reads); only the worker reads it.
    saveAnthropic: async (k) => {
      const p = (n) => F.doc(db, "users", auth.currentUser.uid, "private", n);
      await F.setDoc(p("anthropic"), { key: k, savedAt: F.serverTimestamp() });
      await F.setDoc(p("anthropicMeta"), { last4: k.slice(-4), verifiedAt: F.serverTimestamp() });
    },
    // Older versions stored a typed key inside the settings doc. Remove that copy once it has been moved.
    dropOldKeys: () => F.updateDoc(F.doc(db, "users", auth.currentUser.uid), { "settings.keys": F.deleteField() }),
    removeAnthropic: async () => {
      const p = (n) => F.doc(db, "users", auth.currentUser.uid, "private", n);
      await F.deleteDoc(p("anthropicMeta"));
      await F.deleteDoc(p("anthropic"));
    },
    logout: () => { if (unsub) unsub(); return A.signOut(auth); },
  };
  // Site settings (banner, pages, texts, MCP list) edited by the admin. Public read.
  F.onSnapshot(F.doc(db, "config", "site"), (d) => window.SE_onConfig && window.SE_onConfig(d.exists() ? d.data() : null), () => {});
  A.onAuthStateChanged(auth, async (u) => {
    let s = null;
    if (u) {
      try {
        const d = await F.getDoc(ref(u));
        let data;
        if (!d.exists()) {
          // First login: store the profile (never the password; Auth keeps that).
          data = { email: u.email, createdAt: F.serverTimestamp(), status: "active", plan: "free", settings: {} };
          await F.setDoc(ref(u), data);
        } else {
          data = d.data();
          F.updateDoc(ref(u), { lastLogin: F.serverTimestamp() }).catch(() => {});
        }
        if (data.status === "disabled") {
          window.SE_note = "disabled";
          await A.signOut(auth);
          window.SE_onUser && window.SE_onUser(null);
          return;
        }
        s = data.settings || null;
      } catch (_) {}
    }
    let adm = false;
    if (u) { try { adm = (await F.getDoc(F.doc(db, "admins", u.uid))).exists(); } catch (_) {} }
    let ai = { saved: false };
    if (u) { try { const m = await F.getDoc(F.doc(db, "users", u.uid, "private", "anthropicMeta")); if (m.exists()) ai = { saved: true, last4: m.data().last4 || "" }; } catch (_) {} }
    window.SE_onUser && window.SE_onUser(u, s, adm, ai);
  });
}
