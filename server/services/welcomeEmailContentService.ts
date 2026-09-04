/**
 * Welcome email content — attachments and body, editable from inside the app.
 *
 * Why this exists: the new-hire welcome email's two PDFs were files committed
 * at public/documents/ and its body was a template literal in email-service.ts,
 * so changing either one required a developer and a deploy.
 *
 * Why Postgres and not the filesystem: Railway rebuilds the container on every
 * deploy, so an uploaded file written to disk is gone at the next push. The PDF
 * bytes live in a table. The committed files remain the first-boot seed, and
 * the disk copies are still the fallback if the database is unreachable at send
 * time — a welcome email going out with the old attachment beats one going out
 * with none.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  welcomeEmailAttachments,
  welcomeEmailAttachmentVersions,
  welcomeEmailTemplates,
  welcomeEmailTemplateVersions,
  type WelcomeEmailAttachment,
} from '@shared/schema';

export type WelcomeEmailVariant = 'insurance' | 'retail';
export const WELCOME_EMAIL_VARIANTS: WelcomeEmailVariant[] = ['insurance', 'retail'];

/** Bytes we will accept for one attachment. Gmail's own ceiling is 25MB total. */
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;

/**
 * The two documents that shipped with the app. `slot` keeps their identity
 * stable across renames so the seed never duplicates them.
 */
const SEEDED_ATTACHMENTS = [
  {
    slot: 'culture-and-commitment',
    label: 'Culture and Commitment',
    file: 'Culture-and-Commitment.pdf',
    sortOrder: 10,
  },
  {
    slot: 'training-manual',
    label: 'Training Manual',
    file: 'Training-Manual.pdf',
    sortOrder: 20,
  },
] as const;

function documentsDir(): string {
  return path.resolve(process.cwd(), 'public', 'documents');
}

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

/** Row shape the UI gets: everything except the multi-megabyte payload. */
export type AttachmentSummary = Omit<WelcomeEmailAttachment, 'contentBase64'>;

const SUMMARY_COLUMNS = {
  id: welcomeEmailAttachments.id,
  slot: welcomeEmailAttachments.slot,
  label: welcomeEmailAttachments.label,
  filename: welcomeEmailAttachments.filename,
  description: welcomeEmailAttachments.description,
  contentType: welcomeEmailAttachments.contentType,
  fileSize: welcomeEmailAttachments.fileSize,
  checksum: welcomeEmailAttachments.checksum,
  version: welcomeEmailAttachments.version,
  enabled: welcomeEmailAttachments.enabled,
  sortOrder: welcomeEmailAttachments.sortOrder,
  updatedBy: welcomeEmailAttachments.updatedBy,
  deletedAt: welcomeEmailAttachments.deletedAt,
  createdAt: welcomeEmailAttachments.createdAt,
  updatedAt: welcomeEmailAttachments.updatedAt,
};

let seedAttempted = false;

/**
 * On first use, adopt whatever is committed at public/documents/ as the
 * starting rows, so the very first render after this ships is byte-identical
 * to what the app was already sending.
 */
async function seedFromDiskIfNeeded(): Promise<void> {
  if (seedAttempted) return;
  seedAttempted = true;

  try {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(welcomeEmailAttachments);
    if (count > 0) return;

    for (const seed of SEEDED_ATTACHMENTS) {
      const fullPath = path.join(documentsDir(), seed.file);
      if (!fs.existsSync(fullPath)) {
        console.warn(`[WelcomeEmailContent] Seed file missing, skipping: ${fullPath}`);
        continue;
      }
      const bytes = fs.readFileSync(fullPath);
      await db
        .insert(welcomeEmailAttachments)
        .values({
          id: uuidv4(),
          slot: seed.slot,
          label: seed.label,
          filename: seed.file,
          description: 'Seeded from the version committed with the app.',
          contentType: 'application/pdf',
          fileSize: bytes.length,
          contentBase64: bytes.toString('base64'),
          checksum: sha256(bytes),
          version: 1,
          enabled: true,
          sortOrder: seed.sortOrder,
          updatedBy: 'system:seed',
        })
        .onConflictDoNothing();
      console.log(`[WelcomeEmailContent] Seeded ${seed.label} (${bytes.length} bytes)`);
    }
  } catch (err: any) {
    // A failed seed must not take the welcome email down; the disk fallback covers it.
    seedAttempted = false;
    console.error('[WelcomeEmailContent] Seed failed:', err?.message || err);
  }
}

