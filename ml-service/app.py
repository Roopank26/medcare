"""
Medcare ML Service - Flask API v4.1 (Phase 1+2 hardened)
Port: 5001

Phase 2 additions:
  - LOW_CONFIDENCE_THRESHOLD: predictions < 40% get a safe fallback response
  - Medical disclaimer injected into every prediction response
  - Structured prediction logging (disease, confidence, latency)
  - Invalid/empty symptom input returns clear 400 error
"""

import os, sys, json, time, uuid, logging
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(__file__)
sys.path.insert(0, BASE_DIR)
load_dotenv(os.path.join(BASE_DIR, ".env"))

from utils.predictor import MedcarePredictor, ALIASES, DISEASE_META
from utils.chatbot   import get_chat_response

# ── Structured JSON logging ───────────────────────────────────
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log = {
            "timestamp": self.formatTime(record),
            "level":     record.levelname,
            "service":   "medcare-ml",
            "message":   record.getMessage(),
        }
        if hasattr(record, "extra"):
            log.update(record.extra)
        return json.dumps(log)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger = logging.getLogger("medcare-ml")
logger.setLevel(logging.INFO)
logger.addHandler(handler)
logger.propagate = False

# ── Flask app ────────────────────────────────────────────────
app = Flask(__name__)
IS_PROD = os.getenv("FLASK_ENV") == "production"

# Production CORS: Accept deployment URLs + localhost for dev
DEFAULT_ORIGINS = (
    "https://medcare-theta-nine.vercel.app,"  # Main Vercel frontend
    "https://medcare.vercel.app,"             # Alternative Vercel URL pattern
    "http://localhost:3000,"                   # Local development
    "http://127.0.0.1:3000"                    # Localhost IPv4
)
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",") if o.strip()]

# Log CORS configuration
logger.info(f"CORS enabled for origins: {', '.join(ALLOWED_ORIGINS)}")

CORS(
    app,
    origins=ALLOWED_ORIGINS,
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
    methods=["GET", "POST", "OPTIONS"]
)

# ── Rate limiting ─────────────────────────────────────────────
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    limiter = Limiter(
        app=app, key_func=get_remote_address,
        default_limits=["200 per minute", "1000 per hour"],
        storage_uri="memory://",
    )
    RATE_LIMIT_ENABLED = True
    logger.info("Rate limiting enabled (Flask-Limiter)")
except ImportError:
    class _NoOpLimiter:
        def limit(self, *a, **kw): return lambda f: f
    limiter = _NoOpLimiter()
    RATE_LIMIT_ENABLED = False
    logger.warning("Flask-Limiter not installed - rate limiting disabled")

# ── Phase 2: Low-confidence threshold ────────────────────────
LOW_CONFIDENCE_THRESHOLD = int(os.getenv("LOW_CONFIDENCE_THRESHOLD", "40"))

MEDICAL_DISCLAIMER = (
    "[WARNING] MEDICAL DISCLAIMER: This AI prediction is for informational purposes only "
    "and does NOT constitute a medical diagnosis. Always consult a qualified healthcare "
    "professional for accurate diagnosis and treatment."
)

# ── Service stats ─────────────────────────────────────────────
_stats = {
    "requests_total":          0,
    "predictions_total":       0,
    "low_confidence_fallbacks": 0,
    "errors_total":            0,
    "started_at":              time.time(),
}

# ── Load ML model ─────────────────────────────────────────────
print("\n[STARTUP] Initializing ML model...")
print(f"[DEBUG] Attempting to load model from predictor...")
try:
    predictor = MedcarePredictor.get()
    model_ready = predictor.load()
    
    if not model_ready:
        print("[WARN] ML Model Not Available!")
        print("[WARN] Service running but /predict will return 503 error")
        print("[WARN] To fix: ensure Dockerfile runs 'python train_model.py' successfully")
        logger.error("MODEL_LOADING_FAILED", extra={
            "status": "CRITICAL",
            "detail": "ML model failed to load during startup - service degraded"
        })
    else:
        print("[PASS] ML Model Ready - Service Fully Operational")
        logger.info("MODEL_LOADED", extra={
            "status": "OK", 
            "detail": "ML model initialized successfully",
            "model_type": type(predictor.model).__name__,
            "diseases": len(predictor.encoder.classes_) if predictor.encoder else 0,
            "symptoms": len(predictor.symptoms) if predictor.symptoms else 0,
        })
