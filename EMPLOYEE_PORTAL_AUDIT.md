# Employee Portal (My Portal) Integration Audit Report

**Date**: 2025-12-26
**File Audited**: `/Users/a21/Downloads/Roof HR/client/src/pages/employee-dashboard.tsx`
**Backend Routes Checked**: `employee-portal.ts`, `onboarding-templates.ts`, `contracts.ts`, `routes.ts`

---

## Executive Summary

The Employee Portal page has **partial integration** with backend systems. Some critical features are **missing or not displaying data** that should be visible to employees.

### Overall Status: PARTIALLY INTEGRATED

- **PTO Balance**: WORKING
- **PTO Requests**: WORKING
- **Calendar Events**: WORKING
- **Onboarding Tasks**: MISSING INTEGRATION
- **Contracts**: MISSING INTEGRATION
- **Documents**: PARTIALLY INTEGRATED
- **Pending Items**: INCOMPLETE

---

## Detailed Findings

### 1. ONBOARDING TASKS - MISSING

**Issue**: The employee dashboard does NOT fetch or display onboarding tasks assigned to the employee.

**Evidence**:
- Frontend (`employee-dashboard.tsx`): No API call to `/api/onboarding-instances?employeeId=currentUser.id`
- Backend (`onboarding-templates.ts:317`): Endpoint EXISTS and is properly implemented
  ```typescript
  router.get('/api/onboarding-instances', requireAuth, async (req, res) => {
    const { employeeId, status } = req.query;
    // Returns onboarding workflows/instances
  ```

**Expected Behavior**:
- Employee should see their assigned onboarding tasks
- Progress bar showing X/Y tasks completed
- Due dates for each task
- Ability to mark tasks as complete

**Current Behavior**:
- No onboarding section visible
- No API calls to fetch onboarding data

**Fix Required**:
Add a new query to fetch onboarding instances:
```typescript
const { data: onboardingInstances = [] } = useQuery({
  queryKey: ['/api/onboarding-instances', { employeeId: user?.id }],
  queryFn: async () => {
    const response = await fetch(
      `/api/onboarding-instances?employeeId=${user?.id}`,
      { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
    );
    if (!response.ok) return [];
    return response.json();
  }
});
```

Then display onboarding tasks in the "Pending Actions" tab or a dedicated "Onboarding" tab.

---

### 2. CONTRACTS - MISSING

**Issue**: Employee dashboard does NOT display contracts that need signing.

**Evidence**:
- Frontend (`employee-dashboard.tsx`): No API call to `/api/contracts` or `/api/employee-contracts`
- Backend (`contracts.ts:412, 441`): Endpoints EXIST
  ```typescript
  // contracts.ts:412
  router.get('/api/contracts', requireAuth, async (req, res) => {
    // Returns user's contracts if not manager

  // contracts.ts:441
  router.get('/api/employee-contracts/employee/:employeeId', requireAuth, async (req, res) => {
    // Returns contracts for specific employee
  ```

**Expected Behavior**:
- Employee sees contracts with status: SENT, VIEWED
- "Sign Contract" button for pending contracts
- Contract preview/download capability
- Signature collection interface

**Current Behavior**:
- No contracts section in dashboard
- Quick Actions has a "My Contracts" link to `/contracts` page
- But dashboard itself shows no contract status

**Fix Required**:
Add contracts query:
```typescript
const { data: myContracts = [] } = useQuery({
  queryKey: ['/api/employee-contracts/employee', user?.id],
  queryFn: async () => {
    const response = await fetch(
      `/api/employee-contracts/employee/${user?.id}`,
      { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
    );
    if (!response.ok) return [];
    return response.json();
  }
});

// Filter unsigned contracts
const unsignedContracts = myContracts.filter(
  c => ['SENT', 'VIEWED'].includes(c.status)
);
```

Display unsigned contracts in "Pending Actions" tab with "Sign Now" buttons.

---

### 3. DOCUMENTS - PARTIALLY INTEGRATED

**Issue**: Documents are fetched but only show in "Pending Actions" tab for acknowledgment. No full document library view.

**Evidence**:
- Frontend (`employee-dashboard.tsx:202-211`):
  ```typescript
  const { data: documentsToAck = [] } = useQuery({
    queryKey: ['/api/employee-portal/documents-to-acknowledge'],
    // ...
  });
  ```
- Backend (`employee-portal.ts:349`): Endpoint EXISTS and returns APPROVED documents not yet acknowledged

**Current Behavior**:
- Documents needing acknowledgment appear in "Pending Actions" tab (lines 779-797)
- Quick Actions has "View Documents" link to `/documents` page
- No document count or summary in dashboard

