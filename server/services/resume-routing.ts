/** Identify persisted upload records, including imports made before source metadata existed. */
export function resumeSource(candidate: { source?: string; notes?: string | null }): string | null {
  if (candidate.source === 'Resume Upload' || candidate.source === 'Google Drive Sync') return candidate.source;
  if (candidate.notes?.startsWith('Auto-created from resume upload (')) return 'Resume Upload';
  if (candidate.notes?.startsWith('Synced from Google Drive. Original file:')) return 'Google Drive Sync';
  return null;
}

export function resumeMatch(candidates: any[], filename: string, parsed: { firstName?: string; lastName?: string; email?: string }) {
  const marker = filename.match(/^Indeed-[a-zA-Z0-9_-]{4,128}?--/)?.[0];
  const exact = marker && candidates.find(c => [c.notes, c.resumeUrl].some(value => String(value || '').includes(marker)));
  if (exact) return { candidateId: exact.id, matchType: 'source' };
  const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  const email = normalize(parsed.email || '');
  const name = normalize(`${parsed.firstName || ''} ${parsed.lastName || ''}`);
  const possible = candidates.find(c =>
    (email && !email.endsWith('@placeholder.local') && normalize(c.email || '') === email) ||
    (parsed.firstName && parsed.lastName && !/^unknown candidate$/i.test(name) && normalize(`${c.firstName || ''} ${c.lastName || ''}`) === name));
  return possible ? { candidateId: possible.id, matchType: 'contact' } : null;
}
