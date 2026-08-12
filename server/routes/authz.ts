/**
 * Grant administration — who can do what, editable without a deploy.
 * Mutations are captured by the blanket audit middleware automatically.
 */
import express from 'express';
import { requireAuth, requireAdmin, requireSystemAdmin } from '../middleware/auth';
import {
  KNOWN_CAPABILITIES,
  listGrants,
  addGrant,
  removeGrant,
} from '../services/authzService';

const router = express.Router();

router.get('/api/authz/capabilities', requireAuth, requireAdmin, (_req, res) => {
  res.json(KNOWN_CAPABILITIES);
});

router.get('/api/authz/grants', requireAuth, requireAdmin, async (req, res) => {
  try {
    const capability = typeof req.query.capability === 'string' ? req.query.capability : undefined;
    res.json(await listGrants(capability));
  } catch (err: any) {
    console.error('[Authz] list failed:', err?.message);
    res.status(500).json({ error: 'Failed to list grants' });
  }
});

router.post('/api/authz/grants', requireAuth, requireSystemAdmin, async (req: any, res) => {
  try {
    const { capability, principal, principalType, metadata } = req.body || {};
    if (!capability || !principal) {
      return res.status(400).json({ error: 'capability and principal are required' });
    }
    if (!KNOWN_CAPABILITIES[capability]) {
      return res.status(400).json({ error: `Unknown capability: ${capability}` });
    }
    if (principalType && !['USER_EMAIL', 'AGENT'].includes(principalType)) {
      return res.status(400).json({ error: 'principalType must be USER_EMAIL or AGENT' });
    }
    if ((principalType || 'USER_EMAIL') === 'USER_EMAIL' && !String(principal).includes('@')) {
      return res.status(400).json({ error: 'principal must be an email address' });
    }
    if (capability === 'pto.approve.department' && !metadata?.department) {
      return res.status(400).json({ error: 'pto.approve.department requires metadata.department' });
    }
    const grant = await addGrant({
      capability,
      principal,
      principalType,
      metadata: metadata ?? null,
      createdBy: req.user.id,
    });
    res.json(grant);
  } catch (err: any) {
    console.error('[Authz] add failed:', err?.message);
    res.status(500).json({ error: 'Failed to add grant' });
  }
});

router.delete('/api/authz/grants/:id', requireAuth, requireSystemAdmin, async (req, res) => {
  try {
    const all = await listGrants();
    const target = all.find((g) => g.id === req.params.id);
    if (!target) {
      return res.status(404).json({ error: 'Grant not found' });
    }
    // Never allow the approver pool to reach zero — that would strand every
    // pending PTO request with no one able to act on it.
    if (target.capability === 'pto.approve.core') {
      const remaining = all.filter(
        (g) => g.capability === 'pto.approve.core' && g.enabled && g.id !== target.id,
      );
      if (remaining.length === 0) {
        return res.status(400).json({ error: 'Cannot remove the last PTO core approver' });
      }
    }
    await removeGrant(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Authz] remove failed:', err?.message);
    res.status(500).json({ error: 'Failed to remove grant' });
  }
});

export default router;
