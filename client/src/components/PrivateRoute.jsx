import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const AuthLoader = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
    <div className="relative">
      <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg animate-pulse-ring">
        M
      </div>
      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-secondary rounded-full border-2 border-white"></div>
    </div>
    <div className="text-center">
      <p className="text-gray-600 font-semibold text-sm">Medcare</p>
      <p className="text-gray-400 text-xs mt-0.5">Verifying your session…</p>
    </div>
    <div className="flex gap-1.5 mt-2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-primary rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  </div>
);

const PrivateRoute = ({ children, role }) => {
  const { user, loading } = useAuth();

  if (loading) return <AuthLoader />;
  if (!user)   return <Navigate to="/login" replace />;

  if (role && user.role !== role) {
    return <Navigate to={user.role === "doctor" ? "/doctor-dashboard" : "/patient-dashboard"} replace />;
  }

  return children;
};

export default PrivateRoute;
