import { storage } from '../storage';
import { contractPdfService } from '../services/contractPdfService';
import { notifyRecipientOfNewContract } from '../services/contract-notification';

const senderEmail = process.env.CONTRACT_SENDER_EMAIL || 'ahmed.mahmoud@theroofdocs.com';
const recipientSpec = process.env.CONTRACT_RECIPIENTS || 'ahmed.mahmoud@theroofdocs.com,ryan.ferguson@theroofdocs.com';

const normalize = (value: string) => value.trim().toLowerCase();

async function resolveRecipients() {
  const tokens = recipientSpec.split(',').map((value) => value.trim()).filter(Boolean);
  const users = await storage.getAllUsers();
  const recipients = [] as Array<{ id: string; name: string; email: string; position?: string; department?: string }>;

  for (const token of tokens) {
    const isEmail = token.includes('@');
    let user = null;
    if (isEmail) {
      user = users.find((entry) => normalize(entry.email) === normalize(token)) || null;
    } else {
      const target = normalize(token);
      user = users.find((entry) => `${entry.firstName} ${entry.lastName}`.toLowerCase() === target) || null;
    }

    if (!user) {
      throw new Error(`Recipient not found: ${token}`);
    }

    recipients.push({
      id: user.id,
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      position: user.position || undefined,
      department: user.department || undefined,
    });
  }

  return recipients;
}

async function run() {
  const sender = await storage.getUserByEmail(senderEmail);
  if (!sender) {
    throw new Error(`Sender not found: ${senderEmail}`);
  }

  const recipients = await resolveRecipients();
  const templates = await storage.getAllContractTemplates();
  const desiredTemplates = templates.filter((template) => {
    const name = (template.fileName || template.name || '').toLowerCase();
    return name.includes('richmond') || name.includes('dmv') || name.includes('pa');
  });

  if (desiredTemplates.length === 0) {
    throw new Error('No Richmond/DMV/PA templates found.');
  }

  const today = new Date().toLocaleDateString();

  for (const recipient of recipients) {
    for (const template of desiredTemplates) {
      if (!template.fileName) {
        throw new Error(`Template missing fileName: ${template.name}`);
      }

      const autoValues: Record<string, string> = {
        contractorName: recipient.name,
        name: recipient.name,
        employeeName: recipient.name,
        firstName: recipient.name.split(' ')[0] || recipient.name,
        lastName: recipient.name.split(' ').slice(1).join(' '),
        position: recipient.position || '',
        department: recipient.department || '',
        email: recipient.email,
        date: today,
        startDate: today,
        effectiveDate: today,
        companySignatureDate: today,
      };

      let content = template.content;
      const replacements: Record<string, string> = {
        '{{name}}': recipient.name,
        '{{employeeName}}': recipient.name,
        '{{firstName}}': autoValues.firstName,
        '{{lastName}}': autoValues.lastName,
        '{{position}}': recipient.position || '',
        '{{department}}': recipient.department || '',
        '{{email}}': recipient.email,
        '{{date}}': today,
        '{{startDate}}': today,
      };

      for (const [key, value] of Object.entries(replacements)) {
        content = content.replace(new RegExp(key, 'g'), value);
      }

      const outputFileName = `contract_${recipient.name.toLowerCase().replace(/\s+/g, '_')}_${template.id}_${Date.now()}.pdf`;
      await contractPdfService.generateContract(template.fileName, autoValues, outputFileName);

      const contract = await storage.createEmployeeContract({
        employeeId: recipient.id,
        recipientType: 'EMPLOYEE',
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        templateId: template.id,
        title: `${template.name} - ${recipient.name}`,
        content,
        fileUrl: `/contract-templates/${outputFileName}`,
        fileName: outputFileName,
        status: 'DRAFT',
        createdBy: sender.id,
      });

      const updated = await storage.updateEmployeeContract(contract.id, {
        status: 'SENT',
        sentDate: new Date(),
      });

      await notifyRecipientOfNewContract(
        updated.recipientEmail,
        updated.recipientName,
        updated.title,
        updated.id,
        senderEmail,
        updated.fileUrl || undefined
      );

      console.log(`Sent ${template.name} to ${recipient.email} (contractId=${updated.id})`);
    }
  }
}

run().catch((error) => {
  console.error('Failed to send contracts:', error);
  process.exit(1);
});
