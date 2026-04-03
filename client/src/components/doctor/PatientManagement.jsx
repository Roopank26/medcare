import React, { useState, useEffect, useCallback } from "react";
import {
  subscribeToPatients,
  addPatientDoc,
  updatePatientDoc,
  deletePatientDoc,
} from "../../firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { validateName, validateAge } from "../../utils/validation";
import { sanitizeName, sanitizeText } from "../../utils/sanitize";
import { PageSpinner, EmptyState, Spinner } from "../shared/UI";
import useToast from "../../hooks/useToast";

const CONDITIONS = [
  "Hypertension", "Diabetes Type 2", "Asthma", "Migraine", "Arthritis",
  "Heart Disease", "Depression", "Anxiety", "Obesity", "Thyroid Disorder", "Other",
];
const STATUSES = ["Active", "Recovered", "Under Observation"];

const PatientManagement = () => {
  const { user }  = useAuth();
  const toast     = useToast();

  const [patients,  setPatients]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [saving,    setSaving]    = useState(false);
  const [fieldErr,  setFieldErr]  = useState({});
  const [form, setForm] = useState({ name: "", age: "", condition: "", status: "Active" });

  // Real-time listener scoped to this doctor
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const unsub = subscribeToPatients(user.uid, ({ patients: docs, error: err }) => {
      if (err) toast.error("Could not load patients: " + err);
      else setPatients(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleChange = useCallback((e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setFieldErr((prev) => ({ ...prev, [e.target.name]: null }));
  }, []);

  const validate = () => {
    const errs = {};
    const nameCheck = validateName(form.name);
    if (!nameCheck.valid) errs.name = nameCheck.error;
    const ageCheck  = validateAge(form.age);
    if (!ageCheck.valid)  errs.age  = ageCheck.error;
    if (!form.condition)  errs.condition = "Please select a condition.";
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const payload = {
      name:      sanitizeName(form.name),
      age:       parseInt(form.age, 10),
      condition: sanitizeText(form.condition),
      status:    form.status,
    };

    if (editId) {
      const { error: err } = await updatePatientDoc(editId, payload);
      if (err) { toast.error("Update failed: " + err); setSaving(false); return; }
      toast.success("Patient updated!");
    } else {
      const { error: err } = await addPatientDoc({
        ...payload,
        doctorId:   user.uid,
        doctorName: user.name || "",
      });
      if (err) { toast.error("Could not add patient: " + err); setSaving(false); return; }
      toast.success("Patient added!");
    }

    setSaving(false);
    resetForm();
    // onSnapshot fires automatically — no manual reload
  };

  const handleEdit = useCallback((p) => {
    setForm({ name: p.name, age: String(p.age), condition: p.condition, status: p.status });
    setEditId(p.id);
    setShowForm(true);
    setFieldErr({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleDelete = useCallback(async (id, name) => {
    if (!window.confirm(`Remove "${name}"? This cannot be undone.`)) return;
    const { error: err } = await deletePatientDoc(id);
    if (err) { toast.error("Delete failed: " + err); return; }
    toast.success(`"${name}" removed.`);
  }, [toast]);

  const resetForm = () => {
    setForm({ name: "", age: "", condition: "", status: "Active" });
    setEditId(null);
    setShowForm(false);
    setFieldErr({});
  };

  const InputErr = ({ name }) =>
    fieldErr[name] ? <p className="text-red-500 text-xs mt-1">{fieldErr[name]}</p> : null;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="card flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">👥</div>
          <div>
            <h3 className="font-display font-semibold text-gray-900">Patient Management</h3>
            <p className="text-xs text-gray-400">
              {patients.length} patient{patients.length !== 1 ? "s" : ""} · live updates
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); if (showForm) resetForm(); }}
          className="btn-primary whitespace-nowrap"
        >
          {showForm ? "× Cancel" : "+ Add Patient"}
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="card border border-primary-100 animate-fade-in">
          <h4 className="font-display font-semibold text-gray-900 mb-5">
            {editId ? "✏️ Edit Patient" : "➕ Add New Patient"}
          </h4>
          <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name *</label>
              <input
                type="text" name="name" value={form.name} onChange={handleChange}
                className={`input-field ${fieldErr.name ? "border-red-300" : ""}`}
                placeholder="Patient full name"
              />
              <InputErr name="name" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Age *</label>
              <input
                type="number" name="age" value={form.age} onChange={handleChange}
                className={`input-field ${fieldErr.age ? "border-red-300" : ""}`}
                placeholder="Age" min="0" max="150"
              />
              <InputErr name="age" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Condition *</label>
              <select
                name="condition" value={form.condition} onChange={handleChange}
                className={`input-field ${fieldErr.condition ? "border-red-300" : ""}`}
              >
                <option value="">Select a condition</option>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <InputErr name="condition" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Status</label>
              <select name="status" value={form.status} onChange={handleChange} className="input-field">
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="md:col-span-2 flex gap-3 pt-2 border-t border-gray-100">
              <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                {saving ? <><Spinner size={4} />Saving…</> : (editId ? "Update Patient" : "Add Patient")}
              </button>
              <button type="button" onClick={resetForm} className="btn-outline">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {loading ? (
          <PageSpinner message="Loading patients…" />
        ) : patients.length === 0 ? (
          <EmptyState
            icon="👤" title="No patients yet"
            message="Add your first patient using the button above."
            action={
              <button onClick={() => setShowForm(true)} className="btn-primary mx-auto">
                + Add Patient
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  {["Patient", "Age", "Condition", "Last Visit", "Status", "Actions"].map((h) => (
                    <th key={h} className="pb-3 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {(p.name?.[0] || "?").toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800 truncate max-w-[120px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-gray-600">{p.age}</td>
                    <td className="py-3.5 pr-4 text-gray-700">{p.condition}</td>
                    <td className="py-3.5 pr-4 text-gray-400 text-xs">{p.lastVisit || "—"}</td>
                    <td className="py-3.5 pr-4">
                      <span className={
                        p.status === "Active"    ? "badge-active"    :
                        p.status === "Recovered" ? "badge-recovered" : "badge-warning"
                      }>{p.status}</span>
                    </td>
                    <td className="py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEdit(p)} className="text-xs text-primary hover:underline font-semibold">Edit</button>
                        <span className="text-gray-200">|</span>
                        <button onClick={() => handleDelete(p.id, p.name)} className="text-xs text-red-500 hover:underline font-semibold">Remove</button>
                      </div>
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

export default React.memo(PatientManagement);
