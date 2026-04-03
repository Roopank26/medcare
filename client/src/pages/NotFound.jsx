import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NotFound = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const dashboardPath = user?.role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center animate-fade-in">
        {/* Logo */}
        <Link to="/" className="inline-flex items-center gap-2 mb-10">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-display font-bold text-lg shadow">
            M
          </div>
          <span className="font-display font-bold text-xl text-gray-900">Medcare</span>
        </Link>

        {/* 404 */}
        <div className="relative mb-6">
          <p className="text-[120px] font-display font-bold text-primary/10 leading-none select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center text-5xl">
            🔍
          </div>
        </div>

        <h1 className="font-display font-bold text-2xl text-gray-900 mb-3">
          Page not found
        </h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="btn-outline">
            ← Go Back
          </button>
          {user ? (
            <Link to={dashboardPath} className="btn-primary">
              Go to Dashboard
            </Link>
          ) : (
            <Link to="/" className="btn-primary">
              Go to Home
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotFound;
