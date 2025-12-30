/**
 * One-time script to bulk import COI documents via the production API
 * Run with: npx tsx scripts/api-bulk-import-cois.ts
 */

import { config } from 'dotenv';
config();

import { google } from 'googleapis';
import pdfParse from 'pdf-parse';
import { Readable } from 'stream';

const TARGET_FOLDER_ID = '1brvMwfBzzZ_Q6XXJlPJ8BpIUD1Edlf8u';
const PRODUCTION_API = 'https://roofhr.up.railway.app';
const AUTH_TOKEN = '488647289b280703f75265c48ec1c197c8cceca1de591f4ec010d259f8e07780';

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface COIParsedData {
  insuredName: string | null;
  rawInsuredName: string | null;
  policyNumber: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  insurerName: string | null;
  documentType: 'WORKERS_COMP' | 'GENERAL_LIABILITY' | 'AUTO' | 'UMBRELLA' | 'UNKNOWN';
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

// Simplified COI parser
async function parseCOIDocument(buffer: Buffer): Promise<COIParsedData> {
  const data = await pdfParse(buffer);
  const text = data.text;

  // Extract dates
  const datePairPattern = /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})/g;
  const dateMatch = datePairPattern.exec(text);
  const effectiveDate = dateMatch?.[1] || null;
  const expirationDate = dateMatch?.[2] || null;

  // Extract insured name
  let insuredName: string | null = null;
  let rawInsuredName: string | null = null;

  // Look for person name pattern after INSURED or email
  const emailMatch = text.match(/@[a-z0-9.-]+\.[a-z]{2,}/i);
  if (emailMatch && emailMatch.index) {
    const afterEmail = text.substring(emailMatch.index + emailMatch[0].length, emailMatch.index + 500);
    const namePattern = /([A-Z][a-z]+\s+[A-Z][a-z]+)/;
    const nameMatch = afterEmail.match(namePattern);
    if (nameMatch) {
      insuredName = nameMatch[1].trim();
      rawInsuredName = insuredName;
    }
  }

  // Try INSURED section
  if (!insuredName) {
    const insuredMatch = text.match(/INSURED[\s\n]+([A-Z][A-Za-z0-9\s\.\,\&\-\']+?)[\s\n]+\d{2,5}\s+[A-Z]/i);
    if (insuredMatch) {
      rawInsuredName = insuredMatch[1].trim().replace(/\s{2,}/g, ' ');
      // Check if it's a person name
      if (!/llc|inc|corp|ltd|roofing|construction/i.test(rawInsuredName)) {
        const words = rawInsuredName.split(' ');
        if (words.length >= 2 && words.length <= 4) {
          insuredName = rawInsuredName;
        }
      }
    }
  }

  // Detect document type
  const lowerText = text.toLowerCase();
  let documentType: COIParsedData['documentType'] = 'UNKNOWN';
  if (lowerText.includes('workers compensation') || lowerText.includes('workers comp')) {
    documentType = 'WORKERS_COMP';
  } else if (lowerText.includes('general liability') || lowerText.includes('cgl')) {
    documentType = 'GENERAL_LIABILITY';
  }

  // Extract policy number
  let policyNumber: string | null = null;
  const policyMatch = text.match(/policy\s*(?:number|no\.?|#)\s*:?\s*([A-Z0-9\-]+)/i);
  if (policyMatch) {
    policyNumber = policyMatch[1].trim();
  }

  return {
    insuredName,
    rawInsuredName,
    policyNumber,
    effectiveDate,
    expirationDate,
    insurerName: null,
    documentType
  };
}

// Simple name matching
function matchEmployee(name: string, employees: Employee[]): { employee: Employee | null; score: number } {
  if (!name) return { employee: null, score: 0 };

  const normalizedName = name.toLowerCase().trim();
  let bestMatch: Employee | null = null;
  let bestScore = 0;

  for (const emp of employees) {
    const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase().trim();
    const reversed = `${emp.lastName} ${emp.firstName}`.toLowerCase().trim();

    // Exact match
    if (normalizedName === fullName || normalizedName === reversed) {
      return { employee: emp, score: 100 };
    }

    // Calculate similarity
    const words1 = normalizedName.split(' ');
    const words2 = fullName.split(' ');
    let matchingWords = 0;
    for (const w1 of words1) {
      for (const w2 of words2) {
        if (w1 === w2 || (w1.length > 3 && w2.startsWith(w1)) || (w2.length > 3 && w1.startsWith(w2))) {
          matchingWords++;
        }
      }
    }
    const score = (matchingWords / Math.max(words1.length, words2.length)) * 100;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = emp;
    }
  }

  return { employee: bestScore >= 75 ? bestMatch : null, score: bestScore };
}

async function main() {
  console.log('🚀 Starting Bulk COI Import via Production API');
  console.log(`📁 Target folder: ${TARGET_FOLDER_ID}`);
  console.log(`🌐 API: ${PRODUCTION_API}`);
  console.log('');

  // Initialize Google Drive
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_KEY not set');
    process.exit(1);
  }

  const credentials = JSON.parse(serviceAccountKey);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  console.log('✅ Google Drive initialized');

  // Get existing COIs from API
  console.log('📋 Fetching existing COI documents...');
  const existingRes = await fetch(`${PRODUCTION_API}/api/coi-documents`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
  });
  const existingCois = await existingRes.json() as any[];
  const existingDriveIds = new Set(existingCois.filter((c: any) => c.googleDriveId).map((c: any) => c.googleDriveId));
  console.log(`   Found ${existingCois.length} existing COIs (${existingDriveIds.size} from Drive)`);

  // Get employees from API
  console.log('👥 Fetching employees...');
  const employeesRes = await fetch(`${PRODUCTION_API}/api/users`, {
    headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
  });
  const employees = await employeesRes.json() as Employee[];
  console.log(`   Found ${employees.length} employees`);

  // List ALL PDFs in folder (with pagination)
  console.log('\n📂 Listing files in Google Drive folder...');
  const files: any[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${TARGET_FOLDER_ID}' in parents and trashed=false and mimeType='application/pdf'`,
      pageSize: 1000,
      pageToken,
      fields: 'nextPageToken, files(id, name, webViewLink)',
      orderBy: 'name',
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken;
  } while (pageToken);
  console.log(`📄 Found ${files.length} PDF files`);

  if (files.length === 0) {
    console.log('No files to import.');
    process.exit(0);
  }

  let imported = 0, skipped = 0, failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`\n[${i + 1}/${files.length}] ${file.name}`);

    if (existingDriveIds.has(file.id)) {
      console.log('  ⏭️ Already imported');
      skipped++;
      continue;
    }

    try {
      // Download
      const downloadRes = await drive.files.get(
        { fileId: file.id!, alt: 'media' },
        { responseType: 'stream' }
      );
      const buffer = await streamToBuffer(downloadRes.data as Readable);
      console.log(`  📥 Downloaded ${(buffer.length / 1024).toFixed(1)} KB`);

      // Parse
      const parsed = await parseCOIDocument(buffer);
      console.log(`  📋 Parsed: "${parsed.insuredName || parsed.rawInsuredName || 'Unknown'}", type=${parsed.documentType}, exp=${parsed.expirationDate}`);

      // Match employee
      const nameToMatch = parsed.insuredName || parsed.rawInsuredName;
      const { employee, score } = nameToMatch ? matchEmployee(nameToMatch, employees) : { employee: null, score: 0 };

      let employeeId: string | undefined;
      let externalName: string | undefined;

      if (employee && score >= 75) {
        employeeId = employee.id;
        console.log(`  ✅ Matched: ${employee.firstName} ${employee.lastName} (${score.toFixed(0)}%)`);
      } else {
        externalName = nameToMatch || file.name?.replace(/\.pdf$/i, '') || 'Unknown';
        console.log(`  📝 External: ${externalName}`);
      }

      // Create COI via API
      const coiType = parsed.documentType === 'GENERAL_LIABILITY' ? 'GENERAL_LIABILITY' : 'WORKERS_COMP';
      const today = new Date().toISOString().split('T')[0];
      const expDate = parsed.expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const issDate = parsed.effectiveDate || today;

      // Calculate status
      const expDateObj = new Date(expDate);
      const daysUntil = Math.ceil((expDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      let status = 'ACTIVE';
      if (daysUntil <= 0) status = 'EXPIRED';
      else if (daysUntil <= 30) status = 'EXPIRING_SOON';

      const createRes = await fetch(`${PRODUCTION_API}/api/coi-documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employeeId: employeeId || null,
          externalName: employeeId ? null : externalName,
          parsedInsuredName: nameToMatch || null,
          type: coiType,
          documentUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          googleDriveId: file.id,
          issueDate: issDate,
          expirationDate: expDate,
          policyNumber: parsed.policyNumber || null,
          insurerName: parsed.insurerName || null,
          status,
          alertFrequency: status === 'EXPIRED' ? 'DAILY' : status === 'EXPIRING_SOON' ? 'WEEK_BEFORE' : 'NONE',
          notes: `Bulk imported on ${today}`
        })
      });

      if (createRes.ok) {
        const doc = await createRes.json() as { id: string };
        console.log(`  ✅ Created: ${doc.id}`);
        existingDriveIds.add(file.id!);
        imported++;
      } else {
        const err = await createRes.text();
        throw new Error(`API error: ${createRes.status} - ${err}`);
      }

    } catch (err: any) {
      console.error(`  ❌ Error: ${err.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Imported: ${imported}`);
  console.log(`⏭️ Skipped:  ${skipped}`);
  console.log(`❌ Failed:   ${failed}`);
  console.log('='.repeat(50));
  console.log('\n🎉 Done!');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
