import React from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const PATIENT_LINKS = [
  { label: "Overview",         icon: "🏠", section: "overview"     },
  { label: "AI Symptom Check", icon: "🧠", section: "symptoms", badge: "ML" },
  { label: "Medical History",  icon: "📋", section: "history"      },
  { label: "Appointments",     icon: "📅", section: "appointments" },
  { label: "Reports",          icon: "📁", section: "reports"      },
  { label: "Alerts",           icon: "🔔", section: "alerts"       },
  { label: "My Profile",       icon: "👤", section: "profile"      },
];

const DOCTOR_LINKS = [
  { label: "Overview",     icon: "🏠", section: "overview"     },
  { label: "Patients",     icon: "👥", section: "patients"     },
  { label: "Appointments", icon: "📅", section: "appointments" },
  { label: "Search",       icon: "🔍", section: "search"       },
  { label: "Analytics",    icon: "📊", section: "analytics"    },
  { label: "Reports",      icon: "📁", section: "reports"      },
  { label: "Admin",        icon: "🛠️",  section: "admin"        },
  { label: "My Profile",   icon: "👤", section: "profile"      },
];

const Sidebar = ({ activeSection, setActiveSection }) => {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const links            = user?.role === "doctor" ? DOCTOR_LINKS : PATIENT_LINKS;
  const isDoc            = user?.role === "doctor";

  const initials = (user?.name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    /**
     * fixed: pinned to viewport left
     * top-0 bottom-0: full viewport height (avoids h-screen issues with mobile)
     * w-64: 256px — must match ml-64 in dashboard layout
     * z-20: below Topbar (z-30) so topbar shadow renders correctly
     * overflow-y-auto: nav scrolls if items exceed height
     */
    <aside className="fixed top-0 bottom-0 left-0 w-64 z-20 bg-white border-r border-gray-100 flex flex-col shadow-sm">

      {/* ── Logo ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm flex-shrink-0">
            M
          </div>
          <div>
            <h1 className="font-display font-bold text-gray-900 text-base leading-none">Medcare</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {isDoc ? "Doctor Portal" : "Patient Portal"}
            </p>
          </div>
        </div>
      </div>

      {/* ── AI status strip ──────────────────────────────── */}
      <div className="flex-shrink-0 px-5 py-2 border-b border-gray-100 bg-gradient-to-r from-primary/5 to-secondary/5">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-secondary rounded-full animate-pulse flex-shrink-0" />
          <span className="text-xs text-gray-500 font-medium">ML + Firebase Active</span>
        </div>
      </div>

      {/* ── User card ────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100">
        <button
          onClick={() => setActiveSection("profile")}
          className={`w-full rounded-xl p-2.5 flex items-center gap-3 hover:bg-gray-50 transition-all text-left ${
            activeSection === "profile" ? "bg-primary-50 ring-1 ring-primary/20" : ""
          }`}
        >
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${
              isDoc ? "bg-secondary" : "bg-primary"
            }`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
            <p className={`text-xs font-medium capitalize ${isDoc ? "text-secondary-600" : "text-primary"}`}>
              {user?.role}
            </p>
          </div>
        </button>
      </div>

      {/* ── Navigation — scrollable ──────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
          Menu
        </p>
        <ul className="space-y-0.5">
          {links.map((link) => (
            <li key={link.section}>
              <button
                onClick={() => setActiveSection(link.section)}
                className={`sidebar-link w-full ${
                  activeSection === link.section ? "active" : ""
                }`}
              >
                <span className="text-lg flex-shrink-0">{link.icon}</span>
                <span className="text-sm font-medium flex-1 text-left">{link.label}</span>
                {link.badge && (
                  <span className="text-xs bg-secondary/20 text-secondary-700 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">
                    {link.badge}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* MedBot hint */}
        <div className="mt-4 mx-1 bg-gradient-to-br from-primary-50 to-secondary/10 rounded-xl p-3 border border-primary-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🤖</span>
            <span className="text-xs font-semibold text-gray-700">MedBot AI</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Chat assistant — bottom-right corner.
          </p>
        </div>
      </nav>

      {/* ── Sign out ─────────────────────────────────────── */}
      <div className="flex-shrink-0 px-3 py-3 border-t border-gray-100">
        <button
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
          className="sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <span className="text-lg">🚪</span>
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