**Improvement Needed**:
- Add a count badge showing number of pending documents
- Show recently uploaded documents
- Display document categories employee has access to

---

### 4. PTO BALANCE - WORKING

**Status**: FULLY INTEGRATED

**Evidence**:
- Frontend (`employee-dashboard.tsx:141-162`): Fetches `/api/employee-portal/pto-balance`
- Backend (`employee-portal.ts:141-262`): Comprehensive PTO balance calculation
- Display (lines 287-356): Three cards showing Vacation, Sick, Personal days with progress bars

**Working Features**:
- Displays remaining days for each PTO type
- Shows usage with progress bars
- Handles policy hierarchy (individual > department > company)
- Special handling for Sales/1099 contractors

---

### 5. PTO REQUESTS - WORKING

**Status**: FULLY INTEGRATED

**Evidence**:
- Frontend (`employee-dashboard.tsx:177-187`): Fetches `/api/pto/my-requests`
- Display (lines 671-738): Shows recent PTO requests with status badges
- Quick Actions (line 412): "Request Time Off" button

**Working Features**:
- Lists PTO requests with status (PENDING, APPROVED, DENIED)
- Shows date ranges and reason
- Color-coded status badges
- Link to create new request

---

### 6. CALENDAR EVENTS - WORKING

**Status**: FULLY INTEGRATED

**Evidence**:
- Frontend (`employee-dashboard.tsx:109-121`): Fetches `/api/google/calendar/my-events`
- Display (lines 454-588): Full calendar view with event management
- Event CRUD (lines 871-908): Create, edit, delete event dialogs

**Working Features**:
- Monthly calendar view
- Event color coding by type (Meeting, Interview, PTO, Team PTO)
- Event details modal
- Create/Edit/Delete events (for user-owned events)
- Google Meet link integration

---

### 7. PENDING ITEMS - INCOMPLETE

**Issue**: The pending items query exists but doesn't aggregate all pending items correctly.

**Evidence**:
- Frontend (`employee-dashboard.tsx:165-174`): Fetches `/api/employee-portal/pending-items`
- Backend (`employee-portal.ts:265-303`): Returns PTO requests, tasks, reviews
- Display (lines 741-798): Shows pending items in "Pending Actions" tab

**Missing from Pending Items**:
1. Onboarding tasks
2. Unsigned contracts
3. Training assignments (if any)
4. Missing documents (I-9, W-4, etc.)

**Current Items Shown**:
- Pending PTO requests
- Tasks assigned to user
- Upcoming employee reviews
- Documents to acknowledge

**Fix Required**:
Update the backend `/api/employee-portal/pending-items` endpoint to include:
```typescript
// Add onboarding instances
const onboardingInstances = await storage.getOnboardingInstancesByEmployeeId(userId);
const activeOnboarding = onboardingInstances.filter(i =>
  i.status === 'IN_PROGRESS' || i.status === 'NOT_STARTED'
);

// Add unsigned contracts
const contracts = await storage.getEmployeeContractsByEmployeeId(userId);
const unsignedContracts = contracts.filter(c =>
  ['SENT', 'VIEWED'].includes(c.status)
);

// Return comprehensive pending items
res.json({
  ptoRequests: pendingPto,
  tasks: pendingTasks,
  reviews: upcomingReviews,
  onboarding: activeOnboarding,
  contracts: unsignedContracts,
  counts: {
    ptoRequests: pendingPto.length,
    tasks: pendingTasks.length,
    reviews: upcomingReviews.length,
    onboarding: activeOnboarding.length,
    contracts: unsignedContracts.length,
    total: pendingPto.length + pendingTasks.length + upcomingReviews.length +
           activeOnboarding.length + unsignedContracts.length
  }
});
```

---

## Integration Status Summary

| Feature | Backend Endpoint | Frontend Integration | Status |
|---------|-----------------|---------------------|---------|
| PTO Balance | `/api/employee-portal/pto-balance` | YES (line 141) | WORKING |
| PTO Requests | `/api/pto` | YES (line 177) | WORKING |
| Calendar Events | `/api/google/calendar/my-events` | YES (line 109) | WORKING |
| Documents to Acknowledge | `/api/employee-portal/documents-to-acknowledge` | YES (line 202) | PARTIAL |
| Pending Items | `/api/employee-portal/pending-items` | YES (line 165) | INCOMPLETE |
| **Onboarding Tasks** | `/api/onboarding-instances` | **NO** | **MISSING** |
| **Employee Contracts** | `/api/employee-contracts/employee/:id` | **NO** | **MISSING** |
| Team Directory | `/api/employee-portal/team` | NO | NOT SHOWN |
| Upcoming Events | `/api/employee-portal/upcoming-events` | YES (line 190) | WORKING |

