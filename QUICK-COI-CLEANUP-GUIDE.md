# Quick COI Cleanup Guide

## TL;DR - Three Simple Commands

```bash
# 1. Check current state (run first)
npm run coi:verify

# 2. See what will be deleted (dry run)
npm run coi:analyze

# 3. Clean up duplicates (makes changes)
npm run coi:cleanup
```

## What Each Command Does

### `npm run coi:verify` (Start here!)
- **Safe**: Read-only, no changes
- **Shows**: Current database state
- **Reports**:
  - Total document count
  - Number of duplicates found
  - GoogleDriveId population status
  - Document type distribution
  - Health status and recommendations

**Output**: Quick health check with recommendations

---

### `npm run coi:analyze` (Before cleanup)
- **Safe**: Read-only, no changes
- **Shows**: Detailed duplicate analysis
- **Reports**:
  - Exactly which records will be kept
  - Exactly which records will be deleted
  - Examples of duplicate groups
  - Expected results after cleanup

**Output**: Detailed report of what cleanup will do

---

### `npm run coi:cleanup` (The fix)
- **Destructive**: Makes permanent changes!
- **Does**:
  1. Deletes duplicate COI records
  2. Keeps the oldest (original) record of each group
  3. Backfills googleDriveId from notes field
  4. Shows progress and final summary

**Output**: Cleanup results and statistics

---

## Recommended Workflow

```bash
# Step 1: Check the problem
npm run coi:verify
# Expected: ~1100 documents, ~850 duplicates

# Step 2: Review what will happen
npm run coi:analyze
# Review the output carefully!

# Step 3: Run the cleanup
npm run coi:cleanup
# Deletes duplicates, backfills Drive IDs

# Step 4: Verify it worked
npm run coi:verify
# Expected: ~250 documents, 0 duplicates
```

## Problem Being Solved

**Before**: ~1,100 COI records (many duplicates)
**After**: ~250 unique COI records
**Saved**: ~850 duplicate records removed (77% reduction)

## How It Decides What to Keep

For each group of duplicates:
- **Grouped by**: employeeId + documentUrl + expirationDate
- **Keeps**: The oldest record (earliest createdAt)
- **Deletes**: All newer duplicates

Example:
```
Employee: emp_123
Document: drive.google.com/file/d/abc123
Expiration: 2025-06-15

Records found:
  ✓ KEEP   - Created: 2024-01-10 (oldest)
  ✗ DELETE - Created: 2024-02-15
  ✗ DELETE - Created: 2024-03-20
```

## Safety Features

1. **2-second delay** before cleanup starts (Ctrl+C to cancel)
2. **Progress indicators** every 50 records
3. **Detailed logging** of all operations
4. **Error handling** with counts
5. **Comprehensive summary** at the end

## File Locations

**Scripts**:
- `/server/scripts/verify-coi-state.ts` - State verification
- `/server/scripts/analyze-coi-duplicates.ts` - Dry run analysis
- `/server/scripts/cleanup-coi-duplicates.ts` - Actual cleanup

**Documentation**:
- `/server/scripts/README-COI-CLEANUP.md` - Detailed docs
- `/COI-CLEANUP-SUMMARY.md` - Full implementation summary
- `/QUICK-COI-CLEANUP-GUIDE.md` - This guide

## Alternative Commands

### Using Shell Script
```bash
chmod +x scripts/coi-cleanup.sh
./scripts/coi-cleanup.sh analyze   # Analyze
./scripts/coi-cleanup.sh cleanup   # Cleanup
```

### Using tsx Directly
```bash
npx tsx server/scripts/verify-coi-state.ts
npx tsx server/scripts/analyze-coi-duplicates.ts
npx tsx server/scripts/cleanup-coi-duplicates.ts
```

## Verification Queries

After cleanup, verify in your database:

```sql
-- Should be ~250
SELECT COUNT(*) FROM coi_documents;

-- Should return 0 rows
SELECT employee_id, document_url, expiration_date, COUNT(*)
FROM coi_documents
GROUP BY employee_id, document_url, expiration_date
HAVING COUNT(*) > 1;

-- Should be high percentage
SELECT
  COUNT(google_drive_id)::float / COUNT(*) * 100 as percent_with_drive_id
FROM coi_documents;
```

## Troubleshooting

### "DATABASE_URL must be set"
```bash
# Check .env file exists
cat .env | grep DATABASE_URL

# Make sure you're in the project root
cd "/Users/a21/Downloads/Roof HR"
```

### "Cannot connect to database"
```bash
# Check if database is running
# For Docker:
docker ps | grep postgres

# For local PostgreSQL:
pg_isready -h localhost -p 5434
```

### "Permission denied"
```bash
# Make shell script executable
chmod +x scripts/coi-cleanup.sh
```

## Need More Info?

- **Detailed docs**: `/server/scripts/README-COI-CLEANUP.md`
- **Full summary**: `/COI-CLEANUP-SUMMARY.md`
- **Scripts**: `/server/scripts/*.ts`

## Timeline

- **Fix sync service**: ✓ Already done (uses googleDriveId)
- **Create scripts**: ✓ Done (this task)
- **Run cleanup**: ← You are here
- **Verify results**: After cleanup

---

**Quick Start**: Just run `npm run coi:verify` and follow the recommendations!
