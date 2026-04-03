/**
 * Medcare — Doctor Reports (Production)
 * - Toast for load errors
 * - useCallback for load function
 * - Summary stat cards
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getAllReportsDoc } from "../../firebase/firestore";
import { PageSpinner, EmptyState } from "../shared/UI";
import useToast from "../../hooks/useToast";

const TYPE_ICONS = {
  "Blood Test": "🩸", "X-Ray": "🦴", "MRI": "🧠", "ECG": "💓",
  "Lab Report": "🔬", "Prescription": "💊", "General": "📄", "Other": "📎",
};
const getIcon = (t) => TYPE_ICONS[t] || "📄";

const formatDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
};

const FILTERS = ["All", "Blood Test", "X-Ray", "MRI", "ECG", "Lab Report", "Prescription", "General", "Other"];

const DoctorReports = () => {
  const toast    = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("All");

  const load = useCallback(async () => {
    setLoading(true);
    const { reports: docs, error } = await getAllReportsDoc();
    if (error) toast.error("Could not load reports from Firestore.");
    else setReports(docs);
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const displayed = useMemo(() =>
    filter === "All" ? reports : reports.filter((r) => r.type === filter),
  [reports, filter]);

  const stats = useMemo(() => ({
    total:    reports.length,
    withFile: reports.filter((r) => r.url).length,
    patients: new Set(reports.map((r) => r.userId)).size,
    pending:  reports.filter((r) => !r.reviewed).length,
  }), [reports]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total",    value: stats.total,    icon: "📂", color: "bg-blue-50 text-blue-600"    },
          { label: "Pending",  value: stats.pending,  icon: "⏳", color: "bg-amber-50 text-amber-600"  },
          { label: "In Cloud", value: stats.withFile, icon: "☁️", color: "bg-green-50 text-green-600"  },
          { label: "Patients", value: stats.patients, icon: "👥", color: "bg-purple-50 text-purple-600" },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-3">
            <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-xl flex-shrink-0`}>{s.icon}</div>
            <div>
              <p className="font-display font-bold text-xl text-gray-900">{loading ? "…" : s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + table */}
      <div className="card">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl">📂</div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-gray-900">Patient Reports</h3>
            <p className="text-xs text-gray-400">{displayed.length} report{displayed.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={load} className="btn-ghost text-xs px-3 py-1.5" title="Refresh">↺ Refresh</button>
        </div>

        {/* Type filters */}
        <div className="flex flex-wrap gap-2 mb-5">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all ${
                filter === f ? "bg-primary text-white border-primary" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40"
              }`}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <PageSpinner message="Loading reports from Firestore…" />
        ) : displayed.length === 0 ? (
          <EmptyState
            icon="📭"
            title={filter === "All" ? "No reports yet" : `No ${filter} reports`}
            message="Reports uploaded by patients will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  {["Report", "Patient", "Type", "Date", "Size", "Storage", "Action"].map((h) => (
                    <th key={h} className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors group">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl flex-shrink-0">{getIcon(r.type)}</span>
                        <span className="font-medium text-gray-800 max-w-[130px] truncate text-xs" title={r.filename}>
                          {r.filename}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-gray-600 text-xs">{r.patientName || "Patient"}</td>
                    <td className="py-3.5 pr-4">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{r.type}</span>
                    </td>
                    <td className="py-3.5 pr-4 text-gray-400 text-xs">{formatDate(r.uploadedAt)}</td>
                    <td className="py-3.5 pr-4 text-gray-400 text-xs">{r.size || "—"}</td>
                    <td className="py-3.5 pr-4">
                      {r.url
                        ? <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">☁️ Stored</span>
                        : <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">No file</span>
                      }
                    </td>
                    <td className="py-3.5 pr-4">
                      {r.url
                        ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary font-semibold hover:underline">Open ↗</a>
                        : <span className="text-xs text-gray-300">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default DoctorReports;
