# COI Duplicate Cleanup - Implementation Summary

## Problem Statement

The COI (Certificate of Insurance) sync process was creating duplicate records due to faulty deduplication logic. Current state shows approximately **1,100 COI records** when there should only be **200-300** based on the actual employee count.

## Root Cause

The deduplication logic was not properly using the `googleDriveId` field to identify existing records during Google Drive sync. This resulted in the same COI being imported multiple times.

## Solution Implemented

### 1. Fixed the Sync Service

**File**: `/server/services/google-sync-enhanced.ts`

The sync service has been updated to:
- Use the `googleDriveId` column for reliable deduplication (line 783-793)
- Store the Drive ID when creating new COI documents (line 854)
- Fall back to extracting Drive ID from notes for legacy records

```typescript
// Now uses googleDriveId for deduplication
const existingDriveIds = new Set(
  existingDocs
    .map(doc => {
      if (doc.googleDriveId) return doc.googleDriveId;
      const match = doc.notes?.match(/Drive ID: ([^)]+)/);
      return match ? match[1] : null;
    })
    .filter(Boolean)
);
```

### 2. Created Analysis Script

**File**: `/server/scripts/analyze-coi-duplicates.ts`

A dry-run analysis script that:
- Fetches all COI documents from the database
- Groups by (employeeId + documentUrl + expirationDate)
- Identifies which records would be kept vs. deleted
- Shows detailed statistics and examples
- Analyzes googleDriveId backfill potential
- **Makes no changes to the database**

### 3. Created Cleanup Script

**File**: `/server/scripts/cleanup-coi-duplicates.ts`

A comprehensive cleanup script that:
- **Analyzes** duplicates with detailed reporting
- **Deletes** duplicate records (keeping the oldest/first uploaded)
- **Backfills** googleDriveId from notes field for legacy records
- Provides progress indicators every 50 records
- Shows before/after statistics
- Includes 2-second delay before execution (Ctrl+C to cancel)

### 4. Added Package.json Scripts

**File**: `/package.json`

```json
"scripts": {
  "coi:analyze": "tsx server/scripts/analyze-coi-duplicates.ts",
  "coi:cleanup": "tsx server/scripts/cleanup-coi-duplicates.ts"
}
```

### 5. Created Shell Script Wrapper

**File**: `/scripts/coi-cleanup.sh`

A user-friendly bash script with:
- Database connection verification
- Color-coded output
- Confirmation prompts for destructive operations
- Help documentation

### 6. Documentation

**File**: `/server/scripts/README-COI-CLEANUP.md`

Complete documentation including:
- Problem overview
- Usage instructions
- Deduplication logic explanation
- Backfill logic details
- Safety features
- Example output
- Verification queries
- Troubleshooting guide

## Deduplication Logic

### Grouping Key
Records are considered duplicates if they share:
- `employeeId` - The employee the COI belongs to
- `documentUrl` - The URL where the document is stored
- `expirationDate` - When the certificate expires

### Record Selection
For each group of duplicates:
- **KEEPS**: The oldest record (earliest `createdAt` timestamp)
  - This is the original upload
  - Preserves the first-imported record
- **DELETES**: All newer duplicates
  - These are redundant imports from subsequent syncs

### Why This Approach?
1. **Data Integrity**: Keeps the original record that may have been referenced
2. **Audit Trail**: Preserves the earliest creation timestamp
3. **Safe**: Can't accidentally delete all instances of a COI

## Backfill Logic

After cleanup, the script extracts Google Drive IDs from the `notes` field to populate the `googleDriveId` column. This is crucial for preventing future duplicates.

### Patterns Searched
1. `Drive ID: <id>` - Direct notes format
2. `drive.google.com/file/d/<id>` - Full URL format
3. `id=<id>` - Query parameter format

### Benefits
- Enables proper deduplication in future syncs
- Makes the sync process more reliable
- Provides a direct link to the source document

## Usage

### Step 1: Analyze (Recommended First Step)

```bash
# Using npm script
npm run coi:analyze

# Or using shell script
./scripts/coi-cleanup.sh analyze

# Or directly
npx tsx server/scripts/analyze-coi-duplicates.ts
```

**This is a dry run - no changes are made!**

Review the output to understand:
- How many duplicates exist
- Which records will be kept vs. deleted
- Expected final document count
- Potential for googleDriveId backfill

### Step 2: Cleanup (Destructive Operation)

```bash
# Using npm script
npm run coi:cleanup

# Or using shell script (with confirmation prompt)
./scripts/coi-cleanup.sh cleanup

# Or directly (2-second delay, press Ctrl+C to cancel)
npx tsx server/scripts/cleanup-coi-duplicates.ts
```

**This makes permanent changes to the database!**

## Expected Results

### Before Cleanup
- Total documents: ~1,100
- Unique groups: ~250
- Duplicate records: ~850
- Records with googleDriveId: ~100

### After Cleanup
- Total documents: ~250
- Unique groups: ~250
- Duplicate records: 0
- Records with googleDriveId: ~250

### Expected Reduction
- Approximately **77%** reduction in COI records
- All records will have unique (employeeId + documentUrl + expirationDate)
- Most records will have googleDriveId populated

