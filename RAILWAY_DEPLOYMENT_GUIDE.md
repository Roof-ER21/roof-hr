# Railway Deployment Guide - Roof HR

## Current Status

- **Production URL**: https://roofhr.up.railway.app/
- **Issue**: Blank page (only showing title)
- **Root Cause**: Missing service configuration and potential environment variable issues

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Railway Platform                     │
├─────────────────────────────────────────────────────────┤
│  1. Build Phase (Nixpacks)                             │
│     - Install dependencies: npm ci                      │
│     - Build frontend: vite build                        │
│     - Build backend: esbuild server/index.ts            │
│     - Output: dist/index.js + dist/public/*            │
│                                                          │
│  2. Deploy Phase                                        │
│     - Start: NODE_ENV=production node dist/index.js    │
│     - Server listens on Railway's PORT (auto-assigned) │
│     - Serves API on /api/*                              │
│     - Serves static files from dist/public/             │
│     - SPA fallback for client-side routing              │
│                                                          │
│  3. Health Check                                        │
│     - Endpoint: /api/health                             │
│     - Returns: {"status":"ok","timestamp":"..."}       │
└─────────────────────────────────────────────────────────┘
```

## Files Added/Updated

### 1. `railway.json` (Updated)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npm run build"
  },
  "deploy": {
    "startCommand": "NODE_ENV=production node dist/index.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 100
  }
}
```

### 2. `nixpacks.toml` (New)
Ensures Railway uses correct Node.js version and build steps.

## Required Environment Variables in Railway

Configure these in Railway Dashboard > Project > Variables:

### Critical (Required)
```bash
NODE_ENV=production
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
SESSION_SECRET=<generate-random-string-32-chars>
PORT=<auto-assigned-by-railway>  # Railway sets this automatically
```

### Admin User Setup
```bash
ADMIN_EMAIL=admin@roof-hr.com
ADMIN_TEMP_PASSWORD=<secure-temp-password>
ADMIN_FIRST_NAME=System
ADMIN_LAST_NAME=Administrator
```

### Optional Services
```bash
# Email (SendGrid)
SENDGRID_API_KEY=<your-sendgrid-api-key>
FROM_EMAIL=noreply@your-company.com

# AI Features
OPENAI_API_KEY=<your-openai-api-key>
ANTHROPIC_API_KEY=<your-anthropic-api-key>
GOOGLE_GENAI_API_KEY=<your-google-genai-api-key>

# Google OAuth (if needed)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

### CORS Configuration
```bash
CORS_ORIGIN=https://roofhr.up.railway.app
ALLOWED_ORIGINS=https://roofhr.up.railway.app
```

### Optional Features
```bash
AGENTS_ENABLED=true
AGENT_MAX_CONCURRENT=2
LOG_LEVEL=info
LOG_CONSOLE=true
```

## Deployment Steps

### Option 1: Using Railway CLI (Recommended)

1. **Link the service** (if not already linked):
   ```bash
   cd "/Users/a21/Desktop/Roof HR"
   railway link
   # Select: ROOF HR project
   # Select: production environment
   # Select the web service (if available) or create new
   ```

2. **Set environment variables**:
   ```bash
   # Critical variables
   railway variables set DATABASE_URL="postgresql://..."
   railway variables set SESSION_SECRET="$(openssl rand -hex 32)"
   railway variables set NODE_ENV=production

   # Admin user
   railway variables set ADMIN_EMAIL=admin@roof-hr.com
   railway variables set ADMIN_TEMP_PASSWORD="SecurePassword123!"

   # CORS
   railway variables set CORS_ORIGIN=https://roofhr.up.railway.app
   ```

3. **Deploy**:
   ```bash
   # Commit configuration changes
   git add railway.json nixpacks.toml
   git commit -m "fix: update Railway configuration for proper deployment"
   git push origin main

   # Or deploy directly via Railway
   railway up
   ```

4. **Monitor deployment**:
   ```bash
   railway logs
   ```

### Option 2: Using Railway Dashboard

1. **Go to Railway Dashboard**: https://railway.app/dashboard

2. **Select ROOF HR project** > production environment

3. **Create/Link Service**:
   - Click "New Service" or select existing service
   - Connect to GitHub repository: `Roof-ER21/roof-hr`
   - Set branch: `main`

4. **Configure Environment Variables**:
   - Go to Variables tab
   - Add all required variables listed above

5. **Set Build Configuration**:
   - Railway should auto-detect `railway.json` and `nixpacks.toml`
   - Verify Build Command: `npm ci && npm run build`
   - Verify Start Command: `NODE_ENV=production node dist/index.js`

6. **Deploy**:
   - Click "Deploy" or push to `main` branch
   - Monitor build logs

7. **Verify Health Check**:
   - Visit: https://roofhr.up.railway.app/api/health
   - Should return: `{"status":"ok","timestamp":"...","version":"v2.2.0"}`

## Troubleshooting

### Issue: Blank Page (Current Problem)

**Symptoms**: Only shows "Roof HR - HR Management System" title, no content

**Possible Causes**:
1. Service not properly configured in Railway
2. Missing environment variables
3. Build artifacts not being served correctly
4. Frontend bundle failing to load
5. CORS issues

**Diagnosis Steps**:

1. **Check service status**:
   ```bash
   railway status
   railway logs --tail 100
   ```

2. **Verify health check**:
   ```bash
   curl https://roofhr.up.railway.app/api/health
   ```
   Expected: `{"status":"ok","timestamp":"...","version":"v2.2.0"}`

3. **Check static files**:
   ```bash
   curl -I https://roofhr.up.railway.app/
   curl -I https://roofhr.up.railway.app/assets/index-*.js
   ```

4. **Check browser console**:
   - Open https://roofhr.up.railway.app/
   - Open Developer Tools (F12)
   - Check Console tab for errors
   - Check Network tab for failed requests

5. **Common Fixes**:

   a. **If health check fails** (500/connection error):
      - Server not starting correctly
      - Check DATABASE_URL is correct
      - Check SESSION_SECRET is set
      - Review Railway logs for startup errors

   b. **If health check works but page is blank**:
      - Static files not being served
      - Check Railway logs for "Serving from:" message
      - Verify `dist/public` directory exists in deployed build
      - Check for JavaScript errors in browser console

   c. **If assets return 404**:
      - Build may have failed
      - Check Railway build logs
      - Verify `npm run build` completes successfully
      - Ensure `dist/public/assets/` contains JS/CSS files

   d. **If CORS errors**:
      ```bash
      railway variables set CORS_ORIGIN=https://roofhr.up.railway.app
      railway variables set ALLOWED_ORIGINS=https://roofhr.up.railway.app
      ```

### Issue: Database Connection Failed

**Check**:
```bash
railway variables get DATABASE_URL
```

**Fix**:
- Ensure DATABASE_URL includes `?sslmode=require`
- Verify database service is running (if using Railway PostgreSQL)
- Test connection from Railway logs

### Issue: Build Failures

**Check Railway build logs**:
```bash
railway logs --deployment <deployment-id>
```

**Common causes**:
- Missing dependencies: Run `npm ci` instead of `npm install`
- Out of memory: Frontend bundle is large (2.5MB), may need memory increase
- TypeScript errors: Fix locally first with `npm run check`

### Issue: Server Won't Start

**Check logs for**:
- "Missing required environment variables"
- Database connection errors
- Port binding issues (Railway auto-assigns PORT)

**Fix**:
- Ensure all required env vars are set
- Verify DATABASE_URL is correct
- Don't hardcode PORT in env vars (Railway sets it)

## Verification Checklist

After deployment, verify:

- [ ] Health check endpoint works: `curl https://roofhr.up.railway.app/api/health`
- [ ] Homepage loads fully (not blank): https://roofhr.up.railway.app/
- [ ] Static assets load: Check browser Network tab
- [ ] API endpoints work: Test `/api/auth/validate`
- [ ] Database connection: Check Railway logs for "Database connection established"
- [ ] No console errors: Check browser Developer Tools
- [ ] Admin user created: Check logs for "Created admin user" message

## Performance Optimization

### Current Build Size
- Frontend bundle: 2.57 MB (minified)
- CSS: 124 KB (minified)
- Warning: Large chunk size

### Recommendations
1. **Code splitting**: Implement dynamic imports for routes
2. **Tree shaking**: Review unused dependencies
3. **Lazy loading**: Load heavy components on demand
4. **Railway scaling**: Consider upgrading plan if memory issues occur

## Monitoring

### View Logs
```bash
railway logs --tail 100
```

### View Metrics
- Railway Dashboard > Service > Metrics
- Monitor: CPU, Memory, Network

### Alerts
- Set up Railway webhooks for deployment notifications
- Configure health check alerts

## Rollback Procedure

If deployment fails:

1. **Via Railway CLI**:
   ```bash
   railway rollback
   ```

2. **Via Dashboard**:
   - Go to Deployments tab
   - Click on previous successful deployment
   - Click "Redeploy"

## Local Testing (Production Mode)

Test the production build locally before deploying:

```bash
cd "/Users/a21/Desktop/Roof HR"

# Build
npm run build

# Set required env vars
export NODE_ENV=production
export PORT=5000
export DATABASE_URL="your-database-url"
export SESSION_SECRET="test-secret"

# Start
npm run start

# Test
curl http://localhost:5000/api/health
open http://localhost:5000
```

## Support

If issues persist:

1. **Review Railway logs**: Most issues show up in logs
2. **Check Railway status**: https://railway.statuspage.io/
3. **Railway Discord**: https://discord.gg/railway
4. **GitHub Issues**: Create issue with Railway logs attached

## Next Steps After Successful Deployment

1. **Secure admin account**: Log in and change ADMIN_TEMP_PASSWORD immediately
2. **Configure email service**: Set SendGrid API key for notifications
3. **Set up custom domain** (optional): Railway dashboard > Domains
4. **Enable backups**: Configure database backup schedule
5. **Monitor usage**: Track Railway usage and costs
6. **Set up CI/CD**: Configure GitHub Actions for automated testing before deployment

---

**Created**: 2026-01-28
**Last Updated**: 2026-01-28
**Project**: Roof HR
**Deployment Platform**: Railway
**Production URL**: https://roofhr.up.railway.app/
