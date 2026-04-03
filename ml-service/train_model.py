#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Medcare ML — Model Trainer
Trains Random Forest, Decision Tree, and Naive Bayes classifiers.
Saves the best model + symptom list to disk.

Run: python train_model.py
"""

import os, sys, json
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import LabelEncoder

# ── Paths ────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(__file__)
DATA_PATH   = os.path.join(BASE_DIR, "data", "symptoms_dataset.csv")
MODELS_DIR  = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

MODEL_PATH    = os.path.join(MODELS_DIR, "medcare_model.pkl")
ENCODER_PATH  = os.path.join(MODELS_DIR, "label_encoder.pkl")
SYMPTOMS_PATH = os.path.join(MODELS_DIR, "symptoms_list.json")
META_PATH     = os.path.join(MODELS_DIR, "model_meta.json")


def load_or_generate_data():
    """Load dataset from CSV or generate if missing."""
    if os.path.exists(DATA_PATH):
        print(f"[LOAD] Found existing dataset: {DATA_PATH}")
        return pd.read_csv(DATA_PATH)
    
    # Dataset missing — generate it
    print("[GENERATE] Dataset not found — generating…")
    try:
        # Import from data.dataset module
        from data.dataset import generate_dataset
        df = generate_dataset(samples_per_disease=150)
        df.to_csv(DATA_PATH, index=False)
        print(f"[PASS] Dataset generated: {len(df)} rows at {DATA_PATH}")
        return df
    except ImportError as e:
        print(f"[WARN] Failed to import generate_dataset: {e}")
        print("[WARN] Attempting direct import via sys.path...")
        
        # Fallback: add BASE_DIR to path and retry
        if BASE_DIR not in sys.path:
            sys.path.insert(0, BASE_DIR)
        
        from data.dataset import generate_dataset
        df = generate_dataset(samples_per_disease=150)
        df.to_csv(DATA_PATH, index=False)
        print(f"[PASS] Dataset generated: {len(df)} rows at {DATA_PATH}")
        return df


def train():
    print("\n[ML] Medcare ML - Training Started")
    print("=" * 50)

    # Load data
    df = load_or_generate_data()
    print(f"[OK] Loaded {len(df)} samples, {df['disease'].nunique()} diseases")

    symptom_cols = [c for c in df.columns if c != "disease"]
    X = df[symptom_cols].values
    y = df["disease"].values

    # Label encoding
    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    # Train / test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
    )

    # Define models
    rf  = RandomForestClassifier(n_estimators=200, max_depth=None, random_state=42, n_jobs=-1)
    dt  = DecisionTreeClassifier(max_depth=20, random_state=42)
    nb  = GaussianNB()

    # Soft-voting ensemble
    ensemble = VotingClassifier(
        estimators=[("rf", rf), ("dt", dt), ("nb", nb)],
        voting="soft",
        weights=[3, 1, 1],   # RF gets more weight
    )

    # Cross-validation
    print("\nRunning 5-fold cross-validation...")
    cv_scores = cross_val_score(ensemble, X, y_enc, cv=5, scoring="accuracy")
    print(f"CV Accuracy: {cv_scores.mean():.3f} +/- {cv_scores.std():.3f}")

    # Final fit
    print("\nFitting final model on full training set...")
    ensemble.fit(X_train, y_train)

    # Evaluate
    y_pred    = ensemble.predict(X_test)
    test_acc  = accuracy_score(y_test, y_pred)
    print(f"Test Accuracy: {test_acc:.3f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    # Save artifacts
    joblib.dump(ensemble, MODEL_PATH)
    joblib.dump(le, ENCODER_PATH)

    with open(SYMPTOMS_PATH, "w") as f:
        json.dump(symptom_cols, f, indent=2)

    meta = {
        "diseases":      le.classes_.tolist(),
        "n_symptoms":    len(symptom_cols),
        "n_samples":     len(df),
        "test_accuracy": round(test_acc, 4),
        "cv_accuracy":   round(float(cv_scores.mean()), 4),
    }
    with open(META_PATH, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"\n[OK] Model saved: {MODEL_PATH}")
    print(f"[OK] Encoder: {ENCODER_PATH}")
    print(f"[OK] Symptoms: {SYMPTOMS_PATH}")
    print(f"[OK] Meta: {META_PATH}")
    print(f"\n[DB] Diseases: {len(le.classes_)}")
    print(f"[DB] Symptoms: {len(symptom_cols)}")
    return test_acc


if __name__ == "__main__":
    try:
        print("\n" + "="*60)
        print("[ML] MEDCARE ML MODEL TRAINING")
        print("="*60)
        
        accuracy = train()
        
        # Verify all files were saved
        assert os.path.exists(MODEL_PATH), f"Model file not created: {MODEL_PATH}"
        assert os.path.exists(ENCODER_PATH), f"Encoder file not created: {ENCODER_PATH}"
        assert os.path.exists(SYMPTOMS_PATH), f"Symptoms file not created: {SYMPTOMS_PATH}"
        assert os.path.exists(META_PATH), f"Meta file not created: {META_PATH}"
        
        print("\n" + "="*60)
        print("[PASS] TRAINING COMPLETED SUCCESSFULLY")
        print(f"[PASS] Model Accuracy: {accuracy:.3f} (73% = good, 85%+ = excellent)")
        print(f"[PASS] Model saved: {MODEL_PATH}")
        print(f"[PASS] Encoder saved: {ENCODER_PATH}")
        print(f"[PASS] Symptoms saved: {SYMPTOMS_PATH}")
        print(f"[PASS] Metadata saved: {META_PATH}")
        print("="*60 + "\n")
        
        sys.exit(0)  # Explicit success
        
    except AssertionError as e:
        print("\n" + "="*60)
        print("[FAIL] ASSERTION FAILED")
        print(f"[FAIL] {str(e)}")
        print("="*60 + "\n")
        sys.exit(1)
        
    except Exception as e:
        print("\n" + "="*60)
        print(f"[FAIL] TRAINING FAILED: {type(e).__name__}")
        print(f"[FAIL] Error: {str(e)}")
        print("="*60)
        import traceback
        traceback.print_exc()
        print("="*60 + "\n")
        sys.exit(1)  # Explicit failure
