/**
 * Welcome email administration — attachments and body, editable without a deploy.
 *
 * Gated to admins (SYSTEM_ADMIN / HR_ADMIN and their legacy aliases) because
 * everything here changes what lands in a new hire's inbox. Mutations are
 * captured by the blanket audit middleware automatically.
 */
import express from 'express';
import multer from 'multer';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { EmailService, DEFAULT_WELCOME_SUBJECT_TEMPLATE } from '../email-service';
import * as content from '../services/welcomeEmailContentService';

const router = express.Router();

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: content.MAX_ATTACHMENT_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype}. PDF, Word, PNG and JPEG are accepted.`));
  },
});

function actorOf(req: any): string {
  return req.user?.email || req.user?.id || 'unknown';
}

function parseBool(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return undefined;
}

function parseVariant(v: unknown): content.WelcomeEmailVariant | null {
  return v === 'insurance' || v === 'retail' ? v : null;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

router.get('/api/welcome-email/attachments', requireAuth, requireAdmin, async (req, res) => {
  try {
    const includeDeleted = parseBool(req.query.includeDeleted) === true;
    res.json(await content.listAttachments(includeDeleted));
  } catch (err: any) {
    console.error('[WelcomeEmail] list attachments failed:', err?.message);
    res.status(500).json({ error: 'Failed to load attachments' });
  }
});

router.post(
  '/api/welcome-email/attachments',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'A file is required' });
      const label = (req.body?.label || '').trim();
      if (!label) return res.status(400).json({ error: 'A name is required' });

      const created = await content.createAttachment(
        {
          label,
          filename: (req.body?.filename || req.file.originalname || '').trim(),
          description: req.body?.description ?? null,
          enabled: parseBool(req.body?.enabled) ?? true,
        },
        req.file.buffer,
        req.file.mimetype,
        actorOf(req),
      );
      res.status(201).json(created);
    } catch (err: any) {
      console.error('[WelcomeEmail] create attachment failed:', err?.message);
      res.status(500).json({ error: err?.message || 'Failed to add attachment' });
    }
  },
);

router.put(
  '/api/welcome-email/attachments/:id',
  requireAuth,
  requireAdmin,
  upload.single('file'),
  async (req: any, res) => {
    try {
      const patch: Partial<content.AttachmentInput> = {};
      if (req.body?.label !== undefined) patch.label = String(req.body.label).trim();
      if (req.body?.filename !== undefined) patch.filename = String(req.body.filename).trim();
      if (req.body?.description !== undefined) patch.description = req.body.description;
      const enabled = parseBool(req.body?.enabled);
      if (enabled !== undefined) patch.enabled = enabled;
      if (req.body?.sortOrder !== undefined) {
        const n = Number(req.body.sortOrder);
        if (Number.isFinite(n)) patch.sortOrder = n;
      }
      if (patch.label !== undefined && !patch.label) {
        return res.status(400).json({ error: 'A name is required' });
      }

      const updated = await content.updateAttachment(
        req.params.id,
        patch,
        req.file ? { bytes: req.file.buffer, contentType: req.file.mimetype } : null,
        actorOf(req),
        req.body?.changeLog,
      );
      if (!updated) return res.status(404).json({ error: 'Attachment not found' });
      res.json(updated);
    } catch (err: any) {
      console.error('[WelcomeEmail] update attachment failed:', err?.message);
      res.status(500).json({ error: err?.message || 'Failed to update attachment' });
    }
  },
);

router.delete('/api/welcome-email/attachments/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const ok = await content.deleteAttachment(req.params.id, actorOf(req));
    if (!ok) return res.status(404).json({ error: 'Attachment not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[WelcomeEmail] delete attachment failed:', err?.message);
    res.status(500).json({ error: 'Failed to remove attachment' });
  }
});

router.post(
  '/api/welcome-email/attachments/:id/restore',
  requireAuth,
  requireAdmin,
  async (req: any, res) => {
    try {
      const ok = await content.restoreDeletedAttachment(req.params.id, actorOf(req));
      if (!ok) return res.status(404).json({ error: 'Attachment not found' });
      res.json({ success: true });
    } catch (err: any) {
      console.error('[WelcomeEmail] restore attachment failed:', err?.message);
      res.status(500).json({ error: 'Failed to restore attachment' });
    }
  },
);

router.get('/api/welcome-email/attachments/:id/file', requireAuth, requireAdmin, async (req, res) => {
  try {
    const doc = await content.getAttachmentContent(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Attachment not found' });
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename.replace(/"/g, '')}"`);
    res.send(doc.bytes);
  } catch (err: any) {
    console.error('[WelcomeEmail] download attachment failed:', err?.message);
    res.status(500).json({ error: 'Failed to load file' });
  }
});

