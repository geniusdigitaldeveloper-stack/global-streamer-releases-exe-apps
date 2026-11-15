// Firebase glue: exposes window.SE_FB for the app. Does nothing until firebase-config.js is filled in.
const cfg = window.FIREBASE_CONFIG;
if (cfg && !/^PASTE/.test(cfg.apiKey || "PASTE")) {
  const V = "10.12.2", B = `https://www.gstatic.com/firebasejs/${V}/`;
  const { initializeApp } = await import(B + "firebase-app.js");
  const A = await import(B + "firebase-auth.js");
  const F = await import(B + "firebase-firestore.js");
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
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
    logout: () => A.signOut(auth),
  };
  A.onAuthStateChanged(auth, async (u) => {
    let s = null;
    if (u) { try { const d = await F.getDoc(ref(u)); s = d.exists() ? d.data().settings : null; } catch (_) {} }
    window.SE_onUser && window.SE_onUser(u, s);
  });
}
