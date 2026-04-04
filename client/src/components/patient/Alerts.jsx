import React, { useState, useEffect } from "react";
import { subscribeToSymptoms, getReportsDoc } from "../../firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { PageSpinner } from "../shared/UI";

/**
 * Alerts — generated dynamically from real Firestore data.
 * Symptoms use real-time onSnapshot; reports fetched once.
 */

const ALERT_CFG = {
  critical: {
    border: "bg-red-50 border-red-200 text-red-800",
    badge: "bg-red-100 text-red-700",
  },
  warning: {
    border: "bg-amber-50 border-amber-200 text-amber-800",
    badge: "bg-amber-100 text-amber-700",
  },
  info: {
    border: "bg-blue-50 border-blue-200 text-blue-800",
    badge: "bg-blue-100 text-blue-700",
  },
  success: {
    border: "bg-green-50 border-green-200 text-green-800",
    badge: "bg-green-100 text-green-700",
  },
};

function buildAlerts(symptoms, reports) {
  const alerts = [];
  const today = new Date().toISOString().split("T")[0];

  // Critical / High severity from latest symptom
  if (symptoms.length > 0) {
    const latest = symptoms[0];
    if (latest.severity === "Critical" || latest.severity === "High") {
      alerts.push({
        id: "sev-latest",
        type: "critical",
        icon: "🚨",
        message: `Your most recent assessment (${latest.diagnosis}) was rated ${latest.severity} severity.`,
        sub: "Please consult a qualified healthcare professional immediately.",
        date: latest.date || today,
      });
    }

    // Recurring diagnosis
    const counts = {};
    symptoms.forEach((s) => {
      counts[s.diagnosis] = (counts[s.diagnosis] || 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) {
      alerts.push({
        id: "recur",
        type: "warning",
        icon: "🔁",
        message: `"${top[0]}" has appeared ${top[1]} times in your health records.`,
        sub: "Recurring issues may indicate an underlying condition.",
        date: today,
      });
    }

    // Most frequent symptom word
    const words = {};
    symptoms.forEach((s) => {
      // Safe: symptoms can be array, string, or null
      const raw = Array.isArray(s.symptoms)
        ? s.symptoms.join(" ")
        : (s.symptoms || "");
      raw
        .toLowerCase()
        .split(/,\s*/)
        .forEach((w) => {
          if (w.trim().length > 2) words[w.trim()] = (words[w.trim()] || 0) + 1;
        });
    });
    const topWord = Object.entries(words).sort((a, b) => b[1] - a[1])[0];
    if (topWord && topWord[1] >= 2) {
      alerts.push({
        id: "freq-sym",
        type: "info",
        icon: "📊",
        message: `"${topWord[0]}" is your most frequently reported symptom (${topWord[1]}×).`,
        sub: "Tracking patterns helps your doctor provide better care.",
        date: today,
      });
    }
  }

  // Report uploaded notification
  if (reports.length > 0) {
    const latest = reports[0];
    alerts.push({
      id: "report-latest",
      type: "info",
      icon: "📄",
      message: `Report "${latest.filename}" was uploaded successfully.`,
      sub: "Your doctor can now review this file.",
      date: (latest.uploadedAt || "").split("T")[0] || today,
    });
  }

  // Static wellness alerts
  alerts.push(
    {
      id: "checkup",
      type: "info",
      icon: "📅",
      message: "Schedule a routine health check-up.",
      sub: "Preventive care catches issues early — recommended every 6–12 months.",
      date: today,
    },
    {
      id: "wellness",
      type: "success",
      icon: "💚",
      message: "Tip: Stay hydrated, sleep 7–9 hours, move for 30 min daily.",
      sub: "Consistent habits prevent over 80% of chronic diseases.",
      date: today,
    }
  );

  return alerts;
}

const AlertCard = ({ alert, onDismiss }) => {
  const cfg = ALERT_CFG[alert.type] || ALERT_CFG.info;
  return (
    <div className={`border rounded-xl p-4 flex items-start gap-4 animate-fade-in ${cfg.border}`}>
      <span className="text-2xl flex-shrink-0 mt-0.5">{alert.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full capitalize ${cfg.badge}`}>
            {alert.type}
          </span>
          <span className="text-xs opacity-60">{alert.date}</span>
        </div>
        <p className="text-sm font-medium leading-snug">{alert.message}</p>
        {alert.sub && (
          <p className="text-xs opacity-75 mt-0.5">{alert.sub}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className="flex-shrink-0 text-xl font-bold opacity-30 hover:opacity-60 transition-opacity leading-none mt-0.5"
        aria-label="Dismiss alert"
      >
        ×
      </button>
    </div>
  );
};

const Alerts = () => {
  const { user } = useAuth();
  const [allAlerts, setAllAlerts] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("All");

  useEffect(() => {
    // Guard: if no user, stop loading immediately
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    let reports = [];
    let symptoms = [];
    let loaded = { symptoms: false, reports: false };

    const rebuild = () => {
      if (loaded.symptoms && loaded.reports) {
        setAllAlerts(buildAlerts(symptoms, reports));
        setLoading(false);
      }
    };

    // Symptoms — real-time onSnapshot
    const unsub = subscribeToSymptoms(user.uid, ({ symptoms: docs }) => {
      symptoms = docs;
      loaded.symptoms = true;
      rebuild();
    });

    // Reports — one-shot fetch (no frequent writes)
    getReportsDoc(user.uid).then(({ reports: docs }) => {
      reports = docs;
      loaded.reports = true;
      rebuild();
    });

    return () => unsub(); // cleanup symptom listener
  }, [user?.uid]);

  const dismiss = (id) => setDismissed((prev) => [...prev, id]);
  const restoreAll = () => setDismissed([]);

  const visible = allAlerts
    .filter((a) => !dismissed.includes(a.id))
    .filter((a) => filterType === "All" || a.type === filterType);

  const counts = { critical: 0, warning: 0, info: 0, success: 0 };
  allAlerts
    .filter((a) => !dismissed.includes(a.id))
    .forEach((a) => { if (counts[a.type] !== undefined) counts[a.type]++; });

  const TYPES = [
    { key: "critical", label: "Critical", icon: "🚨", color: "bg-red-50 text-red-600" },
    { key: "warning", label: "Warnings", icon: "⚠️", color: "bg-amber-50 text-amber-600" },
    { key: "info", label: "Info", icon: "ℹ️", color: "bg-blue-50 text-blue-600" },
    { key: "success", label: "Tips", icon: "💚", color: "bg-green-50 text-green-600" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilterType(filterType === t.key ? "All" : t.key)}
            className={`card text-left hover:-translate-y-0.5 transition-all cursor-pointer ${filterType === t.key ? "ring-2 ring-primary" : ""
              }`}
          >
            <div className={`w-10 h-10 ${t.color} rounded-xl flex items-center justify-center text-xl mb-2`}>
              {t.icon}
            </div>
            <p className={`font-display font-bold text-xl ${t.color.split(" ")[1]}`}>
              {loading ? "…" : counts[t.key]}
            </p>
            <p className="text-xs text-gray-500">{t.label}</p>
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="card">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl">🔔</div>
            <div>
              <h3 className="font-display font-semibold text-gray-900">Health Alerts</h3>
              <p className="text-xs text-gray-400">
                {filterType !== "All" ? `Filter: ${filterType} · ` : ""}
                {visible.length} showing · real-time
                {dismissed.length > 0 ? ` · ${dismissed.length} dismissed` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {filterType !== "All" && (
              <button
                onClick={() => setFilterType("All")}
                className="text-xs text-primary underline"
              >
                Show all
              </button>
            )}
            {dismissed.length > 0 && (
              <button
                onClick={restoreAll}
                className="text-xs text-gray-400 underline"
              >
                Restore {dismissed.length}
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <PageSpinner message="Analysing your health data for alerts…" />
        ) : visible.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-3">🎉</div>
            <h4 className="font-display font-semibold text-gray-700 mb-1">All clear!</h4>
            <p className="text-gray-400 text-sm">No active alerts right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((a) => (
              <AlertCard key={a.id} alert={a} onDismiss={dismiss} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Alerts;
