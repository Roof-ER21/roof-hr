import 'dotenv/config';
import { db } from '../db';
import { coiDocuments } from '../../shared/schema';
import { sql } from 'drizzle-orm';

async function verifyCoiState() {
  console.log('='.repeat(80));
  console.log('COI DATABASE STATE VERIFICATION');
  console.log('='.repeat(80));
  console.log('\n');

  try {
    // 1. Total count
    console.log('[1/5] Total Document Count');
    console.log('-'.repeat(80));
    const allDocs = await db.select().from(coiDocuments);
    console.log(`Total COI documents: ${allDocs.length}`);
    console.log('');

    // 2. Check for duplicates
    console.log('[2/5] Duplicate Detection');
    console.log('-'.repeat(80));

    const groups = new Map<string, typeof allDocs>();
    for (const doc of allDocs) {
      const key = `${doc.employeeId}||${doc.documentUrl}||${doc.expirationDate}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(doc);
    }

    const duplicates = Array.from(groups.values()).filter(g => g.length > 1);
    const duplicateCount = duplicates.reduce((sum, g) => sum + (g.length - 1), 0);

    if (duplicates.length === 0) {
      console.log('✓ No duplicates found - database is clean!');
    } else {
      console.log(`✗ Found ${duplicates.length} groups with duplicates`);
      console.log(`  Total duplicate records: ${duplicateCount}`);
      console.log('  Run: npm run coi:cleanup');
    }
    console.log(`Unique document groups: ${groups.size}`);
    console.log('');

    // 3. GoogleDriveId population
    console.log('[3/5] Google Drive ID Population');
    console.log('-'.repeat(80));

    const withDriveId = allDocs.filter(d => d.googleDriveId);
    const withoutDriveId = allDocs.filter(d => !d.googleDriveId);
    const withNotes = withoutDriveId.filter(d => d.notes);

    const percentPopulated = ((withDriveId.length / allDocs.length) * 100).toFixed(1);

    console.log(`Documents with googleDriveId:    ${withDriveId.length} (${percentPopulated}%)`);
    console.log(`Documents without googleDriveId: ${withoutDriveId.length}`);
    console.log(`  (could be backfilled):         ${withNotes.length}`);

    if (withNotes.length > 0) {
      console.log('  Run cleanup script to backfill googleDriveId from notes');
    }
    console.log('');

    // 4. Document type distribution
    console.log('[4/5] Document Type Distribution');
    console.log('-'.repeat(80));

    const byType = new Map<string, number>();
    for (const doc of allDocs) {
      byType.set(doc.type, (byType.get(doc.type) || 0) + 1);
    }

    for (const [type, count] of byType) {
      console.log(`${type}: ${count}`);
    }
    console.log('');

    // 5. Status distribution
    console.log('[5/5] Document Status Distribution');
    console.log('-'.repeat(80));

    const byStatus = new Map<string, number>();
    for (const doc of allDocs) {
      byStatus.set(doc.status, (byStatus.get(doc.status) || 0) + 1);
    }

    for (const [status, count] of byStatus) {
      console.log(`${status}: ${count}`);
    }
    console.log('');

    // Summary
    console.log('='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    const health = {
      duplicates: duplicates.length === 0 ? '✓ CLEAN' : `✗ ${duplicateCount} TO REMOVE`,
      driveIds: percentPopulated === '100.0' ? '✓ COMPLETE' : `○ ${percentPopulated}% POPULATED`,
      total: `${allDocs.length} documents`,
      unique: `${groups.size} unique groups`,
    };

    console.log(`Total Documents:    ${health.total}`);
    console.log(`Unique Groups:      ${health.unique}`);
    console.log(`Duplicates:         ${health.duplicates}`);
    console.log(`Drive ID Status:    ${health.driveIds}`);
    console.log('');

    // Recommendations
    if (duplicates.length > 0 || withNotes.length > 0) {
      console.log('RECOMMENDATIONS:');
      console.log('-'.repeat(80));

      if (duplicates.length > 0) {
        console.log('1. Run analysis to review duplicates:');
        console.log('   npm run coi:analyze');
        console.log('');
        console.log('2. Then run cleanup to remove duplicates:');
        console.log('   npm run coi:cleanup');
        console.log('');
      }

      if (withNotes.length > 0 && duplicates.length === 0) {
        console.log('1. Run cleanup to backfill googleDriveId:');
        console.log('   npm run coi:cleanup');
        console.log('');
      }
    } else {
      console.log('✓ Database is in good state - no action needed!');
      console.log('');
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n✗ ERROR:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run verification
verifyCoiState();