export async function listAttachments(includeDeleted = false): Promise<AttachmentSummary[]> {
  await seedFromDiskIfNeeded();
  const rows = await db
    .select(SUMMARY_COLUMNS)
    .from(welcomeEmailAttachments)
    .where(includeDeleted ? sql`true` : isNull(welcomeEmailAttachments.deletedAt))
    .orderBy(asc(welcomeEmailAttachments.sortOrder), asc(welcomeEmailAttachments.createdAt));
  return rows as AttachmentSummary[];
}

export async function getAttachmentContent(
  id: string,
): Promise<{ filename: string; contentType: string; bytes: Buffer } | null> {
  const [row] = await db
    .select({
      filename: welcomeEmailAttachments.filename,
      contentType: welcomeEmailAttachments.contentType,
      contentBase64: welcomeEmailAttachments.contentBase64,
    })
    .from(welcomeEmailAttachments)
    .where(eq(welcomeEmailAttachments.id, id))
    .limit(1);
  if (!row) return null;
  return {
    filename: row.filename,
    contentType: row.contentType,
    bytes: Buffer.from(row.contentBase64, 'base64'),
  };
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
  label: string;
}

/** Disk fallback: what the app attached before this feature existed. */
function diskAttachments(): MailAttachment[] {
  const out: MailAttachment[] = [];
  for (const seed of SEEDED_ATTACHMENTS) {
    const fullPath = path.join(documentsDir(), seed.file);
    if (!fs.existsSync(fullPath)) continue;
    out.push({
      filename: seed.file,
      content: fs.readFileSync(fullPath),
      contentType: 'application/pdf',
      label: seed.label,
    });
  }
  return out;
}

/**
 * The attachments a welcome email should carry right now. Never throws — on a
 * database problem it degrades to the committed files rather than sending a
 * new hire an email with nothing attached.
 */
export async function getMailAttachments(): Promise<MailAttachment[]> {
  try {
    await seedFromDiskIfNeeded();
    const rows = await db
      .select({
        label: welcomeEmailAttachments.label,
        filename: welcomeEmailAttachments.filename,
        contentType: welcomeEmailAttachments.contentType,
        contentBase64: welcomeEmailAttachments.contentBase64,
      })
      .from(welcomeEmailAttachments)
      .where(
        and(isNull(welcomeEmailAttachments.deletedAt), eq(welcomeEmailAttachments.enabled, true)),
      )
      .orderBy(asc(welcomeEmailAttachments.sortOrder), asc(welcomeEmailAttachments.createdAt));

    // An empty table after a successful seed means an admin disabled or removed
    // everything on purpose — respect that instead of resurrecting the files.
    if (rows.length === 0) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(welcomeEmailAttachments);
      if (count > 0) return [];
      return diskAttachments();
    }

    return rows.map((r) => ({
      label: r.label,
      filename: r.filename,
      contentType: r.contentType,
      content: Buffer.from(r.contentBase64, 'base64'),
    }));
  } catch (err: any) {
    console.error('[WelcomeEmailContent] Falling back to disk attachments:', err?.message || err);
    return diskAttachments();
  }
}

/**
 * Just the names of the attachments a welcome email would carry — no payload.
 * Rendering the body needs the labels; loading five megabytes of PDF to draw a
 * preview does not.
 */
export async function getEnabledAttachmentLabels(): Promise<{ label: string; filename: string }[]> {
  try {
    await seedFromDiskIfNeeded();
    const rows = await db
      .select({ label: welcomeEmailAttachments.label, filename: welcomeEmailAttachments.filename })
      .from(welcomeEmailAttachments)
      .where(
        and(isNull(welcomeEmailAttachments.deletedAt), eq(welcomeEmailAttachments.enabled, true)),
      )
      .orderBy(asc(welcomeEmailAttachments.sortOrder), asc(welcomeEmailAttachments.createdAt));

    if (rows.length === 0) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(welcomeEmailAttachments);
      if (count > 0) return [];
      return SEEDED_ATTACHMENTS.map((s) => ({ label: s.label, filename: s.file }));
    }
    return rows;
  } catch (err: any) {
    console.error('[WelcomeEmailContent] Falling back to disk attachment labels:', err?.message || err);
    return SEEDED_ATTACHMENTS.map((s) => ({ label: s.label, filename: s.file }));
  }
}

export interface AttachmentInput {
  label: string;
  filename: string;
  description?: string | null;
  enabled?: boolean;
  sortOrder?: number;
}

