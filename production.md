# Production Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] Set `NODE_ENV=production` in environment variables
- [ ] Configure `DATABASE_URL` with production PostgreSQL connection string
- [ ] Generate a secure `SESSION_SECRET` (minimum 32 characters)
- [ ] Verify all required environment variables are set

### 2. Database Setup
- [ ] Ensure PostgreSQL database is provisioned
- [ ] Run database migrations: `npm run db:push`
- [ ] Verify database connection with SSL enabled
- [ ] Set up regular database backups

### 3. Security Considerations
- [ ] Enable HTTPS/SSL on the hosting platform
- [ ] Configure CORS settings if needed
- [ ] Set secure session cookies in production
- [ ] Review and update API rate limiting
- [ ] Ensure all passwords meet security requirements

### 4. Build Process
```bash
# Install dependencies
npm ci

# Build the application
npm run build

# The build outputs to:
# - dist/public/ (frontend assets)
# - dist/index.js (server bundle)
```

### 5. Performance Optimizations
- [ ] Enable gzip compression
- [ ] Set up CDN for static assets if needed
- [ ] Configure proper caching headers
- [ ] Monitor memory usage and adjust Node.js heap size if needed

### 6. Monitoring and Logging
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure application logs
- [ ] Set up uptime monitoring
- [ ] Configure database query monitoring

### 7. Deployment Steps

#### For Replit:
1. Click the "Deploy" button in the Replit interface
2. Configure environment variables in the deployment settings
3. The application will automatically build and deploy

#### For Other Platforms:
1. Push code to your Git repository
2. Configure build command: `npm run build`
3. Configure start command: `npm start`
4. Set environment variables
5. Deploy the application

### 8. Post-Deployment Verification
- [ ] Test login functionality with demo accounts
- [ ] Verify sales leaderboard data loads
- [ ] Check QR code generation
- [ ] Test PTO request submission
- [ ] Verify recruitment pipeline functionality
- [ ] Check cron jobs are running (8 AM and 6 PM updates)

### 9. Maintenance

#### Regular Tasks:
- Monitor application logs for errors
- Check database performance and size
- Review and archive old data as needed
- Update dependencies regularly
- Monitor SSL certificate expiration

#### Backup Strategy:
- Daily database backups
- Store backups in a separate location
- Test restore procedures regularly

### 10. Troubleshooting

#### Common Issues:

**Database Connection Errors:**
- Verify DATABASE_URL is correct
- Check SSL settings (`sslmode=require`)
- Ensure database is accessible from deployment environment

**Authentication Issues:**
- Verify SESSION_SECRET is set
- Check session storage is working
- Ensure cookies are enabled for the domain

**Performance Issues:**
- Monitor database query performance
- Check for memory leaks
- Review cron job execution times
- Optimize large data queries

### 11. Scaling Considerations

As the application grows:
- Consider implementing Redis for session storage
- Add database connection pooling
- Implement horizontal scaling with load balancing
- Consider separating API and static asset serving
- Implement caching strategies for frequently accessed data

### 12. Security Updates

Regular security maintenance:
- Update dependencies monthly
- Review npm audit reports
- Update Node.js runtime version
- Review and rotate API keys/secrets
- Conduct security audits quarterly