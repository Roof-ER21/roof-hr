import 'dotenv/config';
import { db } from '../db';
import { coiDocuments } from '../../shared/schema';

interface DuplicateGroup {
  key: string;
  docs: Array<typeof coiDocuments.$inferSelect>;
  employeeId: string | null;
  documentUrl: string;
  expirationDate: string;
}

async function analyzeDuplicateCOIs() {
  console.log('='.repeat(80));
  console.log('COI DUPLICATE ANALYSIS (DRY RUN - NO CHANGES MADE)');
  console.log('='.repeat(80));
  console.log('\n');

  try {
    // Fetch all COI documents
    console.log('Fetching all COI documents from database...');
    const allDocs = await db.select().from(coiDocuments);
    console.log(`✓ Total COI documents: ${allDocs.length}`);
    console.log('');

    // Analyze duplicates
    console.log('Analyzing duplicates by (employeeId + documentUrl + expirationDate)...');
    console.log('-'.repeat(80));

    // Group documents
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

    // Calculate total duplicates
    const totalDuplicates = duplicateGroups.reduce(
      (sum, group) => sum + (group.docs.length - 1),
      0
    );
    console.log(`✓ Total duplicate records: ${totalDuplicates}`);
    console.log('');

    // Statistics
    console.log('STATISTICS');
    console.log('-'.repeat(80));
    console.log(`Current total documents:     ${allDocs.length}`);
    console.log(`After cleanup would have:    ${allDocs.length - totalDuplicates}`);
    console.log(`Records to be deleted:       ${totalDuplicates}`);
    console.log(`Reduction:                   ${((totalDuplicates / allDocs.length) * 100).toFixed(1)}%`);
    console.log('');

    // Show all duplicate groups
    if (duplicateGroups.length > 0) {
      console.log('ALL DUPLICATE GROUPS:');
      console.log('-'.repeat(80));

      // Group by number of duplicates
      const byDupCount = new Map<number, DuplicateGroup[]>();
      for (const group of duplicateGroups) {
        const count = group.docs.length;
        if (!byDupCount.has(count)) {
          byDupCount.set(count, []);
        }
        byDupCount.get(count)!.push(group);
      }

      // Show statistics by duplicate count
      const sortedCounts = Array.from(byDupCount.keys()).sort((a, b) => b - a);
      for (const count of sortedCounts) {
        const groupsWithCount = byDupCount.get(count)!;
        console.log(`\n${groupsWithCount.length} groups with ${count} duplicates each:`);
        console.log(`  (Total of ${groupsWithCount.length * (count - 1)} records to delete)`);
      }

      console.log('\n');
      console.log('DETAILED DUPLICATE GROUPS (showing first 20):');
      console.log('-'.repeat(80));

      for (let i = 0; i < Math.min(20, duplicateGroups.length); i++) {
        const group = duplicateGroups[i];
        console.log(`\nGroup ${i + 1}/${duplicateGroups.length}:`);
        console.log(`  Employee ID: ${group.employeeId}`);
        console.log(`  Document Type: ${group.docs[0].type}`);
        console.log(`  Expiration: ${group.expirationDate}`);
        console.log(`  URL: ${group.documentUrl.substring(0, 60)}...`);
        console.log(`  Total duplicates: ${group.docs.length} records`);
        console.log(`  Records:`);

        group.docs.forEach((doc, idx) => {
          const action = idx === 0 ? '✓ KEEP' : '✗ DELETE';
          console.log(`    ${action} - Created: ${doc.createdAt} | ID: ${doc.id}`);
          if (doc.googleDriveId) {
            console.log(`           Drive ID: ${doc.googleDriveId}`);
          }
          if (doc.notes && doc.notes.includes('Drive ID')) {
            console.log(`           Notes: ${doc.notes.substring(0, 80)}...`);
          }
        });
      }

      if (duplicateGroups.length > 20) {
        console.log(`\n... and ${duplicateGroups.length - 20} more duplicate groups`);
      }
    }

    // Analyze googleDriveId backfill potential
    console.log('\n');
    console.log('GOOGLE DRIVE ID ANALYSIS');
    console.log('-'.repeat(80));

    const docsWithDriveId = allDocs.filter(d => d.googleDriveId);
    const docsWithoutDriveId = allDocs.filter(d => !d.googleDriveId);
    const docsWithNotesButNoDriveId = docsWithoutDriveId.filter(d => d.notes);

    console.log(`Documents with googleDriveId:        ${docsWithDriveId.length}`);
    console.log(`Documents without googleDriveId:     ${docsWithoutDriveId.length}`);
    console.log(`  (with notes field):                ${docsWithNotesButNoDriveId.length}`);
    console.log('');

    if (docsWithNotesButNoDriveId.length > 0) {
      console.log('Sample documents that could be backfilled (first 5):');
      for (let i = 0; i < Math.min(5, docsWithNotesButNoDriveId.length); i++) {
        const doc = docsWithNotesButNoDriveId[i];
        console.log(`  ID: ${doc.id}`);
        console.log(`  Notes: ${doc.notes?.substring(0, 100)}...`);
      }
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('ANALYSIS COMPLETE - NO CHANGES MADE');
    console.log('='.repeat(80));
    console.log('');
    console.log('To perform the actual cleanup, run:');
    console.log('  npx tsx server/scripts/cleanup-coi-duplicates.ts');
    console.log('');

  } catch (error) {
    console.error('\n✗ ERROR during analysis:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the analysis
analyzeDuplicateCOIs();
