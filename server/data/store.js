// In-memory data store for Medcare
const store = {
  users: [
    {
      id: "1",
      name: "Dr. Sarah Mitchell",
      email: "doctor@medcare.com",
      password: "doctor123",
      role: "doctor",
      createdAt: new Date().toISOString(),
    },
    {
      id: "2",
      name: "John Patient",
      email: "patient@medcare.com",
      password: "patient123",
      role: "patient",
      createdAt: new Date().toISOString(),
    },
  ],
  patients: [
    {
      id: "p1",
      name: "Alice Johnson",
      age: 34,
      condition: "Hypertension",
      doctorId: "1",
      lastVisit: "2024-01-15",
      status: "Active",
    },
    {
      id: "p2",
      name: "Bob Williams",
      age: 52,
      condition: "Diabetes Type 2",
      doctorId: "1",
      lastVisit: "2024-01-20",
      status: "Active",
    },
    {
      id: "p3",
      name: "Carol Davis",
      age: 28,
      condition: "Asthma",
      doctorId: "1",
      lastVisit: "2024-01-10",
      status: "Recovered",
    },
    {
      id: "p4",
      name: "David Brown",
      age: 45,
      condition: "Migraine",
      doctorId: "1",
      lastVisit: "2024-01-22",
      status: "Active",
    },
  ],
  symptomHistory: [
    {
      id: "s1",
      userId: "2",
      symptoms: "fever, chills, body ache",
      diagnosis: "Flu",
      confidence: 87,
      recommendations: [
        "Rest and stay hydrated",
        "Take paracetamol for fever",
        "Consult doctor if fever exceeds 103°F",
      ],
      date: "2024-01-18",
    },
  ],
  reports: [],
  alerts: [
    {
      id: "a1",
      userId: "2",
      type: "warning",
      message: "Your next appointment is scheduled for Feb 5, 2024",
      date: new Date().toISOString(),
    },
    {
      id: "a2",
      userId: "2",
      type: "info",
      message: "New test results from Dr. Mitchell are available",
      date: new Date().toISOString(),
    },
  ],
};

module.exports = store;
