import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { MANAGER_ROLES, SUPER_ADMIN_EMAIL } from '@shared/constants/roles';
import { downloadQrSvg, downloadQrPng } from '@/lib/qr-download';
import {
  Megaphone, Eye, QrCode, Plus, Pencil, Trash2, Copy, ExternalLink,
  AlertCircle, Power,
} from 'lucide-react';

interface Campaign {
  id: string;
  code: string;
  name: string;
  destinationUrl: string;
  channel: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  isActive: boolean;
  shortUrl: string;
  qrCodeUrl: string;
  totalScans: number;
  scans30d: number;
}

const CHANNELS = [
  { value: 'yard_sign', label: 'Yard Sign' },
  { value: 'print', label: 'Print / Flyer' },
  { value: 'truck_wrap', label: 'Truck Wrap' },
  { value: 'business_card', label: 'Business Card' },
  { value: 'other', label: 'Other' },
];

// Common Roof-ER destinations — one-click so campaigns never point at a dead URL.
const DEST_PRESETS = [
  { label: 'Free Inspection', url: 'https://www.theroofdocs.com/inspection/' },
  { label: 'Storm / Roof Check', url: 'https://get.theroofdocs.com/roofcheck' },
];
const channelLabel = (v: string | null) => CHANNELS.find((c) => c.value === v)?.label || 'Other';

const emptyForm = {
  name: '', destinationUrl: '', channel: 'yard_sign',
  utmSource: '', utmMedium: '', utmCampaign: '', code: '', isActive: true,
};
type FormState = typeof emptyForm;

