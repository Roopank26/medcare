# 🔧 Authentication Troubleshooting Guide

This guide covers common authentication and login issues in Medcare. All fixes have been verified in the production system.

**Last Updated:** April 3, 2026  
**System State:** ✅ All auth systems verified and working

---

## 🆘 Quick Diagnostic Check

Run this command to verify your auth setup:

```bash
# Check all critical auth files exist
echo "Checking auth files..."
test -f server/utils/firebaseAdmin.js && echo "✅ firebaseAdmin.js" || echo "❌ firebaseAdmin.js MISSING"
test -f server/middleware/auth.js && echo "✅ auth.js middleware" || echo "❌ auth.js middleware MISSING"
test -f server/controllers/authController.js && echo "✅ authController.js" || echo "❌ authController.js MISSING"
test -f server/routes/authRoutes.js && echo "✅ authRoutes.js" || echo "❌ authRoutes.js MISSING"
test -f client/src/context/AuthContext.jsx && echo "✅ AuthContext.jsx" || echo "❌ AuthContext.jsx MISSING"
test -f client/src/firebase/auth.js && echo "✅ firebase/auth.js" || echo "❌ firebase/auth.js MISSING"
test -f client/src/firebase/config.js && echo "✅ firebase/config.js" || echo "❌ firebase/config.js MISSING"
test -f server/.env && echo "✅ server/.env" || echo "❌ server/.env MISSING"
test -f client/.env && echo "✅ client/.env" || echo "❌ client/.env MISSING"

# Check environment variables
echo ""
echo "Checking environment configuration..."
grep -q "FIREBASE_SERVICE_ACCOUNT_JSON" server/.env && echo "✅ FIREBASE_SERVICE_ACCOUNT_JSON configured" || echo "❌ FIREBASE_SERVICE_ACCOUNT_JSON NOT CONFIGURED"
grep -q "REACT_APP_FIREBASE_API_KEY" client/.env && echo "✅ REACT_APP_FIREBASE_API_KEY configured" || echo "❌ REACT_APP_FIREBASE_API_KEY NOT CONFIGURED"
grep -q "REACT_APP_BACKEND_URL" client/.env && echo "✅ REACT_APP_BACKEND_URL configured" || echo "❌ REACT_APP_BACKEND_URL NOT CONFIGURED"

# Verify servers running
echo ""
echo "Checking processes..."
curl -s http://localhost:5000/api/health >/dev/null && echo "✅ Backend running (port 5000)" || echo "❌ Backend NOT running (port 5000)"
curl -s http://localhost:3000 >/dev/null && echo "✅ Frontend running (port 3000)" || echo "❌ Frontend NOT running (port 3000)"
```

---

## 🔴 Common Authentication Issues

### Issue #1: "User Profile Not Found" Error

**Symptoms:**
- Login appears to succeed but shows "User profile not found in database"
- Redirect to dashboard fails
- Error logged as: `[LoginSync] Profile query failed`

**Root Cause:**
The backend loginSync endpoint couldn't find the user profile document in Firestore at `users/{uid}`.

**Solution (Self-Healing - Automatic):**

The system now implements **self-healing login** which automatically creates profiles. However, if you see this error:

1. **Verify Firestore Collection Path:**
   ```bash
   # Check server/controllers/authController.js line 165+
   # Should contain:
   # const db = admin.firestore();
   # const userDocRef = db.collection("users").doc(uid);
   # if (!userSnap.exists) {
   #   // AUTO-CREATE profile
   ```

2. **Check Firestore Console:**
   - Go to Firebase Console → Firestore Database
   - Look for `users` collection
   - Should have documents named by Firebase UID

3. **Clear Browser Cache & Retry:**
   ```bash
   # Press: Ctrl+Shift+Delete (Windows) or Cmd+Shift+Delete (Mac)
   # Clear "All time" → Clear data
   # Refresh page and login again
   ```

