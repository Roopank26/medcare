/**
 * Medcare — Patient Overview (Enterprise v4.0)
 *
 * Phase 6 additions:
 * - Severity trend chart (last 10 assessments over time)
 * - When-to-seek-help recommendations based on severity
 * - Recurring diagnosis callout
 * - Analytics page view tracking
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { getSymptomsDoc, getReportsDoc } from "../../firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { StatCardSkeleton, MedicalDisclaimer } from "../shared/UI";
import analytics from "../../utils/analytics";
import logger from "../../utils/logger";
import useToast from "../../hooks/useToast";

/** Converts any casing to Title Case: "BRONCHITIS" → "Bronchitis" */
const toTitleCase = (str) => {
  if (!str) return "";
  return String(str).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

// Severity → numeric score for trend chart
const SEV_SCORE = { Low: 1, Medium: 2, High: 3, Critical: 4, Unknown: 0 };
const SEV_COLOR = { 0: "#94a3b8", 1: "#22c55e", 2: "#f59e0b", 3: "#ef4444", 4: "#7f1d1d" };

const DAILY_TIPS = [
  "Drink at least 8 glasses of water daily.",
  "Get 7–9 hours of quality sleep every night.",
  "Exercise for at least 30 minutes, 5 days a week.",
  "Schedule regular check-ups even when feeling healthy.",
  "Maintain a balanced diet rich in fruits and vegetables.",
  "Limit screen time before bed to improve sleep quality.",
  "Short breaks during work reduce eye strain and stress.",
];

/** When to seek help — driven by severity analysis */
const getUrgencyMessage = (symptoms) => {
  if (!symptoms.length) return null;
  const latest = symptoms[0];
  if (latest.severity === "Critical") return {
    icon: "🚨", color: "bg-red-50 border-red-200 text-red-800",
    title: "Seek Immediate Care",
    body: `Your most recent assessment (${latest.diagnosis}) is rated Critical. Please go to an emergency room or call emergency services immediately.`,
  };
  if (latest.severity === "High") return {
    icon: "🔴", color: "bg-red-50 border-red-100 text-red-700",
    title: "Consult a Doctor Soon",
    body: `Your recent ${latest.diagnosis} assessment shows High severity. Schedule an appointment with your doctor within the next 24–48 hours.`,
  };
  const recentHigh = symptoms.slice(0, 5).filter((s) => ["High", "Critical"].includes(s.severity));
  if (recentHigh.length >= 2) return {
    icon: "⚠️", color: "bg-amber-50 border-amber-200 text-amber-800",
    title: "Pattern Detected",
    body: "Multiple high-severity assessments in your recent history. Consider scheduling a preventive consultation with your doctor.",
  };
  return null;
};

/** Build insights from Firestore data */
const buildInsights = (symptoms) => {
  if (!symptoms?.length) return [];
  const insights = [];
  const diagCounts = {};
  const symWords = {};
  symptoms.forEach((s) => {
    diagCounts[s.diagnosis] = (diagCounts[s.diagnosis] || 0) + 1;
    (Array.isArray(s.symptoms) ? s.symptoms.join(" ") : s.symptoms || "").toLowerCase().split(/,\s*/).forEach((w) => {
      if (w.trim().length > 2) symWords[w.trim()] = (symWords[w.trim()] || 0) + 1;
    });
  });
  const topDiag = Object.entries(diagCounts).sort((a, b) => b[1] - a[1])[0];
  if (topDiag?.[1] >= 2)
    insights.push({
      icon: "📊", color: "bg-blue-50 border-blue-200 text-blue-800",
      message: `"${topDiag[0]}" has appeared ${topDiag[1]} times in your history.`,
      action: "Consider a follow-up consultation with your doctor."
    });
  const topSym = Object.entries(symWords).sort((a, b) => b[1] - a[1])[0];
  if (topSym?.[1] >= 2)
    insights.push({
      icon: "🔁", color: "bg-amber-50 border-amber-200 text-amber-800",
      message: `"${topSym[0]}" appears frequently in your reports.`,
      action: "Recurring symptoms may indicate an underlying condition."
    });
  const highSev = symptoms.filter((s) => ["High", "Critical"].includes(s.severity));
  if (highSev.length)
    insights.push({
      icon: "🚨", color: "bg-red-50 border-red-200 text-red-800",
      message: "You've had high-severity symptom assessments recently.",
      action: "Please schedule an in-person consultation with a doctor."
    });
  const recentWeek = symptoms.filter((s) => {
    const d = new Date(s.timestamp || s.date);
    return !isNaN(d) && Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
  });
  if (!recentWeek.length && symptoms.length > 0)
    insights.push({
      icon: "💚", color: "bg-green-50 border-green-200 text-green-800",
      message: "No new symptoms reported this week — great sign!",
      action: "Keep up your healthy routine."
    });
  return insights.slice(0, 3);
};

/** Build severity trend data for the chart (last 10 entries) */
const buildTrendData = (symptoms) =>
  symptoms.slice(0, 10).reverse().map((s, i) => ({
    label: s.date || `Entry ${i + 1}`,
    score: SEV_SCORE[s.severity] ?? 0,
    severity: s.severity || "Unknown",
    diagnosis: s.diagnosis,
  }));

const SeverityTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white shadow-lg rounded-xl p-3 border border-gray-100 text-xs">
      <p className="font-semibold text-gray-700">{d.diagnosis}</p>
      <p className="text-gray-500">{d.severity} severity · {d.label}</p>
    </div>
  );
};

