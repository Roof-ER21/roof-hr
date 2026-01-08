import 'dotenv/config';

const APP_URL = (process.env.APP_URL || 'https://roofhr.up.railway.app').replace(/\/+$/, '');
const SENDER_EMAIL = process.env.CONTRACT_SENDER_EMAIL || 'ahmed.mahmoud@theroofdocs.com';
const SENDER_PASSWORD = process.env.CONTRACT_SENDER_PASSWORD || '';
const RECIPIENTS = process.env.CONTRACT_RECIPIENTS || 'ahmed.mahmoud@theroofdocs.com,careers@theroofdocs.com';

async function login() {
  if (!SENDER_PASSWORD) {
    throw new Error('CONTRACT_SENDER_PASSWORD is required to log in.');
  }

  const response = await fetch(`${APP_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: SENDER_EMAIL, password: SENDER_PASSWORD }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Login failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  if (!data?.token) {
    throw new Error('Login succeeded but no token returned.');
  }

  return data.token as string;
}

async function authedFetch(token: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${APP_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed ${path}: ${response.status} ${text}`);
  }

  return response.json();
}

async function run() {
  const token = await login();

  const [templates, users] = await Promise.all([
    authedFetch(token, '/api/contract-templates'),
    authedFetch(token, '/api/users'),
  ]);

  const desiredTemplates = (templates as any[]).filter((template) => {
    const name = `${template.fileName || ''} ${template.name || ''}`.toLowerCase();
    return name.includes('richmond') || name.includes('dmv') || name.includes('pa');
  });

  if (desiredTemplates.length === 0) {
    throw new Error('No Richmond/DMV/PA templates found.');
  }

  const recipientEmails = RECIPIENTS.split(',').map((entry) => entry.trim()).filter(Boolean);

  for (const email of recipientEmails) {
    const user = (users as any[]).find((entry) => entry.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      throw new Error(`Recipient not found: ${email}`);
    }

    for (const template of desiredTemplates) {
      const contract = await authedFetch(token, '/api/employee-contracts', {
        method: 'POST',
        body: JSON.stringify({
          recipientType: 'EMPLOYEE',
          employeeId: user.id,
          templateId: template.id,
          title: template.name,
          content: template.content,
        }),
      });

      const sent = await authedFetch(token, `/api/employee-contracts/${contract.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'SENT' }),
      });

      console.log(`Sent ${template.name} to ${email} (contractId=${sent.id})`);
    }
  }
}

run().catch((error) => {
  console.error('Failed to send contracts via API:', error);
  process.exit(1);
});
