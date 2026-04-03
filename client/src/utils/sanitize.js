/**
 * Medcare — Input Sanitization Utilities
 *
 * Prevents XSS and cleans up user input before storing in Firestore
 * or sending to APIs.
 *
 * DOMPurify is used for HTML content. Plain text gets basic escaping.
 */

/**
 * Strip all HTML tags from a string and trim whitespace.
 * Safe for use on any user-supplied text before storing in Firestore.
 */
export const sanitizeText = (input) => {
  if (typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")        // strip HTML tags
    .replace(/[<>'"]/g, (c) => ({   // escape remaining special chars
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    }[c]))
    .trim();
};

/**
 * Sanitize a plain-text name field.
 * Allows letters, spaces, hyphens, apostrophes, periods.
 */
export const sanitizeName = (name) => {
  if (typeof name !== "string") return "";
  return name.replace(/[^a-zA-ZÀ-ÿ\s\-'.]/g, "").trim().slice(0, 100);
};

/**
 * Sanitize an email address.
 */
export const sanitizeEmail = (email) => {
  if (typeof email !== "string") return "";
  return email.trim().toLowerCase().slice(0, 254);
};

/**
 * Sanitize a symptom description.
 * Allows letters, numbers, spaces, commas, periods, hyphens.
 */
export const sanitizeSymptoms = (text) => {
  if (typeof text !== "string") return "";
  return text
    .replace(/<[^>]*>/g, "")           // strip HTML
    .replace(/[^\w\s,.\-()]/g, " ")    // keep safe chars
    .replace(/\s{2,}/g, " ")           // collapse whitespace
    .trim()
    .slice(0, 2000);
};

/**
 * Sanitize any general text field (notes, descriptions).
 * Strips HTML, limits length.
 */
export const sanitizeGeneral = (text, maxLen = 500) => {
  if (typeof text !== "string") return "";
  return text
    .replace(/<[^>]*>/g, "")
    .trim()
    .slice(0, maxLen);
};

/**
 * Sanitize a complete form object by key type.
 * Pass a mapping of { fieldName: 'text' | 'name' | 'email' | 'symptoms' }
 */
export const sanitizeForm = (data, typeMap) => {
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    const type = typeMap[key] || "text";
    switch (type) {
      case "name":     result[key] = sanitizeName(value);     break;
      case "email":    result[key] = sanitizeEmail(value);    break;
      case "symptoms": result[key] = sanitizeSymptoms(value); break;
      default:         result[key] = sanitizeText(String(value ?? ""));
    }
  }
  return result;
};