function normalizeFilename(name: string, fallback: string): string {
  const base = path.basename(name || '').replace(/[\r\n"\\]/g, '').trim();
  return base || fallback;
}

export async function createAttachment(
  input: AttachmentInput,
  bytes: Buffer,
  contentType: string,
  actor: string,
): Promise<AttachmentSummary> {
  await seedFromDiskIfNeeded();
  const id = uuidv4();
  const filename = normalizeFilename(input.filename, `${input.label}.pdf`);

  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${welcomeEmailAttachments.sortOrder}), 0)::int` })
    .from(welcomeEmailAttachments);

  await db.insert(welcomeEmailAttachments).values({
    id,
    slot: null,
    label: input.label,
    filename,
    description: input.description ?? null,
    contentType,
    fileSize: bytes.length,
    contentBase64: bytes.toString('base64'),
    checksum: sha256(bytes),
    version: 1,
    enabled: input.enabled ?? true,
    sortOrder: input.sortOrder ?? maxOrder + 10,
    updatedBy: actor,
  });

  await recordAttachmentVersion(id, 1, { label: input.label, filename, contentType, bytes }, 'Added', actor);

  const [row] = await db
    .select(SUMMARY_COLUMNS)
    .from(welcomeEmailAttachments)
    .where(eq(welcomeEmailAttachments.id, id));
  return row as AttachmentSummary;
}

async function recordAttachmentVersion(
  attachmentId: string,
  version: number,
  snapshot: { label: string; filename: string; contentType: string; bytes: Buffer },
  changeLog: string,
  actor: string,
): Promise<void> {
  await db
    .insert(welcomeEmailAttachmentVersions)
    .values({
      id: uuidv4(),
      attachmentId,
      version,
      label: snapshot.label,
      filename: snapshot.filename,
      contentType: snapshot.contentType,
      fileSize: snapshot.bytes.length,
      contentBase64: snapshot.bytes.toString('base64'),
      checksum: sha256(snapshot.bytes),
      changeLog,
      createdBy: actor,
    })
    .onConflictDoNothing();
}

/**
 * Update metadata and/or replace the file. A new file bumps the version and
 * snapshots the *incoming* state, so the version list reads as the history of
 * what was actually sent.
 */
export async function updateAttachment(
  id: string,
  patch: Partial<AttachmentInput>,
  file: { bytes: Buffer; contentType: string } | null,
  actor: string,
  changeLog?: string,
): Promise<AttachmentSummary | null> {
  const [existing] = await db
    .select()
    .from(welcomeEmailAttachments)
    .where(eq(welcomeEmailAttachments.id, id))
    .limit(1);
  if (!existing) return null;

  const label = patch.label ?? existing.label;
  const filename = patch.filename
    ? normalizeFilename(patch.filename, existing.filename)
    : existing.filename;
  const nextVersion = file ? existing.version + 1 : existing.version;

  await db
    .update(welcomeEmailAttachments)
    .set({
      label,
      filename,
      description: patch.description !== undefined ? patch.description : existing.description,
      enabled: patch.enabled !== undefined ? patch.enabled : existing.enabled,
      sortOrder: patch.sortOrder !== undefined ? patch.sortOrder : existing.sortOrder,
      ...(file
        ? {
            contentType: file.contentType,
            fileSize: file.bytes.length,
            contentBase64: file.bytes.toString('base64'),
            checksum: sha256(file.bytes),
            version: nextVersion,
          }
        : {}),
      updatedBy: actor,
      updatedAt: new Date(),
    })
    .where(eq(welcomeEmailAttachments.id, id));

  if (file) {
    // Make sure the version that was live before this replacement is on record,
    // even for rows seeded before versioning existed.
    await recordAttachmentVersion(
      id,
      existing.version,
      {
        label: existing.label,
        filename: existing.filename,
        contentType: existing.contentType,
        bytes: Buffer.from(existing.contentBase64, 'base64'),
      },
      'Previous version',
      existing.updatedBy || 'system',
    );
    await recordAttachmentVersion(
      id,
      nextVersion,
      { label, filename, contentType: file.contentType, bytes: file.bytes },
      changeLog || 'Replaced file',
      actor,
    );
  }

  const [row] = await db
    .select(SUMMARY_COLUMNS)
    .from(welcomeEmailAttachments)
    .where(eq(welcomeEmailAttachments.id, id));
  return row as AttachmentSummary;
}

/** Soft delete, so history survives and the removal can be undone. */
export async function deleteAttachment(id: string, actor: string): Promise<boolean> {
  const result = await db
    .update(welcomeEmailAttachments)
    .set({ deletedAt: new Date(), enabled: false, slot: null, updatedBy: actor, updatedAt: new Date() })
    .where(and(eq(welcomeEmailAttachments.id, id), isNull(welcomeEmailAttachments.deletedAt)))
    .returning({ id: welcomeEmailAttachments.id });
  return result.length > 0;
}

export async function restoreDeletedAttachment(id: string, actor: string): Promise<boolean> {
  const result = await db
    .update(welcomeEmailAttachments)
    .set({ deletedAt: null, updatedBy: actor, updatedAt: new Date() })
    .where(eq(welcomeEmailAttachments.id, id))
    .returning({ id: welcomeEmailAttachments.id });
  return result.length > 0;
}

export async function listAttachmentVersions(attachmentId: string) {
  return db
    .select({
      id: welcomeEmailAttachmentVersions.id,
      version: welcomeEmailAttachmentVersions.version,
      label: welcomeEmailAttachmentVersions.label,
      filename: welcomeEmailAttachmentVersions.filename,
      contentType: welcomeEmailAttachmentVersions.contentType,
      fileSize: welcomeEmailAttachmentVersions.fileSize,
      checksum: welcomeEmailAttachmentVersions.checksum,
      changeLog: welcomeEmailAttachmentVersions.changeLog,
      createdBy: welcomeEmailAttachmentVersions.createdBy,
      createdAt: welcomeEmailAttachmentVersions.createdAt,
    })
    .from(welcomeEmailAttachmentVersions)
    .where(eq(welcomeEmailAttachmentVersions.attachmentId, attachmentId))
    .orderBy(desc(welcomeEmailAttachmentVersions.version));
}

export async function getAttachmentVersionContent(
  versionId: string,
): Promise<{ filename: string; contentType: string; bytes: Buffer } | null> {
  const [row] = await db
    .select()
    .from(welcomeEmailAttachmentVersions)
    .where(eq(welcomeEmailAttachmentVersions.id, versionId))
    .limit(1);
  if (!row) return null;
  return {
    filename: row.filename,
    contentType: row.contentType,
    bytes: Buffer.from(row.contentBase64, 'base64'),
  };
}

/** Roll an attachment back to an earlier version — recorded as a new version. */
export async function restoreAttachmentVersion(
  attachmentId: string,
  versionId: string,
  actor: string,
): Promise<AttachmentSummary | null> {
  const [snapshot] = await db
    .select()
    .from(welcomeEmailAttachmentVersions)
    .where(
      and(
        eq(welcomeEmailAttachmentVersions.id, versionId),
        eq(welcomeEmailAttachmentVersions.attachmentId, attachmentId),
      ),
    )
    .limit(1);
  if (!snapshot) return null;

  return updateAttachment(
    attachmentId,
    { label: snapshot.label, filename: snapshot.filename },
    { bytes: Buffer.from(snapshot.contentBase64, 'base64'), contentType: snapshot.contentType },
    actor,
    `Restored version ${snapshot.version}`,
  );
}

// ---------------------------------------------------------------------------
// Body template
// ---------------------------------------------------------------------------

/**
 * Tokens an editable body may use. Anything not in this list is left alone, so
 * a stray `{{...}}` in pasted content never silently becomes an empty string.
 */
export const TEMPLATE_TOKENS: { token: string; description: string }[] = [
  { token: 'firstName', description: "New hire's first name" },
  { token: 'lastName', description: "New hire's last name" },
  { token: 'fullName', description: 'First and last name' },
  { token: 'position', description: 'Position they were hired for' },
  { token: 'startDate', description: 'Start date, e.g. Monday, September 8th' },
  { token: 'startTime', description: 'Report time, e.g. 10am' },
  { token: 'officeAddress', description: 'Address of the office they report to' },
  { token: 'meetPerson', description: 'Who they meet on day one' },
  { token: 'temporaryPassword', description: 'Temporary HR portal password (usually unused)' },
  { token: 'equipmentChecklist', description: 'Equipment checklist block, empty when turned off' },
  { token: 'attachmentsBlock', description: 'Full "I have attached..." paragraph; disappears when nothing is attached' },
  { token: 'attachmentList', description: 'Just the attachment names, one per line' },
];

export type TemplateVars = Record<string, string>;

/** Substitute {{token}} for known tokens only. */
export function applyTokens(html: string, vars: TemplateVars): string {
  return html.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match,
  );
}

export function renderAttachmentList(attachments: { label: string }[]): string {
  return attachments.map((a) => `- ${a.label}`).join('<br>\n            ');
}

export function renderAttachmentsBlock(attachments: { label: string }[]): string {
  if (attachments.length === 0) return '';
  return `<p style="font-size: 15px; line-height: 1.7; color: #333;">
            Lastly, I have attached the following documents for your perusal:<br>
            ${renderAttachmentList(attachments)}
          </p>`;
}

export async function getTemplate(variant: WelcomeEmailVariant) {
  const [row] = await db
    .select()
    .from(welcomeEmailTemplates)
    .where(eq(welcomeEmailTemplates.variant, variant))
    .limit(1);
  return row ?? null;
}

/** The saved body for a variant, or null when the built-in email should be used. */
export async function getActiveTemplate(
  variant: WelcomeEmailVariant,
): Promise<{ subject: string; bodyHtml: string } | null> {
  try {
    const row = await getTemplate(variant);
    if (!row || !row.enabled) return null;
    return { subject: row.subject, bodyHtml: row.bodyHtml };
  } catch (err: any) {
    console.error('[WelcomeEmailContent] Template lookup failed, using built-in:', err?.message || err);
    return null;
  }
}

export async function saveTemplate(
  variant: WelcomeEmailVariant,
  input: { subject: string; bodyHtml: string; enabled?: boolean; changeLog?: string },
  actor: string,
) {
  const existing = await getTemplate(variant);
  const now = new Date();

  if (!existing) {
    const id = uuidv4();
    await db.insert(welcomeEmailTemplates).values({
      id,
      variant,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      enabled: input.enabled ?? true,
      version: 1,
      updatedBy: actor,
    });
    await db.insert(welcomeEmailTemplateVersions).values({
      id: uuidv4(),
      templateId: id,
      variant,
      version: 1,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      changeLog: input.changeLog || 'Created',
      createdBy: actor,
    });
    return getTemplate(variant);
  }

  const contentChanged =
    existing.subject !== input.subject || existing.bodyHtml !== input.bodyHtml;
  const nextVersion = contentChanged ? existing.version + 1 : existing.version;

  await db
    .update(welcomeEmailTemplates)
    .set({
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      enabled: input.enabled ?? existing.enabled,
      version: nextVersion,
      updatedBy: actor,
      updatedAt: now,
    })
    .where(eq(welcomeEmailTemplates.id, existing.id));

  if (contentChanged) {
    await db.insert(welcomeEmailTemplateVersions).values({
      id: uuidv4(),
      templateId: existing.id,
      variant,
      version: nextVersion,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      changeLog: input.changeLog || 'Edited',
      createdBy: actor,
    });
  }

  return getTemplate(variant);
}

export async function listTemplateVersions(variant: WelcomeEmailVariant) {
  return db
    .select({
      id: welcomeEmailTemplateVersions.id,
      version: welcomeEmailTemplateVersions.version,
      subject: welcomeEmailTemplateVersions.subject,
      changeLog: welcomeEmailTemplateVersions.changeLog,
      createdBy: welcomeEmailTemplateVersions.createdBy,
      createdAt: welcomeEmailTemplateVersions.createdAt,
    })
    .from(welcomeEmailTemplateVersions)
    .where(eq(welcomeEmailTemplateVersions.variant, variant))
    .orderBy(desc(welcomeEmailTemplateVersions.version));
}

export async function getTemplateVersion(versionId: string) {
  const [row] = await db
    .select()
    .from(welcomeEmailTemplateVersions)
    .where(eq(welcomeEmailTemplateVersions.id, versionId))
    .limit(1);
  return row ?? null;
}

export async function restoreTemplateVersion(
  variant: WelcomeEmailVariant,
  versionId: string,
  actor: string,
) {
  const snapshot = await getTemplateVersion(versionId);
  if (!snapshot || snapshot.variant !== variant) return null;
  return saveTemplate(
    variant,
    { subject: snapshot.subject, bodyHtml: snapshot.bodyHtml, enabled: true },
    actor,
  );
}

/** Drop the saved body so the built-in email takes over again. */
export async function revertTemplateToBuiltIn(variant: WelcomeEmailVariant, actor: string) {
  const existing = await getTemplate(variant);
  if (!existing) return null;
  await db
    .update(welcomeEmailTemplates)
    .set({ enabled: false, updatedBy: actor, updatedAt: new Date() })
    .where(eq(welcomeEmailTemplates.id, existing.id));
  return getTemplate(variant);
}
