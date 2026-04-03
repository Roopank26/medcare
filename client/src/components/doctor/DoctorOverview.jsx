/**
 * Medcare — Doctor Overview (Production)
 * - Real-time subscribeToPatients with toast errors
 * - useCallback/useMemo performance
 */

import React, { useState, useEffect, useMemo } from "react";
import { subscribeToPatients } from "../../firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { StatCardSkeleton, EmptyState, MedicalDisclaimer } from "../shared/UI";
import useToast from "../../hooks/useToast";

const DoctorOverview = ({ user, setActiveSection }) => {
  const { user: authUser } = useAuth();
  const toast = useToast();

  const [patients, setPatients] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!authUser?.uid) return;
    setLoading(true);
    const unsub = subscribeToPatients(authUser.uid, ({ patients: docs, error }) => {
      if (error) toast.error("Could not load patient data.");
      else setPatients(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [authUser?.uid]); // eslint-disable-line

  const total     = patients.length;
  const active    = useMemo(() => patients.filter((p) => p.status === "Active").length, [patients]);
  const recovered = useMemo(() => patients.filter((p) => p.status === "Recovered").length, [patients]);

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const STATS = [
    { label: "Total Patients", value: total,     icon: "👥", color: "bg-blue-50 text-blue-600"    },
    { label: "Active Cases",   value: active,    icon: "🟢", color: "bg-green-50 text-green-600"  },
    { label: "Recovered",      value: recovered, icon: "✅", color: "bg-teal-50 text-teal-600"    },
    { label: "AI-Powered",     value: "ML",      icon: "🤖", color: "bg-purple-50 text-purple-600" },
  ];

  const QUICK = [
    { label: "Add Patient",  icon: "➕", section: "patients",     color: "bg-blue-50 text-blue-600 hover:bg-blue-100"    },
    { label: "Appointments", icon: "📅", section: "appointments", color: "bg-green-50 text-green-600 hover:bg-green-100" },
    { label: "Analytics",    icon: "📊", section: "analytics",    color: "bg-purple-50 text-purple-600 hover:bg-purple-100" },
    { label: "Reports",      icon: "📁", section: "reports",      color: "bg-amber-50 text-amber-600 hover:bg-amber-100"  },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Banner */}
      <div className="bg-gradient-to-r from-secondary-500 to-secondary-600 rounded-2xl p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="relative">
          <p className="text-secondary-100 text-sm font-medium mb-1">{greeting},</p>
          <h2 className="font-display font-bold text-2xl mb-1">{user?.name} 👋</h2>
          <p className="text-secondary-100 text-sm">
            {loading ? "Loading…" : `Managing ${total} patient${total !== 1 ? "s" : ""} · ${active} active · live`}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0,1,2,3].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="card card-hover">
              <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-xl mb-3`}>{s.icon}</div>
              <p className="font-display font-bold text-2xl text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div>
        <h3 className="font-display font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {QUICK.map((a) => (
            <button key={a.section} onClick={() => setActiveSection(a.section)}
              className={`${a.color} rounded-2xl p-5 text-left transition-all duration-200 hover:scale-105 active:scale-95`}>
              <div className="text-3xl mb-3">{a.icon}</div>
              <p className="font-semibold text-sm">{a.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Recent patients */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-gray-800">Recent Patients</h3>
          <button onClick={() => setActiveSection("patients")} className="text-sm text-primary hover:underline font-medium">
            View all →
          </button>
        </div>
        <div className="card">
          {loading ? (
            <div className="space-y-3">
              {[0,1,2,3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-3 animate-pulse">
                  <div className="w-9 h-9 bg-gray-200 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/4" />
                  </div>
                  <div className="h-5 w-14 bg-gray-200 rounded-full" />
                </div>
              ))}
            </div>
          ) : patients.length === 0 ? (
            <EmptyState icon="👤" title="No patients yet" message="Add your first patient to get started."
              action={<button onClick={() => setActiveSection("patients")} className="btn-primary mx-auto">+ Add Patient</button>} />
          ) : (
            <div className="space-y-1">
              {patients.slice(0, 5).map((p) => (
                <div key={p.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                  <div className="w-9 h-9 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                    {(p.name?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.condition} · Age {p.age}</p>
                  </div>
                  <span className={p.status === "Active" ? "badge-active" : "badge-recovered"}>{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <MedicalDisclaimer compact />
    </div>
  );
};

export default DoctorOverview;