export default function MarketingCampaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManager = user?.email === SUPER_ADMIN_EMAIL || (!!user?.role && MANAGER_ROLES.includes(user.role));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: campaigns = [], isLoading, error } = useQuery<Campaign[]>({
    queryKey: ['/api/marketing/campaigns'],
    enabled: isManager,
  });

  const onErr = (fallback: string) => (e: any) =>
    toast({ title: 'Error', description: e?.message || fallback, variant: 'destructive' });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/marketing/campaigns', 'POST', data),
    onSuccess: () => { toast({ title: 'Campaign created' }); invalidate(); closeDialog(); },
    onError: onErr('Failed to create campaign.'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/marketing/campaigns/${id}`, 'PATCH', data),
    onSuccess: () => { toast({ title: 'Campaign updated' }); invalidate(); closeDialog(); },
    onError: onErr('Failed to update campaign.'),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest(`/api/marketing/campaigns/${id}`, 'PATCH', { isActive }),
    onSuccess: () => invalidate(),
    onError: onErr('Failed to update campaign.'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/marketing/campaigns/${id}`, 'DELETE'),
    onSuccess: () => { toast({ title: 'Campaign deleted' }); invalidate(); },
    onError: onErr('Failed to delete campaign.'),
  });

  if (!isManager) return <Navigate to="/qr-codes" replace />;

  function openCreate() {
    setEditingId(null); setForm(emptyForm); setShowAdvanced(false); setDialogOpen(true);
  }
  function openEdit(c: Campaign) {
    setEditingId(c.id);
    setForm({
      name: c.name, destinationUrl: c.destinationUrl, channel: c.channel || 'other',
      utmSource: c.utmSource || '', utmMedium: c.utmMedium || '', utmCampaign: c.utmCampaign || '',
      code: c.code, isActive: c.isActive,
    });
    setShowAdvanced(!!(c.utmSource || c.utmMedium || c.utmCampaign));
    setDialogOpen(true);
  }
  function closeDialog() { setDialogOpen(false); setEditingId(null); }

  function submit() {
    if (!form.name.trim() || !form.destinationUrl.trim()) {
      toast({ title: 'Missing info', description: 'Name and destination URL are required.', variant: 'destructive' });
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      destinationUrl: form.destinationUrl.trim(),
      channel: form.channel,
      utmSource: form.utmSource.trim() || undefined,
      utmMedium: form.utmMedium.trim() || undefined,
      utmCampaign: form.utmCampaign.trim() || undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: { ...payload, isActive: form.isActive } });
    } else {
      if (form.code.trim()) payload.code = form.code.trim();
      createMutation.mutate(payload);
    }
  }

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast({ title: 'Copied', description: text }),
      () => toast({ title: 'Copy failed', variant: 'destructive' }),
    );
  };

  const totals = campaigns.reduce(
    (a, c) => ({ scans: a.scans + c.totalScans, active: a.active + (c.isActive ? 1 : 0) }),
    { scans: 0, active: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/15 p-3"><Megaphone className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-3xl font-bold">Marketing Campaigns</h1>
            <p className="text-muted-foreground">
              Trackable QR codes for yard signs, print, and truck wraps — each scan is logged and redirected with UTM attribution.
            </p>
          </div>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Campaign</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campaigns</CardTitle>
            <Megaphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{campaigns.length}</div><p className="text-xs text-muted-foreground">{totals.active} active</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{totals.scans}</div><p className="text-xs text-muted-foreground">All-time campaign scans</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scans (30d)</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{campaigns.reduce((s, c) => s + c.scans30d, 0)}</div><p className="text-xs text-muted-foreground">Last 30 days</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>All Campaigns</CardTitle></CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="font-medium">Couldn't load campaigns.</p>
              <p className="text-sm text-muted-foreground">{(error as Error)?.message || 'Please try again shortly.'}</p>
            </div>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : campaigns.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-muted-foreground">No campaigns yet. Create one to generate a trackable QR code.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg border hover:bg-muted/50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{c.name}</h3>
                      <Badge variant="outline">{channelLabel(c.channel)}</Badge>
                      <Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Active' : 'Paused'}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground min-w-0">
                      <button onClick={() => copy(c.shortUrl)} className="inline-flex items-center gap-1 hover:text-foreground" title="Copy short link">
                        <Copy className="h-3 w-3" /> {c.shortUrl.replace(/^https?:\/\//, '')}
                      </button>
                    </div>
                    <a href={c.destinationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline truncate max-w-md">
                      <ExternalLink className="h-3 w-3 shrink-0" /> {c.destinationUrl}
                    </a>
                  </div>

                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-center"><p className="text-2xl font-bold">{c.totalScans}</p><p className="text-xs text-muted-foreground">Scans</p></div>
                    <div className="text-center"><p className="text-2xl font-bold">{c.scans30d}</p><p className="text-xs text-muted-foreground">30d</p></div>

                    <QrDialog campaign={c} />

                    <Button variant="ghost" size="icon" title={c.isActive ? 'Pause' : 'Activate'}
                      onClick={() => toggleMutation.mutate({ id: c.id, isActive: !c.isActive })}>
                      <Power className={`h-4 w-4 ${c.isActive ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" title="Delete"
                      onClick={() => { if (window.confirm(`Delete campaign "${c.name}"? Its scan history is removed too.`)) deleteMutation.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? 'Edit campaign' : 'New campaign'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fall Yard Sign Blitz" />
            </div>
            <div>
              <label className="text-sm font-medium">Destination URL *</label>
              <div className="flex flex-wrap gap-2 my-2">
                {DEST_PRESETS.map((p) => (
                  <button key={p.url} type="button" onClick={() => setForm({ ...form, destinationUrl: p.url })}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.destinationUrl === p.url ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <Input value={form.destinationUrl} onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })} placeholder="https://www.theroofdocs.com/inspection/" />
              <p className="text-xs text-muted-foreground mt-1">Pick a preset or paste any URL. UTM tags are added automatically.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Channel</label>
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}
                className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            {!editingId && (
              <div>
                <label className="text-sm font-medium">Custom short code (optional)</label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="auto-generated from name" />
                <p className="text-xs text-muted-foreground mt-1">The link becomes /m/&lt;code&gt;. Can't change after the QR is printed.</p>
              </div>
            )}
            {editingId && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            )}

            <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="text-xs text-blue-600 hover:underline">
              {showAdvanced ? 'Hide' : 'Show'} UTM overrides
            </button>
            {showAdvanced && (
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-xs text-muted-foreground">utm_source</label><Input value={form.utmSource} onChange={(e) => setForm({ ...form, utmSource: e.target.value })} placeholder="qr" /></div>
                <div><label className="text-xs text-muted-foreground">utm_medium</label><Input value={form.utmMedium} onChange={(e) => setForm({ ...form, utmMedium: e.target.value })} placeholder="offline" /></div>
                <div><label className="text-xs text-muted-foreground">utm_campaign</label><Input value={form.utmCampaign} onChange={(e) => setForm({ ...form, utmCampaign: e.target.value })} placeholder="code" /></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={submit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving…' : editingId ? 'Save changes' : 'Create campaign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QrDialog({ campaign }: { campaign: Campaign }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>View QR</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>QR Code — {campaign.name}</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center space-y-4">
          <img src={campaign.qrCodeUrl} alt="Campaign QR code" className="w-64 h-64 border rounded bg-white p-2" />
          <p className="text-sm text-muted-foreground text-center">Scan to visit:<br />{campaign.shortUrl}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadQrSvg(campaign.qrCodeUrl, `roofer-qr-${campaign.code}.svg`)}>Download SVG</Button>
            <Button onClick={() => downloadQrPng(campaign.qrCodeUrl, `roofer-qr-${campaign.code}.png`)}>Download PNG</Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">SVG = best for print vendors (scales with no quality loss). PNG = for email, Canva, docs.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
