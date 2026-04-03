/**
 * Medcare — Form Validation Utilities
 *
 * Centralized validation so every form uses consistent rules.
 * Returns { valid: boolean, error: string }
 */

/** Validate an email address. */
export const validateEmail = (email) => {
  if (!email?.trim()) return { valid: false, error: "Email is required." };
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(email.trim())) return { valid: false, error: "Enter a valid email address." };
  return { valid: true, error: null };
};

/** Validate a password (min 8 chars, at least one digit). */
export const validatePassword = (password) => {
  if (!password) return { valid: false, error: "Password is required." };
  if (password.length < 8) return { valid: false, error: "Password must be at least 8 characters." };
  return { valid: true, error: null };
};

/** Validate a non-empty name field. */
export const validateName = (name) => {
  if (!name?.trim()) return { valid: false, error: "Name is required." };
  if (name.trim().length < 2) return { valid: false, error: "Name must be at least 2 characters." };
  if (name.trim().length > 100) return { valid: false, error: "Name is too long (max 100 chars)." };
  return { valid: true, error: null };
};

/** Check password confirmation. */
export const validatePasswordMatch = (password, confirm) => {
  if (!confirm) return { valid: false, error: "Please confirm your password." };
  if (password !== confirm) return { valid: false, error: "Passwords do not match." };
  return { valid: true, error: null };
};

/** Validate a date is not in the past. */
export const validateFutureDate = (dateStr) => {
  if (!dateStr) return { valid: false, error: "Please select a date." };
  const today = new Date().toISOString().split("T")[0];
  if (dateStr < today) return { valid: false, error: "Cannot select a past date." };
  return { valid: true, error: null };
};

/** Validate numeric age (0–150). */
export const validateAge = (age) => {
  const n = Number(age);
  if (!age && age !== 0) return { valid: false, error: "Age is required." };
  if (isNaN(n) || n < 0 || n > 150) return { valid: false, error: "Enter a valid age (0–150)." };
  return { valid: true, error: null };
};

/** Validate symptom input is not empty. */
export const validateSymptoms = (symptoms) => {
  if (!symptoms?.trim()) return { valid: false, error: "Please describe your symptoms." };
  if (symptoms.trim().length < 3) return { valid: false, error: "Please provide more detail." };
  if (symptoms.length > 2000) return { valid: false, error: "Symptoms text too long (max 2000 chars)." };
  return { valid: true, error: null };
};

/**
 * Run multiple validators and return the first error.
 * @param  {Array<[value, validatorFn]>} checks
 * @returns {string|null} first error message, or null if all pass
 */
export const runValidations = (checks) => {
  for (const [value, fn] of checks) {
    const { valid, error } = fn(value);
    if (!valid) return error;
  }
  return null;
};
