#!/usr/bin/env node

/**
 * Post-Deployment Auto-Setup Script
 * 
 * Usage: node setup-deployment.js <BACKEND_URL> <ML_URL> <FRONTEND_URL>
 * Example: node setup-deployment.js https://medcare-backend.onrender.com https://medcare-ml.onrender.com https://medcare-web.vercel.app
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const [, , backendUrl, mlUrl, frontendUrl] = process.argv;

if (!backendUrl || !mlUrl || !frontendUrl) {
  console.error('❌ Missing URLs!');
  console.error('Usage: node setup-deployment.js <BACKEND_URL> <ML_URL> <FRONTEND_URL>');
  console.error('Example: node setup-deployment.js https://medcare-backend.onrender.com https://medcare-ml.onrender.com https://medcare-web.vercel.app');
  process.exit(1);
}

console.log('🚀 MedCare Post-Deployment Setup');
console.log('==================================================');
console.log('Backend:  ' + backendUrl);
console.log('ML:       ' + mlUrl);
console.log('Frontend: ' + frontendUrl);
console.log('==================================================\n');

// Step 1: Test backend connectivity
console.log('✓ Testing backend connectivity...');
function testUrl(url, name) {
  return new Promise((resolve) => {
    https.get(url + '/api/health', (res) => {
      if (res.statusCode === 200) {
        console.log(`  ✅ ${name} is UP`);
        resolve(true);
      } else {
        console.log(`  ⚠️  ${name} returned ${res.statusCode}`);
        resolve(false);
      }
    }).on('error', () => {
      console.log(`  ❌ ${name} is DOWN - still deploying?`);
      resolve(false);
    });
  });
}

(async () => {
  // Test all services
  const backendUp = await testUrl(backendUrl, 'Backend');
  const mlUp = await testUrl(mlUrl, 'ML Service');

  console.log('\n✓ Generated configuration exports:\n');

  // Export configuration
  const config = {
    REACT_APP_BACKEND_URL: backendUrl,
    REACT_APP_ML_URL: mlUrl,
    BACKEND_ENV: {
      ALLOWED_ORIGINS: frontendUrl,
      ML_URL: mlUrl,
    },
  };

  console.log('Frontend Environment Variables (.env.production):');
  console.log('---');
  console.log(`REACT_APP_BACKEND_URL=${backendUrl}`);
  console.log(`REACT_APP_ML_URL=${mlUrl}`);
  console.log('REACT_APP_FIREBASE_API_KEY=<from firebase console>');
  console.log('REACT_APP_FIREBASE_AUTH_DOMAIN=madecare-9b986.firebaseapp.com');
  console.log('REACT_APP_FIREBASE_PROJECT_ID=madecare-9b986');
  console.log('REACT_APP_FIREBASE_STORAGE_BUCKET=madecare-9b986.appspot.com');
  console.log('---\n');

  console.log('Backend Environment Variables (Render Dashboard):');
  console.log('---');
  console.log(`ALLOWED_ORIGINS=${frontendUrl}`);
  console.log(`ML_URL=${mlUrl}`);
  console.log('---\n');

  // Summary
  console.log('✅ Next Steps:');
  console.log('1. Copy frontend vars above → Vercel Environment Variables');
  console.log('2. Copy backend vars above → Render Dashboard (medcare-backend)');
  console.log('3. Redeploy both services');
  console.log('4. Test login at: ' + frontendUrl);
  console.log('\n✅ System Status:');
  console.log('  Backend: ' + (backendUp ? '✅ UP' : '⏳ DEPLOYING'));
  console.log('  ML:      ' + (mlUp ? '✅ UP' : '⏳ DEPLOYING'));
  console.log('  Frontend: (check Vercel deployment)\n');
})();