---

## Critical Missing Integrations

### Priority 1: Onboarding Tasks Display

**Why Critical**: New employees need to see their onboarding checklist immediately. This is the first experience they have with the system.

**Implementation**:
1. Add React Query to fetch onboarding instances
2. Create an "Onboarding" tab or section
3. Display:
   - Overall progress (X of Y tasks complete)
   - Task list with due dates
   - Mark complete button
   - Link to upload documents if required

**Location**: Add to Tabs component (line 446) or create a new card in the dashboard

---

### Priority 2: Contracts Needing Signature

**Why Critical**: Legal compliance requires employees to sign contracts promptly. Missing this creates compliance gaps.

**Implementation**:
1. Add React Query to fetch employee contracts
2. Filter for SENT/VIEWED status
3. Add to "Pending Actions" tab (alongside documents)
4. Show:
   - Contract title
   - Date sent
   - "Sign Now" button
   - Preview capability

**Location**: Add to Pending Actions tab (line 741) alongside documentsToAck

---

### Priority 3: Complete Pending Items Aggregation

**Why Important**: Employees need a single source of truth for all pending actions.

**Implementation**:
1. Update backend endpoint to include onboarding and contracts
2. Update frontend to handle new data structure
3. Create comprehensive "To-Do" dashboard view

---

## Data Flow Verification

### Working Flows

1. **PTO Balance Flow**:
   ```
   Frontend → GET /api/employee-portal/pto-balance
   Backend → Calculate from ptoPolicies + ptoRequests
   Frontend ← { vacationDays, sickDays, personalDays, usedVacation, etc. }
   Display → Three progress bar cards
   ```

2. **Calendar Events Flow**:
   ```
   Frontend → GET /api/google/calendar/my-events?timeMin=X&timeMax=Y
   Backend → Fetch from Google Calendar API + local events
   Frontend ← Array of CalendarEvent objects
   Display → Monthly calendar grid with events
   ```

### Broken Flows

1. **Onboarding Tasks Flow** (MISSING):
   ```
   Frontend → (NO CALL)
   Backend → /api/onboarding-instances READY but unused
   Frontend ← (NO DATA)
   Display → Nothing shown
   ```

2. **Contracts Flow** (MISSING):
   ```
   Frontend → (NO CALL)
   Backend → /api/employee-contracts/employee/:id READY but unused
   Frontend ← (NO DATA)
   Display → Nothing shown (except link in Quick Actions)
   ```

---

## Recommendations

### Immediate Actions (High Priority)

1. **Add Onboarding Integration**
   - File: `/Users/a21/Downloads/Roof HR/client/src/pages/employee-dashboard.tsx`
   - Add query for onboarding instances
   - Display in new "Onboarding" tab or dedicated card
   - Show progress, tasks, due dates

2. **Add Contracts Integration**
   - Same file
   - Add query for employee contracts
   - Filter for unsigned contracts
   - Add to "Pending Actions" tab with signature functionality

3. **Update Pending Items Endpoint**
   - File: `/Users/a21/Downloads/Roof HR/server/routes/employee-portal.ts`
   - Line 265: Enhance to include onboarding and contracts
   - Return comprehensive pending items object

### Medium Priority

4. **Add Document Library View**
   - Show all documents employee has access to
   - Categorize by type
   - Show acknowledgment status

5. **Add Team Directory to Dashboard**
   - Endpoint exists (`/api/employee-portal/team`)
   - Not currently fetched or displayed
   - Add colleague quick-contact cards

### Low Priority

6. **Add Quick Stats Dashboard**
   - Total pending items badge
   - Time until next review
   - Onboarding completion percentage
   - Recent activity timeline

---

## Code Examples for Fixes

### Fix 1: Add Onboarding to Dashboard

**Location**: After line 211 in `employee-dashboard.tsx`

```typescript
// Fetch onboarding instances for current user
const { data: onboardingInstances = [], isLoading: onboardingLoading } = useQuery<any[]>({
  queryKey: ['/api/onboarding-instances', user?.id],
  queryFn: async () => {
    const response = await fetch(
      `/api/onboarding-instances?employeeId=${user?.id}`,
      { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
    );
    if (!response.ok) return [];
    return response.json();
  }
});

// Get active onboarding workflows
const activeOnboarding = onboardingInstances.filter(
  i => i.status === 'IN_PROGRESS' || i.status === 'NOT_STARTED'
);
```

