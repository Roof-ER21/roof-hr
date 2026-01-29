# Roof HR - Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: Blank Page (Only Title Shows)

**Symptoms:**
- Browser shows "Roof HR - HR Management System" in title
- Page is blank/white
- No content renders

**Diagnosis Steps:**

1. **Open Browser Developer Tools** (F12 or Cmd+Option+I)
   - Check Console tab for JavaScript errors
   - Check Network tab for failed requests (red items)
   - Look for 404 errors on asset files

2. **Check if React app is loading**
   ```javascript
   // In browser console, type:
   document.getElementById('root')?.innerHTML
   // If it returns empty string, React didn't render
   ```

3. **Verify assets are loading**
   - Network tab should show:
     - `index.html` - 200 OK
     - `index-*.js` - 200 OK (large file, ~2.5MB)
     - `index-*.css` - 200 OK (~125KB)
   - If any return 404, the build failed or wrong version is deployed

4. **Check for cached content**
   - Try hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Or clear browser cache completely
   - Or try incognito/private mode

**Solutions:**

**A. If assets return 404:**
```bash
# Rebuild and redeploy
cd "/Users/a21/Desktop/Roof HR"
npm run build
git add .
git commit -m "fix: rebuild assets"
git push origin main

# Or use deployment script
./deploy-to-railway.sh
```

**B. If JavaScript errors in console:**
- Note the error message
- Common errors:
  - `Failed to fetch` - API endpoint not reachable
  - `Cannot read property of undefined` - Missing environment variable
  - `Module not found` - Build issue, rebuild needed

**C. If browser is caching old version:**
```bash
# Force cache clear in browser
# Chrome: Ctrl+Shift+Delete > Clear browsing data > Cached images and files

# Or add cache-busting parameter
# Visit: https://roofhr.up.railway.app/?v=2
```

**D. If API is not reachable:**
```bash
# Check health endpoint
curl https://roofhr.up.railway.app/api/health

# Should return:
# {"status":"ok","timestamp":"2026-01-29T...","version":"v2.2.0"}

# If it fails, check Railway logs:
railway logs
```

---

### Issue 2: Server Not Starting

**Symptoms:**
- Railway deployment fails
- Health check fails
- Application error 503 or 500

**Check Railway Logs:**
```bash
railway logs
```

**Common Errors and Fixes:**

**A. Missing Environment Variables**
```
Error: Missing required environment variables: DATABASE_URL
```
Fix:
```bash
railway variables set DATABASE_URL="postgresql://..."
railway variables set SESSION_SECRET="$(openssl rand -hex 32)"
```

**B. Database Connection Failed**
```
Error: Connection refused to database
```
Fix:
- Verify DATABASE_URL is correct
- Ensure `?sslmode=require` is at the end of the URL
- Check if database service is running

**C. Port Binding Error**
```
Error: Port 5000 already in use
```
Fix:
- Railway auto-assigns PORT, don't set it manually
- Remove PORT from environment variables if you added it

**D. Build Failed**
```
npm ERR! Build failed
```
Fix:
```bash
# Test build locally
npm run build

# If it fails locally, fix errors first
npm run check  # TypeScript check
```

---

### Issue 3: Login Not Working

**Symptoms:**
- Login button doesn't work
- Gets stuck on "Logging in..."
- "Invalid credentials" error even with correct password

**Check:**

1. **Verify admin user exists**
   ```bash
   # Check Railway logs for:
   # "Created admin user: admin@roof-hr.com"

   railway logs | grep "admin user"
   ```

2. **Test API endpoint directly**
   ```bash
   curl -X POST https://roofhr.up.railway.app/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@roof-hr.com","password":"YourPassword"}'
   ```

3. **Check browser console for errors**
   - Look for CORS errors
   - Look for network errors

**Solutions:**

**A. Admin user not created**
```bash
# Set admin credentials
railway variables set ADMIN_EMAIL=admin@roof-hr.com
railway variables set ADMIN_TEMP_PASSWORD="SecurePassword123!"

# Redeploy
git push origin main
```

**B. CORS errors**
```bash
# Set CORS origin
railway variables set CORS_ORIGIN=https://roofhr.up.railway.app
railway variables set ALLOWED_ORIGINS=https://roofhr.up.railway.app

# Redeploy
git push origin main
```

**C. Database not accessible**
- Check DATABASE_URL is correct
- Verify database service is running
- Check Railway logs for connection errors

---

### Issue 4: 502 Bad Gateway

**Symptoms:**
- Railway shows "502 Bad Gateway"
- Service won't start

