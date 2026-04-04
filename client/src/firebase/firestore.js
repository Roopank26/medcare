/**
 * Medcare — Firestore Database Layer  (madecare-9b986)
 *
 * Collections: users | patients | symptoms | reports | appointments
 *
 * Design principles:
 * - All writes sanitize data before persisting
 * - onSnapshot listeners always return unsubscribe functions
 * - Composite index errors handled with automatic fallback queries
 * - Timestamps normalized to ISO strings for consistent serialization
 */

import {
  doc, collection, getDoc, getDocs, addDoc, setDoc,
  updateDoc, deleteDoc, query, where, orderBy,
  onSnapshot, serverTimestamp, Timestamp, limit,
} from "firebase/firestore";
import { db } from "./config";

// ── Internal helpers ─────────────────────────────────────────

/** Convert Firestore Timestamp or ISO string → ISO string. */
const toISO = (val) => {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate().toISOString();
  return typeof val === "string" ? val : null;
};

/**
 * One-shot fetch with automatic fallback for missing composite indexes.
 * Tries the ordered query first; falls back to unordered on index error.
 */
const safeDocs = async (orderedQ, fallbackQ) => {
  try {
    const s = await getDocs(orderedQ);
    return s.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    if (err.code === "failed-precondition" || err.message?.includes("index")) {
      console.warn("[Firestore] Index not ready, falling back to unordered query");
      try {
        const s = await getDocs(fallbackQ);
        return s.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (e2) {
        console.error("[Firestore] safeDocs fallback failed:", e2.message);
        return [];
      }
    }
    throw err;
  }
};

/**
 * Real-time listener with automatic fallback on index errors.
 * @returns unsubscribe function — always call this in useEffect cleanup.
 */
const safeSnapshot = (orderedQ, fallbackQ, callback) => {
  let innerUnsub = null;

  const unsub = onSnapshot(
    orderedQ,
    (snap) => callback({ docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: null }),
    (err) => {
      if (err.code === "failed-precondition" || err.message?.includes("index")) {
        console.warn("[Firestore] onSnapshot index fallback triggered");
        innerUnsub = onSnapshot(
          fallbackQ,
          (snap) => callback({ docs: snap.docs.map((d) => ({ id: d.id, ...d.data() })), error: null }),
          (e2) => callback({ docs: [], error: e2.message })
        );
      } else {
        callback({ docs: [], error: err.message });
      }
    }
  );

  return () => {
    unsub();
    if (innerUnsub) innerUnsub();
  };
};

// ═════════════════════════════════════════════════════════════
//  USERS
// ═════════════════════════════════════════════════════════════

/** Create user profile at registration. Uses uid as doc ID to prevent duplicates. */
export const createUserProfile = async (uid, data) => {
  try {
    await setDoc(doc(db, "users", uid), {
      uid,
      name: data.name?.trim() || "",
      email: data.email?.trim().toLowerCase() || "",
      role: data.role || "patient",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return { error: null };
  } catch (err) {
    console.error("[Firestore] createUserProfile:", err.message);
    return { error: err.message };
  }
};

/** Fetch user profile by UID. Returns null if not found. */
export const getUserProfile = async (uid) => {
  try {
    console.log('[Firestore] Fetching user profile for UID:', uid);
    const docRef = doc(db, "users", uid);
    console.log('[Firestore] Document reference path:', docRef.path);

    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      console.log('[Firestore] ✅ Document found, data:', data);
      return { uid, ...snap.data() };
    } else {
      console.warn('[Firestore] ⚠️ Document does NOT exist at users/' + uid);
      console.warn('[Firestore] Possible causes:');
      console.warn('[Firestore]   - Profile wasn\'t created during registration');
      console.warn('[Firestore]   - Profile is in a different collection');
      console.warn('[Firestore]   - Document was deleted');
      return null;
    }
  } catch (err) {
    console.error("[Firestore] getUserProfile error:", err.message);
    console.error('[Firestore] Error code:', err.code);
    return null;
  }
};

/**
 * Update editable profile fields.
 * Prevents role, email, uid, and createdAt from being mutated.
 */
export const updateUserProfile = async (uid, data) => {
  try {
    // Strip protected fields
    const { role, email, uid: _uid, createdAt, ...safe } = data;
    await updateDoc(doc(db, "users", uid), {
      ...safe,
      updatedAt: serverTimestamp(),
    });
    return { error: null };
  } catch (err) {
    console.error("[Firestore] updateUserProfile:", err.message);
    return { error: err.message };
  }
};

// ═════════════════════════════════════════════════════════════
//  PATIENTS
// ═════════════════════════════════════════════════════════════

/** Add a new patient. doctorId must be auth.currentUser.uid. */
export const addPatientDoc = async (data) => {
  try {
    const ref = await addDoc(collection(db, "patients"), {
      ...data,
      doctorId: data.doctorId,
      lastVisit: new Date().toISOString().split("T")[0],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { id: ref.id, error: null };
  } catch (err) {
    console.error("[Firestore] addPatientDoc:", err.message);
    return { id: null, error: err.message };
  }
};

/** One-shot patient fetch, filtered by doctorId. */
export const getPatientsDoc = async (doctorId = null) => {
  try {
    const col = collection(db, "patients");
    const q = doctorId
      ? query(col, where("doctorId", "==", doctorId), orderBy("createdAt", "desc"))
      : query(col, orderBy("createdAt", "desc"));
    const fb = doctorId ? query(col, where("doctorId", "==", doctorId)) : col;
    const patients = await safeDocs(q, fb);
    return { patients, error: null };
  } catch (err) {
    return { patients: [], error: err.message };
  }
};

/**
 * Real-time patient listener.
 * Doctors only see their own patients (doctorId = auth.currentUser.uid).
 */
export const subscribeToPatients = (doctorId, callback) => {
  const col = collection(db, "patients");
  const q = doctorId
    ? query(col, where("doctorId", "==", doctorId), orderBy("createdAt", "desc"))
    : query(col, orderBy("createdAt", "desc"));
  const fb = doctorId ? query(col, where("doctorId", "==", doctorId)) : col;

  return safeSnapshot(q, fb, ({ docs, error }) => {
    callback({ patients: docs, error });
  });
};

/** Update a patient record. */
export const updatePatientDoc = async (id, data) => {
  try {
    await updateDoc(doc(db, "patients", id), { ...data, updatedAt: serverTimestamp() });
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

/** Delete a patient record. */
export const deletePatientDoc = async (id) => {
  try {
    await deleteDoc(doc(db, "patients", id));
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

// ═════════════════════════════════════════════════════════════
//  SYMPTOMS
// ═════════════════════════════════════════════════════════════

/** Save ML symptom assessment. userId = auth.currentUser.uid. */
export const saveSymptomDoc = async (userId, data) => {
  try {
    const ref = await addDoc(collection(db, "symptoms"), {
      userId,
      ...data,
      createdAt: serverTimestamp(),
    });
    return { id: ref.id, error: null };
  } catch (err) {
    console.error("[Firestore] saveSymptomDoc:", err.message);
    return { id: null, error: err.message };
  }
};

/** One-shot medical history fetch. No orderBy → no composite index required. Sorted in JS. */
export const getSymptomsDoc = async (userId) => {
  try {
    console.log("UID:", userId);
    const col = collection(db, "medical_history");
    // Plain where-only query — no composite index required
    const snap = await getDocs(query(col, where("userId", "==", userId)));
    console.log("Docs:", snap.docs.length);

    const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Sort latest first in JS
    raw.sort((a, b) => {
      const aTs = a.timestamp?.seconds ?? 0;
      const bTs = b.timestamp?.seconds ?? 0;
      return bTs - aTs;
    });

    return {
      symptoms: raw.map((d) => ({
        ...d,
        // Map Firestore field names → UI expected names
        diagnosis: d.disease,
        selectedTags: Array.isArray(d.symptoms) ? d.symptoms : [],
        createdAt: d.timestamp,
        timestamp: toISO(d.timestamp) || d.date,
      })),
      error: null,
    };
  } catch (err) {
    console.error("[Firestore] getSymptomsDoc error:", err.message);
    return { symptoms: [], error: err.message };
  }
};

/** Real-time medical history listener. No orderBy → no composite index required. Sorted in JS. */
export const subscribeToSymptoms = (userId, callback) => {
  const col = collection(db, "medical_history");
  // Plain where-only query — no index needed
  const q = query(col, where("userId", "==", userId));

  const unsub = onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Sort latest first in JS
      docs.sort((a, b) => {
        const aTs = a.timestamp?.seconds ?? 0;
        const bTs = b.timestamp?.seconds ?? 0;
        return bTs - aTs;
      });
      callback({
        symptoms: docs.map((d) => ({
          ...d,
          diagnosis: d.disease,
          selectedTags: Array.isArray(d.symptoms) ? d.symptoms : [],
          createdAt: d.timestamp,
          timestamp: toISO(d.timestamp) || d.date,
        })),
        error: null,
      });
    },
    (err) => {
      console.error("[Firestore] subscribeToSymptoms error:", err.message);
      callback({ symptoms: [], error: err.message });
    }
  );

  return unsub;
};

/**
 * Named alias for MedicalHistory.jsx — calls callback(mappedArray) directly.
 * Normalization (disease→diagnosis, symptoms→selectedTags) done here so
 * components receive clean, type-safe data and need zero extra processing.
 */
export const subscribeToMedicalHistory = (userId, callback) => {
  const col = collection(db, "medical_history");
  const q = query(col, where("userId", "==", userId));

  return onSnapshot(
    q,
    (snapshot) => {
      const raw = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      raw.sort((a, b) => {
        const aTs = a.timestamp?.seconds ?? 0;
        const bTs = b.timestamp?.seconds ?? 0;
        return bTs - aTs;
      });

      console.log("RAW DATA:", raw);

      const mapped = raw.map((d) => ({
        id: d.id,
        diagnosis: d.disease || d.diagnosis || "Unknown",
        selectedTags: Array.isArray(d.symptoms)
          ? d.symptoms
          : typeof d.symptoms === "string" && d.symptoms
            ? d.symptoms.split(",").map((s) => s.trim()).filter(Boolean)
            : [],
        createdAt: d.timestamp || null,
        timestamp: toISO(d.timestamp) || d.date || null,
        confidence: Number(d.confidence) || 0,
        severity: d.severity
          ? d.severity.charAt(0).toUpperCase() + d.severity.slice(1).toLowerCase()
          : undefined,
        action: d.action || null,
        recommendations: Array.isArray(d.recommendations) ? d.recommendations : [],
        alternatives: Array.isArray(d.alternatives) ? d.alternatives : [],
        date: d.date || null,
        userId: d.userId || null,
      }));

      console.log("MAPPED DATA:", mapped);
      callback(mapped);


    },
    (err) => {
      console.error("[Firestore] subscribeToMedicalHistory error:", err.message);
      callback([]); // safe empty array on error
    }
  );
};

// ═════════════════════════════════════════════════════════════
//  REPORTS
// ═════════════════════════════════════════════════════════════

/** Save report metadata after Firebase Storage upload. */
export const saveReportDoc = async (data) => {
  try {
    const ref = await addDoc(collection(db, "reports"), {
      ...data,
      uploadedAt: serverTimestamp(),
    });
    return { id: ref.id, error: null };
  } catch (err) {
    return { id: null, error: err.message };
  }
};

/** Fetch a patient's own reports. */
export const getReportsDoc = async (userId) => {
  try {
    const col = collection(db, "reports");
    const raw = await safeDocs(
      query(col, where("userId", "==", userId), orderBy("uploadedAt", "desc")),
      query(col, where("userId", "==", userId))
    );
    return {
      reports: raw.map((d) => ({ ...d, uploadedAt: toISO(d.uploadedAt) || d.uploadedAt })),
      error: null,
    };
  } catch (err) {
    return { reports: [], error: err.message };
  }
};

/** Fetch all reports (doctor view). */
export const getAllReportsDoc = async () => {
  try {
    const col = collection(db, "reports");
    const raw = await safeDocs(query(col, orderBy("uploadedAt", "desc")), col);
    return {
      reports: raw.map((d) => ({ ...d, uploadedAt: toISO(d.uploadedAt) || d.uploadedAt })),
      error: null,
    };
  } catch (err) {
    return { reports: [], error: err.message };
  }
};

// ═════════════════════════════════════════════════════════════
//  APPOINTMENTS
// ═════════════════════════════════════════════════════════════

/** Book a new appointment. */
export const saveAppointmentDoc = async (data) => {
  try {
    const ref = await addDoc(collection(db, "appointments"), {
      ...data,
      createdAt: serverTimestamp(),
    });
    return { id: ref.id, error: null };
  } catch (err) {
    return { id: null, error: err.message };
  }
};

/**
 * Real-time appointment listener.
 * Patients: where userId == uid
 * Doctors: where doctorId == uid
 */
export const subscribeToAppointments = (userId, isDoctor, callback) => {
  const col = collection(db, "appointments");
  const field = isDoctor ? "doctorId" : "userId";
  const q = query(col, where(field, "==", userId), orderBy("date", "asc"));
  const fb = query(col, where(field, "==", userId));

  return safeSnapshot(q, fb, ({ docs, error }) => {
    callback({ appointments: docs, error });
  });
};

/** Update appointment (e.g. status change). */
export const updateAppointmentDoc = async (id, data) => {
  try {
    await updateDoc(doc(db, "appointments", id), { ...data, updatedAt: serverTimestamp() });
    return { error: null };
  } catch (err) {
    return { error: err.message };
  }
};

/** Cancel appointment (sets status to "Cancelled"). */
export const cancelAppointmentDoc = (id) =>
  updateAppointmentDoc(id, { status: "Cancelled" });

// ═════════════════════════════════════════════════════════════
//  CHAT FEEDBACK  (Phase 7)
// ═════════════════════════════════════════════════════════════

/**
 * Save a thumbs-up/down feedback record for a chatbot response.
 * Stored at: chatFeedback/{auto-id}
 * Schema is intentionally flat for easy dataset export / retraining.
 */
export const saveChatFeedback = async (userId, feedbackData) => {
  try {
    const ref = await addDoc(collection(db, 'chatFeedback'), {
      userId,
      messageId: feedbackData.messageId || null,
      content: feedbackData.content || '',
      helpful: feedbackData.helpful,          // boolean
      ts: feedbackData.ts || new Date().toISOString(),
      savedAt: serverTimestamp(),
    });
    return { id: ref.id, error: null };
  } catch (err) {
    return { id: null, error: err.message };
  }
};

/**
 * Fetch all chat feedback records (admin/retraining view).
 * Returns records ordered by savedAt desc, limit 500 for safety.
 */
export const getChatFeedback = async () => {
  try {
    const col = collection(db, 'chatFeedback');
    const raw = await safeDocs(
      query(col, orderBy('savedAt', 'desc'), limit(500)),
      query(col, limit(500)),
    );
    return { feedback: raw, error: null };
  } catch (err) {
    return { feedback: [], error: err.message };
  }
};

// ═════════════════════════════════════════════════════════════
//  ML PREDICTION FEEDBACK  (Phase 7)
// ═════════════════════════════════════════════════════════════

/**
 * Save feedback on ML predictions ("Was this diagnosis correct?").
 * Retraining-ready: includes all inputs + model output + user verdict.
 */
export const savePredictionFeedback = async (userId, feedbackData) => {
  try {
    const ref = await addDoc(collection(db, 'predictionFeedback'), {
      userId,
      symptoms: feedbackData.symptoms || '',
      disease: feedbackData.disease || '',
      confidence: feedbackData.confidence || 0,
      helpful: feedbackData.helpful,           // boolean
      comment: feedbackData.comment || '',  // optional text correction
      ts: feedbackData.ts || new Date().toISOString(),
      savedAt: serverTimestamp(),
    });
    return { id: ref.id, error: null };
  } catch (err) {
    return { id: null, error: err.message };
  }
};
