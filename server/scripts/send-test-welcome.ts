import { EmailService } from '../email-service';

async function sendTestEmail() {
  console.log('Initializing email service...');
  const emailService = new EmailService();
  await emailService.initialize();
  
  console.log('Sending welcome email to ahmed.mahmoud@theroofdocs.com...');
  const result = await emailService.sendWelcomeEmail(
    {
      firstName: 'Test',
      lastName: 'Candidate',
      email: 'ahmed.mahmoud@theroofdocs.com',
      position: 'Sales Representative',
    },
    'TempPass123!',
    'ahmed.mahmoud@theroofdocs.com',
    {
      startDate: new Date(),
      includeAttachments: true,
      includeEquipmentChecklist: true,
      equipmentSigningUrl: 'https://roofhr.up.railway.app/sign-equipment/44156524e2fbf37579f6032cfe0072c5eadb6d7b29dd305ed772327077cdfb23',
    }
  );
  
  console.log('Email sent:', result);
  process.exit(0);
}

sendTestEmail().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
