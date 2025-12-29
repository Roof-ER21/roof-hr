# PTO Policy Fix Report
**Date**: December 29, 2025
**Database**: PostgreSQL on Railway (hopper.proxy.rlwy.net:18847)

---

## Problem Summary

The PTO balance is showing **5/5/2 = 12 days** instead of the expected **12/3/2 = 17 days**.

### Current State (as of Dec 29, 2025):

#### 1. Constants File (`/shared/constants/pto-policy.ts`)
✅ **CORRECT** - Already set to 12/3/2 = 17
```typescript
DEFAULT_VACATION_DAYS: 12,
DEFAULT_SICK_DAYS: 3,
DEFAULT_PERSONAL_DAYS: 2,
DEFAULT_TOTAL_DAYS: 17,
```

#### 2. Schema Defaults (`/shared/schema.ts`)
❌ **INCORRECT** - Hardcoded to 5/5/2 = 12

**Lines 76-81** (companyPtoPolicy table):
```typescript
vacationDays: integer('vacation_days').notNull().default(5),  // ❌ Should be 12
sickDays: integer('sick_days').notNull().default(5),          // ❌ Should be 3
personalDays: integer('personal_days').notNull().default(2),  // ✅ Correct
totalDays: integer('total_days').notNull().default(12),       // ❌ Should be 17
```

**Lines 103-105** (ptoPolicies table):
```typescript
vacationDays: integer('vacation_days').notNull().default(5),  // ❌ Should be 12
sickDays: integer('sick_days').notNull().default(5),          // ❌ Should be 3
personalDays: integer('personal_days').notNull().default(2),  // ✅ Correct
```

#### 3. Database - Company Policy (`company_pto_policy` table)
⚠️ **PARTIALLY INCORRECT** - Shows 10/5/2 = 17

Record ID: `24e53265-1820-469c-a5d7-8295a5d5ad2e`
- Vacation Days: **10** (should be **12**)
- Sick Days: **5** (should be **3**)
- Personal Days: **2** ✅
- Total Days: **17** ✅

#### 4. Database - Department Settings (`department_pto_settings` table)
❌ **INCORRECT** - All departments show 5/5/2 = 12

All 9 departments have:
- Sales: 5/5/2 = 12
- Operations: 5/5/2 = 12
- Project Management: 5/5/2 = 12
- Human Resources: 5/5/2 = 12
- Estimating: 5/5/2 = 12
- Field Operations: 5/5/2 = 12
- Administration: 5/5/2 = 12
- Marketing: 5/5/2 = 12
- Production: 5/5/2 = 12

All have `inherit_from_company: true`

#### 5. Database - Individual Policies (`pto_policies` table)
❌ **INCORRECT** - 196 employee records found

- **COMPANY level** policies: Show 5/5/2 = 12 (should be 12/3/2 = 17)
- **DEPARTMENT level** policies: Most show 0/0/0 = 0 (Sales reps - correct)

Sample COMPANY-level employee:
```
Employee ID: b9ea8047-e4be-418e-907a-fe6840de2e96
Policy Level: COMPANY
Vacation Days: 5 (should be 12)
Sick Days: 5 (should be 3)
Personal Days: 2 ✅
Base Days: 12 (should be 17)
Total Days: 12 (should be 17)
```

---

## Root Causes

1. **Schema defaults** in `/shared/schema.ts` are hardcoded to old values (5/5/2)
2. **Database records** were created using these old defaults
3. **Constants file** was updated but database was not migrated

---

## Solution

### Step 1: Update Schema Defaults
File: `/Users/a21/Downloads/Roof HR/shared/schema.ts`

**Lines 78-81** (companyPtoPolicy):
```typescript
// BEFORE:
vacationDays: integer('vacation_days').notNull().default(5),
sickDays: integer('sick_days').notNull().default(5),
personalDays: integer('personal_days').notNull().default(2),
totalDays: integer('total_days').notNull().default(12),

// AFTER:
vacationDays: integer('vacation_days').notNull().default(12),
sickDays: integer('sick_days').notNull().default(3),
personalDays: integer('personal_days').notNull().default(2),
totalDays: integer('total_days').notNull().default(17),
```

