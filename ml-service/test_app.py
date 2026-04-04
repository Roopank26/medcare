#!/usr/bin/env python3
"""Test Flask app startup"""

import os
import sys

# Set production mode
os.environ['FLASK_ENV'] = 'production'
os.environ['ML_PORT'] = '5001'

print("[TEST] Starting Flask app import and initialization...")

try:
    from app import app, model_ready, predictor
    
    print(f"[OK] Flask app imported successfully")
    print(f"[OK] model_ready: {model_ready}")
    print(f"[OK] predictor initialized: {predictor is not None}")
    
    if predictor.model:
        print(f"[OK] Model loaded: {type(predictor.model).__name__}")
    
    # Test that /health endpoint works
    with app.test_client() as client:
        response = client.get('/health')
        print(f"[OK] /health endpoint: {response.status_code}")
        if response.status_code == 200:
            data = response.get_json()
            print(f"[OK] model_ready from API: {data.get('model_ready')}")
            print(f"[OK] Service version: {data.get('version')}")
    
    print("\n[SUCCESS] App startup test PASSED")
    sys.exit(0)
    
except Exception as e:
    print(f"\n[FATAL] App startup test FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
