const express = require("express");
const router = express.Router();
const {
  getAllPatients,
  addPatient,
  getPatientById,
  updatePatient,
  deletePatient,
  getStats,
} = require("../controllers/patientController");

router.get("/", getAllPatients);
router.post("/", addPatient);
router.get("/stats", getStats);
router.get("/:id", getPatientById);
router.put("/:id", updatePatient);
router.delete("/:id", deletePatient);

module.exports = router;
