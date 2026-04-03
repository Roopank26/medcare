// ============================================================
//  Symptom Analysis Controller - Firebase Edition
//
//  WHAT CHANGED:
//  - Removed: Firestore/in-memory saving (React now saves to Firestore)
//  - Removed: getSymptomHistory, getAlerts, addReport, getReports
//  - Kept:    Pure analysis logic - returns diagnosis + confidence
//             Designed to be swappable with OpenAI/Gemini later
// ============================================================
const SYMPTOM_DATABASE = {
  flu: {
    keywords: ["fever","chills","body ache","fatigue","runny nose","cough","sweating"],
    diagnosis: "Flu (Influenza)",
    recommendations: [
      "Rest and get plenty of sleep",
      "Stay hydrated - drink water and clear broths",
      "Take paracetamol or ibuprofen for fever and pain",
      "Consult a doctor if fever exceeds 103F or lasts more than 3 days",
      "Avoid contact with others to prevent spreading",
    ],
  },
  migraine: {
    keywords: ["headache","migraine","head pain","throbbing","light sensitivity","nausea"],
    diagnosis: "Migraine / Tension Headache",
    recommendations: [
      "Rest in a quiet, dark room",
      "Apply cold or warm compress to forehead",
      "Take OTC pain relievers (ibuprofen, aspirin)",
      "Stay hydrated and avoid caffeine spikes",
      "Track triggers in a headache diary",
    ],
  },
  cold: {
    keywords: ["cold","sneezing","sore throat","congestion","stuffy nose","blocked nose"],
    diagnosis: "Common Cold (Rhinovirus)",
    recommendations: [
      "Rest and stay warm",
      "Use saline nasal spray for congestion",
      "Gargle warm salt water for sore throat",
      "Drink warm fluids - honey and lemon tea",
      "OTC decongestants may help with stuffiness",
    ],
  },
  allergy: {
    keywords: ["allergy","itchy","rash","hives","sneezing","watery eyes","swelling"],
    diagnosis: "Allergic Reaction",
    recommendations: [
      "Identify and avoid known allergens",
      "Take antihistamines (cetirizine, loratadine)",
      "Avoid scratching rashes or skin irritations",
      "If swelling affects breathing, seek emergency care immediately",
      "Consider allergy testing for recurring reactions",
    ],
  },
  gastro: {
    keywords: ["stomach","nausea","vomiting","diarrhea","stomach ache","abdominal","cramps","indigestion"],
    diagnosis: "Gastroenteritis / GI Distress",
    recommendations: [
      "Stay hydrated with water and electrolyte drinks",
      "Follow a BRAT diet (Bananas, Rice, Applesauce, Toast)",
      "Avoid dairy, fatty, and spicy foods temporarily",
      "Take OTC antidiarrheal if needed",
      "Seek medical help if symptoms persist beyond 48 hours",
    ],
  },
  hypertension: {
    keywords: ["high blood pressure","hypertension","dizziness","blurred vision","chest tightness","palpitations"],
    diagnosis: "Possible Hypertension / Cardiovascular Issue",
    recommendations: [
      "Measure blood pressure immediately",
      "Sit down and rest in a calm environment",
      "Avoid caffeine and salty foods",
      "Consult a doctor for persistent symptoms",
      "Seek emergency care if chest pain is severe",
    ],
  },
  diabetes: {
    keywords: ["thirst","frequent urination","blurry vision","fatigue","slow healing","weight loss","blood sugar"],
    diagnosis: "Possible Diabetes Symptoms",
    recommendations: [
      "Check blood glucose levels immediately",
      "Avoid high-sugar foods and drinks",
      "Schedule a fasting blood glucose test",
      "Monitor symptoms closely",
      "Consult an endocrinologist",
    ],
  },
};

const analyzeSymptoms = (req, res) => {
  const { symptoms } = req.body;

  if (!symptoms || !symptoms.trim()) {
    return res.status(400).json({ message: "Symptoms text is required" });
  }

  const lower = symptoms.toLowerCase();
  let bestMatch = null;
  let maxScore  = 0;

  for (const [, data] of Object.entries(SYMPTOM_DATABASE)) {
    const matchCount = data.keywords.filter((kw) => lower.includes(kw)).length;
    if (matchCount > maxScore) {
      maxScore  = matchCount;
      bestMatch = { ...data, matchCount };
    }
  }

  let result;
  if (!bestMatch || maxScore === 0) {
    result = {
      diagnosis: "Unspecified Condition",
      confidence: 20,
      recommendations: [
        "Please provide more detailed symptoms",
        "Consult a healthcare professional for proper diagnosis",
        "Keep a symptom log with dates and times",
        "Ensure you are staying hydrated and rested",
      ],
    };
  } else {
    const confidence = Math.min(
      Math.round((maxScore / bestMatch.keywords.length) * 100) + 30,
      95
    );
    result = {
      diagnosis:       bestMatch.diagnosis,
      confidence,
      recommendations: bestMatch.recommendations,
    };
  }

  // NOTE: Saving to Firestore is handled client-side in SymptomChecker.jsx
  // This endpoint only returns the analysis — it is stateless
  res.status(200).json({
    result: {
      ...result,
      date: new Date().toISOString().split("T")[0],
    },
  });
};

module.exports = { analyzeSymptoms };