except Exception as e:
    print(f"[ERROR] Exception during model loading: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    model_ready = False
    logger.error("MODEL_LOADING_EXCEPTION", extra={
        "status": "CRITICAL",
        "detail": f"Exception: {str(e)}",
        "error_type": type(e).__name__
    })

# ── Helpers ───────────────────────────────────────────────────
def ok(data, status=200):
    return jsonify({"success": True, **data}), status

def err(message, status=400, code=None):
    _stats["errors_total"] += 1
    payload = {"success": False, "error": message}
    if code: payload["code"] = code
    return jsonify(payload), status

# ── Request hooks ─────────────────────────────────────────────
@app.before_request
def before():
    g.request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex[:8])
    g.start_time = time.perf_counter()
    _stats["requests_total"] += 1

@app.after_request
def after(response):
    ms = round((time.perf_counter() - g.start_time) * 1000, 1)
    response.headers["X-Request-ID"]    = g.request_id
    response.headers["X-Response-Time"] = f"{ms}ms"
    logger.info("request", extra={
        "request_id": g.request_id,
        "method":     request.method,
        "path":       request.path,
        "status":     response.status_code,
        "latency_ms": ms,
    })
    return response


# ── GET /health ───────────────────────────────────────────────
@app.route("/health")
def health():
    return ok({
        "service":          "Medcare ML API",
        "version":          "4.1.0",
        "model_ready":      model_ready,
        "diseases":         len(DISEASE_META),
        "chatbot":          "openai" if os.getenv("OPENAI_API_KEY") else "rule-based",
        "rate_limiting":    RATE_LIMIT_ENABLED,
        "low_conf_threshold": LOW_CONFIDENCE_THRESHOLD,
        "uptime_seconds":   round(time.time() - _stats["started_at"]),
        "timestamp":        int(time.time()),
    })


# ── GET /metrics ──────────────────────────────────────────────
@app.route("/metrics")
def metrics():
    return ok({**_stats, "uptime_seconds": round(time.time() - _stats["started_at"])})


# ── POST /predict ─────────────────────────────────────────────
@app.route("/predict", methods=["POST"])
@limiter.limit("10 per minute")
def predict():
    if not request.is_json:
        return err("Content-Type must be application/json", code="BAD_CONTENT_TYPE")

    body     = request.get_json(silent=True) or {}
    symptoms = body.get("symptoms", "")

    # ── Input validation ─────────────────────────────────────
    if not symptoms:
        return err("symptoms field is required", code="MISSING_FIELD")
    if isinstance(symptoms, list):
        symptoms = ", ".join(str(s).strip() for s in symptoms if s)
    if not isinstance(symptoms, str):
        return err("symptoms must be a string or array of strings", code="INVALID_TYPE")
    symptoms = symptoms.strip()
    if len(symptoms) < 2:
        return err("symptoms too short - provide at least one symptom", code="TOO_SHORT")
    if len(symptoms) > 2000:
        return err("symptoms text too long (max 2000 chars)", code="TOO_LONG")

    if not model_ready:
        return err(
            "ML model not loaded - service degraded. Restart service to trigger model training. "
            "If problem persists, run: python train_model.py",
            503,
            code="MODEL_NOT_READY"
        )

    t0     = time.perf_counter()
    result = predictor.predict(symptoms)
    ms     = round((time.perf_counter() - t0) * 1000, 1)

    if result is None:
        return err("Prediction failed - internal error", 500, code="PREDICTION_FAILED")

    _stats["predictions_total"] += 1

    # ── Phase 2: Low-confidence fallback ─────────────────────
    low_confidence = result["confidence"] < LOW_CONFIDENCE_THRESHOLD
    if low_confidence:
        _stats["low_confidence_fallbacks"] += 1
        result["low_confidence_fallback"] = True
        result["fallback_message"] = (
            f"The model confidence is low ({result['confidence']}%). "
            "This may indicate the symptoms are too vague or do not match training data. "
            "Please consult a healthcare professional for an accurate assessment."
        )
        logger.warning("low_confidence_prediction", extra={
            "request_id": g.request_id,
            "detail": f"Low confidence ({result['confidence']}%) for {result['disease']}",
            "disease":    result["disease"],
            "confidence": result["confidence"],
            "symptom_count": len(symptoms.split()) if symptoms else 0,
        })
    else:
        result["low_confidence_fallback"] = False

    # ── Phase 2: Always attach medical disclaimer ─────────────
    result["disclaimer"] = MEDICAL_DISCLAIMER

    logger.info("prediction", extra={
        "request_id":    g.request_id,
        "disease":       result["disease"],
        "confidence":    result["confidence"],
        "severity":      result["severity"],
        "symptom_count": result.get("symptom_count", 0),
        "low_conf":      low_confidence,
        "inference_ms":  ms,
    })

    return ok({"prediction": result, "inference_ms": ms})


