/**
 * Refresh contract templates for Richmond/DMV/PA and remove old templates.
 *
 * Run with:
 * DATABASE_URL="postgresql://postgres:...@hopper.proxy.rlwy.net:18847/railway" \
 *   npx tsx server/scripts/refresh-contract-templates.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { db } from '../db';
import { contractTemplates, territories } from '@shared/schema';

const DOWNLOADS_DIR = '/Users/a21/Downloads';
const TEMPLATE_DIR = path.resolve(process.cwd(), 'attached_assets', 'contract_templates');

const SOURCE_TEMPLATES = [
  {
    name: 'Contractor Agreement - Richmond',
    sourceFile: 'Richmond_Roof_Docs_Contract_with_Commission_Addendum.pdf',
    fileName: 'richmond_contract_with_commission_addendum.pdf',
    territoryMatch: 'richmond',
  },
  {
    name: 'Contractor Agreement - DMV',
    sourceFile: 'Roof Docs Contract - Combined with Commission Addendum.pdf',
    fileName: 'dmv_contract_with_commission_addendum.pdf',
    territoryMatch: 'dmv',
  },
  {
    name: 'Contractor Agreement - PA',
    sourceFile: 'Roof Docs Contract - Combined with Commission Addendum.pdf',
    fileName: 'pa_contract_with_commission_addendum.pdf',
    territoryMatch: 'pa',
  },
];

const TEMPLATE_VARIABLES = [
  '{{contractorName}}',
  '{{effectiveDate}}',
  '{{signatureName}}',
  '{{signatureDate}}',
];

async function refreshTemplates() {
  console.log('==============================================');
  console.log('Refreshing contract templates (Richmond/DMV/PA)');
  console.log('==============================================');

  await fs.mkdir(TEMPLATE_DIR, { recursive: true });

  const existingFiles = await fs.readdir(TEMPLATE_DIR);
  for (const file of existingFiles) {
    if (file.toLowerCase().endsWith('.pdf')) {
      await fs.unlink(path.join(TEMPLATE_DIR, file));
      console.log(`Deleted old template file: ${file}`);
    }
  }

  for (const template of SOURCE_TEMPLATES) {
    const sourcePath = path.join(DOWNLOADS_DIR, template.sourceFile);
    const destPath = path.join(TEMPLATE_DIR, template.fileName);
    await fs.copyFile(sourcePath, destPath);
    console.log(`Copied ${template.sourceFile} -> ${template.fileName}`);
  }

  const allTerritories = await db.select().from(territories);
  const resolveTerritory = (match: string) => {
    const territory = allTerritories.find((t) =>
      (t.name || '').toLowerCase().includes(match)
    );
    return territory?.id || null;
  };

  await db.delete(contractTemplates);
  console.log('Cleared contract_templates table.');

  for (const template of SOURCE_TEMPLATES) {
    const territoryId = resolveTerritory(template.territoryMatch);
    await db.insert(contractTemplates).values({
      id: randomUUID(),
      name: template.name,
      type: 'CONTRACTOR',
      territory: territoryId,
      content: `PDF Template: ${template.name}`,
      fileUrl: `/contract-templates/${template.fileName}`,
      fileName: template.fileName,
      variables: TEMPLATE_VARIABLES,
      isActive: true,
      createdBy: 'system',
    });
    console.log(`Inserted template: ${template.name} (${territoryId || 'All'})`);
  }

  console.log('Template refresh complete.');
}

refreshTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to refresh templates:', error);
    process.exit(1);
  });
