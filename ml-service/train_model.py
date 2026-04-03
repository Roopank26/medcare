#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Medcare ML — Production-Safe Model Trainer
Bulletproof training pipeline with comprehensive error handling.
"""

import os
import sys
import json
import traceback

# ============================================================================
# IMPORTS & ENVIRONMENT SETUP
# ============================================================================

print("[START] Loading dependencies...")
try:
    import numpy as np
    import pandas as pd
    import joblib
    from sklearn.ensemble import RandomForestClassifier, VotingClassifier
    from sklearn.tree import DecisionTreeClassifier
    from sklearn.naive_bayes import GaussianNB
    from sklearn.model_selection import train_test_split, cross_val_score
    from sklearn.metrics import classification_report, accuracy_score
    from sklearn.preprocessing import LabelEncoder
    print("[OK] All dependencies loaded successfully")
except ImportError as e:
    print(f"[FATAL] Import error: {e}")
    sys.exit(1)

# ============================================================================
# PATH SETUP (ABSOLUTE, NO AMBIGUITY)
# ============================================================================

print("\n[SETUP] Configuring paths...")
print(f"[DEBUG] Current working directory: {os.getcwd()}")
print(f"[DEBUG] __file__ value: {__file__}")

# Get absolute path to this script's directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
print(f"[PATH] BASE_DIR (absolute): {BASE_DIR}")
print(f"[PATH] BASE_DIR exists: {os.path.isdir(BASE_DIR)}")
print(f"[PATH] BASE_DIR is absolute: {os.path.isabs(BASE_DIR)}")

# Data path
DATA_DIR = os.path.join(BASE_DIR, "data")
DATA_PATH = os.path.join(DATA_DIR, "symptoms_dataset.csv")
print(f"[PATH] DATA_PATH: {DATA_PATH}")

# Models directory
MODELS_DIR = os.path.join(BASE_DIR, "models")
print(f"[PATH] MODELS_DIR: {MODELS_DIR}")

# Model files
MODEL_PATH = os.path.join(MODELS_DIR, "medcare_model.pkl")
ENCODER_PATH = os.path.join(MODELS_DIR, "label_encoder.pkl")
SYMPTOMS_PATH = os.path.join(MODELS_DIR, "symptoms_list.json")
META_PATH = os.path.join(MODELS_DIR, "model_meta.json")

print(f"[PATH] MODEL_PATH: {MODEL_PATH}")
print(f"[PATH] ENCODER_PATH: {ENCODER_PATH}")
print(f"[PATH] SYMPTOMS_PATH: {SYMPTOMS_PATH}")
print(f"[PATH] META_PATH: {META_PATH}")

# ============================================================================
# DIRECTORY CREATION & VERIFICATION
# ============================================================================

print("\n[SETUP] Creating directories...")

# Create models directory
try:
    os.makedirs(MODELS_DIR, exist_ok=True)
    if not os.path.isdir(MODELS_DIR):
        raise OSError(f"Models directory not created or not a directory: {MODELS_DIR}")
    # Verify we can write to it
    test_file = os.path.join(MODELS_DIR, ".test_write")
    with open(test_file, "w") as f:
        f.write("x")
    os.remove(test_file)
    print(f"[OK] Models directory ready and writable: {MODELS_DIR}")
except Exception as e:
    print(f"[FATAL] Cannot create/write to models directory: {e}")
    sys.exit(1)

# Create data directory
try:
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.isdir(DATA_DIR):
        raise OSError(f"Data directory not created or not a directory: {DATA_DIR}")
    print(f"[OK] Data directory ready: {DATA_DIR}")
except Exception as e:
    print(f"[FATAL] Cannot create data directory: {e}")
    sys.exit(1)

# ============================================================================
# DATA LOADING / GENERATION
# ============================================================================

def load_or_generate_data():
    """Load dataset or generate if missing."""
    print("\n[STEP 1] DATA LOADING")
    print("=" * 70)
    
    # Check if CSV exists
    if os.path.exists(DATA_PATH):
        print(f"[LOAD] Found existing dataset: {DATA_PATH}")
        print(f"[CHECK] File exists: {os.path.isfile(DATA_PATH)}")
        print(f"[CHECK] File size: {os.path.getsize(DATA_PATH):,} bytes")
        try:
            df = pd.read_csv(DATA_PATH)
            rows, cols = df.shape
            print(f"[OK] Loaded: {rows} rows, {cols} columns")
            if "disease" not in df.columns:
                raise ValueError("Dataset missing 'disease' column")
            print(f"[OK] Verified: 'disease' column present")
            return df
        except Exception as e:
            print(f"[ERROR] Failed to load CSV: {e}")
            print("[INFO] Will regenerate dataset...")
    else:
        print(f"[WARN] Dataset not found: {DATA_PATH}")
        print("[INFO] Will generate dataset...")
    
    # Generate dataset
    print("\n[GENERATE] Generating synthetic dataset...")
    try:
        # Ensure BASE_DIR is in path for imports
        if BASE_DIR not in sys.path:
            sys.path.insert(0, BASE_DIR)
            print(f"[DEBUG] Added BASE_DIR to sys.path: {BASE_DIR}")
        
        # Import generator
        print(f"[IMPORT] Attempting: from data.dataset import generate_dataset")
        print(f"[DEBUG] sys.path[0]: {sys.path[0]}")
        from data.dataset import generate_dataset
        
        # Generate data
        print(f"[GENERATE] Calling generate_dataset(samples_per_disease=150)...")
        df = generate_dataset(samples_per_disease=150)
        rows, cols = df.shape
        print(f"[OK] Generated: {rows} rows, {cols} columns")
        
        # Save to CSV
        print(f"[SAVE] Saving to: {DATA_PATH}")
        df.to_csv(DATA_PATH, index=False)
        
        # Verify save
        if not os.path.exists(DATA_PATH):
            raise FileNotFoundError(f"CSV not created: {DATA_PATH}")
        size_kb = os.path.getsize(DATA_PATH) / 1024
        print(f"[OK] Dataset saved ({size_kb:.1f} KB)")
        
        return df
        
    except ImportError as e:
        print(f"[FATAL] Cannot import dataset generator: {e}")
        print(f"[INFO] Expected file: {os.path.join(BASE_DIR, 'data', 'dataset.py')}")
        print(f"[DEBUG] BASE_DIR: {BASE_DIR}")
        print(f"[DEBUG] sys.path: {sys.path[:3]}")
        sys.exit(1)
    except Exception as e:
        print(f"[FATAL] Dataset generation failed: {e}")
        traceback.print_exc()
        sys.exit(1)

# ============================================================================
# TRAINING
# ============================================================================

def train_model(df):
    """Train ML model."""
    print("\n[STEP 2] MODEL TRAINING")
    print("=" * 70)
    
    # Prepare features
    print("\n[PREPARE] Extracting features and labels...")
    try:
        symptom_cols = sorted([c for c in df.columns if c != "disease"])
        X = df[symptom_cols].values.astype(float)
        y = df["disease"].values
        n_samples, n_features = X.shape
        n_diseases = len(np.unique(y))
        print(f"[OK] Features: {n_features}, Samples: {n_samples}, Diseases: {n_diseases}")
    except Exception as e:
        print(f"[FATAL] Feature extraction failed: {e}")
        sys.exit(1)
    
    # Encode labels
    print("\n[ENCODE] Encoding disease labels...")
    try:
        le = LabelEncoder()
        y_enc = le.fit_transform(y)
        print(f"[OK] Encoded {len(le.classes_)} classes: {', '.join(le.classes_[:3])}...")
    except Exception as e:
        print(f"[FATAL] Label encoding failed: {e}")
        sys.exit(1)
    
    # Train/test split
    print("\n[SPLIT] Splitting data (80/20)...")
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
        )
        print(f"[OK] Train: {len(X_train)}, Test: {len(X_test)}")
    except Exception as e:
        print(f"[FATAL] Data split failed: {e}")
        sys.exit(1)
    
    # Create models
    print("\n[BUILD] Building ensemble...")
    try:
        rf = RandomForestClassifier(n_estimators=200, max_depth=None, random_state=42, n_jobs=-1)
        dt = DecisionTreeClassifier(max_depth=20, random_state=42)
        nb = GaussianNB()
        ensemble = VotingClassifier(
            estimators=[("rf", rf), ("dt", dt), ("nb", nb)],
            voting="soft",
            weights=[3, 1, 1],
        )
        print(f"[OK] Ensemble created (RF + DT + NB)")
    except Exception as e:
        print(f"[FATAL] Model creation failed: {e}")
        sys.exit(1)
    
    # Cross-validation
    print("\n[CV] Running 5-fold cross-validation...")
    try:
        cv_scores = cross_val_score(ensemble, X, y_enc, cv=5, scoring="accuracy")
        cv_mean = float(cv_scores.mean())
        cv_std = float(cv_scores.std())
        print(f"[OK] CV Accuracy: {cv_mean:.4f} ± {cv_std:.4f}")
    except Exception as e:
        print(f"[WARN] Cross-validation failed: {e}")
        cv_mean = 0.0
        cv_std = 0.0
    
    # Fit
    print("\n[FIT] Fitting model...")
    try:
        ensemble.fit(X_train, y_train)
        print(f"[OK] Model fitted")
    except Exception as e:
        print(f"[FATAL] Model fitting failed: {e}")
        sys.exit(1)
    
    # Evaluate
    print("\n[EVAL] Evaluating on test set...")
    try:
        y_pred = ensemble.predict(X_test)
        test_acc = accuracy_score(y_test, y_pred)
        print(f"[OK] Test Accuracy: {test_acc:.4f}")
        print("\n[REPORT]")
        print(classification_report(y_test, y_pred, target_names=le.classes_))
    except Exception as e:
        print(f"[WARN] Evaluation failed: {e}")
        test_acc = 0.0
    
    return ensemble, le, symptom_cols, test_acc, cv_mean

# ============================================================================
# FILE SAVING & VERIFICATION
# ============================================================================

def save_artifacts(ensemble, le, symptom_cols, test_acc, cv_mean):
    """Save all model artifacts with comprehensive verification."""
    print("\n[STEP 3] SAVING ARTIFACTS")
    print("=" * 70)
    
    # Save model
    print(f"\n[SAVE] Model: {MODEL_PATH}")
    try:
        joblib.dump(ensemble, MODEL_PATH, compress=3)
        # Verify immediately
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Model file not created: {MODEL_PATH}")
        size_mb = os.path.getsize(MODEL_PATH) / (1024**2)
        size_bytes = os.path.getsize(MODEL_PATH)
        # Test reload
        test_model = joblib.load(MODEL_PATH)
        print(f"[OK] Saved ({size_mb:.1f} MB = {size_bytes:,} bytes)")
        print(f"[OK] Verified loadable: {type(test_model).__name__}")
        del test_model
    except Exception as e:
        print(f"[FATAL] Model save failed: {e}")
        traceback.print_exc()
        sys.exit(1)
    
    # Save encoder
    print(f"\n[SAVE] Encoder: {ENCODER_PATH}")
    try:
        joblib.dump(le, ENCODER_PATH)
        if not os.path.exists(ENCODER_PATH):
            raise FileNotFoundError(f"Encoder not created: {ENCODER_PATH}")
        size_b = os.path.getsize(ENCODER_PATH)
        # Test reload
        test_enc = joblib.load(ENCODER_PATH)
        print(f"[OK] Saved ({size_b} bytes)")
        print(f"[OK] Verified: {len(test_enc.classes_)} disease classes")
        del test_enc
    except Exception as e:
        print(f"[FATAL] Encoder save failed: {e}")
        traceback.print_exc()
        sys.exit(1)
    
    # Save symptoms
    print(f"\n[SAVE] Symptoms: {SYMPTOMS_PATH}")
    try:
        with open(SYMPTOMS_PATH, "w") as f:
            json.dump(symptom_cols, f, indent=2)
        if not os.path.exists(SYMPTOMS_PATH):
            raise FileNotFoundError(f"Symptoms not created: {SYMPTOMS_PATH}")
        size_b = os.path.getsize(SYMPTOMS_PATH)
        # Test reload
        with open(SYMPTOMS_PATH) as f:
            test_syms = json.load(f)
        print(f"[OK] Saved ({size_b} bytes)")
        print(f"[OK] Verified: {len(test_syms)} symptoms")
    except Exception as e:
        print(f"[FATAL] Symptoms save failed: {e}")
        traceback.print_exc()
        sys.exit(1)
    
    # Save metadata
    print(f"\n[SAVE] Metadata: {META_PATH}")
    try:
        meta = {
            "diseases": le.classes_.tolist(),
            "n_symptoms": len(symptom_cols),
            "n_samples": len(symptom_cols),
            "test_accuracy": round(test_acc, 4),
            "cv_accuracy": round(cv_mean, 4),
        }
        with open(META_PATH, "w") as f:
            json.dump(meta, f, indent=2)
        if not os.path.exists(META_PATH):
            raise FileNotFoundError(f"Metadata not created: {META_PATH}")
        size_b = os.path.getsize(META_PATH)
        # Test reload
        with open(META_PATH) as f:
            test_meta = json.load(f)
        print(f"[OK] Saved ({size_b} bytes)")
        print(f"[OK] Verified: {len(test_meta['diseases'])} diseases")
    except Exception as e:
        print(f"[FATAL] Metadata save failed: {e}")
        traceback.print_exc()
        sys.exit(1)

# ============================================================================
# FINAL VERIFICATION
# ============================================================================

def verify_all_files():
    """Verify all files exist with detailed reporting."""
    print("\n[STEP 4] FINAL VERIFICATION")
    print("=" * 70)
    print(f"[CHECK] Models directory: {MODELS_DIR}")
    print(f"[CHECK] Directory exists: {os.path.isdir(MODELS_DIR)}")
    
    files = {
        "Model": MODEL_PATH,
        "Encoder": ENCODER_PATH,
        "Symptoms": SYMPTOMS_PATH,
        "Metadata": META_PATH,
    }
    
    all_ok = True
    for name, path in files.items():
        if os.path.exists(path):
            is_file = os.path.isfile(path)
            size = os.path.getsize(path)
            is_readable = os.access(path, os.R_OK)
            status = "[OK]" if (is_file and is_readable) else "[WARNING]"
            print(f"{status} {name:10} {path}")
            print(f"       Size: {size:,} bytes | File: {is_file} | Readable: {is_readable}")
            if not (is_file and is_readable and size > 0):
                all_ok = False
        else:
            print(f"[MISSING] {name:10} {path}")
            all_ok = False
    
    if not all_ok:
        print("\n[ERROR] Directory listing:")
        try:
            contents = os.listdir(MODELS_DIR)
            for item in contents:
                full_path = os.path.join(MODELS_DIR, item)
                size = os.path.getsize(full_path) if os.path.isfile(full_path) else -1
                print(f"  {item} ({size} bytes)")
        except Exception as e:
            print(f"  [ERROR] Cannot list directory: {e}")
        
        print("\n[FATAL] Not all required files created!")
        sys.exit(1)
    
    print("\n[OK] All 4 required files present and readable!")
    return True

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    try:
        print("\n" + "=" * 70)
        print("[MEDCARE ML] TRAINING PIPELINE - PRODUCTION BUILD")
        print("=" * 70)
        print(f"[INFO] Python {sys.version}")
        print(f"[INFO] scikit-learn {__import__('sklearn').__version__}")
        print(f"[INFO] Platform: {sys.platform}")
        print(f"[INFO] PID: {os.getpid()}")
        print("=" * 70)
        
        # Step 1: Load or generate data
        df = load_or_generate_data()
        
        # Step 2: Train model
        ensemble, le, symptom_cols, test_acc, cv_mean = train_model(df)
        
        # Step 3: Save artifacts with verification
        save_artifacts(ensemble, le, symptom_cols, test_acc, cv_mean)
        
        # Step 4: Final verification
        verify_all_files()
        
        # Success
        print("\n" + "=" * 70)
        print("[SUCCESS] TRAINING COMPLETED SUCCESSFULLY")
        print("=" * 70)
        print(f"Test Accuracy:  {test_acc:.4f} (94%+ expected)")
        print(f"CV Accuracy:    {cv_mean:.4f}")
        print(f"Diseases:       {len(le.classes_)}")
        print(f"Symptoms:       {len(symptom_cols)}")
        print(f"Model Files:    {MODELS_DIR}")
        print("=" * 70)
        print(f"[INFO] Exiting with status code 0 (SUCCESS)")
        print("=" * 70 + "\n")
        
        sys.exit(0)
        
    except Exception as e:
        print("\n" + "=" * 70)
        print("[FATAL] TRAINING FAILED - UNEXPECTED ERROR")
        print("=" * 70)
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Message: {e}")
        print("=" * 70)
        print("[TRACEBACK]")
        traceback.print_exc()
        print("=" * 70)
        print(f"[INFO] Exiting with status code 1 (FAILURE)")
        print("=" * 70 + "\n")
        
        sys.exit(1)