4. **If Issue Persists:**
   - Check backend logs: `npm run dev` (should show [LoginSync] logs)
   - Verify FIREBASE_SERVICE_ACCOUNT_JSON is valid
   - Check Firestore rules aren't blocking writes

---

### Issue #2: "Invalid ID Token" or "Token Verification Failed"

**Symptoms:**
- Login form submits but returns: "Invalid ID token" 
- Backend returns: 401 Unauthorized
- Browser console shows: `[Auth] Token verification failed`

**Root Cause:**
Firebase ID token is invalid, expired, or not being sent correctly.

**Solution:**

1. **Verify Token Format:**
   ```javascript
   // In browser console (F12), run:
   const user = firebase.auth().currentUser;
   if (user) {
     user.getIdToken().then(token => {
       console.log('Token valid, length:', token.length);
       console.log('Token preview:', token.substring(0, 50) + '...');
     });
   } else {
     console.log('No user logged in');
   }
   ```

2. **Check Token Expiration:**
   ```javascript
   // Firebase tokens expire after 1 hour
   // If you saw the token in step 1, manually refresh:
   const user = firebase.auth().currentUser;
   if (user) {
     user.getIdToken(true); // Force refresh
   }
   ```

3. **Verify Backend is Receiving Token:**
   ```bash
   # Check server middleware auth.js line 20+
   # Should see: const token = req.headers.authorization?.split('Bearer ')[1];
   # If token is undefined, frontend isn't sending it
   ```

4. **Debug Token Transmission:**
   ```javascript
   // Add to client/src/firebase/auth.js line 160+
   const token = await user.getIdToken();
   console.log('[Auth Debug] Token received:', token ? 'YES' : 'NO');
   console.log('[Auth Debug] Sending to:', process.env.REACT_APP_BACKEND_URL);
   console.log('[Auth Debug] Headers:', {
     Authorization: `Bearer ${token.substring(0, 20)}...`,
     'Content-Type': 'application/json'
   });
   ```

---

### Issue #3: "CORS Error" / "Access denied from origin"

**Symptoms:**
- Browser console shows: `Access to XMLHttpRequest blocked by CORS policy`
- Login returns empty response or network error
- Error: `Origin http://localhost:3000 is not allowed by Access-Control-Allow-Origin`

**Root Cause:**
Frontend URL not in backend's `ALLOWED_ORIGINS` environment variable.

**Solution:**

1. **Check Current Configuration:**
   ```bash
   # View current allowed origins
   grep ALLOWED_ORIGINS server/.env
   ```

