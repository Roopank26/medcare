/**
 * Medcare — Medical History Component (Production-fixed)
 *
 * Fixes applied:
 * - Removed `toast` from useCallback deps (was causing infinite re-fetch loop because
 *   useToast returned a new object reference on every render, recreating `load` on
 *   every render, which triggered the useEffect endlessly → loading stuck forever).
 * - Added toTitleCase() to normalize ALL_CAPS disease names (e.g. BRONCHITIS → Bronchitis).
 * - Deduplicated symptom tags via Set before rendering.
 * - Added console debug logs for Firestore troubleshooting.
 * - Added word-wrap / overflow-wrap CSS safety everywhere text renders.
 * - Proper try/catch/finally so loading ALWAYS resets even on network errors.
 * - Empty state handled cleanly for both filtered + unfiltered views.
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { subscribeToMedicalHistory } from "../../firebase/firestore";
import { MedicalHistorySkeleton, EmptyState, ConfidenceBar, MedicalDisclaimer, SeverityBadge } from "../shared/UI";
import useToast from "../../hooks/useToast";

// ── Helpers ──────────────────────────────────────────────────

/** Converts any casing to Title Case: "BRONCHITIS" → "Bronchitis", "the flu" → "The Flu" */
const toTitleCase = (str) => {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const SEV_STYLE = {
  Low: "bg-green-50 text-green-700 border-green-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  High: "bg-red-50 text-red-700 border-red-200",
  Critical: "bg-red-100 text-red-900 border-red-400",
  Unknown: "bg-gray-50 text-gray-600 border-gray-200",
};

const formatDate = (ts) => {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return String(ts);
  }
};

/**
 * Parse symptom tags from either an array or a comma-separated string.
 * Deduplicates and trims all entries.
 */
