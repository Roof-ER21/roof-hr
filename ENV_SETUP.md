# Environment Variables Setup for Replit Deployment

## Where to Set NODE_ENV=production

### Method 1: Replit Deployment Settings (Recommended)

1. **Click the "Deploy" button** in Replit
2. **In the deployment configuration**, you'll see a section for "Environment Variables"
3. **Add these variables**:
   ```
   NODE_ENV=production
   DATABASE_URL=[your existing database URL]
   SESSION_SECRET=[your existing session secret]
   ```

### Method 2: Replit Secrets Tab

1. **Go to the Secrets tab** in your Replit (lock icon in sidebar)
2. **Add a new secret**:
   - Key: `NODE_ENV`
   - Value: `production`
3. **Your other secrets should already be there**:
   - `DATABASE_URL` (already configured)
   - `SESSION_SECRET` (already configured)

### Method 3: Create .env file (Not recommended for production)

If you want to test locally, you can create a `.env` file:
```bash
NODE_ENV=production
DATABASE_URL=your_database_url_here
SESSION_SECRET=your_session_secret_here
```

## Current Status Check

Let me check what environment variables you currently have set...