FROM python:3.11-slim

WORKDIR /app

# Install dependencies BEFORE switching user (so training works with all permissions)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    mkdir -p models

# Copy code (still as root, for training)
COPY . .

# Train model while ROOT - MUST succeed or build fails
RUN echo "[BUILD] Training ML model..." && \
    python train_model.py || { \
        echo "[ERROR] Model training FAILED!"; \
        echo "[ERROR] Check logs above for details"; \
        exit 1; \
    }

# Verify model files exist BEFORE switching user
RUN [ -f "models/medcare_model.pkl" ] || { \
        echo "[ERROR] Model file not found: models/medcare_model.pkl"; \
        exit 1; \
    } && \
    [ -f "models/label_encoder.pkl" ] || { \
        echo "[ERROR] Encoder file not found: models/label_encoder.pkl"; \
        exit 1; \
    } && \
    [ -f "models/symptoms_list.json" ] || { \
        echo "[ERROR] Symptoms file not found: models/symptoms_list.json"; \
        exit 1; \
    } && \
    echo "[BUILD] [PASS] All model files verified"

# Create non-root user and set permissions
RUN groupadd -r mluser && useradd -r -g mluser mluser && \
    chown -R mluser:mluser /app

USER mluser

ENV FLASK_ENV=production
ENV ML_PORT=5001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/health')" || exit 1

EXPOSE 5001
CMD ["python", "app.py"]
