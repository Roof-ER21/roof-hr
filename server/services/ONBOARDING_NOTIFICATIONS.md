# Onboarding Notification Service

Comprehensive notification system for the onboarding process in Roof HR.

## Overview

The onboarding notification service provides automated notifications for:
- **Assignment notifications**: When an onboarding template is assigned to an employee
- **Overdue task notifications**: Daily reminders for overdue onboarding tasks
- **Email notifications**: Automatic email delivery via Google Gmail service

## Features

### 1. Assignment Notifications
When a manager assigns an onboarding template to an employee:
- ✅ In-app notification created automatically
- ✅ Welcome email sent to employee
- ✅ Link to onboarding dashboard included
- ✅ Manager's name included in the message

### 2. Overdue Task Notifications
Automated daily check at 9 AM for overdue tasks:
- ✅ In-app notification for each overdue task
- ✅ Email reminder with urgency styling
- ✅ Displays days overdue
- ✅ Duplicate prevention (no repeat notifications within 24 hours)

### 3. Scheduled Checks
- ✅ Runs daily at 9:00 AM
- ✅ Auto-starts when server boots
- ✅ Handles errors gracefully
- ✅ Logs all operations

## File Structure

```
/Users/a21/Downloads/Roof HR/
├── server/
│   ├── services/
│   │   ├── onboarding-notifications.ts       # Main service
│   │   ├── test-onboarding-notifications.ts  # Test script
│   │   └── google-email-service.ts           # Email delivery
│   ├── routes/
│   │   └── onboarding-templates.ts           # Updated with notification calls
│   └── index.ts                              # Updated with scheduler
```

## Functions

### `sendOnboardingAssignedNotification(employeeId, instanceId, templateName, managerName)`

Sends notification when an onboarding template is assigned.

**Parameters:**
- `employeeId` (string): ID of the employee receiving the onboarding
- `instanceId` (string): ID of the onboarding instance
- `templateName` (string): Name of the onboarding template
- `managerName` (string): Name of the manager who assigned it

**Returns:** Promise<void>

**Example:**
```typescript
await sendOnboardingAssignedNotification(
  'emp-123',
  'instance-456',
  'New Hire Orientation',
  'John Smith'
);
```

### `sendOverdueTaskNotification(employeeId, stepId, taskTitle, dueDate)`

Sends notification for an overdue onboarding task.

**Parameters:**
- `employeeId` (string): ID of the employee with overdue task
- `stepId` (string): ID of the overdue step
- `taskTitle` (string): Title of the overdue task
- `dueDate` (Date): Original due date of the task

**Returns:** Promise<void>

**Example:**
```typescript
await sendOverdueTaskNotification(
  'emp-123',
  'step-789',
  'Complete I-9 Form',
  new Date('2025-01-01')
);
```

### `checkOverdueTasks()`

Checks all onboarding tasks for overdue items and sends notifications.

**Returns:** Promise<void>

**Example:**
```typescript
await checkOverdueTasks();
```

### `setupOverdueTasksScheduler()`

Sets up the daily scheduled job for checking overdue tasks.

**Schedule:** Daily at 9:00 AM

**Example:**
```typescript
setupOverdueTasksScheduler(); // Called automatically on server start
```

## API Endpoints

### POST /api/onboarding-templates/:templateId/assign/:employeeId
Assigns an onboarding template to an employee and sends notification automatically.

**Access:** Managers only

**Response:**
```json
{
  "success": true,
  "message": "Template assigned successfully",
  "instance": { ... },
  "workflowId": "workflow-123"
}
```

### POST /api/onboarding/check-overdue
Manually trigger overdue tasks check (for testing or admin purposes).

**Access:** Managers only

**Response:**
```json
{
  "success": true,
  "message": "Overdue tasks check initiated. Notifications will be sent to employees with overdue tasks."
}
```

## Email Templates

### Assignment Email
- **Subject:** "New Onboarding Process Assigned"
- **Style:** Welcome theme with blue header
- **Content:** Template name, next steps, CTA button

### Overdue Email
- **Subject:** "Reminder: Overdue Onboarding Task - [Task Title]"
- **Style:** Urgency theme with red header
- **Content:** Task details, days overdue, CTA button

## Configuration

### Environment Variables

```env
# Required for email delivery
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GOOGLE_USER_EMAIL=your-email@domain.com

# Application URL for email links
APP_URL=https://app.theroofdocs.com
```

### Email Service Fallback

If Google credentials are not configured:
- In-app notifications still work
- Email delivery silently fails (logged as warning)
- System continues to operate normally

## Testing

### Run Test Script

```bash
cd "/Users/a21/Downloads/Roof HR"
npx tsx server/services/test-onboarding-notifications.ts
```

### Manual Test via API

```bash
# Trigger overdue check manually
curl -X POST https://your-domain.com/api/onboarding/check-overdue \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Expected Test Output

```
================================================================================
ONBOARDING NOTIFICATION SERVICE TEST
================================================================================

[Test 1] Finding test users...
Found 5 users in the system
Test employee: John Doe (john.doe@example.com)

[Test 2] Finding onboarding templates...
Found 3 templates
Test template: New Hire Orientation

[Test 3] Testing assignment notification...
Assignment notification sent successfully!
✓ Assignment notification found in database
  Title: New Onboarding Process Assigned
  Message: Test Manager has assigned you the "New Hire Orientation"...

