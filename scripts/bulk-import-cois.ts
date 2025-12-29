/**
 * One-time script to bulk import COI documents from Google Drive
 * Run with: npx tsx scripts/bulk-import-cois.ts
 */

import { config } from 'dotenv';
config();

import { google } from 'googleapis';
import { parseCOIDocument } from '../server/services/document-parser';
import { matchEmployeeFromName } from '../server/services/employee-matcher';
import { storage } from '../server/storage';
import { Readable } from 'stream';

const TARGET_FOLDER_ID = '1brvMwfBzzZ_Q6XXJlPJ8BpIUD1Edlf8u';

interface ImportResult {
  fileName: string;
  googleDriveId: string;
  status: 'imported' | 'skipped' | 'failed';
  employeeMatch?: string;
  error?: string;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function calculateCoiStatus(expirationDate: string): { status: string; alertFrequency: string } {
  const expDate = new Date(expirationDate);
  const today = new Date();
  const daysUntilExpiration = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExpiration <= 0) {
    return { status: 'EXPIRED', alertFrequency: 'DAILY' };
  } else if (daysUntilExpiration <= 7) {
    return { status: 'EXPIRING_SOON', alertFrequency: 'DAILY' };
  } else if (daysUntilExpiration <= 30) {
    return { status: 'EXPIRING_SOON', alertFrequency: 'WEEK_BEFORE' };
  } else if (daysUntilExpiration <= 60) {
    return { status: 'ACTIVE', alertFrequency: 'MONTH_BEFORE' };
  } else if (daysUntilExpiration <= 90) {
    return { status: 'ACTIVE', alertFrequency: 'THREE_MONTHS_BEFORE' };
  }
  return { status: 'ACTIVE', alertFrequency: 'NONE' };
}

