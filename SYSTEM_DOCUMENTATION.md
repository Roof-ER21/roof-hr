# HR Management System v2.0 - Complete Feature Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Login Credentials & Access Levels](#login-credentials--access-levels)
3. [Core Features by Module](#core-features-by-module)
4. [Role-Based Permissions](#role-based-permissions)
5. [Automation Features](#automation-features)
6. [Security Features](#security-features)

---

## System Overview

**HR Management System v2.0** is a comprehensive platform designed for ROOF-ER roofing company to manage all HR operations from recruitment to performance management.

### Key Technologies:
- **Frontend**: React with TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with session management
- **AI Integration**: OpenAI GPT-4o for candidate analysis

---

## Login Credentials & Access Levels

### Primary Admin Account:
- **Email**: alex.ortega@theroofdocs.com
- **Password**: Admin123!
- **Role**: Administrator (Full system access)

### Other Admin Accounts Available:
- ben.kosa@theroofdocs.com
- brandon.pernot@theroofdocs.com
- cadell.barnes@theroofdocs.com
- reese.samala@theroofdocs.com

### Manager Accounts:
- andre.mealy@theroofdocs.com
- antonio.barrios@theroofdocs.com
- Various other managers in the system

### Note:
The database has been populated with real employee data from ROOF-ER company (theroofdocs.com domain). 
There are 108 total users in the system with various roles and departments.

---

## Core Features by Module

### 1. Employee Management Module

#### Features:
- **Employee Directory**
  - View all employees with advanced search
  - Filter by department, role, status
  - Export employee data to CSV
  - Bulk import employees from CSV

- **Employee Profiles**
  - Personal information management
  - Contact details
  - Emergency contacts
  - Employment history
  - Document attachments
  - Performance history

- **Employee Actions**
  - Add new employees
  - Edit employee information
  - Deactivate/reactivate employees
  - Assign roles and departments
  - Track employment status changes

### 2. Document Management Module

#### Features:
- **Document Storage**
  - Upload employee documents
  - Version control system
  - Automatic expiration tracking
  - Role-based access control

- **Document Types**
  - Contracts
  - Certifications
  - ID documents
  - Performance reviews
  - Training certificates
  - Policy acknowledgments

- **Document Actions**
  - Upload new documents
  - Download documents
  - View document history
  - Set expiration dates
  - Automated expiration reminders

### 3. Performance Management Module

#### Features:
- **Review Types**
  - Quarterly reviews
  - Annual reviews
  - Probation reviews
  - Project-based reviews
  - Performance Improvement Plans (PIP)

- **Review Process**
  - Create performance reviews
  - Star rating system (1-5)
  - Written feedback sections
  - Goal setting and tracking
  - Review approval workflow
  - Automated review generation (v2.0)

- **Performance Analytics**
  - Individual performance trends
  - Department performance comparisons
  - Historical performance data
  - Export performance reports

### 4. Recruitment Module

#### Features:
- **Candidate Pipeline**
  - Kanban board view
  - List view with filters
  - Drag-and-drop status updates
  - Bulk candidate actions

- **AI-Powered Features (v2.0)**
  - Candidate match scoring
  - Potential prediction
  - Automated screening
  - Smart candidate recommendations

- **Candidate Management**
  - Add candidates manually
  - Import from Indeed/Google Jobs
  - Schedule interviews
  - Track interview feedback
  - Send automated emails
  - Candidate comparison tool

- **Status Tracking**
  - Applied
  - Phone Interview Scheduled
  - Phone Interview Completed
  - In-Person Interview Scheduled
  - In-Person Interview Completed
  - Offer Sent
  - Hired
  - DEAD by us (rejected by company)
  - DEAD by candidate (withdrew)

### 5. PTO (Paid Time Off) Management

#### Features:
- **Request Management**
  - Submit PTO requests
  - View request history
  - Check PTO balance
  - Calendar integration

- **Approval Workflow**
  - Manager approval queue
  - Automated notifications
  - Conflict detection
  - Team calendar view

- **PTO Types**
  - Vacation
  - Sick leave
  - Personal days
  - Unpaid leave

### 6. Onboarding Module (v2.0)

#### Features:
- **Workflow Management**
  - 10-step onboarding process
  - Task assignment
  - Progress tracking
  - Document collection

- **Onboarding Steps**
  - Welcome orientation
  - Documentation collection
  - IT setup
  - Training schedule
  - Mentor assignment
  - Department introduction
  - Policy acknowledgment
  - Benefits enrollment
  - Security access
  - First-week check-in

### 7. Analytics & Reporting (v2.0)

#### Features:
- **Report Types**
  - Employee demographics
  - Turnover analysis
  - Performance trends
  - Recruitment metrics
  - PTO utilization
  - Compliance reports

- **Report Actions**
  - Generate custom reports
  - Schedule automated reports
  - Export to PDF/CSV
  - Email distribution

---

## Role-Based Permissions

### Administrator Permissions:
- ✅ Full system access
- ✅ User management
- ✅ System configuration
- ✅ All employee data access
- ✅ Report generation
- ✅ Automation configuration
- ✅ Security settings

### Manager Permissions:
- ✅ View team members
- ✅ Approve PTO requests
- ✅ Create performance reviews
- ✅ View recruitment pipeline
- ✅ Access team documents
- ✅ Generate team reports
- ❌ System configuration
- ❌ User role management

### Employee Permissions:
- ✅ View own profile
- ✅ Submit PTO requests
- ✅ View own documents
- ✅ View own performance reviews
- ✅ Update personal information
- ❌ View other employees' data
- ❌ Access recruitment module
- ❌ Generate reports

---

## Automation Features (v2.0)

### 1. PTO Expiration Agent
- **Schedule**: Every Monday at 9:00 AM
- **Function**: Sends reminders about unused PTO
- **Recipients**: Employees with expiring PTO

### 2. Performance Review Agent
- **Schedule**: First day of each quarter
- **Function**: Automatically creates quarterly/annual reviews
- **Actions**: Notifies managers and employees

### 3. Document Expiration Agent
- **Schedule**: Monday, Wednesday, Friday at 8:00 AM
- **Function**: Monitors document expirations
- **Actions**: Sends renewal reminders

### 4. Onboarding Workflow Agent
- **Trigger**: Manual (when new employee added)
- **Function**: Initiates 10-step onboarding process
- **Actions**: Assigns tasks, tracks progress

---

## Security Features (v2.0)

### Authentication & Authorization:
- JWT token-based authentication
- Session management with PostgreSQL
- Role-based access control (RBAC)
- Automatic session timeout

### API Security:
- Rate limiting (100 requests/15 minutes)
- CORS protection
- Input sanitization
- SQL injection prevention
- XSS protection

### Data Security:
- Encrypted passwords (bcrypt)
- HTTPS enforcement
- Secure session cookies
- Audit logging

### Monitoring:
- Winston logging system
- Error tracking
- Access logs
- Security event monitoring

---

## Navigation Structure

### Main Menu (Sidebar):
1. **Dashboard** - Overview and metrics
2. **Employees** - Employee directory and management
3. **Recruitment** - Candidate pipeline
4. **Documents** - Document management
5. **Performance** - Review management
6. **PTO** - Time-off requests
7. **Onboarding** - New employee workflows
8. **Analytics** - Reports and insights
9. **Settings** - System configuration (Admin only)

### User Menu (Top Right):
- Profile settings
- Change password
- Logout

---

## Common Workflows

### Adding a New Employee:
1. Navigate to Employees → Add Employee
2. Fill in personal information
3. Assign role and department
4. Set start date
5. System automatically triggers onboarding

### Processing a PTO Request:
1. Employee submits request
2. Manager receives notification
3. Manager reviews team calendar
4. Approves/denies request
5. Employee notified of decision

### Conducting Performance Review:
1. System creates review (automated or manual)
2. Manager completes evaluation
3. Employee adds self-assessment
4. Review meeting scheduled
5. Final review approved and filed

### Hiring Process:
1. Add candidate to pipeline
2. AI scores candidate match
3. Schedule phone interview
4. Record feedback
5. Move through pipeline stages
6. Send offer
7. Convert to employee

---

## Tips for Using the System

1. **Regular Data Backups**: System automatically backs up daily
2. **Document Organization**: Use consistent naming conventions
3. **Performance Reviews**: Complete within 2 weeks of creation
4. **PTO Planning**: Submit requests 2 weeks in advance
5. **Security**: Change password every 90 days

---

## Support & Troubleshooting

### Common Issues:
- **Can't login**: Check email/password, contact admin for reset
- **Missing features**: Verify your role permissions
- **Document upload fails**: Check file size (<10MB) and format
- **Report errors**: Ensure date ranges are valid

### Getting Help:
- System administrators can be reached through the Settings → Support section
- Check the Help menu for user guides
- Submit bug reports through Settings → Feedback

---

## Version History

### v2.0 (Current)
- Added AI-powered recruitment features
- Implemented HR automation agents
- Enhanced security with rate limiting
- Added analytics and reporting module
- Introduced onboarding workflows

### v1.0
- Initial release with core HR features
- Basic employee management
- Document storage
- Performance reviews
- PTO management

---

This documentation is current as of August 2025. For the latest updates, check the system's Help section.