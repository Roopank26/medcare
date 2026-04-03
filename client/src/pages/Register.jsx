import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../context/AuthContext";
import {
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordMatch,
  runValidations,
} from "../utils/validation";
import { sanitizeEmail, sanitizeName } from "../utils/sanitize";
import useToast from "../hooks/useToast";

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
  </svg>
);

// ── Extracted outside to prevent remounting on parent re-render ──
const FormField = ({ label, name, type = "text", placeholder, autoFocus, value, onChange, error }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className={`input-field ${error ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete={name === "email" ? "email" : name === "password" ? "new-password" : "off"}
      aria-invalid={!!error}
    />
    {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
  </div>
);

const Register = () => {
  const [form,     setForm]     = useState({ name: "", email: "", password: "", role: "patient" });
  const [confirm,  setConfirm]  = useState("");
  const [fieldErr, setFieldErr] = useState({});
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const { register, user, authError, clearError } = useAuth();
  const navigate = useNavigate();
  const toast    = useToast();

  useEffect(() => {
    if (user) navigate(user.role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard", { replace: true });
  }, [user, navigate]);

  useEffect(() => { if (authError) setError(authError); }, [authError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setFieldErr(prev => ({ ...prev, [name]: null }));
    setError(""); 
    clearError();
  };

  const handleConfirmChange = (e) => {
    setConfirm(e.target.value);
    setFieldErr(prev => ({ ...prev, confirm: null }));
  };

  const validate = () => {
    const errs = {};
    const checks = [
      [form.name,     validateName],
      [form.email,    validateEmail],
      [form.password, validatePassword],
    ];
    checks.forEach(([val, fn], i) => {
      const keys = ["name", "email", "password"];
      const { valid, error: e } = fn(val);
      if (!valid) errs[keys[i]] = e;
    });
    const matchCheck = validatePasswordMatch(form.password, confirm);
    if (!matchCheck.valid) errs.confirm = matchCheck.error;
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); 
    setError("");
    const { success, error: err } = await register({
      name:     sanitizeName(form.name),
      email:    sanitizeEmail(form.email),
      password: form.password,
      role:     form.role,
    });
    setLoading(false);
    if (!success) { setError(err); return; }
    toast.success("Account created! Welcome to Medcare.");
    // onAuthStateChanged fires → useEffect above redirects
  };

  return (
    <>
      <Helmet>
        <title>Create Account — Medcare</title>
        <meta name="description" content="Create your free Medcare healthcare account." />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo */}
          <div className="text-center mb-7">
            <Link to="/" className="inline-flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg">
                M
              </div>
              <span className="font-display font-bold text-2xl text-gray-900">Medcare</span>
            </Link>
            <p className="text-gray-500 text-sm mt-2">Create your free healthcare account</p>
          </div>

          {/* Role selector */}
          <div className="flex gap-3 mb-5">
            {[
              { r: "patient", label: "👤 Patient",   desc: "Book appointments & track health" },
              { r: "doctor",  label: "👨‍⚕️ Doctor",  desc: "Manage patients & view analytics" },
            ].map(({ r, label, desc }) => (
              <button
                key={r} type="button"
                onClick={() => { setForm({ ...form, role: r }); setError(""); }}
                className={`flex-1 py-3 px-3 rounded-xl border-2 text-sm transition-all text-left ${
                  form.role === r
                    ? r === "doctor"
                      ? "border-secondary bg-secondary text-white shadow-md"
                      : "border-primary bg-primary text-white shadow-md"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                }`}
              >
                <p className="font-semibold">{label}</p>
                <p className={`text-xs mt-0.5 ${form.role === r ? "opacity-80" : "text-gray-400"}`}>{desc}</p>
              </button>
            ))}
          </div>

          {/* Card */}
          <div className="card shadow-xl border border-gray-100">
            {error && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <FormField 
                label="Full Name"      
                name="name"     
                placeholder="Your full name" 
                autoFocus 
                value={form.name}
                onChange={handleChange}
                error={fieldErr.name}
              />
              <FormField 
                label="Email Address"  
                name="email"    
                type="email" 
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                error={fieldErr.email}
              />

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"} 
                    name="password" 
                    value={form.password}
                    onChange={handleChange}
                    className={`input-field pr-10 ${fieldErr.password ? "border-red-300" : ""}`}
                    placeholder="Min. 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button" 
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                  >
                    {showPass ? "🙈" : "👁"}
                  </button>
                </div>
                {fieldErr.password && <p className="text-red-500 text-xs mt-1">{fieldErr.password}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                <input
                  type="password" 
                  value={confirm}
                  onChange={handleConfirmChange}
                  className={`input-field ${fieldErr.confirm ? "border-red-300" : ""}`}
                  placeholder="Repeat password"
                  autoComplete="new-password"
                />
                {fieldErr.confirm && <p className="text-red-500 text-xs mt-1">{fieldErr.confirm}</p>}
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-500">
                Registering as:{" "}
                <span className={`font-bold ${form.role === "doctor" ? "text-secondary-600" : "text-primary"}`}>
                  {form.role === "doctor" ? "👨‍⚕️ Doctor" : "👤 Patient"}
                </span>
                {" "}— role is permanent.
              </div>

              <button
                type="submit" disabled={loading}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold transition-all shadow-sm hover:shadow-md active:scale-95 disabled:opacity-50 ${
                  form.role === "doctor"
                    ? "bg-secondary hover:bg-secondary-600"
                    : "bg-primary hover:bg-primary-600"
                }`}
              >
                {loading ? <><Spinner /> Creating account…</> : "Create Account →"}
              </button>
            </form>

            <div className="mt-5 pt-5 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{" "}
                <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            AI assessments are informational only — not medical diagnoses.
          </p>
        </div>
      </div>
    </>
  );
};

export default Register;
