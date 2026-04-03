import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate(user.role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard");
    } else {
      navigate("/register");
    }
  };

  const features = [
    { icon: "🧠", title: "ML Symptom Checker",    desc: "94%-accurate ensemble model (Random Forest + Naive Bayes) across 18 conditions. Tag-based input, autocomplete, and severity scoring." },
    { icon: "💬", title: "MedBot AI Chatbot",      desc: "Context-aware health assistant powered by OpenAI GPT with intelligent rule-based fallback — always available in your dashboard." },
    { icon: "👨‍⚕️", title: "Doctor Dashboard",       desc: "Manage patients, track conditions, view Firestore-backed analytics, search records, and view uploaded medical reports." },
    { icon: "📋", title: "Medical History",         desc: "Every AI assessment stored in Firestore — searchable, filterable by severity, and viewable in a detailed modal." },
    { icon: "🔔", title: "Smart Health Alerts",    desc: "AI-driven alerts generated from your actual health history. Identifies recurring diagnoses and high-severity patterns." },
    { icon: "📁", title: "Secure Report Storage",  desc: "Upload medical reports (PDF, images) to Firebase Storage. Real download URLs stored in Firestore." },
  ];

  const stats = [
    { value: "18",   label: "Conditions Detected" },
    { value: "95%",  label: "ML Accuracy"          },
    { value: "52",   label: "Symptom Features"     },
    { value: "24/7", label: "AI Availability"      },
  ];

  const steps = [
    { step: "01", title: "Create an Account",    desc: "Register as a Patient or Doctor in under a minute." },
    { step: "02", title: "Describe Symptoms",    desc: "Use tags or free text — the ML model handles both." },
    { step: "03", title: "Get AI Assessment",    desc: "Instant prediction with severity, confidence & alternatives." },
    { step: "04", title: "Track Your History",   desc: "Every result saved to Firestore. Review anytime." },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-bold text-lg shadow">M</div>
            <div>
              <span className="font-display font-bold text-xl text-gray-900">Medcare</span>
              <span className="ml-2 text-xs bg-primary-50 text-primary px-2 py-0.5 rounded-full font-semibold">AI</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/login")}    className="btn-outline text-sm py-2">Login</button>
            <button onClick={() => navigate("/register")} className="btn-primary text-sm py-2">Register</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-primary-50 text-primary px-4 py-2 rounded-full text-sm font-semibold mb-6 border border-primary-100">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse"></span>
          Powered by Machine Learning + Firebase
        </div>
        <h1 className="font-display font-bold text-5xl md:text-6xl text-gray-900 leading-tight mb-6">
          Healthcare,{" "}
          <span className="text-primary">Reimagined</span>
          <br />
          with AI
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          Medcare combines a trained ML classifier, OpenAI chatbot, and real-time Firestore database into a professional healthcare platform for patients and doctors.
        </p>

        {/* Medical disclaimer — prominently placed */}
        <div className="max-w-2xl mx-auto mb-8 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs text-left flex items-start gap-2">
          <span className="text-base flex-shrink-0">⚠️</span>
          <span>
            <strong>Medical Disclaimer:</strong> This platform provides AI-based suggestions and is not a medical diagnosis system. Always consult a qualified healthcare professional for proper medical advice.
          </span>
        </div>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button onClick={handleGetStarted} className="btn-primary text-base px-8 py-3">
            Get Started Free →
          </button>
          <button onClick={() => navigate("/login")} className="btn-outline text-base px-8 py-3">
            Sign In
          </button>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <div className="bg-primary rounded-2xl p-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
          {stats.map(s => (
            <div key={s.label}>
              <div className="font-display font-bold text-3xl mb-1">{s.value}</div>
              <div className="text-primary-100 text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h2 className="font-display font-bold text-3xl text-center text-gray-900 mb-3">Full Feature Set</h2>
        <p className="text-gray-500 text-center mb-10">Everything built and working — no mocks, no placeholders.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map(f => (
            <div key={f.title} className="card card-hover cursor-default">
              <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-2xl mb-4">{f.icon}</div>
              <h3 className="font-display font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="font-display font-bold text-3xl text-center text-gray-900 mb-10">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map(s => (
            <div key={s.step} className="card flex items-start gap-4">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-display font-bold text-sm flex-shrink-0">
                {s.step}
              </div>
              <div>
                <h3 className="font-display font-semibold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-gray-500 text-sm">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">M</div>
          <span className="font-display font-semibold text-gray-800">Medcare AI</span>
        </div>
        <p className="text-sm text-gray-400">© {new Date().getFullYear()} Medcare. AI-powered healthcare, built responsibly.</p>
        <p className="text-xs text-gray-300 mt-1">Not a medical device. Always consult a qualified healthcare professional.</p>
      </footer>
    </div>
  );
};

export default Home;
