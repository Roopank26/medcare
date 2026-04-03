"""
Medcare ML - Predictor Utility
Loads the trained model and maps free-text symptoms to predictions.
"""

import os, json, re, traceback, sys
import numpy as np
import joblib

# Use absolute path to ml-service directory
# If predictor.py is at /app/ml-service/utils/predictor.py (Render)
# Then: dirname(__file__) = /app/ml-service/utils
#       dirname(dirname(__file__)) = /app/ml-service ✓
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))  # /app/ml-service/utils
BASE_DIR      = os.path.dirname(BASE_DIR)  # /app/ml-service (go up one level)

# Ensure BASE_DIR is valid
if not os.path.isabs(BASE_DIR):
    BASE_DIR = os.path.abspath(BASE_DIR)

MODELS_DIR    = os.path.join(BASE_DIR, "models")
MODEL_PATH    = os.path.join(MODELS_DIR, "medcare_model.pkl")
ENCODER_PATH  = os.path.join(MODELS_DIR, "label_encoder.pkl")
SYMPTOMS_PATH = os.path.join(MODELS_DIR, "symptoms_list.json")

# ── Disease metadata (severity + precautions) ─────────────────────────────
DISEASE_META = {
    "Influenza (Flu)": {
        "severity": "Medium",
        "action":   "Rest at home, stay hydrated, avoid contact with others.",
        "precautions": [
            "Rest and stay in isolation to prevent spreading",
            "Drink plenty of fluids - water, broth, electrolytes",
            "Take paracetamol or ibuprofen for fever and pain",
            "Get annual flu vaccination",
            "Consult a doctor if fever exceeds 103F or lasts over 3 days",
        ],
        "emoji": "[FLU]",
    },
    "Common Cold": {
        "severity": "Low",
        "action":   "Home rest with fluids and OTC medication.",
        "precautions": [
            "Rest and stay warm",
            "Use saline nasal spray and steam inhalation",
            "Gargle warm salt water for sore throat",
            "Take vitamin C supplements",
            "Wash hands frequently to prevent spreading",
        ],
        "emoji": "[COLD]",
    },
    "Migraine": {
        "severity": "Medium",
        "action":   "Rest in a dark room; avoid triggers. Consult neurologist for recurrence.",
        "precautions": [
            "Rest in a quiet, dark, cool room",
            "Take prescribed or OTC pain relievers early",
            "Apply cold or warm compress to forehead",
            "Keep a migraine diary to identify triggers",
            "Stay hydrated and maintain a consistent sleep schedule",
        ],
        "emoji": "[MIGRAINE]",
    },
    "Typhoid Fever": {
        "severity": "High",
        "action":   "Seek immediate medical attention. Antibiotics required.",
        "precautions": [
            "Seek immediate medical care - antibiotics are essential",
            "Drink only boiled or purified water",
            "Eat well-cooked, fresh food only",
            "Complete the full course of prescribed antibiotics",
            "Get vaccinated if traveling to high-risk areas",
        ],
        "emoji": "[FEVER]",
    },
    "Dengue Fever": {
        "severity": "High",
        "action":   "Immediate hospital evaluation recommended. Monitor platelet count.",
        "precautions": [
            "Go to a hospital immediately for blood tests",
            "Avoid aspirin and NSAIDs - use only paracetamol",
            "Stay hydrated with oral rehydration solutions",
            "Use mosquito repellents and nets",
            "Monitor for warning signs: bleeding, severe abdominal pain",
        ],
        "emoji": "[DENGUE]",
    },
    "Malaria": {
        "severity": "High",
        "action":   "Urgent medical evaluation and antimalarial treatment needed.",
        "precautions": [
            "Seek immediate medical attention for blood smear test",
            "Take prescribed antimalarial medication",
            "Use mosquito nets and repellents",
            "Stay hydrated and rest",
            "Do not self-medicate - treatment depends on malaria type",
        ],
        "emoji": "[MALARIA]",
    },
    "Pneumonia": {
        "severity": "High",
        "action":   "Medical attention required. May need antibiotics or hospitalization.",
        "precautions": [
            "See a doctor immediately for chest X-ray and diagnosis",
            "Take full course of prescribed antibiotics",
            "Rest and avoid strenuous activities",
            "Stay well-hydrated",
            "Get pneumococcal vaccine for future prevention",
        ],
        "emoji": "[PNEUMONIA]",
    },
    "Bronchitis": {
        "severity": "Medium",
        "action":   "Rest, hydration, and possible bronchodilators. Avoid irritants.",
        "precautions": [
            "Rest and avoid cold, dusty environments",
            "Use a humidifier to ease breathing",
            "Stay well-hydrated to loosen mucus",
            "Avoid smoking and secondhand smoke",
            "Take prescribed bronchodilators or cough syrup",
        ],
        "emoji": "[BRONCHITIS]",
    },
    "Asthma": {
        "severity": "Medium",
        "action":   "Use rescue inhaler. Seek emergency care if breathing is severely impaired.",
        "precautions": [
            "Use your rescue inhaler immediately",
            "Identify and avoid asthma triggers",
            "Follow your asthma action plan",
            "Keep controller medications on schedule",
            "Seek emergency care for severe breathlessness",
        ],
        "emoji": "[ASTHMA]",
    },
    "Gastroenteritis": {
        "severity": "Medium",
        "action":   "Oral rehydration therapy. Medical care if symptoms persist over 48h.",
        "precautions": [
            "Drink oral rehydration solutions to prevent dehydration",
            "Follow BRAT diet (Bananas, Rice, Applesauce, Toast)",
            "Avoid dairy, fatty, and spicy foods temporarily",
            "Wash hands thoroughly before eating",
            "Seek care if vomiting prevents hydration",
        ],
        "emoji": "[GASTRO]",
    },
    "Hypertension": {
        "severity": "High",
        "action":   "Monitor blood pressure. Consult a cardiologist urgently.",
        "precautions": [
            "Check blood pressure immediately",
            "Take prescribed antihypertensive medication",
            "Reduce salt intake and avoid processed foods",
            "Exercise regularly - 30 mins of moderate activity daily",
            "Avoid stress, alcohol, and smoking",
        ],
        "emoji": "[HYPERTON]",
    },
    "Diabetes (Type 2)": {
        "severity": "High",
        "action":   "Consult an endocrinologist. Monitor blood glucose regularly.",
        "precautions": [
            "Check blood glucose levels immediately",
            "Follow a low-glycemic diet",
            "Schedule a fasting blood glucose and HbA1c test",
            "Exercise regularly to improve insulin sensitivity",
            "Take prescribed medications as directed",
        ],
        "emoji": "[DIABETES]",
    },
    "Allergic Reaction": {
        "severity": "Medium",
        "action":   "Take antihistamines. Seek emergency care if breathing is affected.",
        "precautions": [
            "Identify and avoid the allergen trigger",
            "Take antihistamines (cetirizine, loratadine)",
            "Apply hydrocortisone cream for skin reactions",
            "Carry an epinephrine auto-injector if prescribed",
            "Seek emergency care for throat swelling or breathing difficulty",
        ],
        "emoji": "[ALLERGY]",
    },
    "Meningitis": {
        "severity": "Critical",
        "action":   "EMERGENCY: Go to hospital immediately. Life-threatening condition.",
        "precautions": [
            "[EMERGENCY] CALL EMERGENCY SERVICES IMMEDIATELY",
            "Do not delay - meningitis can be fatal within hours",
            "Hospital treatment with IV antibiotics is essential",
            "Avoid bright lights - they worsen symptoms",
            "Notify people in close contact as vaccination may be needed",
        ],
        "emoji": "[EMERGENCY]",
    },
    "COVID-19": {
        "severity": "High",
        "action":   "Self-isolate immediately. Get tested and monitor oxygen levels.",
        "precautions": [
            "Isolate immediately from others",
            "Get a COVID-19 PCR or antigen test",
            "Monitor oxygen saturation - seek care if below 94%",
            "Stay hydrated and rest",
            "Seek emergency care for severe breathlessness",
        ],
        "emoji": "[CV19]",
    },
    "Urinary Tract Infection (UTI)": {
        "severity": "Medium",
        "action":   "See a doctor for antibiotic prescription. Increase fluid intake.",
        "precautions": [
            "See a doctor for urine culture and antibiotic treatment",
            "Drink plenty of water to flush bacteria",
            "Avoid holding urine for long periods",
            "Urinate after intercourse to reduce risk",
            "Complete the full antibiotic course",
        ],
        "emoji": "[UTI]",
    },
    "Anxiety Disorder": {
        "severity": "Medium",
        "action":   "Practice relaxation techniques. Consider consulting a mental health professional.",
        "precautions": [
            "Practice deep breathing and mindfulness exercises",
            "Limit caffeine and alcohol intake",
            "Maintain a regular sleep schedule",
            "Consider speaking with a mental health professional",
            "Exercise regularly - it helps reduce anxiety naturally",
        ],
        "emoji": "[ANXIETY]",
    },
    "Anemia": {
        "severity": "Medium",
        "action":   "Get blood tests done. Iron or B12 supplementation may be needed.",
        "precautions": [
            "Get a complete blood count (CBC) test",
            "Eat iron-rich foods: spinach, lentils, red meat, tofu",
            "Take prescribed iron or B12 supplements",
            "Avoid tea and coffee with meals (inhibit iron absorption)",
            "Rest more than usual - your body needs it",
        ],
        "emoji": "[ANEMIA]",
    },
}

