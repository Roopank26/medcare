/**
 * Medcare — Search Patients (Production)
 * - Real-time onSnapshot with useToast errors
 * - useMemo for filtered results
 * - Accessible keyboard-friendly search
 */

import React, { useState, useEffect, useMemo } from "react";
import { subscribeToPatients } from "../../firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { PageSpinner, EmptyState } from "../shared/UI";
import useToast from "../../hooks/useToast";

const COND_COLORS = {
  "Hypertension":    "bg-red-50 text-red-600",
  "Diabetes Type 2": "bg-orange-50 text-orange-600",
  "Asthma":          "bg-blue-50 text-blue-600",
  "Migraine":        "bg-purple-50 text-purple-600",
  "Arthritis":       "bg-yellow-50 text-yellow-600",
  "Heart Disease":   "bg-red-50 text-red-600",
};
const condColor = (c) => COND_COLORS[c] || "bg-gray-50 text-gray-600";

const formatDate = (ts) => {
  if (!ts) return "—";
  try { return new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return String(ts); }
};

const SearchPatients = () => {
  const { user } = useAuth();
  const toast    = useToast();

  const [query,       setQuery]       = useState("");
  const [allPatients, setAllPatients] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [selected,    setSelected]    = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const unsub = subscribeToPatients(user.uid, ({ patients: docs, error }) => {
      if (error) toast.error("Could not load patients.");
      else setAllPatients(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]); // eslint-disable-line

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allPatients;
    return allPatients.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.condition?.toLowerCase().includes(q) ||
        p.status?.toLowerCase().includes(q)
    );
  }, [query, allPatients]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Search input */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl">🔍</div>
          <div>
            <h3 className="font-display font-semibold text-gray-900">Search Patients</h3>
            <p className="text-xs text-gray-400">Filter by name, condition, or status · live</p>
          </div>
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">🔍</span>
          <input
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
            className="input-field pl-11"
            placeholder="Type patient name or condition…"
            autoFocus
            aria-label="Search patients"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setSelected(null); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xl font-bold leading-none"
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Showing <span className="font-semibold text-gray-700">{filtered.length}</span>{" "}
          of <span className="font-semibold text-gray-700">{allPatients.length}</span> patients
        </p>
      </div>

      {loading ? (
        <PageSpinner message="Loading patients (real-time)…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={query ? "No results found" : "No patients yet"}
          message={query ? `No patients match "${query}".` : "Add patients via Patient Management."}
          action={query ? (
            <button onClick={() => setQuery("")} className="btn-outline mx-auto text-sm">Clear search</button>
          ) : null}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => setSelected(selected?.id === p.id ? null : p)}
              className={`card card-hover cursor-pointer transition-all duration-200 ${
                selected?.id === p.id ? "border-2 border-primary shadow-card-hover" : ""
              }`}
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setSelected(selected?.id === p.id ? null : p)}
              role="button"
              aria-expanded={selected?.id === p.id}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                  {(p.name?.[0] || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-display font-semibold text-gray-900 truncate">{p.name}</h4>
                    <span className={p.status === "Active" ? "badge-active" : "badge-recovered"}>
                      {p.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-1.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${condColor(p.condition)}`}>{p.condition}</span>
                    <span className="text-xs text-gray-400">Age {p.age}</span>
                  </div>
                  <p className="text-xs text-gray-400">Last visit: {p.lastVisit || formatDate(p.createdAt)}</p>
                </div>
              </div>

              {selected?.id === p.id && (
                <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3 animate-fade-in">
                  {[
                    ["Patient ID",  p.id.slice(0, 14) + "…"],
                    ["Age",         `${p.age} years`],
                    ["Condition",   p.condition],
                    ["Status",      p.status],
                    ["Last Visit",  p.lastVisit || "—"],
                    ["Attending",   p.doctorName || "Assigned"],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      <p className="text-sm font-semibold text-gray-700">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchPatients;
