import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';

// Retail contract template content
function createRetailTemplateContent(type: 'marketing' | 'sales') {
  const title = type === 'marketing'
    ? 'RETAIL MARKETING REPRESENTATIVE AGREEMENT'
    : 'RETAIL SALES CONSULTANT AGREEMENT';

  const role = type === 'marketing'
    ? 'Retail Marketing Representative'
    : 'Retail Sales Consultant';

  return `
<h2 style="text-align: center;">${title}</h2>

<p>This agreement ("Agreement") is made as of <strong>{{effectiveDate}}</strong> (the "Effective Date") between The Roof Docs LLC ("Company"), a Virginia limited liability company, and <strong>{{contractorName}}</strong> ("Contractor").</p>

<h3>RECITALS</h3>
<p>WHEREAS, Company is an exterior home remodeling contractor specializing in replacing and installing roofing, siding, gutters, trim and other exterior systems;</p>
<p>WHEREAS, Company desires to enlist Contractor as an independent contractor to provide retail ${type === 'marketing' ? 'marketing' : 'sales'} services;</p>
<p>WHEREAS, Contractor seeks to receive compensation as an independent contractor in exchange for ${type === 'marketing' ? 'marketing' : 'sales consulting'} services;</p>

<h3>1. ROLE AND SERVICES</h3>
<p>Contractor shall serve as a <strong>${role}</strong> and provide the following services:</p>
<ul>
  ${type === 'marketing' ? `
  <li>Conduct retail marketing campaigns and promotions</li>
  <li>Generate retail leads and customer interest</li>
  <li>Represent Company at retail events and locations</li>
  <li>Distribute marketing materials to potential customers</li>
  <li>Track and report marketing activities</li>
  ` : `
  <li>Provide retail sales consultations to customers</li>
  <li>Present product options and pricing</li>
  <li>Close retail sales agreements</li>
  <li>Manage customer relationships</li>
  <li>Process sales documentation</li>
  `}
</ul>

<h3>2. COMPENSATION</h3>
<p>Compensation shall be provided according to the Company's current retail ${type === 'marketing' ? 'marketing' : 'sales'} commission structure as outlined in any provided Commission Addendum.</p>

<h3>3. INDEPENDENT CONTRACTOR STATUS</h3>
<p>Contractor is an independent contractor and not an employee of Company. Contractor shall be responsible for all taxes and payments relating to Contractor's compensation.</p>

<h3>4. CONFIDENTIALITY</h3>
<p>Contractor agrees to maintain the confidentiality of all Confidential Information and not to disclose such information to any third parties without Company's prior written consent.</p>

<h3>5. TERM AND TERMINATION</h3>
<p>This Agreement shall commence on the Effective Date and continue until terminated by either party with written notice.</p>

<h3>SIGNATURES</h3>
<div style="margin-top: 40px;">
  <p><strong>COMPANY:</strong></p>
  <p>The Roof Docs LLC</p>
  <p>By: _______________________________</p>
  <p>Date: {{companySignDate}}</p>
</div>

<div style="margin-top: 40px;">
  <p><strong>CONTRACTOR:</strong></p>
  <p>By: _______________________________</p>
  <p>Name: {{signatureName}}</p>
  <p>Date: {{signatureDate}}</p>
</div>
`;
}

export async function addRetailTemplates() {
  try {
    // Template 1: Retail Marketing Representative
    const marketingTemplate = {
      id: uuidv4(),
      name: 'Retail Marketing Representative Agreement',
      type: 'RETAIL' as const,
      territory: null, // Applies to all territories
      content: createRetailTemplateContent('marketing'),
      fileUrl: '/attached_assets/contract_templates/retail_marketing_contractor_agreement.pdf',
      fileName: 'retail_marketing_contractor_agreement.pdf',
      variables: [
        'effectiveDate',
        'contractorName',
        'companySignDate',
        'signatureName',
        'signatureDate'
      ],
      isActive: true,
      createdBy: 'system'
    };

    // Template 2: Retail Sales Consultant
    const salesTemplate = {
      id: uuidv4(),
      name: 'Retail Sales Consultant Agreement',
      type: 'RETAIL' as const,
      territory: null, // Applies to all territories
      content: createRetailTemplateContent('sales'),
      fileUrl: '/attached_assets/contract_templates/retail_sales_contractor_agreement.pdf',
      fileName: 'retail_sales_contractor_agreement.pdf',
      variables: [
        'effectiveDate',
        'contractorName',
        'companySignDate',
        'signatureName',
        'signatureDate'
      ],
      isActive: true,
      createdBy: 'system'
    };

    // Check if templates already exist
    const existingTemplates = await storage.getAllContractTemplates();
    const marketingExists = existingTemplates.some(t =>
      t.name === marketingTemplate.name || t.fileName === marketingTemplate.fileName
    );
    const salesExists = existingTemplates.some(t =>
      t.name === salesTemplate.name || t.fileName === salesTemplate.fileName
    );

    const results = [];

    if (!marketingExists) {
      const created1 = await storage.createContractTemplate(marketingTemplate);
      console.log('Created Retail Marketing template:', created1.name);
      results.push(created1);
    } else {
      console.log('Retail Marketing template already exists');
    }

    if (!salesExists) {
      const created2 = await storage.createContractTemplate(salesTemplate);
      console.log('Created Retail Sales template:', created2.name);
      results.push(created2);
    } else {
      console.log('Retail Sales template already exists');
    }

    // Also update existing templates to use new PDF files
    console.log('\nUpdating existing territory templates...');

    // Update Richmond template
    const richmondTemplates = existingTemplates.filter(t =>
      t.territory === 'Richmond' || t.name?.toLowerCase().includes('richmond')
    );
    for (const template of richmondTemplates) {
      await storage.updateContractTemplate(template.id, {
        fileUrl: '/attached_assets/contract_templates/richmond_contractor_agreement.pdf',
        fileName: 'richmond_contractor_agreement.pdf'
      });
      console.log('Updated Richmond template:', template.name);
    }

    // Update DMV templates
    const dmvTemplates = existingTemplates.filter(t =>
      t.territory === 'DMV' || t.name?.toLowerCase().includes('dmv')
    );
    for (const template of dmvTemplates) {
      await storage.updateContractTemplate(template.id, {
        fileUrl: '/attached_assets/contract_templates/dmv_pa_contractor_agreement.pdf',
        fileName: 'dmv_pa_contractor_agreement.pdf'
      });
      console.log('Updated DMV template:', template.name);
    }

    // Update PA templates
    const paTemplates = existingTemplates.filter(t =>
      t.territory === 'PA' || t.name?.toLowerCase().includes('pa ') || t.name?.toLowerCase().includes('phi') || t.name?.toLowerCase().includes('pitt')
    );
    for (const template of paTemplates) {
      await storage.updateContractTemplate(template.id, {
        fileUrl: '/attached_assets/contract_templates/dmv_pa_contractor_agreement.pdf',
        fileName: 'dmv_pa_contractor_agreement.pdf'
      });
      console.log('Updated PA template:', template.name);
    }

    return {
      success: true,
      templatesCreated: results.length,
      templates: results
    };

  } catch (error) {
    console.error('Error adding retail templates:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Run if called directly
addRetailTemplates().then(result => {
  console.log('\nRetail templates addition result:', result);
  process.exit(result.success ? 0 : 1);
});