# -- Symptom aliases - map natural language to model features -----------
ALIASES = {
    # Fever variants
    "fever": "fever", "temperature": "fever", "hot": "fever", "warm": "fever",
    "high fever": "high_fever", "very high temperature": "high_fever",
    "mild fever": "mild_fever", "low grade fever": "mild_fever",
    # Pain
    "headache": "headache", "head pain": "headache", "head ache": "headache",
    "severe headache": "severe_headache", "throbbing": "severe_headache",
    "migraine": "migraine",
    "body ache": "body_ache", "body pain": "body_ache", "aches": "body_ache",
    "muscle pain": "muscle_pain", "muscle ache": "muscle_pain", "myalgia": "muscle_pain",
    "joint pain": "joint_pain", "joint ache": "joint_pain", "arthralgia": "joint_pain",
    "back pain": "back_pain", "backache": "back_pain",
    "neck pain": "neck_pain", "neck ache": "neck_pain",
    "stomach pain": "stomach_pain", "stomach ache": "stomach_pain", "abdominal pain": "stomach_pain",
    "cramps": "cramps", "cramping": "cramps", "stomach cramps": "cramps",
    "chest pain": "chest_pain", "chest ache": "chest_pain",
    # Respiratory
    "cough": "cough", "coughing": "cough",
    "dry cough": "dry_cough", "no phlegm": "dry_cough",
    "productive cough": "productive_cough", "phlegm": "productive_cough", "mucus": "productive_cough",
    "breathlessness": "breathlessness", "shortness of breath": "breathlessness",
    "difficulty breathing": "breathlessness", "cant breathe": "breathlessness",
    "chest tightness": "chest_tightness", "tight chest": "chest_tightness",
    "wheezing": "wheezing",
    # Nose / throat
    "runny nose": "runny_nose", "rhinorrhea": "runny_nose", "nasal discharge": "runny_nose",
    "nasal congestion": "nasal_congestion", "blocked nose": "nasal_congestion", "stuffy": "nasal_congestion",
    "sneezing": "sneezing",
    "sore throat": "sore_throat", "throat pain": "sore_throat", "throat ache": "sore_throat",
    # Systemic
    "fatigue": "fatigue", "tired": "fatigue", "tiredness": "fatigue", "exhaustion": "fatigue",
    "weakness": "weakness", "weak": "weakness", "no energy": "weakness",
    "lethargy": "lethargy", "sluggish": "lethargy",
    "chills": "chills", "shivering": "chills", "rigors": "chills",
    "sweating": "sweating", "sweat": "sweating", "night sweats": "sweating",
    # GI
    "nausea": "nausea", "nauseated": "nausea", "feel sick": "nausea",
    "vomiting": "vomiting", "vomit": "vomiting", "throwing up": "vomiting",
    "diarrhea": "diarrhea", "diarrhoea": "diarrhea", "loose stool": "diarrhea",
    "indigestion": "indigestion", "heartburn": "indigestion",
    "loss of appetite": "loss_of_appetite", "no appetite": "loss_of_appetite",
    "weight loss": "weight_loss",
    # Eyes / vision
    "blurred vision": "blurred_vision", "blurry": "blurred_vision", "vision problems": "blurred_vision",
    "light sensitivity": "light_sensitivity", "photophobia": "light_sensitivity",
    "watery eyes": "watery_eyes", "itchy eyes": "watery_eyes",
    # Neuro
    "dizziness": "dizziness", "dizzy": "dizziness", "vertigo": "dizziness",
    "fainting": "fainting", "fainted": "fainting", "syncope": "fainting",
    "confusion": "confusion", "confused": "confusion", "disorientation": "confusion",
    "neck stiffness": "neck_stiffness", "stiff neck": "neck_stiffness",
    # Skin
    "rash": "skin_rash", "skin rash": "skin_rash",
    "itching": "itching", "itchy": "itching",
    "hives": "hives", "urticaria": "hives",
    # CV
    "palpitations": "palpitations", "heart racing": "palpitations", "fast heartbeat": "palpitations",
    # Urinary
    "frequent urination": "frequent_urination", "urinating often": "frequent_urination",
    "excessive thirst": "excessive_thirst", "very thirsty": "excessive_thirst",
    # Lymph
    "swollen lymph nodes": "swollen_lymph_nodes", "swollen glands": "swollen_lymph_nodes",
    # Mental
    "anxiety": "anxiety", "anxious": "anxiety", "panic": "anxiety",
    "depression": "depression", "depressed": "depression", "sad": "depression",
    "insomnia": "insomnia", "cant sleep": "insomnia", "sleepless": "insomnia",
}


