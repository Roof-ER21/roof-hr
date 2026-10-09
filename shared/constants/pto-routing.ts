/**
 * Ford's September 30 request: route these five Production employees' PTO
 * request notifications to Greg instead of Ford. Use the verified account
 * emails, not position labels (Evan and Jack are listed as Production Manager).
 * This changes notification recipients only, never approval permissions.
 */
const PROJECT_MANAGER_EMAILS = new Set([
  'cadell.barnes@theroofdocs.com',
  'colby.mahlstede@theroofdocs.com',
  'service@theroofdocs.com', // Evan Ruszala
  'john.dickey@theroofdocs.com',
  'jack@theroofdocs.com', // Jack Strycharz
]);
const FORD = 'ford.barsi@theroofdocs.com';
const GREG = 'greg.campbell@theroofdocs.com';

export function routePtoRequestRecipients(employeeEmail: string, recipients: string[]): string[] {
  if (!PROJECT_MANAGER_EMAILS.has(employeeEmail.trim().toLowerCase())) return recipients;
  return Array.from(new Set([
    ...recipients.map(email => email.trim().toLowerCase()).filter(email => email !== FORD),
    GREG,
  ]));
}