[Test 4] Testing overdue task notification...
Overdue task notification sent successfully!
✓ Overdue notification found in database
  Title: Overdue Onboarding Task
  Message: Your task "Complete orientation paperwork" is 3 days overdue...

[Test 5] Testing duplicate prevention...
Found 1 overdue notification(s)
✓ Duplicate prevention working correctly

[Test 6] Testing overdue tasks check...
✓ Overdue tasks check completed

[Test 7] Checking actual overdue steps...
Found 0 overdue steps in the system

================================================================================
TEST SUMMARY
================================================================================
✓ Assignment notification: PASSED
✓ Overdue task notification: PASSED
✓ Duplicate prevention: PASSED
✓ Overdue tasks check: PASSED
✓ Database queries: PASSED

All tests completed successfully!
================================================================================
```

## Notification Types

All notifications use the standard notification schema:

```typescript
{
  id: string;
  userId: string;
  type: 'onboarding_assigned' | 'task_overdue';
  title: string;
  message: string;
  read: boolean;
  link: string; // e.g., '/dashboard?tab=onboarding'
  metadata: string; // JSON with additional data
  createdAt: Date;
}
```

## Metadata Structure

### Assignment Notification Metadata
```json
{
  "instanceId": "instance-123",
  "templateName": "New Hire Orientation",
  "managerName": "John Smith"
}
```

### Overdue Notification Metadata
```json
{
  "stepId": "step-456",
  "taskTitle": "Complete I-9 Form",
  "dueDate": "2025-01-01T00:00:00.000Z",
  "daysOverdue": 3
}
```

## Integration Points

### Storage Methods Used

```typescript
// Notification operations
storage.createNotification(data)
storage.getNotificationsByUserId(userId, limit)
storage.getRecentNotification(userId, type, metadataContains, hoursAgo)

// User operations
storage.getUserById(id)

// Onboarding operations
storage.getOverdueOnboardingSteps()
storage.getOnboardingWorkflowById(id)
storage.getOnboardingInstanceById(id)
```

### Route Integration

The notification service is integrated into:
- `POST /api/onboarding-templates/:templateId/assign/:employeeId`
  - Automatically sends assignment notification after successful assignment

## Error Handling

All notification functions:
- ✅ Use try-catch blocks
- ✅ Log errors to console
- ✅ Don't throw errors (silent failures)
- ✅ Don't block the main workflow

Example:
```typescript
try {
  await sendNotification();
} catch (error) {
  console.error('Error sending notification:', error);
  // Don't throw - notification failures shouldn't break assignment
}
```

## Logging

All operations are logged with prefixes:

- `[Onboarding Notification]` - General operations
- `[Onboarding]` - Manual triggers

Example logs:
```
[Onboarding Notification] Sending assignment notification to employee emp-123
[Onboarding Notification] In-app notification created for employee emp-123
[Onboarding Notification] Email sent to john.doe@example.com
[Onboarding Notification] Starting overdue tasks check...
[Onboarding Notification] Found 5 overdue tasks
[Onboarding Notification] Processing overdue tasks for 3 employees
[Onboarding Notification] Overdue tasks check complete. Notifications sent: 5, Failed: 0
```

## Duplicate Prevention

The service prevents spam by:
1. Checking for existing notifications in the last 24 hours
2. Using `storage.getRecentNotification()` with step ID in metadata
3. Skipping notification if one was already sent recently

## Scheduler Details

### Schedule Configuration
- **Time:** 9:00 AM daily
- **Method:** `setTimeout` with recursive scheduling
- **Startup Behavior:** Runs immediately on server start, then schedules next run

### Scheduler Implementation
```typescript
const NINE_AM = 9; // 9:00 AM
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const scheduleNextCheck = () => {
  const now = new Date();
  const nextRun = new Date();
  nextRun.setHours(NINE_AM, 0, 0, 0);

  // If past 9 AM, schedule for tomorrow
  if (now.getHours() >= NINE_AM) {
    nextRun.setTime(nextRun.getTime() + ONE_DAY_MS);
  }

  const msUntilNextRun = nextRun.getTime() - now.getTime();
  setTimeout(async () => {
    await checkOverdueTasks();
    scheduleNextCheck(); // Recursive scheduling
  }, msUntilNextRun);
};
```

## Future Enhancements

Potential improvements:
- [ ] SMS notifications via Twilio
- [ ] Slack/Teams integration
- [ ] Configurable notification frequency
- [ ] Notification preferences per user
- [ ] Weekly digest emails
- [ ] Manager dashboard for overdue tasks
- [ ] Custom notification templates
- [ ] Multi-language support

## Troubleshooting

### Notifications not sending
1. Check server logs for errors
2. Verify database connection
3. Check email service configuration
4. Test with manual trigger endpoint

### Duplicate notifications
1. Check `getRecentNotification()` implementation
2. Verify metadata is being stored correctly
3. Check 24-hour window logic

### Scheduler not running
1. Check server startup logs
2. Verify `setupOverdueTasksScheduler()` is called in index.ts
3. Test with manual trigger endpoint
4. Check for uncaught errors in scheduler

### Email not delivering
1. Verify Google OAuth credentials
2. Check Google API console for quota limits
3. Test with `googleEmailService.sendEmail()` directly
4. Check spam folder
5. Review email service logs

## Support

For issues or questions:
1. Check server logs in `/Users/a21/Downloads/Roof HR/logs/`
2. Run test script for diagnostics
3. Use manual trigger endpoint to test
4. Check notification records in database

## License

Internal use only - Roof HR System
