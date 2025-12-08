import 'dotenv/config';
import { db } from '../db';
import { coiDocuments } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface DuplicateGroup {
  key: string;
  docs: Array<typeof coiDocuments.$inferSelect>;
  employeeId: string | null;
  documentUrl: string;
  expirationDate: string;
}

async function cleanupDuplicateCOIs() {
  console.log('='.repeat(80));
  console.log('COI DUPLICATE CLEANUP SCRIPT');
  console.log('='.repeat(80));
  console.log('\n');

  try {
    // Step 1: Fetch all COI documents
    console.log('[1/4] Fetching all COI documents from database...');
    const allDocs = await db.select().from(coiDocuments);
    console.log(`✓ Total COI documents: ${allDocs.length}`);
    console.log('');

    // Step 2: Analyze duplicates
    console.log('[2/4] Analyzing duplicates...');
    console.log('-'.repeat(80));

    // Group documents by (employeeId + documentUrl + expirationDate)
    // This is the key combination that should be unique
    const groups = new Map<string, DuplicateGroup>();

    for (const doc of allDocs) {
      const key = `${doc.employeeId}||${doc.documentUrl}||${doc.expirationDate}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          docs: [],
          employeeId: doc.employeeId,
          documentUrl: doc.documentUrl,
          expirationDate: doc.expirationDate,
        });
      }
      groups.get(key)!.docs.push(doc);
    }

    // Find groups with duplicates
    const duplicateGroups: DuplicateGroup[] = [];
    for (const group of groups.values()) {
      if (group.docs.length > 1) {
        // Sort by createdAt to identify the original (oldest)
        group.docs.sort((a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        duplicateGroups.push(group);
      }
    }

    console.log(`✓ Unique document groups: ${groups.size}`);
    console.log(`✓ Groups with duplicates: ${duplicateGroups.length}`);

    // Calculate total duplicates to delete
    const totalDuplicates = duplicateGroups.reduce(
      (sum, group) => sum + (group.docs.length - 1),
      0
    );
    console.log(`✓ Total duplicate records to delete: ${totalDuplicates}`);
    console.log('');

    // Show some examples of duplicates
    if (duplicateGroups.length > 0) {
      console.log('Example duplicate groups (showing first 5):');
      console.log('-'.repeat(80));

      for (let i = 0; i < Math.min(5, duplicateGroups.length); i++) {
        const group = duplicateGroups[i];
        console.log(`\nGroup ${i + 1}: Employee ${group.employeeId}`);
        console.log(`  URL: ${group.documentUrl.substring(0, 50)}...`);
        console.log(`  Expiration: ${group.expirationDate}`);
        console.log(`  Duplicate count: ${group.docs.length} records`);

        group.docs.forEach((doc, idx) => {
          console.log(`    ${idx === 0 ? '✓ KEEP' : '✗ DELETE'} - ID: ${doc.id} | Created: ${doc.createdAt} | Drive ID: ${doc.googleDriveId || 'none'}`);
        });
      }

      if (duplicateGroups.length > 5) {
        console.log(`\n... and ${duplicateGroups.length - 5} more duplicate groups`);
      }
      console.log('');
    }

    // Step 3: Delete duplicates
    if (totalDuplicates === 0) {
      console.log('[3/4] No duplicates found - nothing to delete!');
      console.log('');
    } else {
      console.log('[3/4] Deleting duplicate records...');
      console.log('-'.repeat(80));
      console.log(`Deleting ${totalDuplicates} duplicate records (keeping oldest of each group)...`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const group of duplicateGroups) {
        // Skip the first doc (oldest), delete the rest
        for (let i = 1; i < group.docs.length; i++) {
          try {
            const docToDelete = group.docs[i];
            await db.delete(coiDocuments).where(eq(coiDocuments.id, docToDelete.id));
            deletedCount++;

            if (deletedCount % 50 === 0) {
              console.log(`  Progress: ${deletedCount}/${totalDuplicates} deleted...`);
            }
          } catch (error) {
            errorCount++;
            console.error(`  ✗ Error deleting document ${group.docs[i].id}:`, error);
          }
        }
      }

      console.log(`✓ Successfully deleted ${deletedCount} duplicate records`);
      if (errorCount > 0) {
        console.log(`✗ Failed to delete ${errorCount} records (see errors above)`);
      }
      console.log('');
    }

    // Step 4: Backfill googleDriveId from notes
    console.log('[4/4] Backfilling googleDriveId from notes field...');
    console.log('-'.repeat(80));

    // Fetch remaining documents
    const remainingDocs = await db.select().from(coiDocuments);
    console.log(`✓ Remaining COI documents: ${remainingDocs.length}`);

    // Find docs with notes but no googleDriveId
    let backfilledCount = 0;
    let backfillErrorCount = 0;

    for (const doc of remainingDocs) {
      if (!doc.googleDriveId && doc.notes) {
        // Try to extract Drive ID from notes
        // Pattern: "Drive ID: <id>" or similar
        const patterns = [
          /Drive ID:\s*([^\s),]+)/i,
          /drive\.google\.com\/file\/d\/([^\/\s?]+)/i,
          /id=([^\s&]+)/i,
        ];

        let extractedId: string | null = null;

        for (const pattern of patterns) {
          const match = doc.notes.match(pattern);
          if (match && match[1]) {
            extractedId = match[1].trim();
            break;
          }
        }

        if (extractedId) {
          try {
            await db
              .update(coiDocuments)
              .set({ googleDriveId: extractedId })
              .where(eq(coiDocuments.id, doc.id));
            backfilledCount++;

            if (backfilledCount % 50 === 0) {
              console.log(`  Progress: ${backfilledCount} Drive IDs backfilled...`);
            }
          } catch (error) {
            backfillErrorCount++;
            console.error(`  ✗ Error backfilling document ${doc.id}:`, error);
          }
        }
      }
    }

    console.log(`✓ Successfully backfilled ${backfilledCount} googleDriveId fields`);
    if (backfillErrorCount > 0) {
      console.log(`✗ Failed to backfill ${backfillErrorCount} records`);
    }
    console.log('');

    // Final summary
    console.log('='.repeat(80));
    console.log('CLEANUP SUMMARY');
    console.log('='.repeat(80));
    console.log(`Initial document count:      ${allDocs.length}`);
    console.log(`Duplicates deleted:          ${totalDuplicates}`);
    console.log(`Final document count:        ${remainingDocs.length}`);
    console.log(`GoogleDriveId backfilled:    ${backfilledCount}`);
    console.log(`Unique document groups:      ${groups.size}`);
    console.log('');
    console.log('✓ Cleanup completed successfully!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n✗ FATAL ERROR during cleanup:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the cleanup
console.log('Starting in 2 seconds... (Press Ctrl+C to cancel)');
setTimeout(() => {
  cleanupDuplicateCOIs();
}, 2000);
