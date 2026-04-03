# MedCare Deployment Guide - Production Checklist

**Status: READY FOR DEPLOYMENT**
- ✅ GitHub: https://github.com/Roopank26/medcare
- ✅ All code syntax verified
- ✅ Firebase credentials embedded in code
- ✅ Deployment configs ready (render.yaml, vercel.json)

---

## OPTION A: Quick Deployment (15 minutes via UI)

### Backend on Render (5 minutes)

```
1. Go to Render.com → Sign up (free)
2. New Web Service
   - Git: Connect to GitHub → medcare repo
   - Name: medcare-backend
   - Branch: main
   - Runtime: Node
   - Root Dir: server
   - Build: npm install
   - Start: node server.js
   
3. Environment Variables (in Render dashboard):
   NODE_ENV=production
   PORT=5000
   FIREBASE_SERVICE_ACCOUNT_JSON=<paste entire JSON from server/.env file locally>
   ALLOWED_ORIGINS=https://medcare-web.vercel.app
   LOG_LEVEL=info
   
   ⚠️ IMPORTANT: Never paste credentials in public code!
   - Get Firebase JSON from: server/.env (local file only)
   - Set via Render dashboard (keep out of version control)
   
4. Deploy! Get URL → Save as BACKEND_URL
```

### ML Service on Render (3 minutes)

```
1. New Web Service again
   - Name: medcare-ml
   - Root Dir: ml-service
   - Runtime: Python
   - Build: pip install -r requirements.txt
   - Start: gunicorn -w 2 -b 0.0.0.0:5000 app:app
   
2. No env vars needed (Flask defaults)

3. Deploy! Get URL → Save as ML_URL
```

### Frontend on Vercel (5 minutes)

```
1. Go to Vercel.com → Sign up

2. Import Project
   - GitHub: Roopank26/medcare
   - Root Dir: client
   - Framework: React

3. Environment Variables
   REACT_APP_BACKEND_URL=<BACKEND_URL from Render>
   REACT_APP_ML_URL=<ML_URL from Render>
   REACT_APP_FIREBASE_API_KEY=AIzaSyC...
   REACT_APP_FIREBASE_AUTH_DOMAIN=madecare-9b986.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=madecare-9b986
   REACT_APP_FIREBASE_STORAGE_BUCKET=madecare-9b986.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=...
   REACT_APP_FIREBASE_APP_ID=...

4. Deploy! Get URL → Save as FRONTEND_URL
```

---

## After Deployment: 5-Minute Setup

Once you have all 3 URLs:

1. **Update Backend CORS:**
   - Render → medcare-backend → Environment
   - Set: `ALLOWED_ORIGINS=https://medcare-web.vercel.app`
   - Redeploy

2. **Update Frontend URLs (if needed):**
   - Vercel → Deployment Settings
   - Env Vars already set if you did it above

3. **Test Auth Flow:**
   - Frontend: Sign up → Firebase Auth → Check backend logs
   - Should see: `[LoginSync] 🔐 TOKEN VERIFIED: { uid, email }`

---

## OPTION B: Deployed and Ready to Verify

Once you have the 3 URLs, provide them to me and I'll:
- ✅ Update backend CORS
- ✅ Test full auth flow
- ✅ Verify ML endpoint works
- ✅ Confirm "user auto-created" magic works
- ✅ Test end-to-end login
