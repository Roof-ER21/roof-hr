# COI Duplicate Cleanup Scripts

## Overview

This directory contains scripts to analyze and clean up duplicate COI (Certificate of Insurance) documents in the database.

## Problem

The COI sync process was creating duplicate records because of faulty deduplication logic. There are approximately 1,100 COI records when there should only be 200-300.

## Solution

Two scripts are provided:

### 1. Analyze Script (DRY RUN)

**analyze-coi-duplicates.ts** - Analyzes duplicates without making any changes

```bash
npx tsx server/scripts/analyze-coi-duplicates.ts
```

This will:
- Count total COI documents
- Group by (employeeId + documentUrl + expirationDate)
- Show which records would be kept vs deleted
- Display statistics about the cleanup
- Analyze googleDriveId backfill potential

**Run this first to review what will be deleted!**

### 2. Cleanup Script (DESTRUCTIVE)

**cleanup-coi-duplicates.ts** - Performs the actual cleanup

```bash
npx tsx server/scripts/cleanup-coi-duplicates.ts
```

This will:
- Delete duplicate COI records (keeps the oldest/first uploaded)
- Backfill googleDriveId from notes field
- Report detailed progress and summary

**This script makes permanent changes!**

## Deduplication Logic

Records are grouped by:
- `employeeId` - The employee the COI belongs to
- `documentUrl` - The URL where the document is stored
- `expirationDate` - When the certificate expires

For each group with multiple records:
- **KEEPS**: The oldest record (earliest `createdAt`)
- **DELETES**: All newer duplicates

## Backfill Logic

After cleanup, the script extracts Google Drive IDs from the `notes` field and populates the `googleDriveId` column. This helps prevent future duplicates during sync.

Patterns searched:
- `Drive ID: <id>`
- URLs like `drive.google.com/file/d/<id>`
- Query params like `id=<id>`

## Prerequisites

- Database must be running (local PostgreSQL on port 5434)
- .env file must be present with DATABASE_URL
- Node.js and tsx installed

## Safety Features

- 2-second delay before starting cleanup (Ctrl+C to cancel)
- Detailed logging of all operations
- Progress indicators every 50 records
- Error handling with counts
- Before/after statistics

## Example Output

```
================================================================================
COI DUPLICATE CLEANUP SCRIPT
================================================================================

[1/4] Fetching all COI documents from database...
✓ Total COI documents: 1100

[2/4] Analyzing duplicates...
--------------------------------------------------------------------------------
✓ Unique document groups: 250
✓ Groups with duplicates: 180
✓ Total duplicate records to delete: 850

[3/4] Deleting duplicate records...
--------------------------------------------------------------------------------
  Progress: 50/850 deleted...
  Progress: 100/850 deleted...
  ...
✓ Successfully deleted 850 duplicate records

[4/4] Backfilling googleDriveId from notes field...
--------------------------------------------------------------------------------
✓ Successfully backfilled 200 googleDriveId fields

================================================================================
CLEANUP SUMMARY
================================================================================
Initial document count:      1100
Duplicates deleted:          850
Final document count:        250
GoogleDriveId backfilled:    200
Unique document groups:      250
================================================================================
```

## Verification

After running the cleanup, verify the results:

```sql
-- Count total COI documents
SELECT COUNT(*) FROM coi_documents;

-- Check for remaining duplicates
SELECT
  employee_id,
  document_url,
  expiration_date,
  COUNT(*) as count
FROM coi_documents
GROUP BY employee_id, document_url, expiration_date
HAVING COUNT(*) > 1;

-- Check googleDriveId population
SELECT
  COUNT(*) as total,
  COUNT(google_drive_id) as with_drive_id,
  COUNT(*) - COUNT(google_drive_id) as missing_drive_id
FROM coi_documents;
```

## Troubleshooting

### "DATABASE_URL must be set"
Make sure you're running from the project root and the .env file exists:
```bash
cd "/Users/a21/Downloads/Roof HR"
cat .env | grep DATABASE_URL
```

### Database connection refused
Start the local PostgreSQL database:
```bash
docker ps  # Check if container is running
# Or start your local PostgreSQL service
```

### Permission errors
The scripts need read/write access to the database. Check your database user permissions.

## Related Files

- `shared/schema.ts` - Database schema definition
- `server/db.ts` - Database connection setup
- `server/services/coi-sync-service.ts` - COI sync logic (now fixed)

## Future Prevention

The COI sync service has been updated to use `googleDriveId` for deduplication, which should prevent this issue going forward.
