# ML API System - Post-Deployment Monitoring

## 🚀 IMMEDIATE ACTIONS (First 10 minutes after Render rebuild)

### 1. Check Render Build Status
```bash
# Monitor build logs in real-time
# https://dashboard.render.com → ml-service → Logs

# Look for these SUCCESS indicators:
[BUILD] STARTING ML MODEL TRAINING...
[SUCCESS] TRAINING COMPLETED SUCCESSFULLY
[BUILD] SUCCESS: All 4 model files verified and present
[MODEL] ML MODEL READY
```

### 2. Test Health Endpoint (Critical)
```bash
curl https://ml-service-1hgd.onrender.com/health -s | jq '.'

# MUST return:
{
  "success": true,
  "service": "Medcare ML API",
  "version": "4.1.0",
  "model_ready": true,      ← THIS MUST BE TRUE ❌ if false = problem
  "diseases": 18,
  "timestamp": ...
}
```

### 3. Test Prediction (Functional)
```bash
curl -X POST https://ml-service-1hgd.onrender.com/predict \
  -H "Content-Type: application/json" \
  -d '{"symptoms": "fever, cough, fatigue, weakness"}' \
  -s | jq '.prediction'

# MUST return:
{
  "disease": "Influenza (Flu)",
  "confidence": 85.2,
  "severity": "Medium",
  "action": "Rest at home, stay hydrated...",
  "precautions": [...],
  "matched_symptoms": ["fever", "cough", "fatigue", "weakness"]
}
```

### 4. Test Frontend (User Perspective)
1. Navigate to: https://medcare-theta-nine.vercel.app
2. Go to: Symptom Checker page
3. Enter symptoms: "fever, cough, fatigue"
4. Click: "Analyze Symptoms"
5. Expected: Disease prediction with confidence and recommendations
6. NOT expected: "ML Service Offline" or blank page

---

## 🔍 MONITORING & DIAGNOSTICS

### Health Check Dashboard
```bash
# Quick status check
watch -n 5 'curl -s https://ml-service-1hgd.onrender.com/health | jq ".model_ready"'

# Expected output: true (updates every 5 seconds)
```

### Metrics Endpoint
```bash
curl https://ml-service-1hgd.onrender.com/metrics -s | jq '.predictions_total, .requests_total'

# Shows API usage statistics
```

### View Render Logs
```bash
# In Render dashboard:
1. Services → ml-service
2. Logs tab
3. Filter: "model" or "error" or "prediction"
```

---

## 🐛 TROUBLESHOOTING

### Problem: model_ready = false
**Cause**: Model files not created during build

**Fix**:
1. Check Render build logs for [ERROR]
2. If training failed: `python train_model.py` locally to see error
3. Commit fix and push to main (triggers rebuild)

```bash
cd ml-service
python train_model.py 2>&1 | tail -50
# Look for [FATAL] or [ERROR] messages
```

### Problem: /predict returns 503
**Cause**: Model not loaded, app still starting, or training incomplete

**Fix**:
1. Wait 30-60 seconds (health check startup period)
2. Check /health endpoint
3. If model_ready=false after 1 minute, restart service in Render dashboard

### Problem: Slow predictions
**Metrics to check**:
```bash
curl -s https://ml-service-1hgd.onrender.com/metrics | jq '{uptime: .uptime_seconds, predictions: .predictions_total}'

# If uptime is high but predictions is low = good
# If predictions is 0 = model not being used
```

### Problem: Frontend still shows "ML Offline"
**Check**:
1. Frontend ALLOWED_ORIGINS in ml-service/.env
2. CORS headers in API response: `Access-Control-Allow-Origin: https://medcare-theta-nine.vercel.app`
3. Browser console for CORS errors

---

## 📊 EXPECTED PERFORMANCE

### Training Metrics (Per Build)
- **Duration**: 2-3 minutes
- **Test Accuracy**: 94%+ (94.07% expected)
- **CV Accuracy**: 94%+ (94.63% expected)
- **Model Size**: 3.9-4.0 MB
- **Encoder Size**: ~748 bytes
- **Symptoms**: 52 features
- **Diseases**: 18 classes

### API Response Times
- **/health**: <100ms
- **/predict** (average): 100-300ms (first request: 1-2s due to loading)
- **/chat**: 500ms - 30s (depends on ChatGPT API)
- **/suggest**: <50ms

### System Throughput
- **Rate Limit**: 10 req/min per /predict, 30 req/min for /chat
- **Concurrent**: Handles multiple requests
- **Errors**: Should be <1% (all properly logged)

---

## 🔐 SECURITY CHECKS

### API Security
```bash
# Test CORS (should reject invalid origins)
curl -i -H "Origin: http://malicious.com" \
  https://ml-service-1hgd.onrender.com/health

# Should NOT return: Access-Control-Allow-Origin header
```

### Rate Limiting
```bash
# Should be enabled
curl https://ml-service-1hgd.onrender.com/health -s | jq '.rate_limiting'
# Expected: true
```

### Model File Integrity
```bash
# In Render shell (if available):
sha256sum models/*.pkl models/*.json
# Save these checksums for future verification
```

---

## 📝 LOGGING BEST PRACTICES

### What to Monitor
- **[SUCCESS]** markers in training
- **[ERROR]** or **[FATAL]** messages anywhere
- **model_ready** value changes
- **prediction errors** (low confidence)
- **rate limit** violations
- **404/405/500** errors

### View Recent Logs
```bash
# In Render dashboard Logs tab, search for:
- "ERROR" → shows all errors
- "prediction" → shows all predictions
- "model_ready: false" → indicates loading failure
- "Traceback" → shows exceptions
```

### Export Logs to File
```bash
# From Render dashboard:
1. Click "..." menu in Logs section
2. Select "Export logs"
3. Save to file for analysis
```

---

## 🚀 DEPLOYMENT CHECKLIST (After Rebuild)

- [ ] Render build completed without errors
- [ ] Build log shows: [SUCCESS] TRAINING COMPLETED
- [ ] Model files verified in build log
- [ ] /health endpoint returns 200
- [ ] model_ready = true
- [ ] /predict returns 200 (test with sample symptoms)
- [ ] Frontend loads without "ML Offline" message
- [ ] Symptom Checker page shows results
- [ ] Predictions are reasonable (match symptoms)
- [ ] No 503 errors in browser console

---

## 📞 SUPPORT REFERENCE

### Key Endpoints
- Health: `GET /health`
- Metrics: `GET /metrics`
- Predict: `POST /predict`
- Chat: `POST /chat`
- Suggest: `GET /suggest?q=fever`
- Symptoms: `GET /symptoms`

### Important Files
- Training: `ml-service/train_model.py`
- Prediction: `ml-service/utils/predictor.py`
- API: `ml-service/app.py`
- Config: `ml-service/.env`
- Dockerfile: `ml-service/Dockerfile`
- Models: `ml-service/models/` (4 files)

### Configuration
- Model refresh: On every Render rebuild
- Disease classes: 18
- Symptoms tracked: 52
- Confidence threshold: 40%
- Low confidence fallback: Auto-enabled

---

## ✅ SUCCESS CRITERIA

The system is **FULLY OPERATIONAL** when:

1. ✅ **Build Complete**: "Deployment live" in Render dashboard
2. ✅ **Model Loaded**: /health shows model_ready: true
3. ✅ **Predictions Work**: /predict returns disease + confidence
4. ✅ **Frontend Connected**: Symptom Checker returns results
5. ✅ **No Errors**: No 503, 500, or CORS errors
6. ✅ **Performance**: Predictions return in <1 second

**Expected deployment completion time**: 5-10 minutes from code push
