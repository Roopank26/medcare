import React from "react";
import { useAuth } from "../context/AuthContext";

const TITLES = {
  overview: { label: "Dashboard", icon: "🏠" },
  symptoms: { label: "AI Symptom Analyzer", icon: "🧠" },
  history: { label: "Medical History", icon: "📋" },
  appointments: { label: "Appointments", icon: "📅" },
  reports: { label: "Reports", icon: "📁" },
  alerts: { label: "Health Alerts", icon: "🔔" },
  profile: { label: "My Profile", icon: "👤" },
  patients: { label: "Patient Management", icon: "👥" },
  search: { label: "Search Patients", icon: "🔍" },
  analytics: { label: "Analytics", icon: "📊" },
};

const Topbar = ({ activeSection }) => {
  const { user } = useAuth();
  const sect = TITLES[activeSection] || { label: "Dashboard", icon: "🏠" };
  const isDoc = user?.role === "doctor";
  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    /**
     * fixed: stays at top of viewport
     * left-64: clears the 256px sidebar
     * right-0: stretches to the right edge
     * h-16: 64px height (mt-16 in main compensates)
     * z-30: above sidebar (z-20) so it always renders on top
     */
    <header className="fixed top-0 left-64 right-0 h-16 z-30 glass border-b border-white/60 shadow-sm flex items-center justify-between px-6 md:px-8">
      {/* Left — Section title */}
      <div className="flex items-center gap-3">
        <span className="text-xl hidden sm:block" aria-hidden="true">{sect.icon}</span>
        <div>
          <h2 className="font-display font-semibold text-gray-900 text-base leading-none">
            {sect.label}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5 hidden md:block">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Right — status + user */}
      <div className="flex items-center gap-3">
        {/* Online indicator */}
        <div className="hidden sm:flex items-center gap-1.5 bg-secondary-50 text-secondary-700 px-3 py-1.5 rounded-full text-xs font-semibold select-none border border-secondary-100">
          <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse" />
          Live
        </div>

        {/* User avatar + name */}
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0 ${isDoc ? "bg-secondary" : "bg-primary"
              }`}
          >
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold text-gray-800 leading-none">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
