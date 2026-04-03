import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar         from "../components/Sidebar";
import Topbar          from "../components/Topbar";
import ChatbotWidget   from "../components/ChatbotWidget";
import PatientOverview from "../components/patient/PatientOverview";
import SymptomChecker  from "../components/patient/SymptomChecker";
import MedicalHistory  from "../components/patient/MedicalHistory";
import ReportsUpload   from "../components/patient/ReportsUpload";
import Alerts          from "../components/patient/Alerts";
import Appointments    from "../components/shared/Appointments";
import Profile         from "../components/shared/Profile";

const PatientDashboard = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");

  const renderSection = () => {
    switch (activeSection) {
      case "overview":     return <PatientOverview user={user} setActiveSection={setActiveSection} />;
      case "symptoms":     return <SymptomChecker />;
      case "history":      return <MedicalHistory />;
      case "appointments": return <Appointments />;
      case "reports":      return <ReportsUpload />;
      case "alerts":       return <Alerts />;
      case "profile":      return <Profile />;
      default:             return <PatientOverview user={user} setActiveSection={setActiveSection} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Fixed sidebar — 256px wide */}
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />

      {/* Main column: offset by sidebar width, full height */}
      <div className="flex-1 flex flex-col min-w-0 ml-64">
        {/* Fixed topbar — height 64px */}
        <Topbar activeSection={activeSection} />

        {/* Scrollable content — padded below fixed topbar */}
        <main className="flex-1 mt-16 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto w-full">
            {renderSection()}
          </div>
        </main>
      </div>

      {/* Floating chatbot */}
      <ChatbotWidget />
    </div>
  );
};

export default PatientDashboard;
