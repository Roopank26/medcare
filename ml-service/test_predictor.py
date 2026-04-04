#!/usr/bin/env python3
"""Quick test of predictor loading"""

from utils.predictor import MedcarePredictor

predictor = MedcarePredictor.get()
result = predictor.load()

print(f'\nLoading result: {result}')
if result:
    print(f'Model type: {type(predictor.model).__name__}')
    print(f'Diseases: {len(predictor.encoder.classes_)}')
    print(f'Symptoms: {len(predictor.symptoms)}')
    
    # Test a prediction
    test_result = predictor.predict('fever, headache, body ache')
    print(f'\nTest prediction: {test_result["disease"]} ({test_result["confidence"]}%)')
    print(f'Severity: {test_result["severity"]}')
else:
    print("FAILED to load model")
