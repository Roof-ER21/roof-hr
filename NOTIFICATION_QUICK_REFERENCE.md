# Onboarding Notifications - Quick Reference Card

## Files

```
/Users/a21/Downloads/Roof HR/
├── server/services/onboarding-notifications.ts          # Main service
├── server/services/test-onboarding-notifications.ts    # Test script
├── server/services/ONBOARDING_NOTIFICATIONS.md         # Full docs
├── server/routes/onboarding-templates.ts                # Updated routes
└── server/index.ts                                      # Scheduler init
```

## Functions

### Assignment Notification
```typescript
import { sendOnboardingAssignedNotification } from './services/onboarding-notifications';

await sendOnboardingAssignedNotification(
  employeeId: string,
  instanceId: string,
  templateName: string,
  managerName: string
);
```

### Overdue Notification
```typescript
import { sendOverdueTaskNotification } from './services/onboarding-notifications';

await sendOverdueTaskNotification(
  employeeId: string,
  stepId: string,
  taskTitle: string,
  dueDate: Date
);
```

### Check Overdue Tasks
```typescript
import { checkOverdueTasks } from './services/onboarding-notifications';

await checkOverdueTasks(); // Checks all overdue tasks
```

## API Endpoints

### Manual Trigger (Managers Only)
```bash
POST /api/onboarding/check-overdue
Authorization: Bearer {token}
```

### Assignment (Auto Notification)
```bash
POST /api/onboarding-templates/:templateId/assign/:employeeId
Authorization: Bearer {token}
```

## Testing

### Run Tests
```bash
cd "/Users/a21/Downloads/Roof HR"
npx tsx server/services/test-onboarding-notifications.ts
```

### Manual Trigger
```bash
curl -X POST http://localhost:5000/api/onboarding/check-overdue \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Scheduler

- **Schedule:** Daily at 9:00 AM
- **Auto-starts:** On server boot
- **Manual trigger:** `/api/onboarding/check-overdue`

## Environment Variables

```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
GOOGLE_USER_EMAIL=your-email@domain.com
APP_URL=https://app.theroofdocs.com
```

## Notification Types

| Type | Title | Trigger |
|------|-------|---------|
| `onboarding_assigned` | "New Onboarding Process Assigned" | Template assignment |
| `task_overdue` | "Overdue Onboarding Task" | Daily 9 AM check |

## Key Features

✅ In-app notifications
✅ Email notifications
✅ Duplicate prevention (24 hours)
✅ HTML email templates
✅ Error handling
✅ Comprehensive logging
✅ Manual trigger endpoint

## Logs

```
[Onboarding Notification] Sending assignment notification...
[Onboarding Notification] Email sent to user@example.com
[Onboarding Notification] Starting overdue tasks check...
[Onboarding Notification] Found 5 overdue tasks
[Onboarding Notification] Notifications sent: 5, Failed: 0
```

## Quick Troubleshooting

**No notifications:**
- Check server logs
- Verify database connection
- Test storage.createNotification()

**No emails:**
- Check Google OAuth env vars
- Verify email service initialization
- Check spam folder

**Scheduler not running:**
- Check server startup logs
- Look for "scheduler started" message
- Test manual trigger endpoint

## Status

🟢 **READY FOR PRODUCTION**

All features implemented, tested, and documented.
