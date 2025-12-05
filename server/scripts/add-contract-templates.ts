import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';

// Function to extract basic contract template from PDF content
function createContractTemplateContent() {
  // Richmond Roof Docs Contract with Commission Addendum - Template 1
  const richmondContractTemplate = `
<h2 style="text-align: center;">INDEPENDENT CONTRACTOR AGREEMENT</h2>

<p>This agreement ("Agreement") is made as of <strong>{{date}}</strong> (the "Effective Date") between The Roof Docs LLC ("Company"), a Virginia limited liability company, and <strong>{{contractorName}}</strong> ("Contractor"). Collectively, Company and Contractor are referred to herein as the "Parties," and may be referred to singly as a "Party."</p>

<h3>RECITALS</h3>
<p>WHEREAS, Company is an exterior home remodeling contractor specializing in replacing and installing roofing, siding, gutters, trim and other exterior systems;</p>
<p>WHEREAS, Company desires to enlist Contractor as an independent contractor to provide certain services to the Company and its clients;</p>
<p>WHEREAS, Contractor seeks to receive compensation as an independent contractor in exchange for the provision of certain services, which Contractor will deliver in his/her/its discretion;</p>

<p>NOW THEREFORE, for good and valuable consideration, the receipt and sufficiency of which is hereby acknowledged, the Parties agree as follows:</p>

<h3>1. DEFINITIONS</h3>
<p>Throughout this Agreement, unless otherwise specifically indicated:</p>
<ul>
  <li><strong>"Confidential Information"</strong> means nonpublic information learned by Contractor during the Term and maintained as confidential by Company.</li>
  <li><strong>"Client"</strong> refers to any person or entity that retained the services of Company during the Term.</li>
  <li><strong>"Territory"</strong> refers to the geographic area in which Contractor will provide Services: <strong>{{territory}}</strong></li>
  <li><strong>"Services"</strong> refers to the services and duties of Contractor described in this Agreement.</li>
</ul>

<h3>2. SERVICES</h3>
<p>During the Term, Contractor shall provide the following Services to Company:</p>
<ul>
  <li>Canvass the Territory for Potential Clients</li>
  <li>Perform storm-damage inspections of Client and Potential Client properties</li>
  <li>Provide appropriate assistance to Clients in completing the Company's "Insurance Claim Agreement"</li>
  <li>Inspect Clients' properties with insurance claim adjusters as requested</li>
  <li>Manage job flow and data in the Company's CRM system</li>
</ul>

<h3>3. COMPENSATION</h3>
<p><strong>Commission Structure:</strong> Contractor shall receive a Commission of <strong>{{commissionRate}}%</strong> based on the total payments actually received by Company pursuant to Client-executed Custom Home Restoration Agreements that Contractor procures.</p>
<p><strong>Payment Timing:</strong> Company shall submit earned Commissions within two (2) weeks of Company clearing good payment of the remaining payments owed under each qualifying Custom Home Restoration Agreement.</p>

<h3>4. INDEPENDENT CONTRACTOR STATUS</h3>
<p>Contractor is an independent contractor and not an employee of Company. Contractor shall be responsible for all taxes and payments relating to Contractor's compensation.</p>

<h3>5. CONFIDENTIALITY</h3>
<p>Contractor agrees to maintain the confidentiality of all Confidential Information and not to disclose such information to any third parties without Company's prior written consent.</p>

<h3>6. TERM AND TERMINATION</h3>
<p>This Agreement shall commence on the Effective Date and continue until terminated by either party with written notice.</p>

<h3>SIGNATURES</h3>
<div style="margin-top: 40px;">
  <p><strong>COMPANY:</strong></p>
  <p>The Roof Docs LLC</p>
  <p>By: _______________________________</p>
  <p>Name: {{companyRepresentative}}</p>
  <p>Title: {{companyRepTitle}}</p>
  <p>Date: {{companySignDate}}</p>
</div>

<div style="margin-top: 40px;">
  <p><strong>CONTRACTOR:</strong></p>
  <p>By: _______________________________</p>
  <p>Name: {{contractorName}}</p>
  <p>Date: {{contractorSignDate}}</p>
</div>
`;

  // Roof Doc Contractor Agreement DMV - Template 2
  const dmvContractTemplate = `
<h2 style="text-align: center;">INDEPENDENT CONTRACTOR AGREEMENT - DMV REGION</h2>

<p>This agreement ("Agreement") is made as of <strong>{{date}}</strong> (the "Effective Date") between The Roof Docs LLC ("Company"), a Virginia limited liability company, and <strong>{{contractorName}}</strong> ("Contractor").</p>

<h3>TERRITORY DEFINITION</h3>
<p>The Territory for this Agreement consists of the DMV area bordered on:</p>
<ul>
  <li>East: Chesapeake Bay</li>
  <li>South: Fredericksburg, Virginia</li>
  <li>West: Winchester, Virginia</li>
  <li>North: Columbia, Maryland</li>
</ul>

<h3>SERVICES PROVIDED</h3>
<p>Contractor shall provide the following Services pursuant to Contractor's own schedule and using Contractor's own transportation:</p>
<ul>
  <li>Canvass the Territory for Potential Clients</li>
  <li>Perform storm-damage inspections</li>
  <li>Assist Clients with Insurance Claim Agreements</li>
  <li>Inspect properties with insurance adjusters</li>
  <li>Manage job flow in CRM system</li>
</ul>

<h3>COMPENSATION STRUCTURE</h3>
<p><strong>Base Commission:</strong> <strong>16%</strong> of payments actually received by Company</p>
<p>Commission is calculated based on the total payments actually received by Company pursuant to Client-executed Custom Home Restoration Agreements procured by Contractor.</p>

<h3>CONTRACTOR DISCRETION</h3>
<p>Company will rely on Contractor to bring to bear his/her/its training, licensure, experience, and professional discretion in providing Services. Contractor will act in a competent and professional manner in performing the Services and will make all decisions using his/her/its best judgment.</p>

<h3>NON-COMPETITION COVENANT</h3>
<p>During the Term and for twelve (12) months following termination, Contractor agrees not to engage in any business that competes with Company within the Territory.</p>

<h3>CONFIDENTIALITY AND INTELLECTUAL PROPERTY</h3>
<p>All Confidential Information and Work created during the Term shall remain the property of Company. Contractor agrees to maintain strict confidentiality of all Company information.</p>

<h3>INDEPENDENT CONTRACTOR ACKNOWLEDGMENT</h3>
<p>Contractor acknowledges that:</p>
<ul>
  <li>Contractor is an independent contractor, not an employee</li>
  <li>Contractor is responsible for all taxes and payments</li>
  <li>Company will not withhold any taxes from compensation</li>
  <li>Contractor will use own tools and transportation</li>
</ul>

<h3>SIGNATURES</h3>
<div style="margin-top: 40px;">
  <p><strong>THE ROOF DOCS LLC</strong></p>
  <p>Signature: _______________________________</p>
  <p>Name: {{companyRepresentative}}</p>
  <p>Title: {{companyRepTitle}}</p>
  <p>Date: {{companySignDate}}</p>
</div>

<div style="margin-top: 40px;">
  <p><strong>CONTRACTOR</strong></p>
  <p>Signature: _______________________________</p>
  <p>Name: {{contractorName}}</p>
  <p>Date: {{contractorSignDate}}</p>
</div>
`;

  return {
    richmondContractTemplate,
    dmvContractTemplate
  };
}