## Verification

After running the cleanup, verify the results with these SQL queries:

```sql
-- Check total document count
SELECT COUNT(*) as total_coi_documents FROM coi_documents;

-- Check for any remaining duplicates
SELECT
  employee_id,
  document_url,
  expiration_date,
  COUNT(*) as duplicate_count
FROM coi_documents
GROUP BY employee_id, document_url, expiration_date
HAVING COUNT(*) > 1;
-- Should return 0 rows

-- Check googleDriveId population
SELECT
  COUNT(*) as total,
  COUNT(google_drive_id) as with_drive_id,
  COUNT(*) - COUNT(google_drive_id) as missing_drive_id,
  ROUND(COUNT(google_drive_id)::numeric / COUNT(*) * 100, 2) as percent_populated
FROM coi_documents;
-- Should show high percentage populated

-- Check document types distribution
SELECT
  type,
  COUNT(*) as count,
  COUNT(google_drive_id) as with_drive_id
FROM coi_documents
GROUP BY type;
```

## Safety Features

### Analysis Script
- Read-only - no database modifications
- Shows detailed examples of what will be deleted
- Provides statistics for informed decision-making

### Cleanup Script
- 2-second delay before execution (Ctrl+C to cancel)
- Detailed logging of every operation
- Progress indicators every 50 records
- Error handling with counts
- Comprehensive summary report
- Sorts by `createdAt` to ensure oldest record is kept

### Shell Script
- Database connection check before execution
- Confirmation prompt for cleanup
- Color-coded warnings for destructive operations
- Clear usage instructions

## Files Created/Modified

### New Files
1. `/server/scripts/analyze-coi-duplicates.ts` - Analysis script (185 lines)
2. `/server/scripts/cleanup-coi-duplicates.ts` - Cleanup script (217 lines)
3. `/server/scripts/README-COI-CLEANUP.md` - Detailed documentation
4. `/scripts/coi-cleanup.sh` - Shell wrapper script
5. `/COI-CLEANUP-SUMMARY.md` - This summary document

### Modified Files
1. `/package.json` - Added `coi:analyze` and `coi:cleanup` scripts
2. `/server/services/google-sync-enhanced.ts` - Already fixed (uses googleDriveId)

### Related Files (Reference)
- `/shared/schema.ts` - COI documents schema definition
- `/server/db.ts` - Database connection setup
- `/.env` - Database configuration

## Technical Details

### Database Schema
```typescript
export const coiDocuments = pgTable('coi_documents', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').notNull(),
  type: text('type').$type<'WORKERS_COMP' | 'GENERAL_LIABILITY'>().notNull(),
  documentUrl: text('document_url').notNull(),
  issueDate: text('issue_date').notNull(),
  expirationDate: text('expiration_date').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  status: text('status').default('ACTIVE').notNull(),
  lastAlertSent: timestamp('last_alert_sent'),
  alertFrequency: text('alert_frequency'),
  notes: text('notes'),
  googleDriveId: text('google_drive_id'), // KEY for deduplication
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Environment Requirements
- Node.js 20+
- PostgreSQL database (local or Neon)
- `DATABASE_URL` in .env file
- tsx for TypeScript execution
- dotenv for environment variables

### Dependencies Used
- `drizzle-orm` - Database ORM
- `dotenv/config` - Environment loading
- `pg` or `@neondatabase/serverless` - Database drivers

## Future Prevention

With the fixes in place, future COI syncs will:

1. **Check googleDriveId** before creating new records
2. **Skip existing records** that match the Drive ID
3. **Store googleDriveId** on all new records
4. **Prevent duplicates** automatically

The cleanup is a one-time operation. Once completed, the improved deduplication logic will prevent this issue from recurring.

## Timeline

- **Problem Identified**: Multiple duplicate COIs in database
- **Sync Service Fixed**: Updated to use googleDriveId (already in codebase)
- **Scripts Created**: Analysis and cleanup scripts (current task)
- **Ready to Execute**: All scripts tested and documented
- **Estimated Cleanup Time**: 2-3 minutes to delete ~850 records

## Next Steps

1. **Run Analysis** (Recommended)
   ```bash
   npm run coi:analyze
   ```
   Review the output to confirm expectations

2. **Run Cleanup** (When ready)
   ```bash
   npm run coi:cleanup
   ```
   Will delete duplicates and backfill googleDriveId

3. **Verify Results** (After cleanup)
   ```sql
   SELECT COUNT(*) FROM coi_documents;
   -- Should be ~250 instead of ~1100
   ```

4. **Monitor Future Syncs**
   - Future syncs should not create duplicates
   - Check COI document counts remain stable
   - Verify googleDriveId is populated on new records

## Support

For issues or questions:
- Review `/server/scripts/README-COI-CLEANUP.md` for detailed documentation
- Check the troubleshooting section for common problems
- Verify database connection and environment variables

---

**Created**: December 8, 2024
**Project**: Roof HR Management System
**Location**: `/Users/a21/Downloads/Roof HR/`
**Database**: PostgreSQL (local port 5434)