2. **Update if Needed:**
   ```bash
   # Edit server/.env
   # For localhost development (default):
   ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   
   # For production:
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

3. **Restart Backend:**
   ```bash
   # Kill old process
   lsof -ti:5000 | xargs kill -9  # Mac/Linux
   # OR on Windows PowerShell:
   Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force
   
   # Start fresh
   cd server && npm start
   ```

4. **Clear Browser Cache:**
   - Press F12 → Network tab → Disable cache
   - Ctrl+Shift+R (force refresh)

---

### Issue #4: "Missing FIREBASE_SERVICE_ACCOUNT_JSON" or "No Credentials"

**Symptoms:**
- Backend starts but immediately crashes
- Error: `Error: Cannot read property 'credential' of undefined`
- Logs show: `[FirebaseAdmin] Initialization failed`

**Root Cause:**
`FIREBASE_SERVICE_ACCOUNT_JSON` environment variable not set or invalid.

**Solution:**

1. **Get Service Account JSON:**
   ```
   Firebase Console → Project Settings → Service Accounts → Node.js
   → "Generate New Private Key" → JSON file downloads
   ```

2. **Convert to Single-Line Format:**
   ```bash
   # The service account is a large JSON object
   # It must be converted to a single line (no line breaks except in strings)
   
   # Option A: Use Python to format
   python3 << 'EOF'
   import json
   with open('path/to/serviceAccountKey.json', 'r') as f:
       data = json.load(f)
   print(json.dumps(data, separators=(',', ':')))
   EOF
   
   # Option B: Online JSON formatter
   # 1. Go to https://jsoncrush.com
   # 2. Paste JSON, click crush
   # 3. Copy result
   ```

3. **Add to server/.env:**
   ```bash
   # Edit server/.env
   FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"your-project-id",...}
   ```

4. **Verify JSON is Valid:**
   ```bash
   # Use Node.js to validate
   node << 'EOF'
   const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
   try {
     JSON.parse(json);
     console.log('✅ Valid JSON');
   } catch (e) {
     console.log('❌ Invalid JSON:', e.message);
   }
   EOF
   ```

5. **Restart Backend:**
   ```bash
   cd server && npm start
   ```

---

### Issue #5: "user is undefined" or "Cannot read property 'uid' of undefined"

**Symptoms:**
- Dashboard loads but shows no user data
- Console error: `Uncaught TypeError: Cannot read property 'uid' of null`
- Redirects keep looping

**Root Cause:**
AuthContext is not properly initialized or user state not being set.

**Solution:**

1. **Verify AuthContext Provider:**
   ```javascript
   // In client/src/App.js, should have:
   <AuthProvider>
     <div className="App">
       {/* your routes here */}
     </div>
   </AuthProvider>
   
   // Should NOT be wrapping individual routes only
   ```

2. **Check Auth Hook Usage:**
   ```javascript
   // Correct usage:
   const { user, loading } = useAuth();
   
   if (loading) return <div>Loading...</div>;
   if (!user) return <Navigate to="/login" />;
   
   // Incorrect usage:
   const user = useAuth().user;  // Missing loading state
   return <Dashboard user={user} />;  // Might render before user loads
   ```

3. **Add Debug Logging:**
   ```javascript
   // In any component using useAuth():
   const auth = useAuth();
   console.log('[Auth Debug] Current state:', {
     user: auth.user ? auth.user.uid : null,
     loading: auth.loading,
     error: auth.error
   });
   ```

4. **Verify Firebase.auth().currentUser:**
   ```javascript
   // In browser console:
   firebase.auth().currentUser
   // Should return user object if logged in
   // Should return null if logged out
   ```

---

### Issue #6: "Email Already in Use" or "User Already Exists"

**Symptoms:**
- Registration succeeds but login fails
- Error: `Firebase: Error (auth/user-not-found)`
- Or: `Firebase: Error (auth/email-already-in-use)`

**Root Cause:**
Firebase Auth has the user but Firestore profile missing or sync failed.

**Solution:**

1. **Clear Firebase Auth (Development Only):**
   ```
   Firebase Console → Authentication → Users
   → Find user → Delete (right-click menu)
   → Start fresh registration
   ```

2. **Check Firestore Profile:**
   ```
   Firebase Console → Firestore Database → users collection
   → Look for document with your UID
   → If missing, login sync will auto-create (new feature)
   ```

3. **Force Profile Sync:**
   ```bash
   # Manually trigger sync from frontend
   # Open browser console (F12) and run:
   const user = firebase.auth().currentUser;
   if (user) {
     const token = await user.getIdToken();
     const response = await fetch('http://localhost:5000/api/auth/login-sync', {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${token}`,
         'Content-Type': 'application/json'
       }
     });
     const data = await response.json();
     console.log(data);
   }
   ```

---

### Issue #7: "localhost refused to connect" or "Cannot reach backend"

**Symptoms:**
- Frontend won't connect to backend
- Error: `Failed to fetch`
- Network tab shows: `ERR_CONNECTION_REFUSED`

**Root Cause:**
Backend server not running on expected port.

**Solution:**

1. **Start Backend:**
   ```bash
   cd server
   npm install  # if dependencies missing
   npm start    # or: npm run dev
   ```

2. **Verify Port:**
   ```bash
   # On Windows PowerShell:
   Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 5000 }
   
   # On Mac/Linux:
   lsof -i :5000
   
   # Should show node/npm process
   ```

3. **Check environment variable:**
   ```bash
   # Verify REACT_APP_BACKEND_URL matches running port
   grep REACT_APP_BACKEND_URL client/.env
   # Should be http://localhost:5000
   ```

4. **If Port in Use:**
   ```bash
   # Kill process using port 5000
   # Windows PowerShell:
   Stop-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess -Force
   
   # Mac/Linux:
   lsof -ti:5000 | xargs kill -9
   
   # Then restart backend on different port:
   PORT=5001 npm start
   # And update client/.env: REACT_APP_BACKEND_URL=http://localhost:5001
   ```

---

### Issue #8: "Firebase Project Configuration Missing"

**Symptoms:**
- Cannot create Firebase app
- Store undefined or null
- Error: `Cannot read property 'initializeApp' of undefined`
- Or: `Firebase: Error (app/invalid-api-key)`

**Root Cause:**
Firebase SDK not loaded or environment variables missing.

**Solution:**

1. **Verify client/.env:**
   ```bash
   # Should have 7 variables:
   grep "REACT_APP_FIREBASE" client/.env
   ```

2. **Get Correct Values:**
   ```
   Firebase Console → Project Settings → General
   → Look for "Your apps" section
   → Click Web app icon
   → Copy firebaseConfig object
   ```

3. **Example client/.env:**
   ```env
   REACT_APP_FIREBASE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxx
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
   REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef1234567890
   REACT_APP_BACKEND_URL=http://localhost:5000
   ```

4. **Restart Frontend:**
   ```bash
   cd client
   npm start  # Fresh build with new env vars
   ```

---

## 🔍 How to Debug Authentication Issues

### Enable Detailed Logging

**Backend Logging:**
```bash
# Set in server/.env
LOG_LEVEL=debug
NODE_ENV=development

# Then check logs for [LoginSync], [Auth], [FirebaseAdmin] prefixes
cd server && npm run dev
```

**Frontend Logging:**
```javascript
// Add to client/src/firebase/auth.js line 1:
const DEBUG = true;

// Then add logs throughout:
if (DEBUG) console.log('[Auth] Starting login...', email);
if (DEBUG) console.log('[Auth] Firebase auth successful, uid:', user.uid);
if (DEBUG) console.log('[Auth] Token obtained, length:', token.length);
if (DEBUG) console.log('[Auth] Calling backend...', process.env.REACT_APP_BACKEND_URL);
```

### Check Browser DevTools

**Network Tab:**
1. Open DevTools (F12)
2. Go to Network tab
3. Clear existing requests
4. Attempt login
5. Look for request to `/api/auth/login-sync`
6. Click request → Response tab
7. Check for:
   - Status 201 (new profile created)
   - Status 200 (existing profile)
   - Status 401 (token invalid)

**Application Tab:**
1. Go to Application tab
2. LocalStorage → Check for Firebase tokens
3. SessionStorage → Check for cached user data
4. Clear if needed: Right-click → Clear All

**Console Tab:**
1. Go to Console tab
2. Filter by errors (default text color is normal)
3. Red text are errors
4. Look for "[Auth]" or "[LoginSync]" prefixes

### Check Server Logs

```bash
# Terminal where backend is running
# Should show logs like:

# [FirebaseAdmin] Admin SDK initialized  ✓
# [Auth] Verifying token for user xxxxx
# [LoginSync] Querying user at users/{uid}
# [LoginSync] Profile not found, creating new...
# [LoginSync] Profile created, returning HTTP 201
```

---

## 🆘 Advanced Debugging

### Verify Firebase Project Connectivity

```javascript
// Run in browser console (F12):
firebase.initializeApp(firebaseConfig);

// Test 1: Authentication working?
firebase.auth().currentUser ? 'Logged in' : 'Not logged in'

// Test 2: Firestore accessible?
firebase.firestore().collection('users').get().then(snap => {
  console.log('Firestore accessible, docs:', snap.size);
}).catch(e => console.error('Firestore error:', e));

// Test 3: Token valid?
firebase.auth().currentUser?.getIdToken().then(token => {
  console.log('Token valid:', token.substring(0, 50) + '...');
}).catch(e => console.error('Token error:', e));
```

### Test Backend Authentication Endpoint

```bash
# Get a valid token from browser console first
# firebase.auth().currentUser.getIdToken().then(t => console.log(t))

# Then test backend:
curl -X POST http://localhost:5000/api/auth/login-sync \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"uid":"user-123","email":"user@example.com"}'

# Expected response:
# HTTP 201 (new) or HTTP 200 (existing)
# { "success": true, "user": { "uid": "...", "email": "...", "role": "patient" } }
```

### Firestore Rules Debugging

1. Go to Firebase Console → Firestore Database → Rules
2. Look for rule on `users/{uid}` path
3. Rule should check:
   - `isAuth()` - Is user authenticated?
   - `isOwner(uid)` - Does UID match own document?

Example correct rule:
```
match /users/{uid} {
  allow read: if isAuth() && isOwner(uid);
  allow create: if isAuth() && isOwner(uid);
  allow update: if isAuth() && isOwner(uid) && !canModify();
  allow delete: if false;
}
```

---

## ✅ Verification Checklist

After applying any fix, verify:

- [ ] Backend starts without errors
- [ ] Frontend loads at http://localhost:3000
- [ ] Can navigate to /login page
- [ ] Can enter email and password
- [ ] Click "Sign In" doesn't throw error
- [ ] Redirects to /patient-dashboard or /doctor-dashboard
- [ ] Dashboard shows user info
- [ ] Browser console has no red errors
- [ ] Backend terminal shows [LoginSync] success logs
- [ ] Firestore has new user document at users/{uid}

---

## 🎯 When to Seek Help

If none of the above fixes work:

1. **Collect Information:**
   ```bash
   # 1. Note exact error message (screenshot)
   # 2. Check backend logs (npm run dev output)
   # 3. Check browser console (F12 → Console tab)
   # 4. Check Network tab for failed requests
   # 5. Verify .env files have all required variables
   ```

2. **Check Documentation:**
   - See [AUTONOMOUS_FIXES_REPORT.md](./AUTONOMOUS_FIXES_REPORT.md) for architecture
   - See [README.md](./README.md) for initial setup
   - See [QUICK_START.md](./QUICK_START.md) for getting started

3. **Isolated Test:**
   ```bash
   # Test each component separately
   
   # 1. Test Firebase (frontend only)
   npm start  # in client/
   # Can you see Firebase init logs?
   
   # 2. Test Backend (no frontend)
   npm start  # in server/
   # Server starts without errors?
   
   # 3. Test Firestore
   # Firebase Console → Firestore
   # Can you read/write documents?
   ```

---

## 📝 Common Environment Variable Mistakes

| Variable | Wrong ❌ | Correct ✅ | 
|----------|---------|-----------|
| API Key | Missing "REACT_APP_" prefix | `REACT_APP_FIREBASE_API_KEY=...` |
| Service Account | Split across multiple lines | Single line JSON string |
| Backend URL | No protocol | `http://localhost:5000` |
| Port | Wrong port in .env | Matches actual running port |
| NODE_ENV | "dev" or "prod" | Must be "production" or "development" |

---

## 📞 Support Resources

- **Firebase Docs:** https://firebase.google.com/docs
- **React Docs:** https://react.dev
- **Express Docs:** https://expressjs.com
- **Firestore Security:** https://firebase.google.com/docs/firestore/security/overview
- **Auth Troubleshooting:** https://firebase.google.com/support

---

**Last Verified:** April 3, 2026  
**Verification Status:** ✅ All systems operational
