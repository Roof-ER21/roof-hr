/**
 * Welcome Email — the admin screen for what a new hire actually receives.
 *
 * Two things live here, both of which used to require a developer and a deploy:
 * the PDFs attached to the welcome email, and the body of the email itself.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import {
  Paperclip,
  Plus,
  Eye,
  History,
  Trash2,
  Upload,
  RotateCcw,
  Undo2,
  FileText,
  Info,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

// ---------------------------------------------------------------------------
// Types + helpers
// ---------------------------------------------------------------------------

interface Attachment {
  id: string;
  slot: string | null;
  label: string;
  filename: string;
  description: string | null;
  contentType: string;
  fileSize: number;
  checksum: string;
  version: number;
  enabled: boolean;
  sortOrder: number;
  updatedBy: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AttachmentVersion {
  id: string;
  version: number;
  label: string;
  filename: string;
  contentType: string;
  fileSize: number;
  changeLog: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface TemplateVersionRow {
  id: string;
  version: number;
  subject: string;
  changeLog: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface TemplateResponse {
  variant: Variant;
  usingBuiltIn: boolean;
  saved: { subject: string; bodyHtml: string; enabled: boolean; version: number; updatedBy: string | null; updatedAt: string } | null;
  builtIn: { subject: string; bodyHtml: string };
}

interface TokenDoc {
  token: string;
  description: string;
}

type Variant = 'insurance' | 'retail';

const VARIANT_LABEL: Record<Variant, string> = {
  insurance: 'Insurance / Sales',
  retail: 'Retail Division',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Upload endpoints take multipart, which apiRequest's JSON path cannot send. */