**Lines 103-105** (ptoPolicies):
```typescript
// BEFORE:
vacationDays: integer('vacation_days').notNull().default(5),
sickDays: integer('sick_days').notNull().default(5),
personalDays: integer('personal_days').notNull().default(2),

// AFTER:
vacationDays: integer('vacation_days').notNull().default(12),
sickDays: integer('sick_days').notNull().default(3),
personalDays: integer('personal_days').notNull().default(2),
```

### Step 2: Run Database Update Script
File: `/Users/a21/Downloads/Roof HR/server/scripts/fix-pto-policy-sql.ts`

**Command**:
```bash
cd "/Users/a21/Downloads/Roof HR"
DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/fix-pto-policy-sql.ts
```

**What it does**:
1. Updates `company_pto_policy` table: 10/5/2 → 12/3/2 = 17
2. Updates `department_pto_settings` table: 5/5/2 → 12/3/2 = 17 (where inherit_from_company = true, excluding Sales)
3. Updates `pto_policies` table: 5/5/2 → 12/3/2 = 17 (COMPANY level only, excluding sales reps with 0 days)

**SQL Queries**:
```sql
-- 1. Update company policy
UPDATE company_pto_policy
SET
  vacation_days = 12,
  sick_days = 3,
  personal_days = 2,
  total_days = 17,
  last_updated_by = 'system-fix',
  policy_notes = 'Updated to correct allocation: 12 vacation, 3 sick, 2 personal = 17 total',
  updated_at = NOW()
WHERE TRUE;

-- 2. Update department settings (excluding Sales)
UPDATE department_pto_settings
SET
  vacation_days = 12,
  sick_days = 3,
  personal_days = 2,
  total_days = 17,
  updated_at = NOW()
WHERE
  inherit_from_company = true
  AND department NOT ILIKE '%sales%';

-- 3. Update individual employee policies (COMPANY level only)
UPDATE pto_policies
SET
  vacation_days = 12,
  sick_days = 3,
  personal_days = 2,
  base_days = 17,
  total_days = 17 + additional_days,
  remaining_days = (17 + additional_days) - used_days,
  updated_at = NOW()
WHERE
  policy_level = 'COMPANY'
  AND total_days != 0;
```

---

## Verification

After running the fix, verify with:
```bash
DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/check-pto-policy.ts
```

Expected results:
- ✅ Company policy: 12/3/2 = 17
- ✅ Department settings: 12/3/2 = 17 (all except Sales)
- ✅ Sales department: 0/0/0 = 0
- ✅ COMPANY-level employees: 12/3/2 = 17
- ✅ Sales reps (DEPARTMENT level): 0/0/0 = 0

---

## Files Created

1. **Check Script**: `/server/scripts/check-pto-policy.ts`
   - Displays current PTO policy values across all tables

2. **Fix Script**: `/server/scripts/fix-pto-policy-sql.ts`
   - Updates database records to 12/3/2 = 17

3. **Update Script** (alternative): `/server/scripts/update-pto-policy.ts`
   - Drizzle ORM version of the fix

4. **Department Check**: `/server/scripts/check-departments.ts`
   - Displays department PTO settings

---

## Important Notes

### Sales Representatives
Sales reps (1099 contractors) should have **0 PTO days**:
- The system correctly identifies them by:
  - `employment_type === '1099'`
  - `department === 'Sales'`
  - `policy_level === 'DEPARTMENT'`
- These employees will NOT be updated by the fix script

### Custom Policies
Employees with `policy_level === 'DEPARTMENT'` or `policy_level === 'INDIVIDUAL'` will NOT be updated by the fix script. These are custom policies that should be reviewed manually.

### Additional Days
The fix script preserves `additional_days` (manager customizations):
```
total_days = 17 + additional_days
remaining_days = (17 + additional_days) - used_days
```

---

## Execution Order

1. ✅ Update schema defaults in `/shared/schema.ts`
2. ✅ Run fix script: `fix-pto-policy-sql.ts`
3. ✅ Verify with check script: `check-pto-policy.ts`
4. ✅ Push schema changes to database: `npm run db:push`
5. ✅ Deploy to production (git push triggers Railway auto-deploy)

---

## Status

- [ ] Schema defaults updated
- [ ] Database fix script executed
- [ ] Verification completed
- [ ] Schema pushed to database
- [ ] Changes deployed to production
