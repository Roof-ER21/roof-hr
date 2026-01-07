# 🚨 CODEX HANDOFF: Interview Scheduling Issues

## Project Location
```
/Users/a21/Downloads/Roof HR
```

## Production
- **URL**: https://roofhr.up.railway.app
- **Login**: ahmed.mahmoud@theroofdocs.com / TRD2026!
- **Deploy**: Auto-deploys on push to `main` branch

---

## 🔴 CRITICAL ISSUES TO FIX

### Issue 1: Duplicate API Calls (PARTIALLY FIXED)
**Status**: Improved but may still have issues

**Symptoms**:
- When scheduling an interview, the `/api/interviews/check-conflicts` endpoint is called multiple times
- Should be called ONCE, but sometimes fires 6+ times

**Current Fix Applied**:
- Added `isCheckingRef` to track in-flight requests
- Added 500ms debounce
- Used `JSON.stringify(panelMembers)` in dependencies

**File**: `client/src/components/recruiting/interview-scheduler.tsx` (lines 162-215)

**What to verify**:
1. Open browser console
2. Schedule an interview
3. Count `[CONFLICT CHECK]` logs - should be exactly 1 per user action

**If still broken, consider**:
- Using React Query's `useMutation` with cancellation
- Adding abort controller to cancel previous requests
- Using `useCallback` for the mutation function

---

### Issue 2: Google Calendar NOT Being Read (MAJOR)
**Status**: Logging added, needs verification

**Symptoms**:
- Service account IS configured (`GOOGLE_SERVICE_ACCOUNT_KEY` env var exists on Railway)
- But Google Calendar events are NOT being detected as conflicts
- No calendar conflicts appear even when users have meetings

**Expected Behavior**:
- When scheduling an interview, should check each @theroofdocs.com user's Google Calendar
- If they have a meeting at that time, should show as a conflict

**Files**:
- `server/services/service-account-auth.ts` - Service account authentication
- `server/services/calendar-conflict-detector.ts` - Calendar checking logic
- `server/routes/interviews.ts` - API endpoint (lines 566-645)

**Logging Added**:
```
[CalendarConflictDetector] ✅ Initialized with Service Account: <email>
[CalendarConflictDetector] 📅 Google Calendar conflict detection ENABLED
[CalendarConflictDetector] 📅 Checking Google Calendar for user@theroofdocs.com...
[CalendarConflictDetector] 📊 Found X calendar events
[CalendarConflictDetector] ❌ CONFLICT DETECTED: "Meeting Title"
```

**CHECK RAILWAY LOGS FOR**:
1. `✅ Initialized with Service Account` - confirms service account is loaded
2. `📅 Checking Google Calendar for...` - confirms calendar check is running
3. `❌ ACCESS DENIED` - indicates domain-wide delegation issue

**If ACCESS DENIED**:
The service account needs domain-wide delegation enabled in Google Workspace Admin:
1. Go to Google Workspace Admin Console
2. Security > API Controls > Domain-wide Delegation
3. Add the service account email (shown in logs)
4. Add scope: `https://www.googleapis.com/auth/calendar`

---

### Issue 3: Panel Availability Shows Empty (MINOR)
**Status**: Partially working

**Symptoms**:
- Some panel members show "No availability set" even though they have availability

**Files**:
- `server/routes/interview-availability.ts` - Availability API
- `client/src/components/recruiting/interview-scheduler.tsx` - Fetch availability (lines 95-120)

**Logging Added**:
```
[Panel Availability] Fetched for <id>: Array(5)
[Panel Availability] Fetched for <id>: Array(0)  // No availability set
```

---

## 📁 KEY FILES

### Frontend
| File | Purpose | Lines |
|------|---------|-------|
| `client/src/components/recruiting/interview-scheduler.tsx` | Main scheduler component | Full file |
| `client/src/lib/parse-screening-data.ts` | Helper for JSON parsing | Full file |

### Backend
| File | Purpose | Key Functions |
|------|---------|---------------|
| `server/services/calendar-conflict-detector.ts` | Calendar conflict detection | `checkConflicts()`, `checkGoogleCalendarConflicts()`, `checkSoftConflicts()` |
| `server/services/service-account-auth.ts` | Google service account auth | `isConfigured()`, `getCalendarForUser()` |
| `server/routes/interviews.ts` | Interview API routes | `POST /check-conflicts` (line 566) |

---

## ✅ WHAT'S WORKING

1. **Soft Conflicts** - Lunch hours (12pm-1pm), early morning, late afternoon warnings
2. **PTO Conflicts** - Checks if interviewer has approved PTO
3. **Interview Conflicts** - Checks if interviewer has another interview scheduled
4. **Time Conversion** - Correctly converts to Eastern Time
5. **Panel Availability Display** - Shows for users who have it configured

---

## 🧪 TESTING CHECKLIST

```bash
# 1. Build locally
npm run build

# 2. Run locally (optional)
npm run dev

# 3. Deploy
git add -A && git commit -m "fix: description" && git push origin main

# 4. Wait 2-3 minutes for Railway deployment
```

### Browser Testing:
1. Go to https://roofhr.up.railway.app/recruiting
2. Login as ahmed.mahmoud@theroofdocs.com / TRD2026!
3. Click "Schedule Interview" on any candidate
4. Select date, time, interviewer
5. Watch console for `[CONFLICT CHECK]` logs
6. Check "Scheduling Warnings" section for conflicts

### Railway Logs:
```bash
railway login
railway logs
```
Or check Railway dashboard at https://railway.app

---

## 🔧 ENVIRONMENT VARIABLES (Railway)

```
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}  # JSON string
DATABASE_URL=postgresql://...
JWT_SECRET=...
```

---

## 📊 ARCHITECTURE

```
User selects time
       ↓
[Debounce 500ms]
       ↓
POST /api/interviews/check-conflicts
       ↓
┌─────────────────────────────────────┐
│ CalendarConflictDetector            │
├─────────────────────────────────────┤
│ 1. Check PTO conflicts              │
│ 2. Check interview conflicts        │
│ 3. Check Google Calendar conflicts  │←── THIS IS BROKEN
│ 4. Check soft conflicts (time-based)│←── This works
└─────────────────────────────────────┘
       ↓
Return { hasConflicts, conflicts, warnings }
       ↓
Display in UI
```

---

## 🎯 PRIORITY ORDER

1. **HIGH**: Fix Google Calendar integration - this is the main feature
2. **MEDIUM**: Ensure only 1 API call per action
3. **LOW**: Panel availability for all users

---

## 📝 RECENT COMMITS

```bash
git log --oneline -10
```

Key commits:
- `575d944` - Remove debug warning message
- `43ac1f3` - Add debouncing to conflict check
- `42dac49` - Add temporary test warning
- `f1c87e9` - Phase 4 fixes (JSON parse, soft conflicts loop)
- `be49fd1` - Use service account for Google Calendar

---

## 💡 HINTS

1. The service account key is stored as a JSON string in the env var
2. Domain-wide delegation must be enabled in Google Workspace Admin
3. Only @theroofdocs.com emails can have their calendars checked
4. The `isInitialized` flag indicates if service account is ready
5. Check Railway startup logs for service account initialization

---

**Good luck!** 🚀
