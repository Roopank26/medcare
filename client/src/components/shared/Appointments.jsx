/**
 * Medcare — Appointments Component (Production)
 * - Real-time onSnapshot listener with cleanup
 * - Toast notifications instead of inline banners
 * - Full validation with validation.js utilities
 * - Sanitized form inputs
 * - Separate upcoming / past / cancelled views
 * - Doctor can mark appointments complete
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import {
  saveAppointmentDoc,
  subscribeToAppointments,
  updateAppointmentDoc,
  cancelAppointmentDoc,
} from "../../firebase/firestore";
import { validateFutureDate } from "../../utils/validation";
import { sanitizeGeneral, sanitizeText } from "../../utils/sanitize";
import { PageSpinner, EmptyState, Spinner, MedicalDisclaimer } from "./UI";
import useToast from "../../hooks/useToast";

const TYPES = [
  "General Consultation",
  "Follow-up",
  "Routine Check-up",
  "Emergency",
  "Lab Results Review",
  "Specialist Referral",
  "Other",
];
const TODAY = new Date().toISOString().split("T")[0];

const STATUS_CFG = {
  Scheduled: { badge: "bg-blue-50 text-blue-700",   dot: "bg-blue-500"  },
  Confirmed: { badge: "bg-green-50 text-green-700", dot: "bg-green-500" },
  Completed: { badge: "bg-gray-100 text-gray-600",  dot: "bg-gray-400"  },
  Cancelled: { badge: "bg-red-50 text-red-600",     dot: "bg-red-400"   },
};

const AppCard = ({ appt, onCancel, onComplete, isDoctor }) => {
  const cfg    = STATUS_CFG[appt.status] || STATUS_CFG.Scheduled;
  const isPast = appt.date < TODAY;
  const active = appt.status === "Scheduled" || appt.status === "Confirmed";

  return (
    <div className={`card transition-all duration-200 hover:shadow-card-hover ${appt.status === "Cancelled" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
            {appt.type === "Emergency" ? "🚨" : appt.type === "Lab Results Review" ? "🔬" : "📅"}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-gray-900 text-sm">{appt.type}</h4>
            <p className="text-xs text-gray-500 mt-0.5">
              {new Date(appt.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long", year: "numeric", month: "long", day: "numeric",
              })}
              {appt.time ? ` · ${appt.time}` : ""}
            </p>
            {appt.doctor && <p className="text-xs text-primary mt-0.5">👨‍⚕️ {appt.doctor}</p>}
            {appt.notes  && <p className="text-xs text-gray-400 mt-1 line-clamp-2">{appt.notes}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${cfg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {appt.status}
          </span>
          {active && !isPast && (
            <button onClick={() => onCancel(appt.id)} className="text-xs text-red-500 hover:text-red-700 font-semibold underline-offset-2 hover:underline">
              Cancel
            </button>
          )}
          {isDoctor && active && (
            <button onClick={() => onComplete(appt.id)} className="text-xs text-green-600 hover:text-green-800 font-semibold underline-offset-2 hover:underline">
              Mark Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const DEFAULT_FORM = { type: "General Consultation", date: "", time: "", doctor: "", notes: "" };

const Appointments = () => {
  const { user }   = useAuth();
  const isDoctor   = user?.role === "doctor";
  const toast      = useToast();

  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [fieldErr,     setFieldErr]     = useState({});
  const [activeTab,    setActiveTab]    = useState("upcoming");
  const [form, setForm] = useState(DEFAULT_FORM);

  // ── Real-time listener ─────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const unsub = subscribeToAppointments(user.uid, isDoctor, ({ appointments: docs, error }) => {
      if (error) toast.error("Could not load appointments.");
      else setAppointments(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid, isDoctor]); // eslint-disable-line

  const validate = useCallback(() => {
    const errs = {};
    const dateCheck = validateFutureDate(form.date);
    if (!dateCheck.valid) errs.date = dateCheck.error;
    if (!form.type) errs.type = "Please select an appointment type.";
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  }, [form]);

  const handleBook = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);

    const { error } = await saveAppointmentDoc({
      userId:    user.uid,
      userName:  user.name,
      userEmail: user.email,
      doctorId:  isDoctor ? user.uid : "",
      type:      form.type,
      date:      form.date,
      time:      form.time,
      doctor:    sanitizeText(form.doctor),
      notes:     sanitizeGeneral(form.notes),
      status:    "Scheduled",
    });

    setSaving(false);
    if (error) { toast.error("Booking failed: " + error); return; }
    toast.success("Appointment booked successfully!");
    setShowForm(false);
    setForm(DEFAULT_FORM);
    setFieldErr({});
  };

  const handleCancel = useCallback(async (id) => {
    if (!window.confirm("Cancel this appointment?")) return;
    const { error } = await cancelAppointmentDoc(id);
    if (error) { toast.error("Could not cancel appointment."); return; }
    toast.success("Appointment cancelled.");
  }, [toast]);

  const handleComplete = useCallback(async (id) => {
    const { error } = await updateAppointmentDoc(id, { status: "Completed" });
    if (error) toast.error("Could not update appointment.");
    else toast.success("Appointment marked as completed.");
  }, [toast]);

  const upcoming  = appointments.filter((a) => a.date >= TODAY && a.status !== "Cancelled" && a.status !== "Completed");
  const past      = appointments.filter((a) => a.date < TODAY || a.status === "Completed");
  const cancelled = appointments.filter((a) => a.status === "Cancelled");

  const TABS = [
    { key: "upcoming",  label: `Upcoming (${upcoming.length})`   },
    { key: "past",      label: `Past (${past.length})`           },
    { key: "cancelled", label: `Cancelled (${cancelled.length})` },
  ];
  const shown = activeTab === "upcoming" ? upcoming : activeTab === "past" ? past : cancelled;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="card flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">📅</div>
          <div>
            <h3 className="font-display font-semibold text-gray-900">Appointments</h3>
            <p className="text-xs text-gray-400">{upcoming.length} upcoming · {past.length} past · live</p>
          </div>
        </div>
        {!isDoctor && (
          <button onClick={() => { setShowForm(!showForm); if (showForm) { setForm(DEFAULT_FORM); setFieldErr({}); } }} className="btn-primary whitespace-nowrap">
            {showForm ? "× Cancel" : "+ Book Appointment"}
          </button>
        )}
      </div>

      {/* Booking form */}
      {showForm && (
        <div className="card border border-primary-100 animate-fade-in">
          <h4 className="font-display font-semibold text-gray-900 mb-5">📅 Book New Appointment</h4>
          <form onSubmit={handleBook} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Type *</label>
              <select
                value={form.type}
                onChange={(e) => { setForm({ ...form, type: e.target.value }); setFieldErr({ ...fieldErr, type: null }); }}
                className={`input-field ${fieldErr.type ? "border-red-300" : ""}`}
                required
              >
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              {fieldErr.type && <p className="text-red-500 text-xs mt-1">{fieldErr.type}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Date *</label>
              <input
                type="date" value={form.date} min={TODAY}
                onChange={(e) => { setForm({ ...form, date: e.target.value }); setFieldErr({ ...fieldErr, date: null }); }}
                className={`input-field ${fieldErr.date ? "border-red-300" : ""}`}
                required
              />
              {fieldErr.date && <p className="text-red-500 text-xs mt-1">{fieldErr.date}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Preferred Time</label>
              <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Doctor / Clinic</label>
              <input
                type="text" value={form.doctor} maxLength={100}
                onChange={(e) => setForm({ ...form, doctor: e.target.value })}
                className="input-field" placeholder="e.g., Dr. Sarah Mitchell"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                rows={2} value={form.notes} maxLength={500}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="input-field resize-none" placeholder="Symptoms or concerns to mention…"
              />
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2 border-t border-gray-100">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <><Spinner size={4} /> Booking…</> : "✓ Confirm Booking"}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm(DEFAULT_FORM); setFieldErr({}); }} className="btn-outline">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <PageSpinner message="Loading appointments…" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon="📅"
          title={activeTab === "upcoming" ? "No upcoming appointments" : "Nothing here"}
          message={!isDoctor && activeTab === "upcoming" ? "Book your first appointment above." : undefined}
          action={!isDoctor && activeTab === "upcoming" ? (
            <button onClick={() => setShowForm(true)} className="btn-primary mx-auto">
              + Book Appointment
            </button>
          ) : null}
        />
      ) : (
        <div className="space-y-3">
          {shown.map((a) => (
            <AppCard key={a.id} appt={a} onCancel={handleCancel} onComplete={handleComplete} isDoctor={isDoctor} />
          ))}
        </div>
      )}

      <MedicalDisclaimer compact />
    </div>
  );
};

export default Appointments;
