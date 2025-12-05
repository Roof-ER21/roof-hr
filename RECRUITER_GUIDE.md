# ROOF-ER HR System - Recruiter Guide

## Quick Start for Recruiters

### 1. Logging In
- Go to the HR system URL
- Enter your email and password
- Click "Login"

### 2. Main Areas You'll Use

## Recruiting Page - Your Main Workspace

### Viewing Candidates
1. Click **"Recruiting"** in the sidebar
2. Switch between **Kanban view** (visual pipeline) or **List view** (table format)
3. See candidates organized by status:
   - New Applied
   - Screening
   - Interview
   - Offer
   - Hired
   - Rejected

### Adding New Candidates

#### Method 1: Manual Entry
1. Click **"Add Candidate"** button
2. Fill in candidate information:
   - Name, Email, Phone
   - Position Applied For
   - Department
   - Resume link (optional)
3. Click **"Submit"**

#### Method 2: Upload Resume (Recommended)
1. Click **"Upload Resume"** button
2. Select a text file (.txt) or PDF of the candidate's resume
3. The system will automatically:
   - Extract candidate name, email, phone
   - Parse work experience and skills
   - Save resume to Google Drive
   - Pre-fill the candidate form
4. Review extracted information
5. Add position and any missing details
6. Click **"Create Candidate"**

#### Method 3: Bulk Import from CSV
1. Click **"Import Candidates"** button
2. Upload a CSV file with candidate data
3. System will create multiple candidates at once

### Managing Candidates

#### Moving Through Pipeline
- **Drag & Drop**: In Kanban view, drag candidate cards between columns
- **Bulk Actions**: Select multiple candidates and use "Move to Stage" button
- **Individual Update**: Click on candidate, then "Edit" to change status

#### Scheduling Interviews
1. Click on a candidate card
2. Click **"Schedule Interview"**
3. Select date and time
4. Add interviewer names
5. Add meeting location or video link
6. System will:
   - Create calendar event
   - Send email invitations
   - Update candidate status

#### Sending Emails
1. Click on candidate
2. Click **"Send Email"**
3. Choose a template or write custom message
4. Click **"Send"**

### Using Susan AI Assistant

Susan AI can help you work faster with natural language commands.

#### Access Susan AI
- Click the **floating purple orb** in bottom-right corner
- Or go to **"Susan AI"** page in sidebar

#### What You Can Ask Susan:

**Finding Information:**
- "Show me all candidates for the Sales Manager position"
- "Find candidates who applied this week"
- "Who is scheduled for interviews tomorrow?"
- "Show me John Smith's application"

**Taking Actions:**
- "Schedule an interview with Jane Doe for Thursday at 2pm"
- "Move all screening candidates to interview stage"
- "Send offer letter to Michael Johnson"
- "Reject candidates who haven't responded in 2 weeks"

**Email Operations:**
- "Send follow-up email to all candidates in screening"
- "Email interview confirmation to Sarah Wilson"
- "Send rejection letters to candidates marked as rejected"

**Quick Stats:**
- "How many open positions do we have?"
- "Show me hiring metrics for this month"
- "What's our average time to hire?"

### Interview Management

#### Before the Interview
1. Review candidate profile and resume
2. Check interview schedule in calendar
3. Prepare interview questions
4. Send reminder email (or ask Susan to do it)

#### After the Interview
1. Update candidate status
2. Add interview notes
3. Rate candidate (1-5 stars)
4. Move to next stage or reject

### Making Offers

1. Move candidate to "Offer" stage
2. Click **"Generate Offer Letter"**
3. Review and customize offer details
4. Send via email
5. Track offer acceptance

### Converting to Employee

When candidate accepts:
1. Move to "Hired" status
2. Click **"Convert to Employee"**
3. System will:
   - Create employee record
   - Start onboarding process
   - Send welcome email
   - Assign equipment if needed

## Tips for Efficiency

### Use Filters
- Filter by position, department, or date
- Save common filters for quick access
- Export filtered results to CSV

### Bulk Operations
- Select multiple candidates (checkbox)
- Apply actions to all selected:
  - Send emails
  - Change status
  - Add tags
  - Export data

### Quick Actions with Susan AI
Instead of clicking through menus:
- "Schedule interview with [name] for [date/time]"
- "Send [template name] email to all [stage] candidates"
- "Show me candidates who need follow-up"

### Email Templates
1. Go to **"Email Templates"** page
2. Create templates for common scenarios:
   - Interview invitations
   - Rejection letters
   - Offer letters
   - Follow-ups
3. Use variables like {{candidateName}}, {{position}}

## Google Integration Features

### Google Drive
- All resumes automatically saved to Google Drive
- Access via **"View in Drive"** button on candidate profile
- Organized in folders by position and date

### Google Calendar
- Interviews automatically added to calendar
- Sends invites to all participants
- Updates when rescheduled

### Google Sheets
- Export candidate data to Sheets
- Import bulk candidates from Sheets
- Automatic sync for reporting

## Common Workflows

### New Candidate Application
1. Candidate applies → Status: "New Applied"
2. Review application → Move to "Screening"
3. Phone screen → Add notes
4. Schedule interview → Status: "Interview"
5. Conduct interview → Add feedback
6. Make decision → "Offer" or "Rejected"
7. Send offer → Track acceptance
8. Hire → Convert to employee

### Urgent Hiring
1. Ask Susan: "Show me all screened candidates for [position]"
2. Bulk select qualified candidates
3. Ask Susan: "Schedule interviews for selected candidates this week"
4. Review and confirm schedule
5. Send bulk interview invitations

### Weekly Recruiting Tasks
1. Monday: Review new applications
2. Tuesday-Thursday: Conduct interviews
3. Friday: 
   - Follow up on pending offers
   - Send rejection emails
   - Update pipeline status
   - Export weekly report

## Troubleshooting

### Resume Upload Issues
- Use .txt files for best AI parsing
- PDFs work but may have limited extraction
- Large files may take longer to process
- Check Google Drive connection if upload fails

### Email Not Sending
- Verify candidate has valid email
- Check email template for errors
- Ensure Google Gmail integration is connected
- Ask Susan AI to diagnose the issue

### Can't Find Candidate
- Check filters aren't hiding results
- Try searching by email or phone
- Ask Susan: "Find [candidate name or email]"
- Check if candidate was archived

## Best Practices

1. **Keep Status Updated**: Move candidates through pipeline promptly
2. **Add Notes**: Document all interactions and feedback
3. **Use Templates**: Save time with email and message templates
4. **Leverage Susan AI**: Use natural language for complex queries
5. **Regular Follow-ups**: Set reminders for candidate communication
6. **Data Hygiene**: Archive old/rejected candidates monthly
7. **Bulk Operations**: Process similar actions together
8. **Quick Decisions**: Don't let candidates sit in one stage too long

## Support

For technical issues or questions:
1. Ask Susan AI for help first
2. Check this guide for common workflows
3. Contact your HR administrator
4. Report bugs through the Settings page

---

*Last Updated: October 2025*
*Version: 1.0*