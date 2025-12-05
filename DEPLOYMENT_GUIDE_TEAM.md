# HR Management System - Team Deployment Guide

## Quick Start for Team Members

### 1. Initial Setup (5 minutes)

```bash
# Clone the repository
git clone [repository-url]
cd hr-management-system

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your local settings

# Set up the database
npm run db:push

# Start the development server
npm run dev
```

### 2. Access Credentials

**Admin Account (Full Access)**
- Email: ahmed.mahmoud@theroofdocs.com
- Password: Roofer21!
- Role: System Administrator

**Test Accounts for Different Roles**
- Manager: Create via admin panel
- Employee: Create via admin panel

### 3. Key Features Overview

#### For HR Managers
- **Employee Directory**: Manage all employee records
- **Recruitment Pipeline**: Track candidates through hiring process
- **Document Management**: Store and track employee documents
- **Performance Reviews**: Schedule and manage reviews

#### For System Administrators
- **Admin Control Hub**: `/admin-control`
  - Configure HR automation agents
  - Manage recruitment bot settings
  - View system logs and metrics
  - Configure PTO policies

#### AI-Powered Features (Requires OpenAI API Key)
- Resume parsing and analysis
- Candidate success prediction
- Salary benchmarking
- Interview question generation

### 4. Common Tasks

#### Adding a New Employee
1. Navigate to Employees → Add Employee
2. Fill in employee details
3. Upload required documents
4. Assign to department and manager

#### Processing Candidates
1. Go to Recruitment → Candidates
2. Use drag-and-drop to move candidates through stages
3. Schedule interviews directly from candidate cards
4. Use AI insights for evaluation

#### Running HR Agents
1. Access Admin Control Hub
2. Toggle agents on/off as needed
3. Click "Test Run" to execute manually
4. View logs for execution details

### 5. Troubleshooting

#### Issue: Login Not Working
- Clear browser cookies
- Check database connection
- Verify JWT_SECRET in .env

#### Issue: AI Features Not Working
- Verify OPENAI_API_KEY is set
- Check API key has sufficient credits
- Review error logs in Admin Control Hub

#### Issue: Email Notifications Not Sending
- Configure SENDGRID_API_KEY
- Verify email templates exist
- Check spam folder

### 6. Development Workflow

```bash
# Create a new feature branch
git checkout -b feature/your-feature-name

# Make your changes
# Test locally
npm run dev

# Run tests
npm test

# Commit changes
git add .
git commit -m "feat: your feature description"

# Push to repository
git push origin feature/your-feature-name
```

### 7. Database Management

```bash
# View current schema
npm run db:studio

# Push schema changes
npm run db:push

# Generate migrations (production)
npm run db:generate

# Apply migrations
npm run db:migrate
```

### 8. API Endpoints

Key endpoints for integration:

```
POST   /api/auth/login          - User authentication
GET    /api/employees            - List employees
GET    /api/candidates           - List candidates  
POST   /api/candidates           - Add candidate
GET    /api/documents            - List documents
POST   /api/performance-reviews  - Create review
GET    /api/hr-agents           - List automation agents
POST   /api/hr-agents/:id/test  - Test run an agent
```

### 9. Security Best Practices

1. **Never commit secrets** - Use .env files
2. **Use strong passwords** - Minimum 8 characters
3. **Regular backups** - Database backed up daily
4. **Access control** - Follow role-based permissions
5. **API rate limiting** - Prevents abuse

### 10. Support & Resources

- **Documentation**: See `/docs` folder
- **API Reference**: `/api-docs`
- **Issue Tracking**: Report bugs in GitHub Issues
- **Team Chat**: [Your Slack/Teams channel]

### 11. Deployment to Production

For production deployment, contact the DevOps team or follow these steps:

1. Ensure all tests pass
2. Update version in package.json
3. Create production build: `npm run build`
4. Tag release: `git tag v1.0.0`
5. Deploy using Replit deployment button
6. Verify all services are running

### 12. Important Notes

- **Data Privacy**: Handle employee data with care
- **Compliance**: Follow GDPR/privacy regulations
- **Backups**: Regular backups are automatic
- **Updates**: Pull latest changes weekly
- **Testing**: Always test in development first

## Need Help?

Contact the development team or check the documentation for more details.