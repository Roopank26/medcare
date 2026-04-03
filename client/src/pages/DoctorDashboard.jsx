import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar           from "../components/Sidebar";
import Topbar            from "../components/Topbar";
import ChatbotWidget     from "../components/ChatbotWidget";
import DoctorOverview    from "../components/doctor/DoctorOverview";
import PatientManagement from "../components/doctor/PatientManagement";
import SearchPatients    from "../components/doctor/SearchPatients";
import Analytics         from "../components/doctor/Analytics";
import DoctorReports     from "../components/doctor/DoctorReports";
import AdminDashboard    from "../components/doctor/AdminDashboard";
import Appointments      from "../components/shared/Appointments";
import Profile           from "../components/shared/Profile";

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState("overview");

  const renderSection = () => {
    switch (activeSection) {
      case "overview":     return <DoctorOverview user={user} setActiveSection={setActiveSection} />;
      case "patients":     return <PatientManagement />;
      case "appointments": return <Appointments />;
      case "search":       return <SearchPatients />;
      case "analytics":    return <Analytics />;
      case "reports":      return <DoctorReports />;
      case "admin":        return <AdminDashboard />;
      case "profile":      return <Profile />;
      default:             return <DoctorOverview user={user} setActiveSection={setActiveSection} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />
      <div className="flex-1 flex flex-col min-w-0 ml-64">
        <Topbar activeSection={activeSection} />
        <main className="flex-1 mt-16 p-6 md:p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto w-full">
            {renderSection()}
          </div>
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
};

export default DoctorDashboard;