const PatientOverview = ({ user, setActiveSection }) => {
  const { user: authUser } = useAuth();
  const toast = useToast();
  // Use a ref so `load` never has `toast` as a dep (would cause infinite loops)
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [symptoms, setSymptoms] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const tip = DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length];

  const load = useCallback(async () => {
    if (!authUser?.uid) return;
    try {
      const [{ symptoms: s = [], error: e1 }, { reports: r = [], error: e2 }] = await Promise.all([
        getSymptomsDoc(authUser.uid).catch(() => ({ symptoms: [], error: "fetch_failed" })),
        getReportsDoc(authUser.uid).catch(() => ({ reports: [], error: "fetch_failed" })),
      ]);
      if (e1 || e2) toastRef.current.error("Could not load all overview data. Pull to refresh.");
      // Normalize disease names
      setSymptoms((s || []).map((item) => ({ ...item, diagnosis: toTitleCase(item.diagnosis) })));
      setReports(r);
    } catch (err) {
      logger.error("[PatientOverview] Load failed", err);
      toastRef.current.error("Could not load overview data.");
    } finally {
      setLoading(false);
    }
    // toast intentionally omitted — use toastRef
  }, [authUser?.uid]);

  useEffect(() => {
    load();
    analytics.page("overview");
  }, [load]);

  const insights = useMemo(() => buildInsights(symptoms), [symptoms]);
  const trendData = useMemo(() => buildTrendData(symptoms), [symptoms]);
  const urgency = useMemo(() => getUrgencyMessage(symptoms), [symptoms]);

  const STATS = [
    { icon: "🧠", label: "AI Assessments", value: symptoms.length, color: "bg-blue-50", sub: "Total" },
    { icon: "📁", label: "Reports", value: reports.length, color: "bg-purple-50", sub: "Uploaded" },
    { icon: "💡", label: "AI Insights", value: insights.length, color: "bg-green-50", sub: "Active" },
    { icon: "🔔", label: "Alerts", value: "Active", color: "bg-amber-50", sub: "Check alerts" },
  ];

  const QUICK = [
    { label: "AI Symptom Check", icon: "🧠", section: "symptoms", color: "bg-blue-50 text-blue-600 hover:bg-blue-100" },
    { label: "Medical History", icon: "📋", section: "history", color: "bg-green-50 text-green-600 hover:bg-green-100" },
    { label: "Appointments", icon: "📅", section: "appointments", color: "bg-purple-50 text-purple-600 hover:bg-purple-100" },
    { label: "Upload Report", icon: "📁", section: "reports", color: "bg-amber-50 text-amber-600 hover:bg-amber-100" },
  ];

  const SEV_YAXIS = { 0: "—", 1: "Low", 2: "Med", 3: "High", 4: "Crit" };

  return (
    <div className="animate-fade-in space-y-6">

      {/* Welcome */}
      <div className="bg-gradient-to-r from-primary to-primary-600 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 right-16 w-20 h-20 bg-white/5 rounded-full translate-y-1/2" />
        <div className="relative">
          <p className="text-primary-100 text-sm font-medium mb-1">Good {greeting},</p>
          <h2 className="font-display font-bold text-2xl mb-1">{user?.name} 👋</h2>
          <p className="text-primary-100 text-sm">Your AI-powered health dashboard · real data from Firestore</p>
        </div>
      </div>

      {/* Medical disclaimer */}
      <MedicalDisclaimer />

      {/* Urgency alert (Phase 6) */}
      {!loading && urgency && (
        <div className={`border rounded-xl p-4 flex items-start gap-3 ${urgency.color}`}>
          <span className="text-2xl flex-shrink-0">{urgency.icon}</span>
          <div>
            <p className="font-semibold text-sm mb-0.5">{urgency.title}</p>
            <p className="text-sm opacity-90">{urgency.body}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="card card-hover">
              <div className={`w-12 h-12 ${s.color} rounded-xl flex items-center justify-center text-2xl mb-3`}>{s.icon}</div>
              <p className="font-display font-bold text-xl text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h3 className="font-display font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK.map((a) => (
            <button key={a.section} onClick={() => { setActiveSection(a.section); analytics.page(a.section); }}
              className={`${a.color} rounded-2xl p-5 text-left transition-all duration-200 hover:scale-105 active:scale-95`}>
              <div className="text-3xl mb-3">{a.icon}</div>
              <p className="font-semibold text-sm">{a.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Phase 6: Severity Trend Chart */}
      {!loading && trendData.length >= 2 && (
        <div className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">📈</div>
            <div>
              <h3 className="font-display font-semibold text-gray-900">Severity Trend</h3>
              <p className="text-xs text-gray-400">Last {trendData.length} AI assessments over time</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="sevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E86DE" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2E86DE" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, 4]} ticks={[0, 1, 2, 3, 4]}
                tickFormatter={(v) => SEV_YAXIS[v] || ""}
                tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false}
              />
              <Tooltip content={<SeverityTip />} />
              <Area
                type="monotone" dataKey="score" name="Severity"
                stroke="#2E86DE" strokeWidth={2} fill="url(#sevGrad)"
                dot={{ fill: "#2E86DE", r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {Object.entries({ 1: "Low", 2: "Medium", 3: "High", 4: "Critical" }).map(([score, label]) => (
              <div key={score} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: SEV_COLOR[Number(score)] }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI personalization insights */}
      {insights.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-gray-800 mb-4">🧠 AI Personalization Insights</h3>
          <div className="space-y-3">
            {insights.map((ins, i) => (
              <div key={i} className={`border rounded-xl p-4 flex items-start gap-3 ${ins.color}`}>
                <span className="text-xl flex-shrink-0">{ins.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{ins.message}</p>
                  <p className="text-xs mt-0.5 opacity-75">{ins.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Daily health tip */}
      <div className="card border-l-4 border-l-secondary flex items-start gap-4">
        <div className="text-3xl">💡</div>
        <div>
          <h4 className="font-display font-semibold text-gray-800 mb-1">Daily Health Tip</h4>
          <p className="text-gray-500 text-sm">{tip}</p>
        </div>
      </div>

      {/* Recent assessments */}
      {!loading && symptoms.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-gray-800">Recent AI Assessments</h3>
            <button onClick={() => setActiveSection("history")} className="text-sm text-primary hover:underline font-medium">
              View all →
            </button>
          </div>
          <div className="card space-y-2">
            {symptoms.slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center gap-4 py-2 border-b border-gray-50 last:border-0">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center text-lg flex-shrink-0">🧠</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.diagnosis}</p>
                  <p className="text-xs text-gray-400">{s.date} · {s.confidence}% confidence</p>
                </div>
                {s.severity && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${s.severity === "High" || s.severity === "Critical" ? "bg-red-50 text-red-600"
                      : s.severity === "Medium" ? "bg-amber-50 text-amber-600"
                        : "bg-green-50 text-green-600"
                    }`}>
                    {s.severity}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !symptoms.length && (
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">🤖</div>
          <h4 className="font-display font-semibold text-gray-700 mb-2">No AI assessments yet</h4>
          <p className="text-gray-400 text-sm mb-5">Try the AI Symptom Checker for your first ML health assessment.</p>
          <button onClick={() => setActiveSection("symptoms")} className="btn-primary mx-auto">
            Try AI Symptom Checker →
          </button>
        </div>
      )}
    </div>
  );
};

export default PatientOverview;