# ── POST /chat ────────────────────────────────────────────────
@app.route("/chat", methods=["POST"])
@limiter.limit("30 per minute")
def chat():
    if not request.is_json:
        return err("Content-Type must be application/json")

    body     = request.get_json(silent=True) or {}
    messages = body.get("messages", [])

    if not messages or not isinstance(messages, list):
        return err("messages array is required")
    if len(messages) > 50:
        return err("Too many messages (max 50)")

    for i, msg in enumerate(messages):
        if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
            return err(f"messages[{i}] must have role and content")
        if msg["role"] not in ("user", "assistant", "system"):
            return err(f"messages[{i}].role must be user, assistant, or system")
        if len(str(msg.get("content", ""))) > 4000:
            return err(f"messages[{i}].content too long")

    result = get_chat_response(messages)
    return ok(result)


# ── GET /suggest ──────────────────────────────────────────────
@app.route("/suggest")
@limiter.limit("60 per minute")
def suggest():
    q = request.args.get("q", "").strip()
    if not q:        return ok({"suggestions": []})
    if len(q) > 100: return err("Query too long (max 100 chars)")
    if len(q) < 2:   return ok({"suggestions": []})

    suggestions = predictor.get_symptom_suggestions(q)
    alias_hits  = [k.replace("_", " ").title() for k in ALIASES if q.lower() in k.lower()]
    deduped     = list(dict.fromkeys(suggestions + alias_hits))[:8]
    return ok({"suggestions": deduped, "query": q})


# ── GET /symptoms ─────────────────────────────────────────────
@app.route("/symptoms")
def symptoms():
    sym_list   = predictor.symptoms or []
    readable   = [s.replace("_", " ").title() for s in sym_list]
    diseases   = [
        {"name": name, "severity": meta.get("severity","Unknown"), "emoji": meta.get("emoji","[MEDICAL]")}
        for name, meta in DISEASE_META.items()
    ]
    common_tags = [
        "Fever","Headache","Cough","Fatigue","Nausea","Sore Throat",
        "Body Ache","Dizziness","Runny Nose","Stomach Pain","Chills",
        "Vomiting","Diarrhea","Chest Pain","Breathlessness","Joint Pain",
        "Skin Rash","Weakness","Loss of Appetite","Back Pain",
    ]
    return ok({
        "symptoms":       readable,
        "common_tags":    common_tags,
        "diseases":       diseases,
        "total_symptoms": len(readable),
        "total_diseases": len(diseases),
    })


# ── Error handlers ─────────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return err(f"Endpoint not found: {request.path}", 404)

@app.errorhandler(405)
def method_not_allowed(e):
    return err(f"Method {request.method} not allowed on {request.path}", 405)

@app.errorhandler(429)
def rate_limited(e):
    return err("Rate limit exceeded. Please slow down.", 429, code="RATE_LIMITED")

@app.errorhandler(500)
def server_error(e):
    logger.error("unhandled_exception", extra={"detail": str(e), "error_type": type(e).__name__})
    return err("Internal server error", 500)


# ── Entry point ───────────────────────────────────────────────
if __name__ == "__main__":
    port      = int(os.getenv("ML_PORT", 5001))
    chat_mode = "OpenAI GPT" if os.getenv("OPENAI_API_KEY") else "Rule-based"

    print(f"\n{'='*58}")
    print(f"  [ML] Medcare ML Service v4.1 (PRODUCTION)")
    print(f"  [NET] Running on http://0.0.0.0:{port}")
    model_status = "READY" if model_ready else "NOT LOADED"
    print(f"  [MOD] Model: {model_status}")
    print(f"  [BOT] Chatbot: {chat_mode}")
    print(f"  [LOW-CONF] Threshold: {LOW_CONFIDENCE_THRESHOLD}%")
    print(f"  [SEC] Rate Limiting: {'Enabled' if RATE_LIMIT_ENABLED else 'Disabled'}")
    print(f"  [DB] Disease Classes: {len(DISEASE_META)}")
    print(f"{'='*58}\n")

    app.run(host="0.0.0.0", port=port, debug=False)
