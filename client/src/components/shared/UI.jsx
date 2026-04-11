/**
 * Medcare — Shared UI Component Library
 * Reusable primitives used across all components.
 */
import React, { useState, useEffect, useCallback } from "react";

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

/* ── Medical history skeleton (5 shimmer rows) ───────────── */
export const MedicalHistorySkeleton = () => (
  <div className="animate-fade-in">
    {/* Shimmer header */}
    <div className="flex items-center gap-4 mb-5">
      <Skeleton className="h-4 w-6" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-4 w-16" />
    </div>
    <div className="space-y-3">
      {[0.9, 0.8, 0.65, 0.5, 0.35].map((opacity, i) => (
        <div
          key={i}
          className="flex items-center gap-4 py-2.5 border-b border-gray-50"
          style={{ opacity }}
        >
          <Skeleton className="h-4 w-5 flex-shrink-0" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-7 w-12 rounded-lg ml-auto" />
        </div>
      ))}
    </div>
  </div>
);

/* ── Severity badge ───────────────────────────────────────── */
const SEV_CONFIG = {
  Low: { dot: "🟢", bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
  Medium: { dot: "🟡", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  High: { dot: "🔴", bg: "bg-red-50", border: "border-red-200", text: "text-red-700" },
  Critical: { dot: "🚨", bg: "bg-red-100", border: "border-red-400", text: "text-red-900" },
  Unknown: { dot: "⚪", bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-500" },
};

export const SeverityBadge = ({ severity }) => {
  if (!severity) return <span className="text-gray-300 text-xs">—</span>;
  const cfg = SEV_CONFIG[severity] || SEV_CONFIG.Unknown;
  return (
    <span className={`sev-dot ${cfg.bg} ${cfg.border} ${cfg.text}`}>
      <span>{cfg.dot}</span>
      {severity}
    </span>
  );
};

/* ── Empty state ─────────────────────────────────────────── */
export const EmptyState = ({ icon = "📭", title = "Nothing here", message = "", action = null }) => (
  <div className="text-center py-14 px-4 animate-slide-up">
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
  const color = value >= 70 ? "bg-red-500" : value >= 50 ? "bg-amber-500" : "bg-green-500";
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
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-100 text-gray-600",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors[color] || colors.gray}`}>
      {label}
    </span>
  );
};

/* ── Toast system ────────────────────────────────────────── */

// Single toast item
const ToastItem = ({ toast, onRemove }) => {
  const [leaving, setLeaving] = useState(false);

  const dismiss = useCallback(() => {
    setLeaving(true);
    setTimeout(() => onRemove(toast.id), 250);
  }, [toast.id, onRemove]);

  useEffect(() => {
    const t = setTimeout(dismiss, toast.duration || 3500);
    return () => clearTimeout(t);
  }, [dismiss, toast.duration]);

  const TYPE_ICON = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };

  return (
    <div
      className={`toast-item toast-${toast.type} ${leaving ? "animate-toast-out" : "animate-toast-in"}`}
      role="alert"
    >
      <span className="flex-shrink-0 text-base mt-0.5">{TYPE_ICON[toast.type] || "ℹ️"}</span>
      <div className="flex-1 min-w-0">
        {toast.title && <p className="font-semibold text-xs mb-0.5">{toast.title}</p>}
        <p className="text-xs leading-snug">{toast.message}</p>
      </div>
      <button
        onClick={dismiss}
        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity text-lg leading-none font-bold"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
};

// Toast container — mount once at app level
export const ToastContainer = ({ toasts, onRemove }) => (
  <div className="toast-stack" aria-live="polite">
    {toasts.map((t) => (
      <ToastItem key={t.id} toast={t} onRemove={onRemove} />
    ))}
  </div>
);

// Hook — call in any component to push toasts
export const useToastManager = () => {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((type, message, title, duration) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message, title, duration }]);
  }, []);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toasts,
    remove,
    success: (msg, title) => push("success", msg, title),
    error: (msg, title) => push("error", msg, title),
    warning: (msg, title) => push("warning", msg, title),
    info: (msg, title) => push("info", msg, title),
  };
};