async function sendMultipart(url: string, method: 'POST' | 'PUT', form: FormData) {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: authHeaders(),
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      message = JSON.parse(body).error || body;
    } catch {
      /* plain text */
    }
    throw new Error(message || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * These files need the auth header, so they cannot be linked or framed
 * directly — fetch the bytes and hand the browser an object URL.
 */
async function openFileInNewTab(url: string) {
  const res = await fetch(url, { credentials: 'include', headers: authHeaders() });
  if (!res.ok) throw new Error('Could not open that file');
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener');
  // Give the new tab time to claim the blob before releasing it.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

// ---------------------------------------------------------------------------

export default function WelcomeEmailManager() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Welcome Email</h2>
        <p className="text-sm text-muted-foreground">
          What a new hire receives on day one. Changes take effect on the next welcome email sent —
          no deploy needed.
        </p>
      </div>

      <AttachmentsCard />
      <BodyCard />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

function AttachmentsCard() {
  const queryClient = useQueryClient();
  const [showRemoved, setShowRemoved] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Attachment | null>(null);
  const [historyFor, setHistoryFor] = useState<Attachment | null>(null);

  const { data: attachments = [], isLoading } = useQuery<Attachment[]>({
    queryKey: ['/api/welcome-email/attachments', showRemoved],
    queryFn: () =>
      apiRequest<Attachment[]>(
        `/api/welcome-email/attachments${showRemoved ? '?includeDeleted=true' : ''}`,
        'GET',
      ),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['/api/welcome-email/attachments'] });

  const toggleEnabled = useMutation({
    mutationFn: async (row: Attachment) => {
      const form = new FormData();
      form.append('enabled', String(!row.enabled));
      return sendMultipart(`/api/welcome-email/attachments/${row.id}`, 'PUT', form);
    },
    onSuccess: (_data, row) => {
      invalidate();
      toast({
        title: row.enabled ? 'Attachment turned off' : 'Attachment turned on',
        description: row.enabled
          ? `${row.label} will no longer be attached.`
          : `${row.label} will be attached again.`,
      });
    },
    onError: (err: Error) => toast({ title: 'Could not update', description: err.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: (row: Attachment) =>
      apiRequest(`/api/welcome-email/attachments/${row.id}`, 'DELETE'),
    onSuccess: (_d, row) => {
      invalidate();
      toast({ title: 'Removed', description: `${row.label} will no longer be attached. You can put it back from "Show removed".` });
    },
    onError: (err: Error) => toast({ title: 'Could not remove', description: err.message, variant: 'destructive' }),
  });

  const restore = useMutation({
    mutationFn: (row: Attachment) =>
      apiRequest(`/api/welcome-email/attachments/${row.id}/restore`, 'POST'),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Restored' });
    },
    onError: (err: Error) => toast({ title: 'Could not restore', description: err.message, variant: 'destructive' }),
  });

  const live = attachments.filter((a) => !a.deletedAt);
  const enabledCount = live.filter((a) => a.enabled).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Attachments
          </CardTitle>
          <CardDescription>
            {enabledCount === 0
              ? 'No documents are attached to the welcome email right now.'
              : `${enabledCount} document${enabledCount === 1 ? '' : 's'} attached to every welcome email.`}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRemoved((v) => !v)}>
            {showRemoved ? 'Hide removed' : 'Show removed'}
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Add attachment
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : attachments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing here yet. Add the first document.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="w-24">Version</TableHead>
                <TableHead className="w-28">Attached</TableHead>
                <TableHead className="w-[280px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attachments.map((row) => (
                <TableRow key={row.id} className={row.deletedAt ? 'opacity-60' : undefined}>
                  <TableCell>
                    <div className="font-medium">{row.label}</div>
                    {row.description && (
                      <div className="text-xs text-muted-foreground">{row.description}</div>
                    )}
                    {row.deletedAt && (
                      <Badge variant="outline" className="mt-1">
                        Removed
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="max-w-[220px] truncate" title={row.filename}>
                        {row.filename}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(row.fileSize)} · updated {formatWhen(row.updatedAt)}
                      {row.updatedBy ? ` by ${row.updatedBy}` : ''}
                    </div>
                  </TableCell>
                  <TableCell>v{row.version}</TableCell>
                  <TableCell>
                    {row.deletedAt ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <Switch
                        checked={row.enabled}
                        onCheckedChange={() => toggleEnabled.mutate(row)}
                        aria-label={`Attach ${row.label}`}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Open the current file"
                        onClick={() =>
                          openFileInNewTab(`/api/welcome-email/attachments/${row.id}/file`).catch(
                            (e: Error) =>
                              toast({ title: 'Could not open', description: e.message, variant: 'destructive' }),
                          )
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="History" onClick={() => setHistoryFor(row)}>
                        <History className="h-4 w-4" />
                      </Button>
                      {row.deletedAt ? (
                        <Button variant="ghost" size="sm" title="Put back" onClick={() => restore.mutate(row)}>
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setEditing(row)}>
                            <Upload className="mr-1 h-4 w-4" />
                            Replace
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Remove"
                            onClick={() => {
                              if (window.confirm(`Remove "${row.label}" from the welcome email?`)) {
                                remove.mutate(row);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AttachmentDialog
        open={addOpen}
        mode="create"
        onOpenChange={setAddOpen}
        onSaved={invalidate}
      />
      <AttachmentDialog
        open={!!editing}
        mode="edit"
        attachment={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={invalidate}
      />
      <AttachmentHistoryDialog
        attachment={historyFor}
        onOpenChange={(open) => !open && setHistoryFor(null)}
        onRestored={invalidate}
      />
    </Card>
  );
}

function AttachmentDialog({
  open,
  mode,
  attachment,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  attachment?: Attachment | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState('');
  const [filename, setFilename] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [changeLog, setChangeLog] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLabel(attachment?.label ?? '');
    setFilename(attachment?.filename ?? '');
    setDescription(attachment?.description ?? '');
    setChangeLog('');
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
  }, [open, attachment]);

  const save = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append('label', label.trim());
      form.append('description', description);
      if (filename.trim()) form.append('filename', filename.trim());
      if (changeLog.trim()) form.append('changeLog', changeLog.trim());
      if (file) form.append('file', file);

      if (mode === 'create') {
        return sendMultipart('/api/welcome-email/attachments', 'POST', form);
      }
      return sendMultipart(`/api/welcome-email/attachments/${attachment!.id}`, 'PUT', form);
    },
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
      toast({
        title: mode === 'create' ? 'Attachment added' : 'Attachment updated',
        description: 'It will be used on the next welcome email sent.',
      });
    },
    onError: (err: Error) =>
      toast({ title: 'Could not save', description: err.message, variant: 'destructive' }),
  });

  const canSave = label.trim().length > 0 && (mode === 'edit' || !!file) && !save.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add attachment' : `Edit ${attachment?.label ?? ''}`}</DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'PDF, Word, PNG or JPEG, up to 15 MB.'
              : 'Upload a new file to replace the current one, or just change the details. The old file is kept in history.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wea-label">Name in the email</Label>
            <Input
              id="wea-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Training Manual"
            />
            <p className="text-xs text-muted-foreground">
              This is what the new hire sees listed in the email body.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wea-file">{mode === 'create' ? 'File' : 'Replace file (optional)'}</Label>
            <Input
              id="wea-file"
              type="file"
              ref={fileInput}
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                setFile(picked);
                // Default the recipient-facing filename to what they picked.
                if (picked && (!filename.trim() || mode === 'create')) setFilename(picked.name);
              }}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} · {formatBytes(file.size)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="wea-filename">Filename the recipient sees</Label>
            <Input
              id="wea-filename"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Training-Manual.pdf"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="wea-description">Internal note (optional)</Label>
            <Textarea
              id="wea-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Not shown to the new hire."
            />
          </div>

          {mode === 'edit' && file && (
            <div className="space-y-2">
              <Label htmlFor="wea-changelog">What changed (optional)</Label>
              <Input
                id="wea-changelog"
                value={changeLog}
                onChange={(e) => setChangeLog(e.target.value)}
                placeholder="Rebuilt photo pages 15-18"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentHistoryDialog({
  attachment,
  onOpenChange,
  onRestored,
}: {
  attachment: Attachment | null;
  onOpenChange: (open: boolean) => void;
  onRestored: () => void;
}) {
  const { data: versions = [], isLoading, refetch } = useQuery<AttachmentVersion[]>({
    queryKey: ['/api/welcome-email/attachments', attachment?.id, 'versions'],
    queryFn: () =>
      apiRequest<AttachmentVersion[]>(`/api/welcome-email/attachments/${attachment!.id}/versions`, 'GET'),
    enabled: !!attachment,
  });

  const restore = useMutation({
    mutationFn: (version: AttachmentVersion) =>
      apiRequest(
        `/api/welcome-email/attachments/${attachment!.id}/versions/${version.id}/restore`,
        'POST',
      ),
    onSuccess: (_d, version) => {
      refetch();
      onRestored();
      toast({ title: `Rolled back to v${version.version}`, description: 'Saved as a new version.' });
    },
    onError: (err: Error) =>
      toast({ title: 'Could not roll back', description: err.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={!!attachment} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>History — {attachment?.label}</DialogTitle>
          <DialogDescription>
            Every file that has been in this slot. Rolling back saves the old file as a new version,
            so nothing is lost either way.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No earlier versions yet — this file has not been replaced.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Version</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Change</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    v{v.version}
                    {attachment && v.version === attachment.version && (
                      <Badge className="ml-2">current</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate text-sm" title={v.filename}>
                      {v.filename}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatBytes(v.fileSize)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{v.changeLog || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatWhen(v.createdAt)}
                      {v.createdBy ? ` · ${v.createdBy}` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Open this version"
                        onClick={() =>
                          openFileInNewTab(`/api/welcome-email/attachment-versions/${v.id}/file`).catch(
                            (e: Error) =>
                              toast({ title: 'Could not open', description: e.message, variant: 'destructive' }),
                          )
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {attachment && v.version !== attachment.version && (
                        <Button variant="outline" size="sm" onClick={() => restore.mutate(v)}>
                          <RotateCcw className="mr-1 h-4 w-4" />
                          Roll back
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

function BodyCard() {
  const [variant, setVariant] = useState<Variant>('insurance');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email body</CardTitle>
        <CardDescription>
          Two versions go out depending on the hire: sales hires get the insurance email, retail
          hires get the retail one. Edit either.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={variant} onValueChange={(v) => setVariant(v as Variant)}>
          <TabsList>
            <TabsTrigger value="insurance">{VARIANT_LABEL.insurance}</TabsTrigger>
            <TabsTrigger value="retail">{VARIANT_LABEL.retail}</TabsTrigger>
          </TabsList>
          {(['insurance', 'retail'] as Variant[]).map((v) => (
            <TabsContent key={v} value={v} className="pt-4">
              <BodyEditor variant={v} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function BodyEditor({ variant }: { variant: Variant }) {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<{ subject: string; html: string; attachmentLabels: string[] } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data, isLoading } = useQuery<TemplateResponse>({
    queryKey: ['/api/welcome-email/templates', variant],
    queryFn: () => apiRequest<TemplateResponse>(`/api/welcome-email/templates/${variant}`, 'GET'),
  });

  const { data: tokens = [] } = useQuery<TokenDoc[]>({
    queryKey: ['/api/welcome-email/tokens'],
    queryFn: () => apiRequest<TokenDoc[]>('/api/welcome-email/tokens', 'GET'),
  });

  // Load the saved copy when there is one, otherwise show the built-in as the
  // starting point — so "edit" never begins from a blank box.
  useEffect(() => {
    if (!data) return;
    const source = data.saved && data.saved.enabled ? data.saved : data.builtIn;
    setSubject(source.subject);
    setBodyHtml(source.bodyHtml);
    setDirty(false);
  }, [data]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/welcome-email/templates', variant] });
    queryClient.invalidateQueries({ queryKey: ['/api/welcome-email/templates', variant, 'versions'] });
  };

  const save = useMutation({
    mutationFn: () =>
      apiRequest(`/api/welcome-email/templates/${variant}`, {
        method: 'PUT',
        body: JSON.stringify({ subject, bodyHtml, enabled: true }),
      }),
    onSuccess: () => {
      invalidate();
      setDirty(false);
      toast({ title: 'Saved', description: 'The next welcome email will use this version.' });
    },
    onError: (err: Error) => toast({ title: 'Could not save', description: err.message, variant: 'destructive' }),
  });

  const useBuiltIn = useMutation({
    mutationFn: () => apiRequest(`/api/welcome-email/templates/${variant}/use-built-in`, 'POST'),
    onSuccess: () => {
      invalidate();
      toast({
        title: 'Back to the built-in email',
        description: 'Your edits are kept in history and can be restored.',
      });
    },
    onError: (err: Error) => toast({ title: 'Could not switch back', description: err.message, variant: 'destructive' }),
  });

  const runPreview = useMutation({
    mutationFn: () =>
      apiRequest<{ subject: string; html: string; attachmentLabels: string[] }>(
        '/api/welcome-email/preview',
        { method: 'POST', body: JSON.stringify({ variant, draftSubject: subject, draftBodyHtml: bodyHtml }) },
      ),
    onSuccess: (result) => setPreview(result),
    onError: (err: Error) => toast({ title: 'Could not render preview', description: err.message, variant: 'destructive' }),
  });

  const unknownTokens = useMemo(() => {
    const known = new Set(tokens.map((t) => t.token));
    const found = new Set<string>();
    for (const m of `${subject}\n${bodyHtml}`.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
      if (!known.has(m[1])) found.add(m[1]);
    }
    return [...found];
  }, [subject, bodyHtml, tokens]);

  if (isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {data?.usingBuiltIn ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            This email is still the version built into the app. What you see below is that text —
            edit it and save to take it over.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Edited version v{data?.saved?.version} is live, saved{' '}
            {data?.saved ? formatWhen(data.saved.updatedAt) : ''}
            {data?.saved?.updatedBy ? ` by ${data.saved.updatedBy}` : ''}.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor={`subject-${variant}`}>Subject</Label>
        <Input
          id={`subject-${variant}`}
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setDirty(true);
          }}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={`body-${variant}`}>Body (HTML)</Label>
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
        </div>
        <Textarea
          id={`body-${variant}`}
          value={bodyHtml}
          onChange={(e) => {
            setBodyHtml(e.target.value);
            setDirty(true);
          }}
          rows={22}
          className="font-mono text-xs"
          spellCheck={false}
        />
      </div>

      {unknownTokens.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            Unknown placeholder{unknownTokens.length > 1 ? 's' : ''}:{' '}
            {unknownTokens.map((t) => `{{${t}}}`).join(', ')}. These will be sent to the new hire
            exactly as written.
          </AlertDescription>
        </Alert>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Placeholders you can use</p>
        <div className="flex flex-wrap gap-2">
          {tokens.map((t) => (
            <button
              key={t.token}
              type="button"
              title={t.description}
              className="rounded border bg-muted/50 px-2 py-1 font-mono text-xs hover:bg-muted"
              onClick={() => {
                navigator.clipboard?.writeText(`{{${t.token}}}`);
                toast({ title: `Copied {{${t.token}}}`, description: t.description });
              }}
            >
              {`{{${t.token}}}`}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending || !subject.trim() || !bodyHtml.trim()}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
        <Button variant="outline" onClick={() => runPreview.mutate()} disabled={runPreview.isPending}>
          <Eye className="mr-1 h-4 w-4" />
          Preview
        </Button>
        <Button variant="outline" onClick={() => setHistoryOpen(true)}>
          <History className="mr-1 h-4 w-4" />
          History
        </Button>
        {data?.builtIn && (
          <Button
            variant="ghost"
            onClick={() => {
              setSubject(data.builtIn.subject);
              setBodyHtml(data.builtIn.bodyHtml);
              setDirty(true);
              toast({ title: 'Loaded the built-in text', description: 'Nothing is saved until you press Save.' });
            }}
          >
            Load built-in text
          </Button>
        )}
        {!data?.usingBuiltIn && (
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm('Go back to the email built into the app? Your edits stay in history.')) {
                useBuiltIn.mutate();
              }
            }}
          >
            <Undo2 className="mr-1 h-4 w-4" />
            Use the built-in email
          </Button>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
            <DialogDescription>
              Rendered with sample details for a new hire named Alex Sample.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded border p-3">
              <div className="text-xs uppercase text-muted-foreground">Subject</div>
              <div className="font-medium">{preview?.subject}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs uppercase text-muted-foreground">Attachments</div>
              <div className="text-sm">
                {preview?.attachmentLabels.length ? preview.attachmentLabels.join(', ') : 'None'}
              </div>
            </div>
            <div
              className="rounded border p-3"
              // The body is HTML written by an admin of this system and rendered
              // for that same admin, which is the same trust level as sending it.
              dangerouslySetInnerHTML={{ __html: preview?.html ?? '' }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <TemplateHistoryDialog
        variant={variant}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        currentVersion={data?.saved?.version}
        onRestored={invalidate}
      />
    </div>
  );
}

function TemplateHistoryDialog({
  variant,
  open,
  onOpenChange,
  currentVersion,
  onRestored,
}: {
  variant: Variant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVersion?: number;
  onRestored: () => void;
}) {
  const { data: versions = [], isLoading, refetch } = useQuery<TemplateVersionRow[]>({
    queryKey: ['/api/welcome-email/templates', variant, 'versions'],
    queryFn: () =>
      apiRequest<TemplateVersionRow[]>(`/api/welcome-email/templates/${variant}/versions`, 'GET'),
    enabled: open,
  });

  const restore = useMutation({
    mutationFn: (v: TemplateVersionRow) =>
      apiRequest(`/api/welcome-email/templates/${variant}/versions/${v.id}/restore`, 'POST'),
    onSuccess: (_d, v) => {
      refetch();
      onRestored();
      toast({ title: `Rolled back to v${v.version}`, description: 'Saved as a new version.' });
    },
    onError: (err: Error) =>
      toast({ title: 'Could not roll back', description: err.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>History — {VARIANT_LABEL[variant]}</DialogTitle>
          <DialogDescription>Every saved edit to this email.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No saved edits yet — this email is still the built-in one.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Version</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Saved</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    v{v.version}
                    {v.version === currentVersion && <Badge className="ml-2">current</Badge>}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate" title={v.subject}>
                    {v.subject}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{v.changeLog || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatWhen(v.createdAt)}
                      {v.createdBy ? ` · ${v.createdBy}` : ''}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {v.version !== currentVersion && (
                      <Button variant="outline" size="sm" onClick={() => restore.mutate(v)}>
                        <RotateCcw className="mr-1 h-4 w-4" />
                        Roll back
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