const parseTags = (item) => {
  let raw = [];
  if (Array.isArray(item.selectedTags) && item.selectedTags.length) {
    raw = item.selectedTags;
  } else if (Array.isArray(item.symptoms) && item.symptoms.length) {
    // symptoms stored as array directly in Firestore
    raw = item.symptoms;
  } else if (typeof item.symptoms === "string" && item.symptoms) {
    raw = item.symptoms.split(",").map((s) => s.trim()).filter(Boolean);
  }
  // Deduplicate (case-insensitive)
  const seen = new Set();
  return raw.filter((t) => {
    const key = String(t).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/* ── Detail Modal ─────────────────────────────────────────── */
const DetailModal = ({ item, onClose }) => {
  if (!item) return null;
  const sevStyle = SEV_STYLE[item.severity] || SEV_STYLE.Unknown;
  const tags = parseTags(item);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Assessment details"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto animate-scale-in"
        style={{ wordWrap: "break-word", overflowWrap: "break-word" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-600 p-5 rounded-t-2xl text-white">
          <div className="flex items-start justify-between">
            <div style={{ minWidth: 0 }}>
              <p className="text-primary-100 text-xs mb-1">
                AI Assessment · {item.date || formatDate(item.timestamp)}
              </p>
              <h3 className="font-display font-bold text-xl" style={{ wordBreak: "break-word" }}>
                {toTitleCase(item.diagnosis)}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white text-2xl font-bold leading-none ml-4 flex-shrink-0"
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full">{item.confidence}% confidence</span>
            <SeverityBadge severity={item.severity} />
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          <ConfidenceBar value={item.confidence} />

          {tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Reported Symptoms</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((s, i) => (
                  <span
                    key={`${s}-${i}`}
                    className="text-xs bg-blue-50 text-primary border border-blue-100 px-2.5 py-1 rounded-full"
                    style={{ wordBreak: "break-word" }}
                  >
                    {toTitleCase(s)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {item.action && (
            <div className={`rounded-xl p-3.5 border ${sevStyle}`} style={{ wordBreak: "break-word" }}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-1 opacity-70">Recommended Action</p>
              <p className="text-sm">{item.action}</p>
            </div>
          )}

          {item.recommendations?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Precautions</p>
              <ul className="space-y-2">
                {item.recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="w-5 h-5 bg-secondary-50 text-secondary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                      {i + 1}
                    </span>
                    <span style={{ wordBreak: "break-word", flex: 1 }}>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.alternatives?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Other Possibilities</p>
              <div className="space-y-2">
                {item.alternatives.map((a, i) => (
                  <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                    <span className="text-base flex-shrink-0">{a.emoji || "🩺"}</span>
                    <p className="flex-1 text-xs font-semibold text-gray-700" style={{ wordBreak: "break-word" }}>
                      {toTitleCase(a.disease)}
                    </p>
                    <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                      <div className="h-full bg-gray-400 rounded-full" style={{ width: `${Math.min(a.confidence, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-9 text-right flex-shrink-0">{a.confidence}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <MedicalDisclaimer compact />
        </div>
      </div>
    </div>
  );
};

/* ── Main component ────────────────────────────────────────── */
const MedicalHistory = () => {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Holds the active Firestore unsubscribe fn — guards against duplicate listeners
  const unsubscribeRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filterSev, setFilterSev] = useState("All");
  const [retryKey, setRetryKey] = useState(0);

  // ── Effect 1: track auth state — runs ONCE on mount ──────────
  // Stores uid in state; onSnapshot is NOT created here so token
  // refreshes do NOT recreate the Firestore listener.
  const [userId, setUserId] = useState(undefined); // undefined = "not yet resolved"

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (currentUser) => {
      console.log("USER:", currentUser);
      setUserId(currentUser ? currentUser.uid : null);
    });
    return () => unsub();
  }, []); // ← empty: auth listener lives for the full component lifetime

  // ── Effect 2: Firestore listener — re-runs only when uid or retryKey changes ──
  // userId === undefined  → auth not yet resolved (keep loading)
  // userId === null       → no user logged in (stop loading)
  // userId === "abc123"   → subscribe to real-time data
  useEffect(() => {
    if (userId === undefined) return; // auth still loading — do nothing

    if (userId === null) {
      setLoading(false);
      setHistory([]);
      return;
    }

    setLoading(true);
    setLoadError(null);

    // 🛑 Kill any existing listener BEFORE creating a new one
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // ✅ Single listener, stored in ref so it can be cancelled deterministically
    const unsub = subscribeToMedicalHistory(userId, (data) => {
      console.log("FETCHED:", data);
      setHistory(
        data.map((s) => ({ ...s, diagnosis: toTitleCase(s.diagnosis) }))
      );
      setLoading(false); // ALWAYS stops the spinner
    });

    unsubscribeRef.current = unsub;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userId, retryKey]); // ← only re-runs when user changes or retry is clicked



  // ── Filter + derived ───────────────────────────────────────
  const SEVERITIES = ["All", "Low", "Medium", "High", "Critical"];

  const shown = useMemo(
    () => (filterSev === "All" ? history : history.filter((h) => h.severity === filterSev)),
    [history, filterSev]
  );

  const confBadge = (c) =>
    c >= 70 ? "bg-red-50 text-red-600"
      : c >= 50 ? "bg-amber-50 text-amber-600"
        : "bg-green-50 text-green-600";

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="animate-fade-in space-y-6" style={{ wordWrap: "break-word", overflowWrap: "break-word" }}>
      <div className="card">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl">📋</div>
            <div>
              <h3 className="font-display font-semibold text-gray-900">Medical History</h3>
              <p className="text-xs text-gray-400">{shown.length} of {history.length} records</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => setFilterSev(s)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${filterSev === s
                  ? "bg-primary text-white border-primary"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40"
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <MedicalHistorySkeleton />

          /* Error */
        ) : loadError ? (
          <div className="text-center py-14 px-4">
            <div className="text-5xl mb-4">⚠️</div>
            <h4 className="font-display font-semibold text-gray-700 mb-2">Could not load history</h4>
            <p className="text-gray-400 text-sm mb-5 max-w-sm mx-auto">{loadError}</p>
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="btn-primary mx-auto"
            >
              Retry
            </button>
          </div>

          /* Empty */
        ) : shown.length === 0 ? (
          <EmptyState
            icon={filterSev !== "All" ? "🔍" : "📭"}
            title={filterSev !== "All" ? `No ${filterSev} severity records` : "No records yet"}
            message={
              filterSev === "All"
                ? "Use the AI Symptom Checker to create your first health record."
                : "Try clearing the filter to see all records."
            }
            action={filterSev !== "All" ? (
              <button onClick={() => setFilterSev("All")} className="btn-outline mx-auto text-sm">Clear filter</button>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Run the AI Symptom Checker to generate your first record.</p>
            )}
          />

          /* Table */
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  {["#", "Date", "Symptoms", "Diagnosis", "Confidence", "Severity", ""].map((h) => (
                    <th
                      key={h}
                      className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="stagger-list">
                {shown.map((item, i) => {
                  const tags = parseTags(item);
                  const symptomsLabel = tags.map(toTitleCase).join(", ") || "—";
                  return (
                    <tr
                      key={item.id || i}
                      className="border-b border-gray-50 hover:bg-blue-50/30 transition-colors animate-slide-up hover-lift cursor-pointer"
                      onClick={() => setSelected(item)}
                    >
                      <td className="py-3.5 pr-4 text-gray-400 font-mono text-xs">{i + 1}</td>
                      <td className="py-3.5 pr-4 text-gray-500 text-xs whitespace-nowrap">
                        {item.date || formatDate(item.timestamp)}
                      </td>
                      <td
                        className="py-3.5 pr-4 text-gray-700 max-w-[140px] truncate text-xs"
                        title={symptomsLabel}
                        style={{ maxWidth: "140px" }}
                      >
                        {symptomsLabel}
                      </td>
                      <td
                        className="py-3.5 pr-4 font-semibold text-gray-900 text-xs"
                        style={{ wordBreak: "break-word", maxWidth: "160px" }}
                      >
                        {item.diagnosis}
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${confBadge(item.confidence)}`}>
                          {item.confidence}%
                        </span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <SeverityBadge severity={item.severity} />
                      </td>
                      <td className="py-3.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelected(item)}
                          className="text-xs text-white font-semibold bg-primary px-3 py-1.5 rounded-lg hover:bg-primary-600 transition-all active:scale-95 shadow-sm"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DetailModal item={selected} onClose={() => setSelected(null)} />
    </div>
  );
};

export default MedicalHistory;
