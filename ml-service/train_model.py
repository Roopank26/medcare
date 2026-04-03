#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Medcare ML — Model Trainer with comprehensive debugging
Trains Random Forest, Decision Tree, and Naive Bayes classifiers.
Saves the best model + symptom list to disk.

Run: python train_model.py
"""

import os, sys, json, traceback
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, VotingClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, accuracy_score
from sklearn.preprocessing import LabelEncoder

# ── Debug: Print Python version and environment ────────────────────────────
print(f"[DEBUG] Python version: {sys.version}")
print(f"[DEBUG] Python executable: {sys.executable}")
print(f"[DEBUG] Current working directory: {os.getcwd()}")

# ── Paths ────────────────────────────────────────────────────
BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
print(f"[DEBUG] BASE_DIR: {BASE_DIR}")

DATA_PATH   = os.path.join(BASE_DIR, "data", "symptoms_dataset.csv")
print(f"[DEBUG] DATA_PATH: {DATA_PATH}")

MODELS_DIR  = os.path.join(BASE_DIR, "models")
print(f"[DEBUG] MODELS_DIR: {MODELS_DIR}")

# Create models directory with error handling
try:
    os.makedirs(MODELS_DIR, exist_ok=True)
    print(f"[OK] Created models directory: {MODELS_DIR}")
except Exception as e:
    print(f"[ERROR] Failed to create models directory: {e}")
    sys.exit(1)

# Verify directory exists
if not os.path.isdir(MODELS_DIR):
    print(f"[ERROR] Models directory does not exist and could not be created: {MODELS_DIR}")
    sys.exit(1)
else:
    print(f"[OK] Models directory verified: {MODELS_DIR}")

MODEL_PATH    = os.path.join(MODELS_DIR, "medcare_model.pkl")
ENCODER_PATH  = os.path.join(MODELS_DIR, "label_encoder.pkl")
SYMPTOMS_PATH = os.path.join(MODELS_DIR, "symptoms_list.json")
META_PATH     = os.path.join(MODELS_DIR, "model_meta.json")

print(f"[DEBUG] MODEL_PATH: {MODEL_PATH}")
print(f"[DEBUG] ENCODER_PATH: {ENCODER_PATH}")
print(f"[DEBUG] SYMPTOMS_PATH: {SYMPTOMS_PATH}")
print(f"[DEBUG] META_PATH: {META_PATH}")


def load_or_generate_data():
    """Load dataset from CSV or generate if missing."""
    print("\n" + "="*60)
    print("[STEP 1] LOAD OR GENERATE DATASET")
    print("="*60)
    
    # Check if data directory exists
    data_dir = os.path.dirname(DATA_PATH)
    print(f"[CHECK] Data directory exists: {os.path.isdir(data_dir)} ({data_dir})")
    
    # Check if CSV file exists
    csv_exists = os.path.exists(DATA_PATH)
    print(f"[CHECK] CSV file exists: {csv_exists} ({DATA_PATH})")
    
    if csv_exists:
        try:
            print(f"[LOAD] Loading dataset from CSV: {DATA_PATH}")
            df = pd.read_csv(DATA_PATH)
            print(f"[OK] Dataset loaded: {len(df)} rows, {len(df.columns)} columns")
            print(f"[OK] Columns: {list(df.columns[:5])}... (showing first 5)")
            return df
        except Exception as e:
            print(f"[ERROR] Failed to load CSV: {type(e).__name__}: {e}")
            print("[INFO] Will attempt to generate dataset instead...")
    
    # Dataset missing or failed to load — generate it
    print("[GENERATE] Generating dataset (no CSV found)...")
    
    try:
        print("[IMPORT] Attempting to import generate_dataset from data.dataset...")
        
        # Add BASE_DIR to path FIRST for module imports
        if BASE_DIR not in sys.path:
            print(f"[INFO] Adding to sys.path: {BASE_DIR}")
            sys.path.insert(0, BASE_DIR)
        
        # Try import
        print(f"[IMPORT] sys.path[0] = {sys.path[0]}")
        print(f"[IMPORT] Checking if data/dataset.py exists: {os.path.exists(os.path.join(BASE_DIR, 'data', 'dataset.py'))}")
        
        from data.dataset import generate_dataset
        print("[OK] Successfully imported generate_dataset")
        
        # Generate data
        print("[GENERATE] Calling generate_dataset(samples_per_disease=150)...")
        df = generate_dataset(samples_per_disease=150)
        print(f"[OK] Dataset generated: {len(df)} rows, {len(df.columns)} columns")
        
        # Create data directory if needed
        data_dir = os.path.dirname(DATA_PATH)
        if not os.path.exists(data_dir):
            print(f"[CREATE] Creating data directory: {data_dir}")
            os.makedirs(data_dir, exist_ok=True)
        
        # Save to CSV
        print(f"[SAVE] Saving dataset to: {DATA_PATH}")
        df.to_csv(DATA_PATH, index=False)
        
        # Verify save
        if os.path.exists(DATA_PATH):
            saved_size = os.path.getsize(DATA_PATH)
            print(f"[OK] Dataset saved successfully ({saved_size} bytes)")
        else:
            raise FileNotFoundError(f"Dataset file was not created at: {DATA_PATH}")
        
        return df
        
    except ImportError as e:
        print(f"[ERROR] Import failed: {type(e).__name__}: {e}")
        print("[ERROR] Cannot generate dataset without data.dataset module")
        print("[ERROR] File should be at:", os.path.join(BASE_DIR, 'data', 'dataset.py'))
        raise
    except Exception as e:
        print(f"[ERROR] Dataset generation failed: {type(e).__name__}: {e}")
        raise



def train():
    print("\n" + "="*60)
    print("[STEP 2] TRAIN ML MODEL")
    print("="*60)
    
    # Load data
    print("\n[LOAD] Loading training data...")
    try:
        df = load_or_generate_data()
        print(f"[OK] Data loaded: {len(df)} samples")
    except Exception as e:
        print(f"[ERROR] Failed to load/generate data: {type(e).__name__}: {e}")
        raise

    # Prepare features
    print("\n[PREPARE] Preparing features and labels...")
    try:
        symptom_cols = [c for c in df.columns if c != "disease"]
        X = df[symptom_cols].values
        y = df["disease"].values
        print(f"[OK] Features prepared: {len(symptom_cols)} symptoms, {len(X)} samples")
        print(f"[OK] Unique diseases: {len(np.unique(y))}")
    except Exception as e:
        print(f"[ERROR] Failed to prepare features: {type(e).__name__}: {e}")
        raise

    # Label encoding
    print("\n[ENCODE] Performing label encoding...")
    try:
        le = LabelEncoder()
        y_enc = le.fit_transform(y)
        print(f"[OK] Encoded {len(le.classes_)} disease classes: {list(le.classes_[:3])}...")
    except Exception as e:
        print(f"[ERROR] Failed to encode labels: {type(e).__name__}: {e}")
        raise

    # Train / test split
    print("\n[SPLIT] Splitting data (80/20)...")
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
        )
        print(f"[OK] Train set: {len(X_train)} samples")
        print(f"[OK] Test set: {len(X_test)} samples")
    except Exception as e:
        print(f"[ERROR] Failed to split data: {type(e).__name__}: {e}")
        raise

    # Define models
    print("\n[BUILD] Building ensemble models...")
    try:
        rf  = RandomForestClassifier(n_estimators=200, max_depth=None, random_state=42, n_jobs=-1)
        dt  = DecisionTreeClassifier(max_depth=20, random_state=42)
        nb  = GaussianNB()
        print("[OK] Random Forest created (200 estimators)")
        print("[OK] Decision Tree created (max_depth=20)")
        print("[OK] Gaussian Naive Bayes created")

        ensemble = VotingClassifier(
            estimators=[("rf", rf), ("dt", dt), ("nb", nb)],
            voting="soft",
            weights=[3, 1, 1],
        )
        print("[OK] Ensemble Voting Classifier created")
    except Exception as e:
        print(f"[ERROR] Failed to build models: {type(e).__name__}: {e}")
        raise

    # Cross-validation
    print("\n[CV] Running 5-fold cross-validation...")
    try:
        cv_scores = cross_val_score(ensemble, X, y_enc, cv=5, scoring="accuracy")
        mean_cv = cv_scores.mean()
        std_cv = cv_scores.std()
        print(f"[OK] CV Accuracy: {mean_cv:.4f} +/- {std_cv:.4f}")
    except Exception as e:
        print(f"[ERROR] Cross-validation failed: {type(e).__name__}: {e}")
        raise

    # Final fit
    print("\n[FIT] Fitting final model on training set...")
    try:
        ensemble.fit(X_train, y_train)
        print("[OK] Model fitting completed")
    except Exception as e:
        print(f"[ERROR] Model fitting failed: {type(e).__name__}: {e}")
        raise

    # Evaluate
    print("\n[EVAL] Evaluating on test set...")
    try:
        y_pred    = ensemble.predict(X_test)
        test_acc  = accuracy_score(y_test, y_pred)
        print(f"[OK] Test Accuracy: {test_acc:.4f}")
        print("\n[REPORT] Classification Report:")
        print(classification_report(y_test, y_pred, target_names=le.classes_))
    except Exception as e:
        print(f"[ERROR] Evaluation failed: {type(e).__name__}: {e}")
        raise

    # Save artifacts with detailed error checking
    print("\n" + "="*60)
    print("[STEP 3] SAVING MODEL ARTIFACTS")
    print("="*60)
    
    # Save model
    print(f"\n[SAVE] Saving model to: {MODEL_PATH}")
    try:
        joblib.dump(ensemble, MODEL_PATH)
        if os.path.exists(MODEL_PATH):
            size_mb = os.path.getsize(MODEL_PATH) / (1024*1024)
            print(f"[OK] Model saved ({size_mb:.2f} MB)")
        else:
            raise FileNotFoundError(f"Model file was not created at: {MODEL_PATH}")
    except Exception as e:
        print(f"[ERROR] Failed to save model: {type(e).__name__}: {e}")
        raise

    # Save encoder
    print(f"\n[SAVE] Saving encoder to: {ENCODER_PATH}")
    try:
        joblib.dump(le, ENCODER_PATH)
        if os.path.exists(ENCODER_PATH):
            size_kb = os.path.getsize(ENCODER_PATH) / 1024
            print(f"[OK] Encoder saved ({size_kb:.2f} KB)")
        else:
            raise FileNotFoundError(f"Encoder file was not created at: {ENCODER_PATH}")
    except Exception as e:
        print(f"[ERROR] Failed to save encoder: {type(e).__name__}: {e}")
        raise

    # Save symptoms list
    print(f"\n[SAVE] Saving symptoms list to: {SYMPTOMS_PATH}")
    try:
        with open(SYMPTOMS_PATH, "w") as f:
            json.dump(symptom_cols, f, indent=2)
        if os.path.exists(SYMPTOMS_PATH):
            size_b = os.path.getsize(SYMPTOMS_PATH)
            print(f"[OK] Symptoms list saved ({size_b} bytes)")
        else:
            raise FileNotFoundError(f"Symptoms file was not created at: {SYMPTOMS_PATH}")
    except Exception as e:
        print(f"[ERROR] Failed to save symptoms: {type(e).__name__}: {e}")
        raise

    # Save metadata
    print(f"\n[SAVE] Saving metadata to: {META_PATH}")
    try:
        meta = {
            "diseases":      le.classes_.tolist(),
            "n_symptoms":    len(symptom_cols),
            "n_samples":     len(df),
            "test_accuracy": round(test_acc, 4),
            "cv_accuracy":   round(float(cv_scores.mean()), 4),
        }
        with open(META_PATH, "w") as f:
            json.dump(meta, f, indent=2)
        if os.path.exists(META_PATH):
            size_b = os.path.getsize(META_PATH)
            print(f"[OK] Metadata saved ({size_b} bytes)")
        else:
            raise FileNotFoundError(f"Metadata file was not created at: {META_PATH}")
    except Exception as e:
        print(f"[ERROR] Failed to save metadata: {type(e).__name__}: {e}")
        raise

    print(f"\n[OK] Diseases: {len(le.classes_)}")
    print(f"[OK] Symptoms: {len(symptom_cols)}")
    
    return test_acc



if __name__ == "__main__":
    try:
        print("\n" + "="*70)
        print("[START] MEDCARE ML MODEL TRAINING PIPELINE")
        print("="*70)
        
        # Run training
        accuracy = train()
        
        # Comprehensive file verification
        print("\n" + "="*70)
        print("[VERIFY] FINAL FILE VERIFICATION")
        print("="*70)
        
        files_to_check = {
            "Model": MODEL_PATH,
            "Encoder": ENCODER_PATH,
            "Symptoms": SYMPTOMS_PATH,
            "Metadata": META_PATH,
        }
        
        all_exist = True
        for name, path in files_to_check.items():
            exists = os.path.exists(path)
            status = "[OK]" if exists else "[MISSING]"
            size = os.path.getsize(path) if exists else 0
            size_str = f"({size:,} bytes)" if exists else "(FILE NOT FOUND)"
            print(f"{status} {name}: {path} {size_str}")
            if not exists:
                all_exist = False
        
        if not all_exist:
            print("\n[ERROR] Not all model files were created!")
            print("[ERROR] Cannot proceed with exit code 0")
            sys.exit(1)
        
        # Success output
        print("\n" + "="*70)
        print("[SUCCESS] TRAINING PIPELINE COMPLETED")
        print("="*70)
        print(f"[METRIC] Final Test Accuracy: {accuracy:.4f}")
        print(f"[METRIC] Model type: VotingClassifier (RF + DT + NB)")
        print(f"[METRIC] Diseases: {len(files_to_check)}")
        print(f"[FILES] All 4 required files created and verified")
        print("="*70 + "\n")
        
        # Exit with success
        sys.exit(0)
        
    except AssertionError as e:
        print("\n" + "="*70)
        print("[FAIL] ASSERTION ERROR")
        print("="*70)
        print(f"[ERROR] {str(e)}")
        traceback.print_exc()
        print("="*70 + "\n")
        sys.exit(1)
        
    except Exception as e:
        print("\n" + "="*70)
        print("[FAIL] TRAINING PIPELINE FAILED")
        print("="*70)
        print(f"[ERROR] {type(e).__name__}: {str(e)}")
        print("\n[TRACEBACK] Full error details:")
        traceback.print_exc()
        print("="*70 + "\n")
        sys.exit(1)
