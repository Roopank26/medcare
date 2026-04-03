/**
 * Medcare — Firebase Storage Helpers (Production)
 *
 * - Validates file type and size before upload
 * - Real upload progress via uploadBytesResumable
 * - Returns download URL + storage path for Firestore metadata
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./config";

/** Allowed MIME types for medical report uploads. */
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const STORAGE_ERRORS = {
  "storage/unauthorized":       "Permission denied. Check Firebase Storage rules.",
  "storage/canceled":           "Upload was cancelled.",
  "storage/unknown":            "An unknown storage error occurred. Please try again.",
  "storage/quota-exceeded":     "Storage quota exceeded. Contact support.",
  "storage/unauthenticated":    "Please sign in to upload files.",
  "storage/retry-limit-exceeded": "Upload failed after too many retries. Check your connection.",
};

const friendlyStorageError = (code) =>
  STORAGE_ERRORS[code] || "Upload failed. Please try again.";

/**
 * Upload a file to Firebase Storage with progress tracking.
 *
 * @param {File}     file         - The File object
 * @param {string}   userId       - auth.currentUser.uid
 * @param {string}   reportType   - e.g. "Blood Test"
 * @param {Function} onProgress   - Called with 0–100
 * @returns Promise<{ url, storagePath, error }>
 */
export const uploadReportFile = (file, userId, reportType, onProgress) =>
  new Promise((resolve) => {
    if (!file) {
      resolve({ url: null, storagePath: null, error: "No file provided." });
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      resolve({ url: null, storagePath: null, error: "File too large. Maximum size is 20 MB." });
      return;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      resolve({ url: null, storagePath: null, error: "File type not allowed. Use PDF, JPG, PNG, or DOCX." });
      return;
    }

    // Sanitize filename: keep alphanumeric, dot, hyphen, underscore
    const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `reports/${userId}/${Date.now()}_${safeName}`;

    const storageRef  = ref(storage, storagePath);
    const uploadTask  = uploadBytesResumable(storageRef, file, {
      contentType: file.type,
      customMetadata: {
        uploadedBy:  userId,
        reportType:  reportType || "General",
        originalName: file.name,
      },
    });

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (typeof onProgress === "function") onProgress(pct);
      },
      (err) => {
        resolve({
          url:         null,
          storagePath: null,
          error:       friendlyStorageError(err.code),
        });
      },
      async () => {
        try {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ url, storagePath, error: null });
        } catch (err) {
          resolve({ url: null, storagePath, error: err.message });
        }
      }
    );
  });

/**
 * Delete a file from Firebase Storage by its path.
 * Silently succeeds if the file no longer exists.
 */
export const deleteReportFile = async (storagePath) => {
  try {
    await deleteObject(ref(storage, storagePath));
    return { error: null };
  } catch (err) {
    if (err.code === "storage/object-not-found") return { error: null };
    console.error("[Storage] deleteReportFile:", err.message);
    return { error: err.message };
  }
};

/** Format bytes to a human-readable string. */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "—";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};