async function main() {
  console.log('🚀 Starting Bulk COI Import from Google Drive');
  console.log(`📁 Target folder: ${TARGET_FOLDER_ID}`);
  console.log('');

  // Initialize Google Drive
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY environment variable not set');
    process.exit(1);
  }

  const credentials = JSON.parse(serviceAccountKey);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  console.log('✅ Google Drive initialized');

  // Get existing COIs to check for duplicates
  const existingCois = await storage.getAllCoiDocuments();
  const existingDriveIds = new Set(existingCois.filter(c => c.googleDriveId).map(c => c.googleDriveId));
  console.log(`📋 Found ${existingCois.length} existing COI documents (${existingDriveIds.size} from Drive)`);

  // List all PDF files in the target folder
  console.log('\n📂 Listing files in Google Drive folder...');
  const response = await drive.files.list({
    q: `'${TARGET_FOLDER_ID}' in parents and trashed=false and mimeType='application/pdf'`,
    pageSize: 100,
    fields: 'files(id, name, webViewLink, modifiedTime)',
    orderBy: 'name',
  });

  const files = response.data.files || [];
  console.log(`📄 Found ${files.length} PDF files`);

  if (files.length === 0) {
    console.log('No PDF files found in the folder.');
    process.exit(0);
  }

  const results: ImportResult[] = [];
  let imported = 0;
  let skipped = 0;
  let failed = 0;

  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n[${i + 1}/${files.length}] Processing: ${file.name}`);

    // Check for duplicate
    if (existingDriveIds.has(file.id)) {
      console.log(`  ⏭️  Skipping - already imported`);
      results.push({
        fileName: file.name || '',
        googleDriveId: file.id || '',
        status: 'skipped',
        error: 'Already imported',
      });
      skipped++;
      continue;
    }

    try {
      // Download file
      console.log(`  📥 Downloading...`);
      const downloadResponse = await drive.files.get(
        { fileId: file.id!, alt: 'media' },
        { responseType: 'stream' }
      );
      const fileBuffer = await streamToBuffer(downloadResponse.data as Readable);
      console.log(`  ✅ Downloaded ${(fileBuffer.length / 1024).toFixed(1)} KB`);

      // Parse COI
      console.log(`  🔍 Parsing COI document...`);
      const parsedData = await parseCOIDocument(fileBuffer);
      console.log(`  📋 Parsed: insured="${parsedData.insuredName || parsedData.rawInsuredName}", type=${parsedData.documentType}, exp=${parsedData.expirationDate}`);

      // Match to employee
      const nameToMatch = parsedData.insuredName || parsedData.rawInsuredName;
      let employeeId: string | null = null;
      let employeeMatchStr = '';
      let externalName: string | null = null;

      if (nameToMatch) {
        console.log(`  👤 Matching employee: "${nameToMatch}"`);
        const matchResult = await matchEmployeeFromName(nameToMatch);

        if (matchResult.matchedEmployee && matchResult.confidence >= 80) {
          employeeId = matchResult.employeeId;
          employeeMatchStr = `${matchResult.matchedEmployee.firstName} ${matchResult.matchedEmployee.lastName} (${matchResult.confidence}%)`;
          console.log(`  ✅ Matched: ${employeeMatchStr}`);
        } else if (matchResult.suggestedEmployees.length > 0) {
          // Use the best suggestion if confidence is reasonable
          const best = matchResult.suggestedEmployees[0];
          if (best.score >= 75) {
            employeeId = best.id;
            employeeMatchStr = `${best.firstName} ${best.lastName} (${best.score}%)`;
            console.log(`  🔶 Best match: ${employeeMatchStr}`);
          } else {
            // Treat as external
            externalName = nameToMatch;
            console.log(`  ❓ No strong match, using as external: ${externalName}`);
          }
        } else {
          externalName = nameToMatch;
          console.log(`  ❓ No match found, using as external: ${externalName}`);
        }
      } else {
        // No name found, extract from filename
        const fileBaseName = file.name?.replace(/\.pdf$/i, '') || '';
        externalName = fileBaseName;
        console.log(`  ⚠️ No insured name found, using filename: ${externalName}`);
      }

      // Determine COI type
      let coiType: 'WORKERS_COMP' | 'GENERAL_LIABILITY' = 'WORKERS_COMP';
      if (parsedData.documentType === 'GENERAL_LIABILITY') {
        coiType = 'GENERAL_LIABILITY';
      } else if (parsedData.documentType === 'UNKNOWN') {
        // Check filename for hints
        const lowerName = (file.name || '').toLowerCase();
        if (lowerName.includes('gl') || lowerName.includes('liability')) {
          coiType = 'GENERAL_LIABILITY';
        }
      }

      // Calculate status based on expiration
      const expirationDate = parsedData.expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const issueDate = parsedData.effectiveDate || new Date().toISOString().split('T')[0];
      const { status, alertFrequency } = calculateCoiStatus(expirationDate);

      // Create COI document
      console.log(`  💾 Creating COI record...`);
      const docData = {
        employeeId: employeeId,
        externalName: employeeId ? null : externalName,
        parsedInsuredName: nameToMatch || null,
        type: coiType,
        documentUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        googleDriveId: file.id!,
        issueDate,
        expirationDate,
        policyNumber: parsedData.policyNumber || null,
        insurerName: parsedData.insurerName || null,
        status,
        alertFrequency,
        uploadedBy: 'system',
        notes: `Bulk imported from Google Drive on ${new Date().toISOString().split('T')[0]}`,
      };

      const doc = await storage.createCoiDocument(docData);
      existingDriveIds.add(file.id!); // Prevent duplicates within batch

      console.log(`  ✅ Created COI: ${doc.id}`);
      results.push({
        fileName: file.name || '',
        googleDriveId: file.id || '',
        status: 'imported',
        employeeMatch: employeeMatchStr || externalName || 'Unknown',
      });
      imported++;

    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
      results.push({
        fileName: file.name || '',
        googleDriveId: file.id || '',
        status: 'failed',
        error: err.message,
      });
      failed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Imported: ${imported}`);
  console.log(`⏭️  Skipped:  ${skipped}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log('='.repeat(60));

  // Detailed results
  console.log('\n📋 DETAILED RESULTS:');
  console.log('-'.repeat(60));
  for (const result of results) {
    const statusIcon = result.status === 'imported' ? '✅' : result.status === 'skipped' ? '⏭️' : '❌';
    console.log(`${statusIcon} ${result.fileName}`);
    if (result.status === 'imported') {
      console.log(`   → ${result.employeeMatch}`);
    } else if (result.error) {
      console.log(`   → ${result.error}`);
    }
  }

  console.log('\n🎉 Bulk import complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
