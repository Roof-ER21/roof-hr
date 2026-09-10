/**
 * "Susan wants to read your Roof HR, as you." — the consent screen.
 *
 * Another Roof-ER app sends the person here to connect it to Roof HR. The whole
 * point of the detour is that ROOF HR signs them in, not the app that sent them:
 * the app never says who they are, and what links the two accounts is this
 * round-trip, not a matching email address.
 *
 * This is a client route rather than a server-rendered page because Roof HR
 * authenticates with a bearer in localStorage and sets no cookie — a page
 * rendered on the server would have no way to know who is looking at it.
 *
 * Nothing here decides permissions. The server answers /request for the
 * signed-in caller, already narrowed to what their role can reach, and this
 * screen shows exactly that — including what is being WITHHELD, so a rep can
 * see that Susan asked for something their role does not reach.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, Check, Loader2, Lock, Plug, ShieldCheck } from 'lucide-react';

type Grant = { area: string; scope: string; label: string; description: string };

interface ConnectRequest {
  app: { slug: string; displayName: string; purpose: string };
  you: { name: string; email: string; role: string };
  grants: Grant[];
  withheld: Grant[];
  readOnly: boolean;
  expiresInDays: number;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ConnectAgent() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const appSlug = params.get('app') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const state = params.get('state') ?? '';

  const [request, setRequest] = useState<ConnectRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!appSlug || !redirectUri) {
        setError('That connection link is incomplete. Start again from the app you were using.');
        setLoading(false);
        return;
      }
      try {
        const qs = new URLSearchParams({ app: appSlug, redirect_uri: redirectUri });
        const res = await fetch(`/api/mcp/connect/request?${qs}`, { headers: authHeaders(), credentials: 'include' });
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setError(body?.error ?? `Roof HR could not check that request (${res.status}).`);
        } else {
          setRequest(body as ConnectRequest);
        }
      } catch {
        if (!cancelled) setError('Could not reach Roof HR. Check your connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appSlug, redirectUri]);

  const approve = useCallback(async () => {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch('/api/mcp/connect/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({ app: appSlug, redirect_uri: redirectUri, state }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.redirectTo) {
        setError(body?.error ?? `Roof HR could not complete that connection (${res.status}).`);
        setApproving(false);
        return;
      }
      // Hand the one-time code back to the app. The token is not in this URL.
      window.location.assign(body.redirectTo as string);
    } catch {
      setError('Could not reach Roof HR. Nothing was connected.');
      setApproving(false);
    }
  }, [appSlug, redirectUri, state]);

  const cancel = useCallback(() => {
    if (!redirectUri) { window.location.assign('/'); return; }
    try {
      const target = new URL(redirectUri);
      target.searchParams.set('error', 'access_denied');
      if (state) target.searchParams.set('state', state);
      window.location.assign(target.toString());
    } catch {
      window.location.assign('/');
    }
  }, [redirectUri, state]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Nothing was connected
            </CardTitle>
            <CardDescription>{error ?? 'That request could not be checked.'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => window.location.assign('/')}>Back to Roof HR</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plug className="h-5 w-5" />
            Connect {request.app.displayName} to Roof HR
          </CardTitle>
          <CardDescription>
            {request.app.displayName} is asking to read your Roof HR {request.app.purpose}. It will see
            exactly what <strong>you</strong> can see — nothing more.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-muted-foreground">You are signed in to Roof HR as</div>
            <div className="font-medium">{request.you.name || request.you.email}</div>
            <div className="text-muted-foreground">{request.you.email} · {request.you.role}</div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              What it will be able to read
              {request.readOnly && <Badge variant="secondary">Read only</Badge>}
            </div>
            <ul className="space-y-2">
              {request.grants.map((g) => (
                <li key={g.scope} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>
                    <span className="font-medium">{g.label}</span>
                    <span className="block text-muted-foreground">{g.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {request.withheld.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Asked for, but your role does not reach it
              </div>
              <ul className="space-y-1">
                {request.withheld.map((g) => (
                  <li key={g.scope} className="text-sm text-muted-foreground">{g.label}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                These are not being granted. If your role changes, connect again to pick them up.
              </p>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            This connection lasts {request.expiresInDays} days and can be removed any time from
            Connected agents in Roof HR. Removing it stops {request.app.displayName} immediately.
          </p>

          <div className="flex gap-2">
            <Button onClick={approve} disabled={approving || request.grants.length === 0}>
              {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
              Allow
            </Button>
            <Button variant="outline" onClick={cancel} disabled={approving}>Cancel</Button>
          </div>

          {request.grants.length === 0 && (
            <p className="text-sm text-amber-600">
              Your role does not reach anything {request.app.displayName} is asking for, so there is
              nothing to connect.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
