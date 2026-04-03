/**
 * Medcare - Express Server (Enterprise + Phase 1 Security)
 */
'use strict';

// Load environment variables from .env file (MUST be first)
require('dotenv').config({ path: `${__dirname}/.env` });

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const { v4: uuid } = require('uuid');

const symptomRoutes  = require('./routes/symptomRoutes');
const patientRoutes  = require('./routes/patientRoutes');
const authRoutes     = require('./routes/authRoutes');
const { sanitizeBody } = require('./middleware/sanitize');

const app  = express();
const PORT = process.env.PORT || 5000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Security headers ─────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// ── CORS ─────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',').map((o) => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}));

// ── Body parsing + sanitization ───────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(sanitizeBody);

// ── Rate limiting ─────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again in 15 minutes.' },
});
app.use(globalLimiter);

const symptomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30,
  message: { success: false, error: 'Too many symptom analysis requests. Please wait.' },
});

// ── Request logging + correlation IDs ────────────────────────
app.use((req, _res, next) => {
  req.id = uuid().split('-')[0];
  req._startAt = process.hrtime();
  next();
});

app.use((req, res, next) => {
  res.on('finish', () => {
    const diff  = process.hrtime(req._startAt);
    const ms    = ((diff[0] * 1e9 + diff[1]) / 1e6).toFixed(2);
    const level = res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO';
    const line  = `[${new Date().toISOString()}] [${level}] [${req.id}] ${req.method} ${req.path} ${res.statusCode} ${ms}ms`;
    if (level === 'ERROR') console.error(line);
    else if (level === 'WARN') console.warn(line);
    else if (!IS_PROD) console.log(line);
  });
  next();
});

// ── Routes ────────────────────────────────────────────────────
// Auth routes - no token required (login/register)
app.use('/api/auth', authRoutes);

// Protected routes - require Firebase ID token
const { requireAuth } = require('./middleware/auth');
app.use('/api/symptoms', requireAuth, symptomLimiter, symptomRoutes);
app.use('/api/patients', requireAuth, patientRoutes);

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({
    success: true, service: 'Medcare API', version: '3.0.0',
    env: process.env.NODE_ENV || 'development',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// ── Error handling ────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  if (err.message?.startsWith('CORS:'))
    return res.status(403).json({ success: false, error: err.message });
  if (err.type === 'entity.parse.failed')
    return res.status(400).json({ success: false, error: 'Invalid JSON body' });
  console.error(`[${new Date().toISOString()}] [ERROR] [${req.id}] Unhandled:`, err.message);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Graceful shutdown ─────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`\n🏥  Medcare API        → http://localhost:${PORT}`);
  console.log(`🔐  Auth               : Firebase ID token (all /api/symptoms, /api/patients)`);
  console.log(`🛡  Rate limiting      : 100 req/15min (global), 30 req/15min (symptoms)`);
  console.log(`🪖  Helmet             : Security headers enabled\n`);
});

const shutdown = (signal) => {
  console.log(`\n[${signal}] Graceful shutdown initiated…`);
  server.close(() => { console.log('[Shutdown] HTTP server closed.'); process.exit(0); });
  setTimeout(() => { console.error('[Shutdown] Forced exit'); process.exit(1); }, 10_000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error('[UnhandledRejection]', reason));
process.on('uncaughtException',  (err)    => { console.error('[UncaughtException]', err); process.exit(1); });

module.exports = app;
