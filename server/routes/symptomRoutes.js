// ============================================================
//  Symptom Routes — only /analyze is kept
//  History, reports and alerts now live in Firestore
// ============================================================

const express = require("express");
const router  = express.Router();
const { analyzeSymptoms } = require("../controllers/symptomController");

router.post("/analyze", analyzeSymptoms);

module.exports = router;
