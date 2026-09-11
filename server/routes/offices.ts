/**
 * Offices — read by anyone signed in (the interview scheduler and hire modal
 * need the list), changed only by admins (SYSTEM_ADMIN / HR_ADMIN). Mutations
 * are captured by the blanket audit middleware.
 */
import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { isAdmin } from '../../shared/constants/roles';
import * as officeService from '../services/officeService';

const router = express.Router();

function actorOf(req: any): string {
  return req.user?.email || req.user?.id || 'unknown';
}

function readInput(body: any) {
  const out: Partial<officeService.OfficeInput> = {};
  if (body?.key !== undefined) out.key = String(body.key);
  if (body?.label !== undefined) out.label = String(body.label);
  if (body?.address !== undefined) out.address = String(body.address);
  if (body?.meetPerson !== undefined) out.meetPerson = String(body.meetPerson);
  if (body?.enabled !== undefined) out.enabled = Boolean(body.enabled);
  if (body?.sortOrder !== undefined && body.sortOrder !== '') {
    const n = Number(body.sortOrder);
    if (Number.isFinite(n)) out.sortOrder = Math.trunc(n);
  }
  return out;
}

// Everyone signed in: the active offices, for pickers.
router.get('/api/offices', requireAuth, async (req: any, res) => {
  try {
    const all = String(req.query.all || '') === 'true';
    // Only admins get the disabled/removed rows.
    const rows = await officeService.listOffices({ includeDisabled: all && isAdmin(req.user), includeDeleted: false });
    res.json(rows);
  } catch (err: any) {
    console.error('[Offices] list failed:', err?.message);
    // Pickers must still work if the table is unreachable.
    res.json(officeService.FALLBACK_OFFICES.map((o, i) => ({ ...o, id: `fallback-${o.key}`, enabled: true, sortOrder: (i + 1) * 10 })));
  }
});

router.post('/api/offices', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const input = readInput(req.body);
    if (!input.label?.trim()) return res.status(400).json({ error: 'A name is required' });
    if (!input.address?.trim()) return res.status(400).json({ error: 'An address is required' });
    const created = await officeService.createOffice(input as officeService.OfficeInput, actorOf(req));
    res.status(201).json(created);
  } catch (err: any) {
    const msg = err?.message || 'Failed to create office';
    res.status(/already exists/.test(msg) ? 409 : 500).json({ error: msg });
  }
});

router.patch('/api/offices/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const input = readInput(req.body);
    if (input.label !== undefined && !input.label.trim()) return res.status(400).json({ error: 'A name is required' });
    if (input.address !== undefined && !input.address.trim()) return res.status(400).json({ error: 'An address is required' });
    const updated = await officeService.updateOffice(req.params.id, input, actorOf(req));
    if (!updated) return res.status(404).json({ error: 'Office not found' });
    res.json(updated);
  } catch (err: any) {
    console.error('[Offices] update failed:', err?.message);
    res.status(500).json({ error: 'Failed to update office' });
  }
});

router.delete('/api/offices/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const removed = await officeService.deleteOffice(req.params.id, actorOf(req));
    if (!removed) return res.status(404).json({ error: 'Office not found' });
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[Offices] delete failed:', err?.message);
    res.status(500).json({ error: 'Failed to remove office' });
  }
});

export default router;
