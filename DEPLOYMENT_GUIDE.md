# Step-by-Step Deployment Guide for ROOF-ER HR Management System

## Pre-Deployment Setup

### 1. Database Setup (PostgreSQL)

You'll need a PostgreSQL database. Here are two options:

#### Option A: Neon Database (Recommended for Replit)
1. Go to https://neon.tech and create a free account
2. Create a new project
3. Copy the connection string (it will look like: `postgresql://user:password@host/database?sslmode=require`)

#### Option B: Other PostgreSQL Providers
- Supabase
- Railway
- Render
- DigitalOcean

### 2. Environment Variables

Create these environment variables in your Replit deployment settings:

```
DATABASE_URL=postgresql://[your-connection-string]?sslmode=require
SESSION_SECRET=[generate-a-32-character-random-string]
NODE_ENV=production
```

To generate a secure SESSION_SECRET, you can use:
```bash
openssl rand -base64 32
```

## Deployment Steps

### Step 1: Prepare the Database

1. First, let's create the database schema. Run this command in the Shell:
```bash
npm run db:push
```

This will create all the necessary tables:
- users (for authentication)
- sales_reps (sales team data)
- bonus_config (bonus tiers)
- pto_requests (time off requests)
- candidates (recruitment)
- employee_reviews (performance reviews)
- sessions (for authentication)
- And more...

### Step 2: Build the Application

Run the build command:
```bash
npm run build
```

This creates optimized production files in the `dist/` folder.

### Step 3: Deploy on Replit

1. Click the "Deploy" button in the Replit interface
2. Choose "Production" deployment
3. Add your environment variables:
   - DATABASE_URL: Your PostgreSQL connection string
   - SESSION_SECRET: Your generated secret
   - NODE_ENV: production

4. Replit will automatically:
   - Install dependencies
   - Build the application
   - Start the production server

### Step 4: Initial Data Setup

After deployment, the application will be empty. You have two options:

#### Option A: Use Demo Accounts (for testing)
The system creates these demo accounts automatically in development:
- admin@roof-er.com / admin123
- manager@roof-er.com / manager123
- employee@roof-er.com / employee123

#### Option B: Create Your First Admin User
1. Use the registration endpoint to create an admin user
2. Or manually insert an admin user in the database

### Step 5: Verify Deployment

1. Visit your deployed URL
2. Try logging in with your credentials
3. Check these key features:
   - Login/logout functionality
   - Dashboard loads properly
   - Leaderboard shows data (if sales reps exist)
   - Navigation works correctly

## Post-Deployment Configuration

### 1. Set Up Regular Backups
Configure your database provider to create daily backups.

### 2. Monitor the Application
- Check the logs regularly for errors
- Monitor database performance
- Set up uptime monitoring

### 3. Configure Cron Jobs
The application automatically runs leaderboard updates at:
- 8:00 AM
- 6:00 PM

These are already configured and will start automatically.

## Troubleshooting Common Issues

### Authentication Not Working
- Verify SESSION_SECRET is set
- Check that cookies are enabled for your domain
- Ensure DATABASE_URL is correct

### Database Connection Errors
- Verify DATABASE_URL includes `?sslmode=require`
- Check that the database is accessible
- Ensure all tables were created with `npm run db:push`

### Blank Pages or 404 Errors
- Verify the build completed successfully
- Check that static files are being served
- Look for JavaScript errors in browser console

### Data Not Showing
- Verify users have proper roles assigned
- Check that authentication tokens are valid
- Ensure database has data populated

## Quick Deployment Checklist

- [ ] PostgreSQL database created
- [ ] DATABASE_URL environment variable set
- [ ] SESSION_SECRET generated and set (32+ characters)
- [ ] NODE_ENV set to "production"
- [ ] Run `npm run db:push` to create tables
- [ ] Run `npm run build` to create production build
- [ ] Deploy via Replit Deploy button
- [ ] Verify login works
- [ ] Check all main features load properly

## Need Help?

If you encounter issues:
1. Check the application logs in Replit
2. Verify all environment variables are set correctly
3. Ensure the database connection is working
4. Try running `npm run db:push` again if tables are missing