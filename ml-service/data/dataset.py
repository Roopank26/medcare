"""
Medcare ML — Symptom-Disease Dataset
Generates a synthetic but medically-grounded training dataset.
Run: python data/dataset.py  →  writes symptoms_dataset.csv
"""

import pandas as pd
import numpy as np
import os

# ── All symptoms tracked by the model ──────────────────────────────────────
ALL_SYMPTOMS = [
    "fever", "high_fever", "mild_fever", "chills", "sweating",
    "headache", "severe_headache", "migraine",
    "cough", "dry_cough", "productive_cough", "breathlessness",
    "runny_nose", "nasal_congestion", "sneezing", "sore_throat",
    "fatigue", "weakness", "lethargy",
    "body_ache", "muscle_pain", "joint_pain", "back_pain",
    "nausea", "vomiting", "diarrhea", "stomach_pain", "cramps", "indigestion",
    "loss_of_appetite", "weight_loss",
    "skin_rash", "itching", "hives",
    "dizziness", "fainting", "blurred_vision",
    "chest_pain", "chest_tightness", "palpitations",
    "swollen_lymph_nodes", "neck_stiffness",
    "frequent_urination", "excessive_thirst",
    "anxiety", "depression", "insomnia",
    "light_sensitivity", "neck_pain", "confusion",
]

# ── Disease definitions: symptoms with probabilities ───────────────────────
# Format: { symptom: probability_of_occurring }
DISEASES = {
    "Influenza (Flu)": {
        "fever": 0.95, "high_fever": 0.75, "chills": 0.85, "body_ache": 0.90,
        "headache": 0.80, "fatigue": 0.90, "cough": 0.80, "sore_throat": 0.60,
        "runny_nose": 0.55, "sweating": 0.70, "weakness": 0.80, "loss_of_appetite": 0.65,
    },
    "Common Cold": {
        "runny_nose": 0.95, "nasal_congestion": 0.90, "sneezing": 0.85,
        "sore_throat": 0.80, "mild_fever": 0.50, "cough": 0.70,
        "headache": 0.55, "fatigue": 0.60, "weakness": 0.45,
    },
    "Migraine": {
        "severe_headache": 0.95, "migraine": 0.90, "nausea": 0.80,
        "vomiting": 0.55, "light_sensitivity": 0.85, "dizziness": 0.65,
        "blurred_vision": 0.50, "neck_pain": 0.60, "fatigue": 0.55,
    },
    "Typhoid Fever": {
        "high_fever": 0.95, "headache": 0.85, "weakness": 0.90,
        "stomach_pain": 0.80, "loss_of_appetite": 0.85, "diarrhea": 0.70,
        "nausea": 0.75, "vomiting": 0.60, "fatigue": 0.90, "chills": 0.70,
        "body_ache": 0.75, "sweating": 0.65,
    },
    "Dengue Fever": {
        "high_fever": 0.95, "severe_headache": 0.85, "body_ache": 0.90,
        "joint_pain": 0.90, "muscle_pain": 0.85, "skin_rash": 0.75,
        "nausea": 0.70, "vomiting": 0.65, "fatigue": 0.80, "chills": 0.60,
        "loss_of_appetite": 0.75, "sweating": 0.55,
    },
    "Malaria": {
        "high_fever": 0.95, "chills": 0.90, "sweating": 0.85,
        "headache": 0.80, "body_ache": 0.80, "fatigue": 0.85,
        "nausea": 0.70, "vomiting": 0.65, "diarrhea": 0.50,
        "joint_pain": 0.55, "weakness": 0.80,
    },
    "Pneumonia": {
        "fever": 0.90, "cough": 0.95, "productive_cough": 0.85,
        "breathlessness": 0.90, "chest_pain": 0.80, "chills": 0.75,
        "fatigue": 0.85, "weakness": 0.80, "loss_of_appetite": 0.70,
        "nausea": 0.55,
    },
    "Bronchitis": {
        "cough": 0.95, "productive_cough": 0.85, "chest_tightness": 0.80,
        "breathlessness": 0.70, "mild_fever": 0.60, "fatigue": 0.70,
        "sore_throat": 0.55, "headache": 0.50, "body_ache": 0.55,
    },
    "Asthma": {
        "breathlessness": 0.95, "chest_tightness": 0.90, "dry_cough": 0.85,
        "cough": 0.80, "wheezing": 0.85, "fatigue": 0.65,
        "anxiety": 0.60, "sweating": 0.55,
    },
    "Gastroenteritis": {
        "diarrhea": 0.95, "vomiting": 0.90, "stomach_pain": 0.85,
        "nausea": 0.90, "cramps": 0.80, "fever": 0.65,
        "weakness": 0.75, "loss_of_appetite": 0.80, "fatigue": 0.70,
    },
    "Hypertension": {
        "headache": 0.80, "dizziness": 0.75, "blurred_vision": 0.65,
        "chest_pain": 0.70, "palpitations": 0.70, "fatigue": 0.60,
        "breathlessness": 0.60, "nausea": 0.45, "anxiety": 0.55,
    },
    "Diabetes (Type 2)": {
        "frequent_urination": 0.95, "excessive_thirst": 0.90,
        "fatigue": 0.85, "blurred_vision": 0.70, "weakness": 0.80,
        "weight_loss": 0.65, "headache": 0.55, "dizziness": 0.50,
        "nausea": 0.45, "loss_of_appetite": 0.45,
    },
    "Allergic Reaction": {
        "skin_rash": 0.85, "itching": 0.90, "hives": 0.80,
        "sneezing": 0.75, "runny_nose": 0.75, "nasal_congestion": 0.70,
        "swollen_lymph_nodes": 0.50, "breathlessness": 0.55,
        "watery_eyes": 0.70, "mild_fever": 0.40,
    },
    "Meningitis": {
        "severe_headache": 0.95, "neck_stiffness": 0.90, "high_fever": 0.90,
        "light_sensitivity": 0.85, "nausea": 0.80, "vomiting": 0.75,
        "confusion": 0.70, "skin_rash": 0.60, "fatigue": 0.85,
        "body_ache": 0.75,
    },
    "COVID-19": {
        "fever": 0.85, "dry_cough": 0.90, "fatigue": 0.85,
        "breathlessness": 0.75, "body_ache": 0.70, "headache": 0.70,
        "sore_throat": 0.65, "loss_of_appetite": 0.75,
        "dizziness": 0.50, "chills": 0.60, "weakness": 0.80,
    },
    "Urinary Tract Infection (UTI)": {
        "frequent_urination": 0.95, "stomach_pain": 0.80, "cramps": 0.75,
        "mild_fever": 0.65, "nausea": 0.55, "fatigue": 0.65,
        "back_pain": 0.70, "weakness": 0.55,
    },
    "Anxiety Disorder": {
        "anxiety": 0.95, "palpitations": 0.85, "breathlessness": 0.75,
        "insomnia": 0.80, "headache": 0.70, "dizziness": 0.65,
        "fatigue": 0.75, "sweating": 0.70, "chest_tightness": 0.65,
    },
    "Anemia": {
        "fatigue": 0.95, "weakness": 0.90, "dizziness": 0.85,
        "breathlessness": 0.75, "headache": 0.70, "blurred_vision": 0.55,
        "palpitations": 0.65, "fainting": 0.60, "chest_pain": 0.50,
    },
}

