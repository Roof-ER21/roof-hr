/**
 * Send a test offer letter with contract PDF attachments.
 *
 * Run with:
 * DATABASE_URL="postgresql://postgres:...@hopper.proxy.rlwy.net:18847/railway" \
 *   npx tsx server/scripts/send-contract-template-test.ts
 */

const APP_URL = process.env.APP_URL || 'https://roofhr.up.railway.app';

const RECIPIENT = process.env.TEST_CONTRACT_TO || 'ahmed.mahmoud@theroofdocs.com';
const CC_RECIPIENTS = process.env.TEST_CONTRACT_CC
  ? process.env.TEST_CONTRACT_CC.split(',').map((email) => email.trim()).filter(Boolean)
  : ['careers@theroofdocs.com'];

const templates = [
  {
    label: 'Richmond',
    fileName: 'richmond_contract_with_commission_addendum.pdf',
  },
  {
    label: 'DMV',
    fileName: 'dmv_contract_with_commission_addendum.pdf',
  },
  {
    label: 'PA',
    fileName: 'pa_contract_with_commission_addendum.pdf',
  },
];

async function sendTestEmail() {
  const today = new Date().toLocaleDateString();

  const body = `
Hello,

Attached are the three contractor agreement PDFs (Richmond, DMV, PA) generated from the new templates.
These are pre-filled with the top fields (Effective Date + Contractor Name) and include a signature box.

Offer Letter (Test):
We are pleased to offer you the position of Contractor with Roof Docs. Your start date is ${today}.
Please review the attached agreements and let us know if you have any questions.

Best regards,
Roof HR
`;

  const response = await fetch(`${APP_URL}/api/emails/send-contract-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: RECIPIENT,
      cc: CC_RECIPIENTS,
      subject: 'Test Offer Letter + Contractor Agreements (Richmond/DMV/PA)',
      body,
      contractorName: 'Test Candidate',
      effectiveDate: today,
      templates
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send test email: ${response.status} ${errorText}`);
  }

  console.log('Test email sent.');
}

sendTestEmail()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to send test email:', error);
    process.exit(1);
  });