router.get('/api/welcome-email/attachments/:id/versions', requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json(await content.listAttachmentVersions(req.params.id));
  } catch (err: any) {
    console.error('[WelcomeEmail] list attachment versions failed:', err?.message);
    res.status(500).json({ error: 'Failed to load version history' });
  }
});

router.get(
  '/api/welcome-email/attachment-versions/:versionId/file',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const doc = await content.getAttachmentVersionContent(req.params.versionId);
      if (!doc) return res.status(404).json({ error: 'Version not found' });
      res.setHeader('Content-Type', doc.contentType);
      res.setHeader('Content-Disposition', `inline; filename="${doc.filename.replace(/"/g, '')}"`);
      res.send(doc.bytes);
    } catch (err: any) {
      console.error('[WelcomeEmail] download attachment version failed:', err?.message);
      res.status(500).json({ error: 'Failed to load file' });
    }
  },
);

router.post(
  '/api/welcome-email/attachments/:id/versions/:versionId/restore',
  requireAuth,
  requireAdmin,
  async (req: any, res) => {
    try {
      const restored = await content.restoreAttachmentVersion(
        req.params.id,
        req.params.versionId,
        actorOf(req),
      );
      if (!restored) return res.status(404).json({ error: 'Version not found' });
      res.json(restored);
    } catch (err: any) {
      console.error('[WelcomeEmail] restore attachment version failed:', err?.message);
      res.status(500).json({ error: 'Failed to restore that version' });
    }
  },
);

// ---------------------------------------------------------------------------
// Body template
// ---------------------------------------------------------------------------

router.get('/api/welcome-email/tokens', requireAuth, requireAdmin, (_req, res) => {
  res.json(content.TEMPLATE_TOKENS);
});

router.get('/api/welcome-email/templates/:variant', requireAuth, requireAdmin, async (req, res) => {
  try {
    const variant = parseVariant(req.params.variant);
    if (!variant) return res.status(400).json({ error: 'variant must be insurance or retail' });

    const saved = await content.getTemplate(variant);
    const builtIn = {
      subject: DEFAULT_WELCOME_SUBJECT_TEMPLATE,
      bodyHtml: new EmailService().buildWelcomeEmailTemplate(variant),
    };
    res.json({
      variant,
      // usingBuiltIn tells the UI whether edits are live or the app is still
      // sending the version compiled into the code.
      usingBuiltIn: !saved || !saved.enabled,
      saved: saved ?? null,
      builtIn,
    });
  } catch (err: any) {
    console.error('[WelcomeEmail] get template failed:', err?.message);
    res.status(500).json({ error: 'Failed to load the email body' });
  }
});

router.put('/api/welcome-email/templates/:variant', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const variant = parseVariant(req.params.variant);
    if (!variant) return res.status(400).json({ error: 'variant must be insurance or retail' });

    const subject = (req.body?.subject || '').trim();
    const bodyHtml = req.body?.bodyHtml;
    if (!subject) return res.status(400).json({ error: 'A subject is required' });
    if (typeof bodyHtml !== 'string' || !bodyHtml.trim()) {
      return res.status(400).json({ error: 'A body is required' });
    }

    const saved = await content.saveTemplate(
      variant,
      {
        subject,
        bodyHtml,
        enabled: parseBool(req.body?.enabled) ?? true,
        changeLog: req.body?.changeLog,
      },
      actorOf(req),
    );
    res.json(saved);
  } catch (err: any) {
    console.error('[WelcomeEmail] save template failed:', err?.message);
    res.status(500).json({ error: 'Failed to save the email body' });
  }
});