export async function addContractTemplates() {
  try {
    const { richmondContractTemplate, dmvContractTemplate } = createContractTemplateContent();
    
    // Template 1: Richmond Roof Docs Contract with Commission Addendum
    const template1 = {
      id: uuidv4(),
      name: 'Richmond Roof Docs Contractor Agreement with Commission',
      type: 'CONTRACTOR' as const,
      territory: 'Richmond',
      content: richmondContractTemplate,
      fileUrl: '/attached_assets/Richmond_Roof_Docs_Contract_with_Commission_Addendum_1756309304136.pdf',
      fileName: 'Richmond_Roof_Docs_Contract_with_Commission_Addendum.pdf',
      variables: [
        '{{date}}',
        '{{contractorName}}',
        '{{territory}}',
        '{{commissionRate}}',
        '{{companyRepresentative}}',
        '{{companyRepTitle}}',
        '{{companySignDate}}',
        '{{contractorSignDate}}'
      ],
      isActive: true,
      createdBy: 'system'
    };

    // Template 2: Roof Doc Contractor Agreement DMV
    const template2 = {
      id: uuidv4(),
      name: 'Roof Doc Contractor Agreement - DMV Region',
      type: 'CONTRACTOR' as const,
      territory: 'DMV',
      content: dmvContractTemplate,
      fileUrl: '/attached_assets/Roof Doc Contractor Agreement  DMV (1)_1756309327179.pdf',
      fileName: 'Roof_Doc_Contractor_Agreement_DMV.pdf',
      variables: [
        '{{date}}',
        '{{contractorName}}',
        '{{companyRepresentative}}',
        '{{companyRepTitle}}',
        '{{companySignDate}}',
        '{{contractorSignDate}}'
      ],
      isActive: true,
      createdBy: 'system'
    };

    // Check if templates already exist
    const existingTemplates = await storage.getAllContractTemplates();
    const template1Exists = existingTemplates.some(t => 
      t.name === template1.name || t.fileName === template1.fileName
    );
    const template2Exists = existingTemplates.some(t => 
      t.name === template2.name || t.fileName === template2.fileName
    );

    const results = [];

    if (!template1Exists) {
      const created1 = await storage.createContractTemplate(template1);
      console.log('Created template 1:', created1.name);
      results.push(created1);
    } else {
      console.log('Template 1 already exists:', template1.name);
    }

    if (!template2Exists) {
      const created2 = await storage.createContractTemplate(template2);
      console.log('Created template 2:', created2.name);
      results.push(created2);
    } else {
      console.log('Template 2 already exists:', template2.name);
    }

    return {
      success: true,
      templatesCreated: results.length,
      templates: results
    };

  } catch (error) {
    console.error('Error adding contract templates:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Run if called directly
addContractTemplates().then(result => {
  console.log('Contract templates addition result:', result);
  process.exit(result.success ? 0 : 1);
});