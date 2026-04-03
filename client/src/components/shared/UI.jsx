/**
 * Medcare — Shared UI Component Library
 * Reusable primitives used across all components.
 */
import React from "react";

/* ── Spinner (inline) ────────────────────────────────────── */
export const Spinner = ({ size = 4, color = "text-current", className = "" }) => (
  <svg
    className={`animate-spin w-${size} h-${size} ${color} ${className}`}
    fill="none" viewBox="0 0 24 24"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
  </svg>
);

/* ── Page-level loading spinner ──────────────────────────── */
export const PageSpinner = ({ message = "Loading…" }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4">
    <Spinner size={8} color="text-primary" />
    <p className="text-sm text-gray-400">{message}</p>
  </div>
);

/* ── Skeleton shimmer block ──────────────────────────────── */
export const Skeleton = ({ className = "" }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

/* ── Stat card skeleton ──────────────────────────────────── */
export const StatCardSkeleton = () => (
  <div className="card flex items-center gap-4">
    <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-6 w-10" />
      <Skeleton className="h-3 w-20" />
    </div>
  </div>
);

/* ── Table row skeleton ──────────────────────────────────── */
export const TableRowSkeleton = ({ cols = 5 }) => (
  <tr className="border-b border-gray-50">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="py-3.5 pr-4">
        <Skeleton className="h-4 w-full rounded" />
      </td>
    ))}
  </tr>
);

/* ── Empty state ─────────────────────────────────────────── */
export const EmptyState = ({ icon = "📭", title = "Nothing here", message = "", action = null }) => (
  <div className="text-center py-14 px-4">
    <div className="text-5xl mb-4">{icon}</div>
    <h4 className="font-display font-semibold text-gray-700 mb-2">{title}</h4>
    {message && <p className="text-gray-400 text-sm mb-5 max-w-sm mx-auto leading-relaxed">{message}</p>}
    {action}
  </div>
);

/* ── Success banner ──────────────────────────────────────── */
export const SuccessBanner = ({ message }) => (
  <div className="p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2.5">
    <span className="text-base flex-shrink-0">✅</span>
    <span>{message}</span>
  </div>
);

/* ── Error banner ────────────────────────────────────────── */
export const ErrorBanner = ({ message, onRetry }) => (
  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
    <span className="text-red-500 text-base flex-shrink-0">⚠️</span>
    <div className="flex-1 min-w-0">
      <p className="text-red-700 text-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-1 text-xs text-red-600 underline hover:no-underline">
          Try again
        </button>
      )}
    </div>
  </div>
);

/* ── Info banner ─────────────────────────────────────────── */
export const InfoBanner = ({ message, icon = "ℹ️" }) => (
  <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm flex items-center gap-2.5">
    <span className="text-base flex-shrink-0">{icon}</span>
    <span>{message}</span>
  </div>
);

/* ── Medical disclaimer ──────────────────────────────────── */
export const MedicalDisclaimer = ({ compact = false }) =>
  compact ? (
    <p className="text-xs text-amber-700 flex items-center gap-1.5">
      <span>⚠️</span>
      AI suggestions only — not a substitute for professional medical advice.
    </p>
  ) : (
    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
      <span className="flex-shrink-0 text-base">⚠️</span>
      <span>
        <strong>Medical Disclaimer:</strong> This platform provides AI-based suggestions and is{" "}
        <em>not</em> a medical diagnosis system. The ML model has inherent limitations.
        Always consult a qualified healthcare professional for proper diagnosis and treatment.
        In an emergency, call emergency services immediately.
      </span>
    </div>
  );

/* ── Section header ──────────────────────────────────────── */
export const SectionHeader = ({ icon, title, subtitle }) => (
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
      {icon}
    </div>
    <div>
      <h3 className="font-display font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  </div>
);

/* ── Confidence bar ──────────────────────────────────────── */
export const ConfidenceBar = ({ value, showLabel = true }) => {
  const color  = value >= 70 ? "bg-red-500" : value >= 50 ? "bg-amber-500" : "bg-green-500";
  const txtClr = value >= 70 ? "text-red-600" : value >= 50 ? "text-amber-600" : "text-green-600";
  return (
    <div>
      {showLabel && (
        <div className={`flex justify-between text-xs mb-1.5 ${txtClr}`}>
          <span>Confidence</span>
          <span className="font-bold">{value}%</span>
        </div>
      )}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
};

/* ── Badge ───────────────────────────────────────────────── */
export const Badge = ({ label, color = "blue" }) => {
  const colors = {
    blue:   "bg-blue-50 text-blue-700",
    green:  "bg-green-50 text-green-700",
    amber:  "bg-amber-50 text-amber-700",
    red:    "bg-red-50 text-red-700",
    gray:   "bg-gray-100 text-gray-600",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color] || colors.gray}`}>
      {label}
    </span>
  );
};
