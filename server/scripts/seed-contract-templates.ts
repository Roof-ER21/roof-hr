/**
 * Seed default contract templates
 * Run with: DATABASE_URL="postgresql://postgres:ufRefNkmaqNaBwNCLITXlWgBxDcZKyqd@hopper.proxy.rlwy.net:18847/railway" npx tsx server/scripts/seed-contract-templates.ts
 */

import { db } from '../db';
import { contractTemplates, territories } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const SYSTEM_USER_ID = 'system';

async function seedContractTemplates() {
  console.log('==============================================');
  console.log('  SEEDING CONTRACT TEMPLATES - ROOF HR');
  console.log('==============================================\n');

  try {
    // First, get all territories
    const allTerritories = await db.select().from(territories);
    console.log(`Found ${allTerritories.length} territories:`);
    allTerritories.forEach(t => console.log(`  - ${t.name}: ${t.id}`));

    // Find specific territories by name
    const dmvTerritory = allTerritories.find(t =>
      t.name?.toLowerCase().includes('dmv')
    );
    const richmondTerritory = allTerritories.find(t =>
      t.name?.toLowerCase().includes('richmond')
    );
    const paTerritory = allTerritories.find(t =>
      t.name?.toLowerCase().includes('pa')
    );

    console.log('\nMatched territories:');
    console.log(`  DMV: ${dmvTerritory?.id || 'NOT FOUND'}`);
    console.log(`  Richmond VA: ${richmondTerritory?.id || 'NOT FOUND'}`);
    console.log(`  PA: ${paTerritory?.id || 'NOT FOUND'}`);

    // Employment Agreement content template
    const employmentAgreementContent = `
EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is entered into as of {{startDate}} between The Roof Docs ("Company") and {{name}} ("Employee").

1. POSITION AND DUTIES
Employee is hired for the position of {{position}}. Employee shall report to {{manager}} and perform all duties associated with this role.

2. COMPENSATION
Employee shall receive a base salary of {{salary}} per year, paid in accordance with the Company's standard payroll practices.

3. BENEFITS
Employee shall be eligible for the Company's standard benefits package, including health insurance, PTO, and other benefits as outlined in the Employee Handbook.

4. AT-WILL EMPLOYMENT
Employment with the Company is "at-will" and may be terminated by either party at any time, with or without cause or notice.

5. CONFIDENTIALITY
Employee agrees to maintain the confidentiality of all proprietary information, trade secrets, and business operations of the Company.

6. NON-COMPETE
During employment and for a period of one (1) year following termination, Employee agrees not to engage in any business that directly competes with the Company within the territory.

7. ACKNOWLEDGMENT
By signing below, Employee acknowledges having read, understood, and agreed to all terms of this Agreement.

Company Representative: _____________________  Date: __________

Employee: {{name}}                            Date: {{signatureDate}}
Signature: _________________________________
`;

    // Equipment Agreement content template
    const equipmentAgreementContent = `
EQUIPMENT AGREEMENT

This Equipment Agreement ("Agreement") is entered into as of {{issueDate}} between The Roof Docs ("Company") and {{name}} ("Employee").

1. EQUIPMENT ISSUED
The Company hereby issues the following equipment to Employee for business use:

{{equipmentList}}

2. EMPLOYEE RESPONSIBILITIES
Employee agrees to:
- Use the equipment solely for Company business purposes
- Take reasonable care to protect the equipment from damage, loss, or theft
- Not modify, alter, or repair the equipment without prior authorization
- Report any damage, malfunction, or loss immediately to management
- Return all equipment in good working condition upon termination of employment

3. COMPANY PROPERTY
All equipment remains the sole property of the Company. Employee has no ownership rights to any equipment issued.

4. FINANCIAL RESPONSIBILITY
Employee agrees to be financially responsible for:
- Damage caused by negligence or misuse
- Loss or theft resulting from failure to take reasonable precautions
- Replacement cost if equipment is not returned upon termination

5. RETURN OF EQUIPMENT
Upon termination of employment (voluntary or involuntary), Employee must return all Company equipment within 24 hours.

6. ACKNOWLEDGMENT
By signing below, Employee acknowledges receipt of the above equipment and agrees to all terms of this Agreement.

Position: {{position}}
Department: {{department}}

Company Representative: _____________________  Date: __________

Employee: {{name}}                            Date: {{signatureDate}}
Signature: _________________________________
`;

    // Define templates to seed
    const templatesToSeed = [
      {
        id: randomUUID(),
        name: 'Employment Agreement - DMV Territory',
        type: 'EMPLOYMENT' as const,
        territory: dmvTerritory?.id || null,
        content: employmentAgreementContent,
        variables: ['{{name}}', '{{position}}', '{{startDate}}', '{{salary}}', '{{manager}}', '{{signatureDate}}'],
        isActive: true,
        createdBy: SYSTEM_USER_ID,
      },
      {
        id: randomUUID(),
        name: 'Employment Agreement - Richmond VA Territory',
        type: 'EMPLOYMENT' as const,
        territory: richmondTerritory?.id || null,
        content: employmentAgreementContent,
        variables: ['{{name}}', '{{position}}', '{{startDate}}', '{{salary}}', '{{manager}}', '{{signatureDate}}'],
        isActive: true,
        createdBy: SYSTEM_USER_ID,
      },
      {
        id: randomUUID(),
        name: 'Employment Agreement - PA Territory',
        type: 'EMPLOYMENT' as const,
        territory: paTerritory?.id || null,
        content: employmentAgreementContent,
        variables: ['{{name}}', '{{position}}', '{{startDate}}', '{{salary}}', '{{manager}}', '{{signatureDate}}'],
        isActive: true,
        createdBy: SYSTEM_USER_ID,
      },
      {
        id: randomUUID(),
        name: 'Equipment Agreement',
        type: 'OTHER' as const,
        territory: null, // Applies to all territories
        content: equipmentAgreementContent,
        variables: ['{{name}}', '{{position}}', '{{department}}', '{{issueDate}}', '{{equipmentList}}', '{{signatureDate}}'],
        isActive: true,
        createdBy: SYSTEM_USER_ID,
      },
    ];

    console.log('\n--- Seeding Templates ---\n');

    for (const template of templatesToSeed) {
      // Check if template with same name already exists
      const existing = await db
        .select()
        .from(contractTemplates)
        .where(eq(contractTemplates.name, template.name));

      if (existing.length > 0) {
        console.log(`SKIP: "${template.name}" already exists`);
        continue;
      }

      await db.insert(contractTemplates).values(template);
      console.log(`CREATED: "${template.name}" (Territory: ${template.territory || 'All'})`);
    }

    // Verify results
    const allTemplates = await db.select().from(contractTemplates);
    console.log('\n========================================');
    console.log('  SEEDING COMPLETE');
    console.log('========================================');
    console.log(`Total templates in database: ${allTemplates.length}`);
    allTemplates.forEach(t => {
      const territory = allTerritories.find(tr => tr.id === t.territory);
      console.log(`  - ${t.name} (${t.type}) - Territory: ${territory?.name || 'All'}`);
    });

    console.log('\n');
    return { success: true, count: allTemplates.length };

  } catch (error: any) {
    console.error('\nError seeding templates:', error.message);
    throw error;
  }
}

// Run
seedContractTemplates()
  .then(result => {
    console.log('Result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Failed:', error);
    process.exit(1);
  });
