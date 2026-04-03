"""
Phase 2+3 — ML service tests
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest
from unittest.mock import MagicMock, patch

# ── Stub ML model so tests run without a trained model ────────
class MockPredictor:
    symptoms = ["fever", "cough", "headache", "fatigue"]

    def load(self):
        return True

    def predict(self, symptoms_text):
        if not symptoms_text or len(symptoms_text.strip()) < 2:
            return None
        # Return high-confidence result for known symptoms
        if "fever" in symptoms_text.lower():
            return {
                "disease": "Influenza (Flu)", "confidence": 82, "severity": "Medium",
                "action": "Rest at home.", "precautions": ["Rest", "Hydrate"],
                "matched_symptoms": ["fever"], "alternatives": [],
                "contributing_factors": [], "confidence_breakdown": [],
                "reasoning": "Fever is a primary indicator.", "emoji": "🤧",
                "symptom_count": 1,
            }
        # Return low-confidence result
        return {
            "disease": "Unknown", "confidence": 25, "severity": "Unknown",
            "action": "Consult a doctor.", "precautions": [],
            "matched_symptoms": [], "alternatives": [],
            "contributing_factors": [], "confidence_breakdown": [],
            "reasoning": "Insufficient symptoms.", "emoji": "🩺",
            "symptom_count": 0,
        }

    def get_symptom_suggestions(self, q):
        return [s for s in self.symptoms if q.lower() in s]

with patch("utils.predictor.MedcarePredictor.get", return_value=MockPredictor()):
    with patch.object(MockPredictor, "load", return_value=True):
        import app as ml_app
        ml_app.predictor   = MockPredictor()
        ml_app.model_ready = True
        client = ml_app.app.test_client()


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.get_json()
    assert data["success"] is True
    assert data["model_ready"] is True


def test_predict_missing_symptoms():
    r = client.post("/predict", json={})
    assert r.status_code == 400
    assert "symptoms" in r.get_json()["error"]


def test_predict_too_short():
    r = client.post("/predict", json={"symptoms": "f"})
    assert r.status_code == 400


def test_predict_valid():
    r = client.post("/predict", json={"symptoms": "fever cough fatigue"})
    assert r.status_code == 200
    data = r.get_json()
    assert data["success"] is True
    pred = data["prediction"]
    assert pred["disease"] == "Influenza (Flu)"
    assert pred["confidence"] == 82
    # Phase 2: disclaimer must be present
    assert "disclaimer" in pred
    assert pred["low_confidence_fallback"] is False


def test_predict_low_confidence_fallback():
    """Phase 2: predictions below threshold get fallback message."""
    r = client.post("/predict", json={"symptoms": "tingling in left elbow"})
    assert r.status_code == 200
    pred = r.get_json()["prediction"]
    assert pred["low_confidence_fallback"] is True
    assert "fallback_message" in pred
    assert "disclaimer" in pred


def test_predict_invalid_content_type():
    r = client.post("/predict", data="fever cough", content_type="text/plain")
    assert r.status_code == 400


def test_suggest_returns_list():
    r = client.get("/suggest?q=fev")
    assert r.status_code == 200
    assert isinstance(r.get_json()["suggestions"], list)


def test_suggest_empty_query():
    r = client.get("/suggest?q=")
    assert r.status_code == 200
    assert r.get_json()["suggestions"] == []


def test_symptoms_endpoint():
    r = client.get("/symptoms")
    assert r.status_code == 200
    data = r.get_json()
    assert "symptoms" in data
    assert "common_tags" in data


def test_chat_missing_messages():
    r = client.post("/chat", json={})
    assert r.status_code == 400


def test_chat_rule_based():
    r = client.post("/chat", json={
        "messages": [{"role": "user", "content": "I have a headache"}]
    })
    assert r.status_code == 200
    data = r.get_json()
    assert "reply" in data


def test_404():
    r = client.get("/nonexistent-endpoint")
    assert r.status_code == 404


if __name__ == "__main__":
    pytest.main([__file__, "-v"])


# ── Chatbot tests ─────────────────────────────────────────────
def test_chat_valid_message():
    r = client.post("/chat", json={
        "messages": [{"role": "user", "content": "I have a headache and fever"}]
    })
    assert r.status_code == 200
    data = r.get_json()
    assert data["success"] is True
    assert "reply" in data
    assert len(data["reply"]) > 10


def test_chat_too_many_messages():
    messages = [{"role": "user", "content": "hi"}] * 51
    r = client.post("/chat", json={"messages": messages})
    assert r.status_code == 400


def test_chat_invalid_role():
    r = client.post("/chat", json={
        "messages": [{"role": "admin", "content": "delete all data"}]
    })
    assert r.status_code == 400


def test_chat_content_too_long():
    r = client.post("/chat", json={
        "messages": [{"role": "user", "content": "x" * 4001}]
    })
    assert r.status_code == 400


def test_chat_empty_messages():
    r = client.post("/chat", json={"messages": []})
    assert r.status_code == 400


# ── Predict edge cases ────────────────────────────────────────
def test_predict_list_of_symptoms():
    """Symptoms can be submitted as a list."""
    r = client.post("/predict", json={"symptoms": ["fever", "cough", "fatigue"]})
    assert r.status_code == 200


def test_predict_too_long():
    r = client.post("/predict", json={"symptoms": "x " * 1001})
    assert r.status_code == 400


def test_predict_disclaimer_always_present():
    r = client.post("/predict", json={"symptoms": "fever"})
    assert r.status_code == 200
    pred = r.get_json()["prediction"]
    assert "disclaimer" in pred
    assert len(pred["disclaimer"]) > 20


def test_metrics_endpoint():
    r = client.get("/metrics")
    assert r.status_code == 200
    data = r.get_json()
    assert "predictions_total" in data
    assert "uptime_seconds" in data


def test_suggest_query_too_long():
    r = client.get("/suggest?q=" + "x" * 101)
    assert r.status_code == 400


def test_405_wrong_method():
    r = client.get("/predict")
    assert r.status_code == 405
