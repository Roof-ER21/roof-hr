import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'EXECUTE' | 'LOGIN' | 'LOGOUT' | 'SQL_QUERY' | 'TOGGLE' | 'EXPORT';

// Paths whose mutations are logged explicitly (or must never be logged here).
// /api/auth/* gets explicit LOGIN/LOGOUT events; /api/super-admin/* already
// hand-instruments its own createAuditLog calls with before/after values.
const SKIP_PREFIXES = [
  '/api/auth/',
  '/api/super-admin/',
  '/api/public/',
];

// Request-body keys that must never land in an audit row.
const REDACT_KEY_RE = /pass(word)?|token|secret|signature|ssn|apikey|api_key|authorization|credential/i;

const MAX_STRING = 300;      // per-value cap (base64 blobs, essay fields)
const MAX_PAYLOAD = 4000;    // total serialized cap per row

function scrub(value: any, depth = 0): any {
  if (value == null || depth > 4) return undefined;
  if (typeof value === 'string') {
    return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + `…[+${value.length - MAX_STRING} chars]` : value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(v => scrub(v, depth + 1));
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = REDACT_KEY_RE.test(k) ? '[REDACTED]' : scrub(v, depth + 1);
  }
  return out;
}

function serializePayload(body: any): string | undefined {
  if (body == null || typeof body !== 'object' || Object.keys(body).length === 0) return undefined;
  try {
    const json = JSON.stringify(scrub(body));
    return json.length > MAX_PAYLOAD ? json.slice(0, MAX_PAYLOAD) + '…' : json;
  } catch {
    return undefined;
  }
}

function methodToAction(method: string): AuditAction {
  switch (method) {
    case 'DELETE': return 'DELETE';
    case 'PUT':
    case 'PATCH': return 'UPDATE';
    default: return 'CREATE';
  }
}

const ID_SEGMENT_RE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+|[A-Za-z0-9_-]{16,})$/i;

// '/api/pto/abc123/approve' -> { resourceType: 'pto/approve', resourceId: 'abc123' }
function parseResource(path: string): { resourceType: string; resourceId?: string } {
  const segments = path.replace(/^\/api\//, '').split('/').filter(Boolean);
  const typeParts: string[] = [];
  let resourceId: string | undefined;
  for (const seg of segments) {
    if (!resourceId && ID_SEGMENT_RE.test(seg) && typeParts.length > 0) {
      resourceId = seg;
    } else {
      typeParts.push(seg);
    }
  }
  return { resourceType: typeParts.join('/') || 'api', resourceId };
}

function clientMeta(req: Request) {
  return {
    ipAddress: req.ip || undefined,
    userAgent: req.get('user-agent')?.slice(0, 500) || undefined,
  };
}

function writeRow(row: Parameters<typeof storage.createAuditLog>[0]) {
  // Fire-and-forget: the audit trail must never break or slow a request.
  Promise.resolve()
    .then(() => storage.createAuditLog(row))
    .catch((err: any) => console.warn('[Audit] write failed:', err?.message));
}

/**
 * Blanket audit trail: one row for every authenticated, successful (2xx)
 * mutating request under /api/*. Mounted app-level BEFORE routers; reads
 * req.user at response-finish time, after requireAuth has populated it.
 */
export function auditTrail(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (!req.path.startsWith('/api/')) return next();
  if (SKIP_PREFIXES.some(p => req.path.startsWith(p))) return next();

  let responseBody: any;
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    responseBody = body;
    return originalJson(body);
  } as any;

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const user = (req as any).user;
    if (!user?.id) return; // unauthenticated public mutations aren't attributable

    const { resourceType, resourceId } = parseResource(req.path);
    writeRow({
      userId: user.id,
      userEmail: user.email,
      action: methodToAction(req.method),
      resourceType,
      resourceId: resourceId ?? (typeof responseBody?.id === 'string' ? responseBody.id : undefined),
      resourceName: `${req.method} ${req.path}`,
      newValue: serializePayload(req.body),
      ...clientMeta(req),
    });
  });

  next();
}

/** Explicit auth events — called from the login/logout routes. */
export function logAuthEvent(
  req: Request,
  action: 'LOGIN' | 'LOGOUT',
  opts: { userId?: string; userEmail: string; success: boolean; reason?: string },
) {
  writeRow({
    userId: opts.userId || 'unknown',
    userEmail: opts.userEmail,
    action,
    resourceType: 'auth',
    resourceName: opts.success ? `${action.toLowerCase()} success` : `${action.toLowerCase()} failed`,
    newValue: JSON.stringify({ success: opts.success, ...(opts.reason ? { reason: opts.reason } : {}) }),
    ...clientMeta(req),
  });
}
