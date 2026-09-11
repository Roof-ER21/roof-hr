/**
 * Offices — where a new hire reports and where an in-person interview happens.
 *
 * Why this exists: the office list was three constants copied into four files,
 * so adding Pittsburgh meant a developer and a deploy. Now it is a table HR can
 * edit under Recruiting → Email Templates → Offices.
 *
 * The welcome email renderer reads {{officeAddress}} and {{meetPerson}} from
 * here. If the database is unreachable at send time it falls back to the
 * seeded list below, so a welcome email never goes out with a blank address.
 */
import { v4 as uuidv4 } from 'uuid';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { offices, type Office } from '@shared/schema';
import { FALLBACK_OFFICES, DEFAULT_OFFICE_KEY, slugifyKey } from '@shared/constants/offices';

export type OfficeInput = {
  key?: string;
  label: string;
  address: string;
  meetPerson?: string;
  enabled?: boolean;
  sortOrder?: number;
};

export { FALLBACK_OFFICES, DEFAULT_OFFICE_KEY, slugifyKey };

export async function listOffices(opts: { includeDisabled?: boolean; includeDeleted?: boolean } = {}) {
  const conds = [];
  if (!opts.includeDeleted) conds.push(isNull(offices.deletedAt));
  if (!opts.includeDisabled) conds.push(eq(offices.enabled, true));
  return db
    .select()
    .from(offices)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(offices.sortOrder), asc(offices.label));
}

export async function getOfficeById(id: string) {
  const [row] = await db.select().from(offices).where(eq(offices.id, id)).limit(1);
  return row ?? null;
}

export async function getOfficeByKey(key: string) {
  const [row] = await db.select().from(offices).where(eq(offices.key, key)).limit(1);
  return row ?? null;
}

/**
 * The address and meet-person for a welcome email. Unknown or missing key
 * falls back to DMV, the historical default; a DB error falls back to the
 * seeded list. Deleted/disabled offices still resolve so an old hire re-send
 * keeps its address.
 */
export async function resolveOfficeForEmail(
  key: string | undefined | null,
): Promise<{ key: string; address: string; meetPerson: string }> {
  const wanted = (key || DEFAULT_OFFICE_KEY).trim();
  try {
    const row = (await getOfficeByKey(wanted)) ?? (await getOfficeByKey(DEFAULT_OFFICE_KEY));
    if (row) return { key: row.key, address: row.address, meetPerson: row.meetPerson };
  } catch (err: any) {
    console.error('[Offices] lookup failed, using built-in list:', err?.message || err);
  }
  const fb =
    FALLBACK_OFFICES.find((o) => o.key === wanted) ??
    FALLBACK_OFFICES.find((o) => o.key === DEFAULT_OFFICE_KEY)!;
  return { key: fb.key, address: fb.address, meetPerson: fb.meetPerson };
}

export async function createOffice(input: OfficeInput, actor: string) {
  const key = (input.key?.trim() || slugifyKey(input.label)) || `OFFICE_${Date.now()}`;
  const existing = await getOfficeByKey(key);
  if (existing && !existing.deletedAt) {
    throw new Error(`An office with the key "${key}" already exists`);
  }
  const now = new Date();
  if (existing) {
    // Re-adding a deleted office revives its row so old references line up again.
    await db
      .update(offices)
      .set({
        label: input.label.trim(),
        address: input.address.trim(),
        meetPerson: (input.meetPerson || 'the team').trim(),
        enabled: input.enabled ?? true,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        deletedAt: null,
        updatedBy: actor,
        updatedAt: now,
      })
      .where(eq(offices.id, existing.id));
    return getOfficeById(existing.id);
  }
  const id = uuidv4();
  await db.insert(offices).values({
    id,
    key,
    label: input.label.trim(),
    address: input.address.trim(),
    meetPerson: (input.meetPerson || 'the team').trim(),
    enabled: input.enabled ?? true,
    sortOrder: input.sortOrder ?? 100,
    updatedBy: actor,
  });
  return getOfficeById(id);
}

export async function updateOffice(id: string, input: Partial<OfficeInput>, actor: string) {
  const existing = await getOfficeById(id);
  if (!existing || existing.deletedAt) return null;
  const patch: Partial<Office> = { updatedBy: actor, updatedAt: new Date() };
  if (input.label !== undefined) patch.label = input.label.trim();
  if (input.address !== undefined) patch.address = input.address.trim();
  if (input.meetPerson !== undefined) patch.meetPerson = (input.meetPerson || 'the team').trim();
  if (input.enabled !== undefined) patch.enabled = input.enabled;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  await db.update(offices).set(patch).where(eq(offices.id, id));
  return getOfficeById(id);
}

export async function deleteOffice(id: string, actor: string) {
  const existing = await getOfficeById(id);
  if (!existing || existing.deletedAt) return null;
  await db
    .update(offices)
    .set({ deletedAt: new Date(), enabled: false, updatedBy: actor, updatedAt: new Date() })
    .where(eq(offices.id, id));
  return getOfficeById(id);
}
