import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../context/AuthContext";
import { validateEmail } from "../utils/validation";
import { sanitizeEmail } from "../utils/sanitize";
import useToast from "../hooks/useToast";

const Spinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
  </svg>
);

// ── Extracted outside to prevent remounting on parent re-render ──
const FormField = ({ label, name, type = "text", placeholder, autoFocus, value, onChange, error, helpText }) => (
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
      autoComplete={name === "email" ? "email" : name === "password" ? "current-password" : "off"}
      aria-invalid={!!error}
      aria-describedby={error ? `${name}-err` : undefined}
    />
    {error && <p id={`${name}-err`} className="text-red-500 text-xs mt-1">{error}</p>}
    {helpText && <p className="text-gray-500 text-xs mt-1">{helpText}</p>}
  </div>
);

const Login = () => {
  const [form,       setForm]       = useState({ email: "", password: "" });
  const [fieldErr,   setFieldErr]   = useState({});
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [showPass,   setShowPass]   = useState(false);
  const [resetMode,  setResetMode]  = useState(false);
  const [resetSent,  setResetSent]  = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const { login, user, sendPasswordReset, authError, clearError } = useAuth();
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

  const validate = () => {
    const errs = {};
    const emailCheck = validateEmail(form.email);
    if (!emailCheck.valid) errs.email = emailCheck.error;
    if (!form.password)    errs.password = "Password is required.";
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); 
    setError("");
    const { success, role, error: err } = await login({
      email:    sanitizeEmail(form.email),
      password: form.password,
    });
    setLoading(false);
    if (!success) { setError(err); return; }
    toast.success("Welcome back!");
    navigate(role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard", { replace: true });
  };

  const handleReset = async (e) => {
    e.preventDefault();
    const check = validateEmail(form.email);
    if (!check.valid) { setFieldErr(prev => ({ ...prev, email: check.error })); return; }
    setResetLoading(true);
    const { success, error: err } = await sendPasswordReset(sanitizeEmail(form.email));
    setResetLoading(false);
    if (!success) { setError(err); return; }
    setResetSent(true);
    toast.success("Password reset email sent! Check your inbox.");
  };

  return (
    <>
      <Helmet>
        <title>Sign In — Medcare</title>
        <meta name="description" content="Sign in to your Medcare healthcare portal." />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg">
                M
              </div>
              <span className="font-display font-bold text-2xl text-gray-900">Medcare</span>
            </Link>
            <p className="text-gray-500 text-sm mt-2">
              {resetMode ? "Reset your password" : "Sign in to your healthcare portal"}
            </p>
          </div>

          {/* Firebase badge */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="w-2 h-2 bg-orange-400 rounded-full" />
            <span className="text-xs text-gray-400 font-medium">Secured by Firebase Authentication</span>
          </div>

          {/* Card */}
          <div className="card shadow-xl border border-gray-100">
            {/* Global error */}
            {error && !resetSent && (
              <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Reset success */}
            {resetSent && (
              <div className="mb-5 p-3.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-start gap-2">
                <span className="flex-shrink-0 mt-0.5">✅</span>
                <span>Password reset email sent to <strong>{form.email}</strong>. Check your inbox.</span>
              </div>
            )}

            {!resetMode ? (
              /* ── Login form ── */
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <FormField
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoFocus
                  value={form.email}
                  onChange={handleChange}
                  error={fieldErr.email}
                />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-semibold text-gray-700">Password</label>
                    <button
                      type="button"
                      onClick={() => setResetMode(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      name="password"
                      value={form.password}
                      onChange={handleChange}
                      className={`input-field pr-10 ${fieldErr.password ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
                      placeholder="Your password"
                      autoComplete="current-password"
                      aria-invalid={!!fieldErr.password}
                      aria-describedby={fieldErr.password ? "pw-err" : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                      aria-label={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass ? "🙈" : "👁"}
                    </button>
                  </div>
                  {fieldErr.password && (
                    <p id="pw-err" className="text-red-500 text-xs mt-1">{fieldErr.password}</p>
                  )}
                </div>

                <button
                  type="submit" disabled={loading}
                  className="btn-primary w-full py-3 mt-2"
                >
                  {loading ? <><Spinner /> Signing in…</> : "Sign In →"}
                </button>
              </form>
            ) : (
              /* ── Password reset form ── */
              <form onSubmit={handleReset} noValidate className="space-y-4">
                <p className="text-sm text-gray-600">
                  Enter your email and we'll send you a link to reset your password.
                </p>
                <FormField
                  label="Email Address"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoFocus
                  value={form.email}
                  onChange={handleChange}
                  error={fieldErr.email}
                />

                <button type="submit" disabled={resetLoading || resetSent} className="btn-primary w-full py-3">
                  {resetLoading ? <><Spinner /> Sending…</> : "Send Reset Link"}
                </button>
                <button
                  type="button"
                  onClick={() => { setResetMode(false); setResetSent(false); setError(""); }}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 text-center"
                >
                  ← Back to sign in
                </button>
              </form>
            )}

            <div className="mt-5 pt-5 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Don't have an account?{" "}
                <Link to="/register" className="text-primary font-semibold hover:underline">
                  Create one free
                </Link>
              </p>
            </div>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            AI-powered healthcare · Not a medical diagnostic tool
          </p>
        </div>
      </div>
    </>
  );
};

export default Login;