**Display**: Add new tab or card

```typescript
<TabsContent value="onboarding" className="space-y-4">
  <Card>
    <CardHeader>
      <CardTitle>My Onboarding Tasks</CardTitle>
      <CardDescription>Complete these tasks to finish your onboarding</CardDescription>
    </CardHeader>
    <CardContent>
      {activeOnboarding.length > 0 ? (
        activeOnboarding.map((instance: any) => (
          <OnboardingProgressCard
            key={instance.id}
            instance={instance}
          />
        ))
      ) : (
        <p className="text-center text-gray-500 py-4">
          No active onboarding tasks
        </p>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

---

### Fix 2: Add Contracts to Dashboard

**Location**: After onboarding query

```typescript
// Fetch employee contracts
const { data: myContracts = [], isLoading: contractsLoading } = useQuery<any[]>({
  queryKey: ['/api/employee-contracts/employee', user?.id],
  queryFn: async () => {
    const response = await fetch(
      `/api/employee-contracts/employee/${user?.id}`,
      { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
    );
    if (!response.ok) return [];
    return response.json();
  }
});

// Filter unsigned contracts
const unsignedContracts = myContracts.filter(
  c => c.status === 'SENT' || c.status === 'VIEWED'
);
```

**Display**: Add to Pending Actions tab (after documentsToAck section)

```typescript
{unsignedContracts.length > 0 && (
  <div className="mt-6">
    <h4 className="font-medium text-gray-900 dark:text-white mb-3">
      Contracts Awaiting Signature
    </h4>
    <div className="space-y-2">
      {unsignedContracts.map((contract: any) => (
        <div
          key={contract.id}
          className="flex items-center justify-between p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20"
        >
          <div className="flex items-center gap-3">
            <Award className="w-4 h-4 text-blue-600" />
            <div>
              <span className="text-sm font-medium">{contract.title}</span>
              <p className="text-xs text-gray-500">
                Sent: {new Date(contract.sentDate).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Link to={`/contracts/${contract.id}`}>
            <Button size="sm">Sign Now</Button>
          </Link>
        </div>
      ))}
    </div>
  </div>
)}
```

---

### Fix 3: Enhanced Pending Items Backend

**Location**: `/Users/a21/Downloads/Roof HR/server/routes/employee-portal.ts` (line 265)

```typescript
router.get('/api/employee-portal/pending-items', requireAuth, async (req: any, res) => {
  try {
    const userId = req.user.id;

    // Existing: Pending PTO requests
    const allPtoRequests = await storage.getAllPtoRequests();
    const pendingPto = allPtoRequests.filter(r =>
      r.employeeId === userId && r.status === 'PENDING'
    );

    // Existing: Pending tasks
    const allTasks = await storage.getAllTasks();
    const pendingTasks = allTasks.filter(t =>
      t.assignedTo === userId && t.status !== 'COMPLETED'
    );

    // Existing: Upcoming reviews
    const allReviews = await storage.getAllEmployeeReviews();
    const upcomingReviews = allReviews.filter(r =>
      r.revieweeId === userId &&
      r.status !== 'ACKNOWLEDGED'
    );

    // NEW: Active onboarding instances
    const allOnboarding = await storage.getAllOnboardingWorkflows();
    const activeOnboarding = allOnboarding.filter(o =>
      o.employeeId === userId &&
      (o.status === 'IN_PROGRESS' || o.status === 'NOT_STARTED')
    );

    // NEW: Unsigned contracts
    const allContracts = await storage.getEmployeeContractsByEmployeeId(userId);
    const unsignedContracts = allContracts.filter(c =>
      c.status === 'SENT' || c.status === 'VIEWED'
    );

    // NEW: Documents to acknowledge
    const allDocuments = await db.select().from(documents).where(eq(documents.status, 'APPROVED'));
    const userAcknowledgments = await db.select()
      .from(documentAcknowledgments)
      .where(eq(documentAcknowledgments.employeeId, userId));
    const acknowledgedDocIds = new Set(userAcknowledgments.map(a => a.documentId));
    const unacknowledgedDocs = allDocuments.filter(doc => !acknowledgedDocIds.has(doc.id));

    // Build comprehensive pending items response
    const pendingItems = [
      // PTO Requests
      ...pendingPto.map(r => ({
        id: `pto-${r.id}`,
        type: 'pto' as const,
        title: `PTO Request - ${r.type}`,
        description: `${r.startDate} to ${r.endDate}`,
        dueDate: r.startDate,
        action: 'View',
        link: '/pto'
      })),

      // Tasks
      ...pendingTasks.map(t => ({
        id: `task-${t.id}`,
        type: 'task' as const,
        title: t.title,
        description: t.description || 'No description',
        dueDate: t.dueDate,
        action: 'Complete',
        link: `/tasks/${t.id}`
      })),

      // Reviews
      ...upcomingReviews.map(r => ({
        id: `review-${r.id}`,
        type: 'review' as const,
        title: `${r.reviewType} Review`,
        description: r.summary || 'Performance review',
        dueDate: r.dueDate,
        action: 'View',
        link: `/reviews/${r.id}`
      })),

      // NEW: Onboarding
      ...activeOnboarding.map(o => ({
        id: `onboarding-${o.id}`,
        type: 'onboarding' as const,
        title: 'Onboarding Tasks',
        description: `${o.currentStep} of ${o.totalSteps} steps completed`,
        dueDate: null,
        action: 'Continue',
        link: `/onboarding/${o.id}`
      })),

      // NEW: Contracts
      ...unsignedContracts.map(c => ({
        id: `contract-${c.id}`,
        type: 'contract' as const,
        title: c.title,
        description: `Awaiting signature - Sent ${new Date(c.sentDate).toLocaleDateString()}`,
        dueDate: c.sentDate,
        action: 'Sign',
        link: `/contracts/${c.id}`
      })),

      // NEW: Documents
      ...unacknowledgedDocs.map(d => ({
        id: `document-${d.id}`,
        type: 'document' as const,
        title: d.name,
        description: d.description || 'Document requires acknowledgment',
        dueDate: d.createdAt,
        action: 'Acknowledge',
        link: `/documents/${d.id}`
      }))
    ];

    res.json({
      items: pendingItems,
      // Legacy format for backwards compatibility
      ptoRequests: pendingPto,
      tasks: pendingTasks,
      reviews: upcomingReviews,
      onboarding: activeOnboarding,
      contracts: unsignedContracts,
      documents: unacknowledgedDocs,
      counts: {
        ptoRequests: pendingPto.length,
        tasks: pendingTasks.length,
        reviews: upcomingReviews.length,
        onboarding: activeOnboarding.length,
        contracts: unsignedContracts.length,
        documents: unacknowledgedDocs.length,
        total: pendingItems.length
      }
    });
  } catch (error) {
    console.error('Error fetching pending items:', error);
    res.status(500).json({ error: 'Failed to fetch pending items' });
  }
});
```

---

## Testing Checklist

After implementing fixes, verify:

### Onboarding Integration
- [ ] Employee with assigned onboarding sees tasks
- [ ] Progress percentage is accurate
- [ ] Can mark tasks as complete
- [ ] Due dates display correctly
- [ ] Completed tasks are visually distinct

### Contracts Integration
- [ ] Employee sees contracts with status SENT/VIEWED
- [ ] Can click to view contract details
- [ ] Signature flow works
- [ ] After signing, status updates to SIGNED
- [ ] Contract disappears from pending list after signing

### Documents Integration
- [ ] Documents to acknowledge show in Pending Actions
- [ ] Can acknowledge documents
- [ ] After acknowledgment, document removed from pending
- [ ] Can view full document library

### Pending Items Aggregation
- [ ] All pending items show correctly
- [ ] Count badge is accurate
- [ ] Items link to correct pages
- [ ] Items sorted by priority/due date

---

## File Paths Reference

**Frontend**: `/Users/a21/Downloads/Roof HR/client/src/pages/employee-dashboard.tsx`
**Backend Routes**:
- `/Users/a21/Downloads/Roof HR/server/routes/employee-portal.ts`
- `/Users/a21/Downloads/Roof HR/server/routes/onboarding-templates.ts`
- `/Users/a21/Downloads/Roof HR/server/routes/contracts.ts`
- `/Users/a21/Downloads/Roof HR/server/routes.ts` (documents)

---

## Conclusion

The Employee Portal has a **solid foundation** with working PTO, calendar, and basic pending items. However, **critical missing integrations** for onboarding tasks and contract signing create gaps in the employee experience.

**Priority Fixes**:
1. Add onboarding tasks display (HIGH)
2. Add contracts needing signature (HIGH)
3. Enhance pending items aggregation (MEDIUM)

**Estimated Development Time**:
- Onboarding integration: 2-3 hours
- Contracts integration: 2-3 hours
- Enhanced pending items: 1-2 hours
- Testing: 1-2 hours
- **Total**: 6-10 hours

All backend endpoints are **ready and functional**. Only frontend integration work is needed.