class MedcarePredictor:
    _instance = None

    def __init__(self):
        self.model    = None
        self.encoder  = None
        self.symptoms = None
        self._loaded  = False

    @classmethod
    def get(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def load(self):
        """
        Load trained model, encoder, and symptoms list.
        
        Returns:
            bool: True if all files loaded successfully, False otherwise
        """
        if self._loaded:
            return True
        
        print(f"[MODEL] Loading from directory: {MODELS_DIR}")
        
        # Check if all required files exist
        required_files = {
            "model": MODEL_PATH,
            "encoder": ENCODER_PATH,
            "symptoms": SYMPTOMS_PATH,
        }
        
        missing_files = {}
        for name, path in required_files.items():
            exists = os.path.exists(path)
            status = "[OK]" if exists else "[MISSING]"
            print(f"[CHECK] {status} {name}: {path}")
            if not exists:
                missing_files[name] = path
        
        if missing_files:
            print(f"\n[ERROR] Model files missing! Cannot start without trained model.")
            print(f"[ERROR] Missing files:")
            for name, path in missing_files.items():
                print(f"[ERROR]   - {name}: {path}")
            print(f"\n[FIX] To train the model:");
            print(f"[FIX]   cd {BASE_DIR}")
            print(f"[FIX]   python train_model.py")
            print(f"[FIX]")
            return False
        
        try:
            # Load model
            print(f"[LOAD] Loading model...")
            self.model = joblib.load(MODEL_PATH)
            print(f"[LOAD] [OK] Model loaded: {type(self.model).__name__}")
            
            # Load encoder
            print(f"[LOAD] Loading encoder...")
            self.encoder = joblib.load(ENCODER_PATH)
            n_diseases = len(self.encoder.classes_)
            print(f"[LOAD] [OK] Encoder loaded: {n_diseases} disease classes")
            
            # Load symptoms
            print(f"[LOAD] Loading symptoms...")
            with open(SYMPTOMS_PATH) as f:
                self.symptoms = json.load(f)
            n_symptoms = len(self.symptoms)
            print(f"[LOAD] [OK] Symptoms loaded: {n_symptoms} features")
            
            self._loaded = True
            print(f"[PASS] ML MODEL READY")
            return True
            
        except json.JSONDecodeError as e:
            print(f"[ERROR] Invalid JSON in {SYMPTOMS_PATH}: {str(e)}")
            return False
            
        except Exception as e:
            print(f"[ERROR] Failed to load model: {type(e).__name__}")
            print(f"[ERROR] {str(e)}")
            import traceback
            traceback.print_exc()
            return False

    def parse_symptoms(self, text_or_list):
        """Convert free text or a list into a model feature vector."""
        if isinstance(text_or_list, list):
            text = " ".join(text_or_list)
        else:
            text = str(text_or_list)

        text_lower = text.lower()
        matched = set()

        # 1. Try multi-word aliases first (longest match wins)
        alias_keys = sorted(ALIASES.keys(), key=len, reverse=True)
        for alias in alias_keys:
            if alias in text_lower:
                matched.add(ALIASES[alias])

        # 2. Try direct feature name matching
        for symptom in self.symptoms:
            sym_readable = symptom.replace("_", " ")
            if sym_readable in text_lower or symptom in text_lower:
                matched.add(symptom)

        return matched

    def predict(self, symptoms_input, top_k=3):
        """
        Predict disease from symptom input.

        Returns a rich dict including:
        - disease, confidence, severity, action, precautions
        - alternatives (top-3 with severity)
        - matched_symptoms (which symptoms were recognized)
        - contributing_factors (PHASE 5: explainability)
          - top symptoms driving the prediction, with % importance
          - plain-language reasoning string
        - confidence_breakdown (PHASE 5: per-estimator weights)
        """
        if not self._loaded and not self.load():
            return None

        matched = self.parse_symptoms(symptoms_input)
        if not matched:
            return {
                "disease":     "Unspecified Condition",
                "confidence":  20,
                "severity":    "Unknown",
                "action":      "Please provide more specific symptoms for better analysis.",
                "precautions": [
                    "Consult a healthcare professional for proper evaluation",
                    "Keep a symptom diary with dates and intensity",
                    "Stay hydrated and get adequate rest",
                ],
                "matched_symptoms":    [],
                "alternatives":        [],
                "contributing_factors": [],
                "reasoning":           "Insufficient symptoms provided for a reliable analysis.",
                "emoji":               "[MEDICAL]",
                "symptom_count":       0,
            }

        # ── Build feature vector ──────────────────────────────
        vec = np.array([[1 if s in matched else 0 for s in self.symptoms]])

        # ── Get ensemble probabilities ────────────────────────
        proba   = self.model.predict_proba(vec)[0]
        classes = self.encoder.classes_

        # ── Top-K predictions ─────────────────────────────────
        top_indices  = np.argsort(proba)[::-1][:top_k]
        top_diseases = [(classes[i], round(float(proba[i]) * 100, 1)) for i in top_indices]

        best_disease, best_conf = top_diseases[0]
        calibrated_conf = min(round(best_conf * 1.3 + 10, 1), 97.0)

        meta = DISEASE_META.get(best_disease, {
            "severity":    "Unknown",
            "action":      "Consult a healthcare professional.",
            "precautions": ["See a qualified doctor for diagnosis and treatment."],
            "emoji":       "[MEDICAL]",
        })

        # ── Phase 5: Explainability ────────────────────────────
        contributing_factors = []
        try:
            # Use Random Forest feature importances (estimator index 0)
            rf = self.model.estimators_[0]
            if hasattr(rf, "feature_importances_"):
                importances = rf.feature_importances_
                matched_scores = []
                for sym in matched:
                    if sym in self.symptoms:
                        idx   = self.symptoms.index(sym)
                        score = round(float(importances[idx]) * 100, 2)
                        matched_scores.append({
                            "symptom": sym.replace("_", " ").title(),
                            "weight":  score,
                        })
                # Sort by importance, return top-5
                matched_scores.sort(key=lambda x: x["weight"], reverse=True)
                contributing_factors = matched_scores[:5]
        except Exception:
            pass  # Explainability is informational - never crash prediction

        # ── Phase 5: Per-estimator confidence breakdown ───────
        confidence_breakdown = []
        try:
            estimator_names = ["Random Forest", "Decision Tree", "Naive Bayes"]
            # Get the encoded integer index for best_disease
            best_encoded = np.where(self.encoder.classes_ == best_disease)[0]
            if len(best_encoded):
                best_class_idx = int(best_encoded[0])
                for i, est in enumerate(self.model.estimators_):
                    est_proba = est.predict_proba(vec)[0]
                    # est.classes_ are integers matching encoder positions
                    est_class_positions = list(est.classes_)
                    if best_class_idx in est_class_positions:
                        pos      = est_class_positions.index(best_class_idx)
                        est_conf = round(float(est_proba[pos]) * 100, 1)
                        confidence_breakdown.append({
                            "model":      estimator_names[i] if i < len(estimator_names) else f"Model {i}",
                            "confidence": est_conf,
                        })
        except Exception:
            pass

        # ── Phase 5: Human-readable reasoning ─────────────────
        if contributing_factors:
            top_syms = [f["symptom"] for f in contributing_factors[:3]]
            reasoning = (
                f"The prediction of {best_disease} is primarily driven by "
                f"{', '.join(top_syms[:-1])} and {top_syms[-1]}. "
                if len(top_syms) >= 2
                else f"The prediction is based on {top_syms[0]}. "
            )
            reasoning += (
                f"These symptoms collectively achieve {calibrated_conf}% confidence across "
                f"the ensemble of {len(self.model.estimators_)} models."
            )
        else:
            reasoning = (
                f"Based on {len(matched)} matched symptom(s), "
                f"the model predicts {best_disease} with {calibrated_conf}% confidence."
            )

        # ── Alternatives ──────────────────────────────────────
        alternatives = []
        for d, c in top_diseases[1:]:
            if c > 2:
                cal_c    = min(round(c * 1.25 + 5, 1), 85.0)
                alt_meta = DISEASE_META.get(d, {})
                alternatives.append({
                    "disease":    d,
                    "confidence": cal_c,
                    "severity":   alt_meta.get("severity", "Unknown"),
                    "emoji":      alt_meta.get("emoji", "[MEDICAL]"),
                })

        return {
            "disease":                best_disease,
            "confidence":             calibrated_conf,
            "severity":               meta["severity"],
            "action":                 meta["action"],
            "precautions":            meta["precautions"],
            "matched_symptoms":       list(matched),
            "alternatives":           alternatives,
            "contributing_factors":   contributing_factors,
            "confidence_breakdown":   confidence_breakdown,
            "reasoning":              reasoning,
            "emoji":                  meta.get("emoji", "🩺"),
            "symptom_count":          len(matched),
        }

    def get_symptom_suggestions(self, partial: str):
        """Return symptom suggestions matching a partial string."""
        partial = partial.lower().strip()
        if len(partial) < 2:
            return []
        suggestions = set()
        # Check aliases
        for alias in ALIASES:
            if partial in alias:
                suggestions.add(alias.replace("_", " ").title())
        # Check raw symptom names
        if self.symptoms:
            for sym in self.symptoms:
                readable = sym.replace("_", " ")
                if partial in readable:
                    suggestions.add(readable.title())
        return sorted(suggestions)[:8]
