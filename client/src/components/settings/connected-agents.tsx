/**
 * Connected agents — a person's own MCP tokens.
 *
 * Any MCP client (Genie 21, Claude, ChatGPT, Cursor) connects to /mcp with one
 * of these tokens and acts AS this person: it sees exactly what they can see in
 * Roof HR. Pass one is read-only — the area picker offers "<area>:read" only
 * and the copy says so.
 *
 * Backed by /api/mcp/tokens (self-scoped to the session). The plaintext token
 * is shown ONCE, right after minting; after that only the last four characters.
 * Mounted on Settings → Personal (admins) and on My Portal (everyone).
 */

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Check, Copy, Loader2, Plug, Plus, Trash2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (mirror server/routes/mcp-tokens.ts)
// ---------------------------------------------------------------------------

export interface AgentToken {
  id: string;
  name: string;
  hint: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface AgentArea {
  area: string;
  scope: string;
  label: string;
  description: string;
  allowed: boolean;
}

interface TokensResponse { tokens: AgentToken[]; endpoint: string }
interface AreasResponse { endpoint: string; readOnly: boolean; areas: AgentArea[] }
interface MintResponse extends AgentToken { token: string; endpoint: string }

export const AGENT_TOKENS_QUERY_KEY = ['mcp-tokens'] as const;
export const AGENT_AREAS_QUERY_KEY = ['mcp-token-areas'] as const;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchTokens(): Promise<TokensResponse> {
  const res = await fetch('/api/mcp/tokens', { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load agent tokens (${res.status})`);
  const body = (await res.json()) as Partial<TokensResponse>;
  return { tokens: Array.isArray(body.tokens) ? body.tokens : [], endpoint: body.endpoint || '' };
}

async function fetchAreas(): Promise<AreasResponse> {
  const res = await fetch('/api/mcp/tokens/areas', { headers: authHeaders(), credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load agent areas (${res.status})`);
  const body = (await res.json()) as Partial<AreasResponse>;
  return { endpoint: body.endpoint || '', readOnly: true, areas: Array.isArray(body.areas) ? body.areas : [] };
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the value is selectable on screen */
    }
  }, [value]);
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void copy()} aria-label={label}>
      {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConnectedAgents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'list' | 'new'>('list');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<MintResponse | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<AgentToken | null>(null);
  const [revoking, setRevoking] = useState(false);

  const tokens = useQuery({ queryKey: AGENT_TOKENS_QUERY_KEY, queryFn: fetchTokens, staleTime: 30_000 });
  const areas = useQuery({ queryKey: AGENT_AREAS_QUERY_KEY, queryFn: fetchAreas, staleTime: 5 * 60_000 });

  const endpoint = tokens.data?.endpoint || areas.data?.endpoint || `${window.location.origin}/mcp`;
  const allowedAreas = useMemo(() => (areas.data?.areas ?? []).filter((a) => a.allowed), [areas.data]);

  const resetForm = () => {
    setName('');
    setPicked({});
    setExpiresInDays('');
    setError(null);
  };

  const mint = useCallback(async (): Promise<boolean> => {
    const scopes = Object.entries(picked).filter(([, on]) => on).map(([scope]) => scope);
    if (!name.trim()) { setError('Give the token a name — usually the agent that will use it.'); return false; }
    if (scopes.length === 0) { setError('Pick at least one area the agent may read.'); return false; }
    setMinting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: name.trim(), scopes };
      if (expiresInDays.trim()) body.expiresInDays = Number(expiresInDays);
      const res = await fetch('/api/mcp/tokens', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as (MintResponse & { error?: string }) | null;
      if (!res.ok || !json?.token) {
        setError(json?.error || 'Could not create the token. Try again.');
        return false;
      }
      setMinted(json);
      resetForm();
      await queryClient.invalidateQueries({ queryKey: AGENT_TOKENS_QUERY_KEY });
      return true;
    } catch (err) {
      setError('Network error — the token was not created.');
      console.error('[connected-agents] mint failed:', err);
      return false;
    } finally {
      setMinting(false);
    }
  }, [expiresInDays, name, picked, queryClient]);

  const revoke = useCallback(async (token: AgentToken) => {
    setRevoking(true);
    setError(null);
    try {
      const res = await fetch(`/api/mcp/tokens/${encodeURIComponent(token.id)}`, {
        method: 'DELETE',
        headers: authHeaders(),
        credentials: 'include',
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error || `Could not revoke "${token.name}".`);
        return;
      }
      setConfirmRevoke(null);
      toast({ title: 'Token revoked', description: `"${token.name}" can no longer read Roof HR.` });
      await queryClient.invalidateQueries({ queryKey: AGENT_TOKENS_QUERY_KEY });
    } catch (err) {
      setError('Network error — the token was not revoked.');
      console.error('[connected-agents] revoke failed:', err);
    } finally {
      setRevoking(false);
    }
  }, [queryClient, toast]);

  const list = tokens.data?.tokens ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Plug className="w-5 h-5 mr-2" />
          Connected agents
        </CardTitle>
        <CardDescription>
          Tokens that let an AI agent read Roof HR as you — nothing more than you can already see, and nothing it can change.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Freshly minted token — shown once */}
        {minted && (
          <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 space-y-3">
            <div className="text-sm font-semibold text-blue-900">Your new token for “{minted.name}”</div>
            <div className="text-xs text-blue-800">
              Copy it now — Roof HR keeps only a fingerprint and will not show it again.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white/80 px-2 py-1.5 text-xs break-all select-all border border-blue-200">
                {minted.token}
              </code>
              <CopyButton value={minted.token} label="Copy token" />
            </div>
            <div className="text-xs text-blue-900 space-y-1">
              <div className="font-semibold">Connect an agent</div>
              <div className="flex items-center gap-2">
                Endpoint: <code className="select-all">{minted.endpoint || endpoint}</code>
                <CopyButton value={minted.endpoint || endpoint} label="Copy endpoint" />
              </div>
              <div>Header: <code className="select-all">Authorization: Bearer {minted.token}</code></div>
              <div>Works with any MCP client (Genie 21, Claude, ChatGPT, Cursor). Read-only: the agent can look things up, never change them.</div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setMinted(null)}>Done, I saved it</Button>
          </div>
        )}

        {mode === 'list' ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-gray-600">
                Endpoint <code className="select-all">{endpoint}</code> · header <code>Authorization: Bearer …</code>
              </div>
              <Button type="button" size="sm" onClick={() => { resetForm(); setMode('new'); }}>
                <Plus className="w-4 h-4 mr-1" /> New token
              </Button>
            </div>

            {tokens.isLoading ? (
              <div role="status" className="flex items-center gap-2 py-4 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : tokens.isError ? (
              <div role="alert" className="flex items-center justify-between rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                <span>Could not load your tokens</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void tokens.refetch()}>Retry</Button>
              </div>
            ) : list.length === 0 ? (
              <div className="rounded-lg border border-dashed p-5 text-center text-sm text-gray-500">
                No agents connected yet. Create a token and paste it into your agent.
              </div>
            ) : (
              <div className="space-y-2">
                {list.map((t) => (
                  <div key={t.id} className="rounded-lg border px-3 py-2.5 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium">
                        {t.name} <span className="font-mono font-normal text-gray-500">…{t.hint}</span>
                      </div>
                      {confirmRevoke?.id === t.id ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-red-700">Revoke “{t.name}”? Its agent stops working immediately.</span>
                          <Button type="button" variant="destructive" size="sm" disabled={revoking} onClick={() => void revoke(t)}>
                            {revoking ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />} Revoke
                          </Button>
                          <Button type="button" variant="outline" size="sm" disabled={revoking} onClick={() => setConfirmRevoke(null)}>Keep</Button>
                        </div>
                      ) : (
                        <Button type="button" variant="outline" size="sm" onClick={() => setConfirmRevoke(t)} aria-label={`Revoke ${t.name}`}>
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {t.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="font-mono text-[11px]">{s}</Badge>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500">
                      Created {formatDay(t.createdAt)} · last used {formatWhen(t.lastUsedAt)}
                      {t.expiresAt ? ` · expires ${formatDay(t.expiresAt)}` : ' · no expiry'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold">New agent token</div>
              <p className="text-xs text-gray-600">
                Read-only for now: pick which areas the agent may look at. It will see exactly what you see in Roof HR, and it cannot change anything.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-token-name">Name</Label>
              <Input
                id="agent-token-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Genie 21, Claude on my laptop"
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <Label>What it may read</Label>
              {areas.isLoading ? (
                <div role="status" className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : allowedAreas.length === 0 ? (
                <div className="text-sm text-gray-500">Your role has no areas an agent could read.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {allowedAreas.map((a) => (
                    <label key={a.scope} htmlFor={`agent-area-${a.area}`} className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer">
                      <Checkbox
                        id={`agent-area-${a.area}`}
                        checked={!!picked[a.scope]}
                        onCheckedChange={(checked) => setPicked((p) => ({ ...p, [a.scope]: checked === true }))}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-medium">{a.label}</span>{' '}
                        <span className="font-mono text-[11px] text-gray-500">{a.scope}</span>
                        <div className="text-xs text-gray-600">{a.description}</div>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {allowedAreas.length > 0 && (
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setPicked(Object.fromEntries(allowedAreas.map((a) => [a.scope, true])))}>Select all</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPicked({})}>Clear</Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5 max-w-xs">
              <Label htmlFor="agent-token-expiry">Expires after (days, optional)</Label>
              <Input
                id="agent-token-expiry"
                type="number"
                min={1}
                max={365}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
                placeholder="never"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" disabled={minting} onClick={() => { resetForm(); setMode('list'); }}>Cancel</Button>
              <Button type="button" disabled={minting} onClick={() => { void mint().then((ok) => { if (ok) setMode('list'); }); }}>
                {minting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />} Create token
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
