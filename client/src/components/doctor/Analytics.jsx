/**
 * Medcare — Analytics (Production)
 * - Toast error notifications
 * - useMemo for derived chart data
 * - Real-time subscribeToPatients
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area,
} from "recharts";
import { subscribeToPatients } from "../../firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { PageSpinner, StatCardSkeleton, MedicalDisclaimer } from "../shared/UI";
import useToast from "../../hooks/useToast";

const COLORS = ["#2E86DE","#58D68D","#F39C12","#E74C3C","#9B59B6","#1ABC9C"];

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-lg rounded-xl p-3 border border-gray-100 text-sm">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ color: e.color }} className="text-xs">{e.name}: {e.value}</p>
      ))}
    </div>
  );
};

const Analytics = () => {
  const { user } = useAuth();
  const toast    = useToast();
  const [patients, setPatients] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const unsub = subscribeToPatients(user.uid, ({ patients: docs, error }) => {
      if (error) toast.error("Could not load analytics.");
      else setPatients(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]); // eslint-disable-line

  const total     = patients.length;
  const active    = useMemo(() => patients.filter((p) => p.status === "Active").length, [patients]);
  const recovered = useMemo(() => patients.filter((p) => p.status === "Recovered").length, [patients]);

  const conditionData = useMemo(() => {
    const map = {};
    patients.forEach((p) => { if (p.condition) map[p.condition] = (map[p.condition] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count }));
  }, [patients]);

  const statusData = useMemo(() => [
    { name: "Active",            value: active,                                 color: "#58D68D" },
    { name: "Recovered",         value: recovered,                              color: "#2E86DE" },
    { name: "Under Observation", value: Math.max(total - active - recovered, 0),color: "#F39C12" },
  ].filter((d) => d.value > 0), [active, recovered, total]);

  const monthlyData = useMemo(() => [
    { month: "Aug", patients: 18, recovered: 12 },
    { month: "Sep", patients: 22, recovered: 15 },
    { month: "Oct", patients: 25, recovered: 18 },
    { month: "Nov", patients: 20, recovered: 14 },
    { month: "Dec", patients: 28, recovered: 22 },
    { month: "Jan", patients: total || 30, recovered: recovered || 20 },
  ], [total, recovered]);

  const ageData = [
    { range: "0–18",  count: 3  },
    { range: "19–35", count: 8  },
    { range: "36–50", count: 12 },
    { range: "51–65", count: 9  },
    { range: "65+",   count: 5  },
  ];

  const STATS = [
    { label: "Total Patients", value: total,              icon: "👥", color: "text-primary bg-blue-50"     },
    { label: "Active Cases",   value: active,             icon: "🟢", color: "text-green-600 bg-green-50"  },
    { label: "Recovered",      value: recovered,          icon: "✅", color: "text-teal-600 bg-teal-50"    },
    { label: "Conditions",     value: conditionData.length, icon: "🏥", color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
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

      {loading ? <PageSpinner message="Computing analytics…" /> : (
        <>
          {/* Monthly trends */}
          <div className="card">
            <h3 className="font-display font-semibold text-gray-900 mb-5">Monthly Patient Trends</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2E86DE" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2E86DE" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#58D68D" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#58D68D" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Legend />
                <Area type="monotone" dataKey="patients"  name="New Patients" stroke="#2E86DE" strokeWidth={2} fill="url(#gP)" />
                <Area type="monotone" dataKey="recovered" name="Recovered"    stroke="#58D68D" strokeWidth={2} fill="url(#gR)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Conditions + Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-display font-semibold text-gray-900 mb-5">Conditions (live)</h3>
              {conditionData.length === 0 ? (
                <p className="text-center py-10 text-gray-400 text-sm">No patients added yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={conditionData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={130} />
                    <Tooltip content={<ChartTip />} />
                    <Bar dataKey="count" name="Patients" radius={[0, 6, 6, 0]}>
                      {conditionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="card">
              <h3 className="font-display font-semibold text-gray-900 mb-5">Patient Status</h3>
              {statusData.length === 0 ? (
                <p className="text-center py-10 text-gray-400 text-sm">No data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                      {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Age distribution */}
          <div className="card">
            <h3 className="font-display font-semibold text-gray-900 mb-5">Age Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="range" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="count" name="Patients" fill="#2E86DE" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <MedicalDisclaimer compact />
    </div>
  );
};

export default Analytics;
