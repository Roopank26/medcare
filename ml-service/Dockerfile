FROM python:3.11-slim

# Security: non-root user
RUN groupadd -r mluser && useradd -r -g mluser mluser

WORKDIR /app

# Install dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=mluser:mluser . .

USER mluser

ENV FLASK_ENV=production
ENV ML_PORT=5001

# Train model if not present
RUN python train_model.py 2>/dev/null || true

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/health')"

EXPOSE 5001
CMD ["python", "app.py"]
