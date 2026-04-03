#!/usr/bin/env node
/**
 * Startup script that loads .env and starts the server
 */
const fs = require('fs');
const path = require('path');

// Load .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const [, key, value] = match;
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value.trim();
        }
      }
    }
  });
  
  console.log('[Startup] ✅ Loaded .env file');
} else {
  console.warn('[Startup] ⚠️ No .env file found');
}

// Verify Firebase credentials
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log('[Startup] ✅ Firebase credentials loaded');
  } catch (e) {
    console.error('[Startup] ❌ Firebase credentials invalid JSON');
  }
} else {
  console.error('[Startup] ❌ FIREBASE_SERVICE_ACCOUNT_JSON not set');
}

console.log('[Startup] Environment:');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('  PORT:', process.env.PORT || '5000');
console.log('  ALLOWED_ORIGINS:', process.env.ALLOWED_ORIGINS || 'http://localhost:3000');

// Start server
require('./server.js');