**Cause:** Server crashed or failed to start

**Fix:**

1. **Check logs for crash**
   ```bash
   railway logs
   ```

2. **Look for:**
   - Uncaught exceptions
   - Database connection errors
   - Missing dependencies

3. **Common fixes:**
   ```bash
   # Rebuild
   railway up --force

   # Or trigger rebuild from GitHub
   git commit --allow-empty -m "trigger rebuild"
   git push origin main
   ```

---

### Issue 5: Assets Loading But App Still Blank

**Symptoms:**
- Network tab shows all assets loaded (200 OK)
- No errors in console
- Page still blank

**Cause:** React app failed to initialize silently

**Diagnosis:**

1. **Check if React is trying to render**
   ```javascript
   // In browser console:
   console.log(window.React)  // Should be undefined in production
   document.getElementById('root')
   // Should show <div id="root"></div> or have content
   ```

2. **Enable React DevTools**
   - Install React DevTools browser extension
   - Check if React tree is rendered

3. **Check for silent errors**
   ```javascript
   // In browser console:
   window.addEventListener('error', e => console.error('Error:', e));
   window.addEventListener('unhandledrejection', e => console.error('Promise rejection:', e));
   // Refresh page
   ```

**Solutions:**

**A. Environment variable issue**
- Check if app expects specific env vars
- Railway env vars are not accessible in client-side code
- Only server-side code can access process.env

**B. API base URL wrong**
- App makes API calls to `/api/*`
- Should work automatically since same origin
- Check Network tab for failed API calls

**C. Authentication loop**
- App might be stuck checking auth status
- Check if `/api/auth/validate` endpoint works:
  ```bash
  curl https://roofhr.up.railway.app/api/auth/validate
  ```

---

### Issue 6: Slow Loading or Timeouts

**Symptoms:**
- App takes forever to load
- Some pages timeout
- Intermittent 504 errors

**Cause:** Large bundle size (2.5MB) or server overload

**Short-term fix:**
```bash
# Increase Railway plan (more memory/CPU)
# Or optimize bundle size
```

**Long-term optimization:**
- Implement code splitting
- Lazy load routes
- Reduce bundle size

---

## Quick Diagnostic Commands

### Check Production Health
```bash
curl https://roofhr.up.railway.app/api/health
```

### Check Homepage HTML
```bash
curl https://roofhr.up.railway.app/ | head -20
```

### Check Asset Loading
```bash
# Get asset hash from homepage
ASSET=$(curl -s https://roofhr.up.railway.app/ | grep -oP 'src="/assets/index-\K[^.]+' | head -1)
echo "Asset hash: $ASSET"

# Check if asset exists
curl -I https://roofhr.up.railway.app/assets/index-$ASSET.js
```

### View Recent Logs
```bash
railway logs
```

### Check Environment Variables
```bash
railway variables
```

### Test Database Connection
```bash
# From Railway dashboard or CLI
railway run node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => console.log('✓ Database connected'))
  .catch(err => console.error('✗ Database error:', err))
  .finally(() => client.end());
"
```

---

## Emergency Recovery

### Nuclear Option - Complete Rebuild

If nothing else works:

```bash
cd "/Users/a21/Desktop/Roof HR"

# 1. Clean build artifacts
rm -rf node_modules dist

# 2. Fresh install
npm ci

# 3. Build
npm run build

# 4. Verify build
ls -lh dist/public/assets/

# 5. Commit and deploy
git add .
git commit -m "fix: complete rebuild"
git push origin main

# 6. Watch logs
railway logs
```

### Force Railway Rebuild

```bash
# Option 1: Via CLI
railway up --force

# Option 2: Via Git
git commit --allow-empty -m "force rebuild"
git push origin main

# Option 3: Via Dashboard
# Railway Dashboard > Service > Settings > Redeploy
```

---

## Getting Help

### What to Include When Asking for Help

1. **Railway Logs:**
   ```bash
   railway logs > railway-logs.txt
   # Attach railway-logs.txt
   ```

2. **Browser Console Errors:**
   - Screenshot of browser console (F12)
   - Include Network tab showing failed requests

3. **Environment:**
   - Railway service name
   - Deployment ID (from logs)
   - Browser and version

4. **What you tried:**
   - List all troubleshooting steps attempted
   - Any error messages received

### Support Resources

- **Railway Discord:** https://discord.gg/railway
- **Railway Docs:** https://docs.railway.app
- **Project GitHub:** https://github.com/Roof-ER21/roof-hr/issues

---

**Last Updated:** 2026-01-29
**Maintainer:** Development Team