# Add "wheezing" and "watery_eyes" to master list
ALL_SYMPTOMS += ["wheezing", "watery_eyes"]


def generate_dataset(samples_per_disease: int = 120) -> pd.DataFrame:
    """Generate synthetic training data using disease-symptom probabilities."""
    rng = np.random.RandomState(42)
    rows = []

    for disease, symptom_probs in DISEASES.items():
        for _ in range(samples_per_disease):
            row = {s: 0 for s in ALL_SYMPTOMS}
            # Positive symptoms (from disease profile)
            for symptom, prob in symptom_probs.items():
                if symptom in row:
                    row[symptom] = int(rng.random() < prob)
            # Random noise — occasional false positives
            for symptom in ALL_SYMPTOMS:
                if row[symptom] == 0 and rng.random() < 0.05:
                    row[symptom] = 1
            row["disease"] = disease
            rows.append(row)

    df = pd.DataFrame(rows)
    # Shuffle
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    return df


if __name__ == "__main__":
    df = generate_dataset(samples_per_disease=150)
    out = os.path.join(os.path.dirname(__file__), "symptoms_dataset.csv")
    df.to_csv(out, index=False)
    print(f"[OK] Dataset saved: {out}")
    print(f"  Rows: {len(df)} | Diseases: {df['disease'].nunique()}")
    print(f"  Symptoms: {len(ALL_SYMPTOMS)}")
    print(df["disease"].value_counts())
