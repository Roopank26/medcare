#!/usr/bin/env node
/**
 * Verify Firestore rules for login recovery + owner isolation.
 * Uses Firebase Admin (custom token) + client SDK against production project.
 */
const fs = require("fs");
const path = require("path");

const PROJECT_ID = "madecare-9b986";
const SA_PATH = path.join(__dirname, "..", ".firebase-sa.json");
const clientEnvPath = path.join(__dirname, "..", "client", ".env");

function loadClientFirebaseConfig() {
  const env = fs.readFileSync(clientEnvPath, "utf8");
  const pick = (key) => {
    const m = env.match(new RegExp(`^${key}=(.+)$`, "m"));
    return m ? m[1].trim() : "";
  };
  return {
    apiKey: pick("REACT_APP_FIREBASE_API_KEY"),
    authDomain: pick("REACT_APP_FIREBASE_AUTH_DOMAIN"),
    projectId: pick("REACT_APP_FIREBASE_PROJECT_ID"),
    storageBucket: pick("REACT_APP_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: pick("REACT_APP_FIREBASE_MESSAGING_SENDER_ID"),
    appId: pick("REACT_APP_FIREBASE_APP_ID"),
  };
}

async function runAsUser(uid, fn) {
  const admin = require(path.join(__dirname, "..", "server", "node_modules", "firebase-admin"));
  const { initializeApp } = require(path.join(__dirname, "..", "client", "node_modules", "firebase/app"));
  const { getAuth, signInWithCustomToken, signOut } = require(path.join(
    __dirname,
    "..",
    "client",
    "node_modules",
    "firebase/auth"
  ));
  const { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, serverTimestamp } =
    require(path.join(__dirname, "..", "client", "node_modules", "firebase/firestore"));

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)) });
  }

  const customToken = await admin.auth().createCustomToken(uid);
  const app = initializeApp(loadClientFirebaseConfig(), `rules-test-${uid}`);
  const auth = getAuth(app);
  const db = getFirestore(app);

  await signInWithCustomToken(auth, customToken);
  try {
    return await fn({ db, doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, serverTimestamp, uid });
  } finally {
    await signOut(auth).catch(() => {});
  }
}

async function ensureTestUser(uid, email) {
  const admin = require(path.join(__dirname, "..", "server", "node_modules", "firebase-admin"));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(require(SA_PATH)) });
  }
  try {
    await admin.auth().getUser(uid);
  } catch {
    await admin.auth().createUser({ uid, email, password: "RulesTest!2026Secure" });
  }
  // Remove profile so recovery path is exercised
  await admin.firestore().doc(`users/${uid}`).delete().catch(() => {});
}

function assertDenied(promise, label) {
  return promise
    .then(() => {
      throw new Error(`${label}: expected permission-denied but succeeded`);
    })
    .catch((err) => {
      const code = err.code || err.message || "";
      if (!String(code).includes("permission-denied") && !String(code).includes("Missing or insufficient")) {
        throw new Error(`${label}: unexpected error: ${err.message}`);
      }
    });
}

async function main() {
  const ts = Date.now();
  const userA = `rules-test-a-${ts}`;
  const userB = `rules-test-b-${ts}`;
  const emailA = `rules.test.a.${ts}@example.com`;
  const emailB = `rules.test.b.${ts}@example.com`;

  console.log("[verify] Preparing test users...");
  await ensureTestUser(userA, emailA);
  await ensureTestUser(userB, emailB);

  console.log("[verify] User A — profile recovery (setDoc users/{uid})...");
  await runAsUser(userA, async ({ db, doc, getDoc, setDoc, serverTimestamp, uid }) => {
    const ref = doc(db, "users", uid);
    const missing = await getDoc(ref);
    if (missing.exists()) throw new Error("Expected missing profile before recovery");

    await setDoc(ref, {
      uid,
      name: "Rules Test A",
      email: emailA,
      role: "patient",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const created = await getDoc(ref);
    if (!created.exists()) throw new Error("Profile not readable after create");
    if (created.data().uid !== uid) throw new Error("Profile uid mismatch");
  });
  console.log("  ✅ users create + read");

  console.log("[verify] User A — medical_history write + read...");
  await runAsUser(userA, async ({ db, collection, addDoc, query, where, getDocs, serverTimestamp, uid }) => {
    await addDoc(collection(db, "medical_history"), {
      userId: uid,
      disease: "Test",
      confidence: 0.9,
      symptoms: ["fever"],
      timestamp: serverTimestamp(),
    });
    const snap = await getDocs(query(collection(db, "medical_history"), where("userId", "==", uid)));
    if (snap.empty) throw new Error("medical_history query returned no docs");
  });
  console.log("  ✅ medical_history owner access");

  console.log("[verify] User A — symptoms create...");
  await runAsUser(userA, async ({ db, collection, addDoc, serverTimestamp, uid }) => {
    await addDoc(collection(db, "symptoms"), {
      userId: uid,
      symptoms: "fever, cough",
      diagnosis: "Test",
      createdAt: serverTimestamp(),
    });
  });
  console.log("  ✅ symptoms create");

  console.log("[verify] User B — cannot read User A profile...");
  await runAsUser(userB, async ({ db, doc, getDoc }) => {
    await assertDenied(getDoc(doc(db, "users", userA)), "cross-user users read");
  });
  console.log("  ✅ cross-user users blocked");

  console.log("[verify] Cleanup test users...");
  const admin = require(path.join(__dirname, "..", "server", "node_modules", "firebase-admin"));
  for (const uid of [userA, userB]) {
    await admin.firestore().doc(`users/${uid}`).delete().catch(() => {});
    await admin.auth().deleteUser(uid).catch(() => {});
  }

  console.log("\n[verify] ✅ All Firestore rule checks passed");
}

main().catch((err) => {
  console.error("\n[verify] ❌", err.message);
  process.exit(1);
});