/** Go back to the version compiled into the app, keeping the edit history. */
router.post(
  '/api/welcome-email/templates/:variant/use-built-in',
  requireAuth,
  requireAdmin,
  async (req: any, res) => {
    try {
      const variant = parseVariant(req.params.variant);
      if (!variant) return res.status(400).json({ error: 'variant must be insurance or retail' });
      res.json(await content.revertTemplateToBuiltIn(variant, actorOf(req)));
    } catch (err: any) {
      console.error('[WelcomeEmail] revert template failed:', err?.message);
      res.status(500).json({ error: 'Failed to switch back to the built-in email' });
    }
  },
);

router.get('/api/welcome-email/templates/:variant/versions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const variant = parseVariant(req.params.variant);
    if (!variant) return res.status(400).json({ error: 'variant must be insurance or retail' });
    res.json(await content.listTemplateVersions(variant));
  } catch (err: any) {
    console.error('[WelcomeEmail] list template versions failed:', err?.message);
    res.status(500).json({ error: 'Failed to load version history' });
  }
});

router.get('/api/welcome-email/template-versions/:versionId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const version = await content.getTemplateVersion(req.params.versionId);
    if (!version) return res.status(404).json({ error: 'Version not found' });
    res.json(version);
  } catch (err: any) {
    console.error('[WelcomeEmail] get template version failed:', err?.message);
    res.status(500).json({ error: 'Failed to load that version' });
  }
});

router.post(
  '/api/welcome-email/templates/:variant/versions/:versionId/restore',
  requireAuth,
  requireAdmin,
  async (req: any, res) => {
    try {
      const variant = parseVariant(req.params.variant);
      if (!variant) return res.status(400).json({ error: 'variant must be insurance or retail' });
      const restored = await content.restoreTemplateVersion(
        variant,
        req.params.versionId,
        actorOf(req),
      );
      if (!restored) return res.status(404).json({ error: 'Version not found' });
      res.json(restored);
    } catch (err: any) {
      console.error('[WelcomeEmail] restore template version failed:', err?.message);
      res.status(500).json({ error: 'Failed to restore that version' });
    }
  },
);

/**
 * Render the email exactly as a new hire would receive it, using whatever is
 * saved right now — or an unsaved draft posted from the editor.
 */
router.post('/api/welcome-email/preview', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const variant = parseVariant(req.body?.variant) || 'insurance';
    const draftSubject = typeof req.body?.draftSubject === 'string' ? req.body.draftSubject : undefined;
    const draftBodyHtml = typeof req.body?.draftBodyHtml === 'string' ? req.body.draftBodyHtml : undefined;

    const rendered = await new EmailService().renderWelcomeEmailContent(
      {
        firstName: req.body?.firstName || 'Alex',
        lastName: req.body?.lastName || 'Sample',
        email: req.body?.email || 'new.hire@example.com',
        position: req.body?.position || 'Sales Representative',
      },
      'TRD2026!',
      {
        startDate: req.body?.startDate ? new Date(req.body.startDate) : undefined,
        startTime: req.body?.startTime,
        welcomeEmailType: variant,
        officeLocation: req.body?.officeLocation || 'DMV',
        includeEquipmentChecklist:
          variant !== 'retail' && req.body?.includeEquipmentChecklist !== false,
        templateOverride:
          draftSubject !== undefined || draftBodyHtml !== undefined
            ? { subject: draftSubject, bodyHtml: draftBodyHtml }
            : undefined,
      },
    );

    res.json(rendered);
  } catch (err: any) {
    console.error('[WelcomeEmail] preview failed:', err?.message);
    res.status(500).json({ error: err?.message || 'Failed to render preview' });
  }
});

export default router;
