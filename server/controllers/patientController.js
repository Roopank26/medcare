const store = require("../data/store");
const { v4: uuidv4 } = require("uuid");

const getAllPatients = (req, res) => {
  const { search } = req.query;
  let patients = [...store.patients];

  if (search) {
    patients = patients.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase())
    );
  }

  res.status(200).json({ patients });
};

const addPatient = (req, res) => {
  const { name, age, condition, doctorId, status } = req.body;

  if (!name || !age || !condition) {
    return res.status(400).json({ message: "Name, age, and condition are required" });
  }

  const newPatient = {
    id: uuidv4(),
    name,
    age: parseInt(age),
    condition,
    doctorId: doctorId || "1",
    lastVisit: new Date().toISOString().split("T")[0],
    status: status || "Active",
  };

  store.patients.push(newPatient);
  res.status(201).json({ message: "Patient added successfully", patient: newPatient });
};

const getPatientById = (req, res) => {
  const { id } = req.params;
  const patient = store.patients.find((p) => p.id === id);

  if (!patient) {
    return res.status(404).json({ message: "Patient not found" });
  }

  res.status(200).json({ patient });
};

const updatePatient = (req, res) => {
  const { id } = req.params;
  const index = store.patients.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "Patient not found" });
  }

  store.patients[index] = { ...store.patients[index], ...req.body };
  res.status(200).json({ message: "Patient updated", patient: store.patients[index] });
};

const deletePatient = (req, res) => {
  const { id } = req.params;
  const index = store.patients.findIndex((p) => p.id === id);

  if (index === -1) {
    return res.status(404).json({ message: "Patient not found" });
  }

  store.patients.splice(index, 1);
  res.status(200).json({ message: "Patient removed" });
};

const getStats = (req, res) => {
  const total = store.patients.length;
  const active = store.patients.filter((p) => p.status === "Active").length;
  const recovered = store.patients.filter((p) => p.status === "Recovered").length;
  const conditions = {};

  store.patients.forEach((p) => {
    conditions[p.condition] = (conditions[p.condition] || 0) + 1;
  });

  const conditionData = Object.entries(conditions).map(([name, count]) => ({
    name,
    count,
  }));

  res.status(200).json({
    stats: { total, active, recovered, conditionData },
  });
};

module.exports = { getAllPatients, addPatient, getPatientById, updatePatient, deletePatient, getStats };
