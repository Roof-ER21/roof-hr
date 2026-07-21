import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
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
import { LayoutTemplate, Download, RotateCcw, Megaphone, ArrowRight, Palette, Sparkles } from 'lucide-react';
import { ensurePosterFonts, makeMeasure } from '@/lib/poster/fonts';
import {
  POSTER_TEMPLATES, templateById, qrSvgFromDataUri, posterFileName,
  DEFAULT_BRAND, type PosterTemplate, type BrandTokens,
} from '@/lib/poster/templates';
import { downloadPosterPng, downloadPosterSvg } from '@/lib/poster/raster';

interface Campaign {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  shortUrl: string;
  qrCodeUrl: string;
}

interface AiVariant {
  templateId: string;
  angle: string;
  copy: Record<string, string>;
}

const BRIEF_IDEAS = [
  'Fall storm yard sign for Richmond',
  'Grocery store poster for Fairfax families',
  'Spring gutter checkup, friendly tone',
];

/** Strip the fixed width/height so the inline preview scales to its container. */
function fluid(svg: string): string {
  return svg.replace(/(<svg[^>]*?) width="\d+" height="\d+"/, '$1 style="width:100%;height:auto;display:block"');
}

/** "The stylist" — save the house look once; it flows into every template + QR. */
function BrandKitDialog({ brand, isCustomized }: { brand: BrandTokens; isCustomized: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => toForm(brand));

  function toForm(b: BrandTokens) {
    return {
      charcoal: b.charcoal, red: b.red, cream: b.cream,
      phone: b.phone, email: b.email, website: b.website,
      servingAreas: b.servingAreas.join(', '),
      chips: b.chips.join(', '),
    };
  }
  function openDialog() { setForm(toForm(brand)); setOpen(true); }

  const invalidate = () => {
    // Campaign QR colors are rendered server-side from the kit — refresh them too.
    queryClient.invalidateQueries({ queryKey: ['/api/marketing/brand'] });
    queryClient.invalidateQueries({ queryKey: ['/api/marketing/campaigns'] });
    queryClient.invalidateQueries({ queryKey: ['/api/qr-codes'] });
  };

  const saveMutation = useMutation({
    mutationFn: (tokens: any) => apiRequest('/api/marketing/brand', 'PUT', { tokens }),
    onSuccess: () => { toast({ title: 'Brand kit saved', description: 'Applied to all templates and QR codes.' }); invalidate(); setOpen(false); },
    onError: (e: any) => toast({ title: 'Not saved', description: e?.message || 'Failed to save the brand kit.', variant: 'destructive' }),
  });
  const resetMutation = useMutation({
    mutationFn: () => apiRequest('/api/marketing/brand', 'DELETE'),
    onSuccess: () => { toast({ title: 'Brand kit reset', description: 'Back to the Roof-ER defaults.' }); invalidate(); setOpen(false); },
    onError: (e: any) => toast({ title: 'Reset failed', description: e?.message || 'Please try again.', variant: 'destructive' }),
  });

  function save() {
    const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
    saveMutation.mutate({
      charcoal: form.charcoal.trim(), red: form.red.trim(), cream: form.cream.trim(),
      phone: form.phone.trim(), email: form.email.trim(), website: form.website.trim(),
      servingAreas: csv(form.servingAreas), chips: csv(form.chips),
    });
  }

  const colorField = (key: 'charcoal' | 'red' | 'cream', label: string, hint: string) => (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(form[key]) ? form[key] : '#000000'}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="h-9 w-12 rounded border border-input bg-background p-1"
          aria-label={`${label} color picker`}
        />
        <Input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="font-mono" />
      </div>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );

  return (
    <>
      <Button variant="outline" onClick={openDialog}>
        <Palette className="h-4 w-4 mr-2" /> Brand Kit{isCustomized && <Badge variant="secondary" className="ml-2">custom</Badge>}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Brand Kit</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Saved once, applied everywhere: poster templates, campaign QR codes, and rep QR codes.
          </p>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {colorField('charcoal', 'Charcoal', 'Headlines + QR modules — keep it dark.')}
              {colorField('red', 'Accent red', 'Callouts, highlights, QR cross.')}
              {colorField('cream', 'Cream', 'Light poster background.')}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Website</label>
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Serving areas (comma-separated)</label>
              <Input value={form.servingAreas} onChange={(e) => setForm({ ...form, servingAreas: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Service chips (comma-separated)</label>
              <Input value={form.chips} onChange={(e) => setForm({ ...form, chips: e.target.value })} className="mt-1" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending || !isCustomized}>
              Reset to defaults
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Saving…' : 'Save kit'}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MarketingTemplates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isManager = user?.email === SUPER_ADMIN_EMAIL || (!!user?.role && MANAGER_ROLES.includes(user.role));

  const [fontsReady, setFontsReady] = useState(false);
  const [templateId, setTemplateId] = useState(POSTER_TEMPLATES[0].id);
  const [campaignId, setCampaignId] = useState<string>('');
  const [copy, setCopy] = useState<Record<string, string>>(POSTER_TEMPLATES[0].defaults);
  const [busy, setBusy] = useState<'png' | 'svg' | null>(null);
  const [brief, setBrief] = useState('');
  const [aiVariants, setAiVariants] = useState<AiVariant[]>([]);

  useEffect(() => {
    let alive = true;
    ensurePosterFonts().then(() => { if (alive) setFontsReady(true); });
    return () => { alive = false; };
  }, []);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/marketing/campaigns'],
    enabled: isManager,
  });

  const { data: brandResp } = useQuery<{ tokens: BrandTokens; isCustomized: boolean }>({
    queryKey: ['/api/marketing/brand'],
    enabled: isManager,
  });
  const brand = brandResp?.tokens ?? DEFAULT_BRAND;

  const campaign = campaigns.find((c) => c.id === campaignId) || campaigns[0];
  const template = templateById(templateId) || POSTER_TEMPLATES[0];
  const measure = useMemo(() => (fontsReady ? makeMeasure() : null), [fontsReady]);
  const qrSvg = campaign ? qrSvgFromDataUri(campaign.qrCodeUrl) : '';

  const posterSvg = useMemo(() => {
    if (!measure || !qrSvg) return '';
    return template.build({ copy, brand, qrSvg, measure, uid: 'main' });
  }, [template, copy, qrSvg, measure, brand]);

  const minis = useMemo(() => {
    if (!measure || !qrSvg) return {} as Record<string, string>;
    const m: Record<string, string> = {};
    for (const t of POSTER_TEMPLATES) {
      m[t.id] = t.build({ copy: t.defaults, brand, qrSvg, measure, uid: `mini-${t.id}` });
    }
    return m;
  }, [qrSvg, measure, brand]);

  const aiPreviews = useMemo(() => {
    if (!measure || !qrSvg) return [] as string[];
    return aiVariants.map((v, i) => {
      const t = templateById(v.templateId);
      return t ? t.build({ copy: v.copy, brand, qrSvg, measure, uid: `ai-${i}` }) : '';
    });
  }, [aiVariants, qrSvg, measure, brand]);

  const generateMutation = useMutation({
    mutationFn: (b: string) => apiRequest('/api/marketing/ai-design', 'POST', { brief: b, variants: 3 }),
    onSuccess: (resp: any) => {
      setAiVariants(resp?.variants ?? []);
      if (!resp?.variants?.length) toast({ title: 'No concepts', description: 'Try rewording the brief.', variant: 'destructive' });
    },
    onError: (e: any) => toast({ title: 'AI designer unavailable', description: e?.message || 'Try again shortly.', variant: 'destructive' }),
  });

  function applyVariant(v: AiVariant) {
    const t = templateById(v.templateId);
    if (!t) return;
    setTemplateId(t.id);
    setCopy({ ...t.defaults, ...v.copy });
    toast({ title: `Loaded: ${v.angle}`, description: 'Tweak the copy below, then download.' });
  }

  if (!isManager) return <Navigate to="/qr-codes" replace />;

  function pickTemplate(t: PosterTemplate) {
    setTemplateId(t.id);
    setCopy(t.defaults);
  }

  async function exportFile(kind: 'png' | 'svg') {
    if (!posterSvg || !campaign) return;
    setBusy(kind);
    try {
      const name = posterFileName(template.id, campaign.code, kind);
      if (kind === 'png') await downloadPosterPng(posterSvg, name, template.exportScale ?? undefined);
      else await downloadPosterSvg(posterSvg, name);
      toast({ title: 'Download started', description: name });
    } catch (e: any) {
      toast({ title: 'Export failed', description: e?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/15 p-3"><LayoutTemplate className="h-6 w-6 text-primary" /></div>
          <div>
            <h1 className="text-3xl font-bold">Poster Templates</h1>
            <p className="text-muted-foreground">
              Pick a template, drop in a campaign's tracked QR code, tweak the copy, and download print-ready art.
            </p>
          </div>
        </div>
        <BrandKitDialog brand={brand} isCustomized={!!brandResp?.isCustomized} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Loading campaigns…</p>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Megaphone className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium">Posters need a campaign QR code first.</p>
            <p className="text-sm text-muted-foreground">Create a campaign — its trackable QR code drops into every template.</p>
            <Link to="/marketing/campaigns" className="inline-block">
              <Button>Create a campaign <ArrowRight className="h-4 w-4 ml-2" /></Button>
            </Link>
          </CardContent>
        </Card>
      ) : !fontsReady ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Loading poster fonts…</p>
      ) : (
        <>
          {/* Campaign picker */}
          <Card>
            <CardContent className="pt-6 flex flex-col md:flex-row md:items-center gap-3">
              <label className="text-sm font-medium shrink-0">Campaign QR code:</label>
              <select
                value={campaign?.id || ''}
                onChange={(e) => setCampaignId(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm md:w-96"
              >
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.shortUrl.replace(/^https?:\/\//, '')}</option>
                ))}
              </select>
              {campaign && !campaign.isActive && <Badge variant="secondary">Paused — scans won't redirect</Badge>}
            </CardContent>
          </Card>

          {/* AI designer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-primary" /> AI Designer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  value={brief}
                  maxLength={300}
                  placeholder='Describe the piece — e.g. "fall storm yard sign for Richmond"'
                  onChange={(e) => setBrief(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && brief.trim().length >= 3 && !generateMutation.isPending) generateMutation.mutate(brief.trim()); }}
                />
                <Button
                  onClick={() => generateMutation.mutate(brief.trim())}
                  disabled={generateMutation.isPending || brief.trim().length < 3}
                  className="shrink-0"
                >
                  {generateMutation.isPending ? 'Designing…' : 'Generate concepts'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {BRIEF_IDEAS.map((idea) => (
                  <button key={idea} type="button" onClick={() => setBrief(idea)}
                    className="text-xs px-2.5 py-1 rounded-full border hover:bg-muted transition-colors">
                    {idea}
                  </button>
                ))}
              </div>

              {generateMutation.isPending && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="rounded-lg bg-muted animate-pulse" style={{ aspectRatio: '1100/1700' }} />
                  ))}
                </div>
              )}

              {!generateMutation.isPending && aiVariants.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {aiVariants.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyVariant(v)}
                      className="rounded-lg border-2 border-transparent hover:border-primary text-left overflow-hidden transition-colors"
                      title="Load this concept into the editor"
                    >
                      <div className="bg-neutral-200 p-3">
                        {aiPreviews[i] && <div className="shadow-md" dangerouslySetInnerHTML={{ __html: fluid(aiPreviews[i]) }} />}
                      </div>
                      <div className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">{v.angle}</p>
                          <p className="text-xs text-muted-foreground">{templateById(v.templateId)?.name}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">Use</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                The AI writes on-brand copy and picks a layout — the QR code, colors, and print files stay exact. Click a concept to load it into the editor.
              </p>
            </CardContent>
          </Card>

          {/* Template picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {POSTER_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t)}
                className={`rounded-lg border-2 text-left overflow-hidden transition-colors ${t.id === template.id ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'}`}
              >
                {/* Poster previews are print proofs — always on a light "paper" backdrop,
                    independent of app theme (dark mode made dark posters merge into the page). */}
                <div className="bg-neutral-200 p-3">
                  {minis[t.id] && <div className="shadow-md" dangerouslySetInnerHTML={{ __html: fluid(minis[t.id]) }} />}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  <Badge variant="outline" className="mt-1.5 text-[10px]">{t.sizeLabel ?? '11×17 in'}</Badge>
                </div>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
            {/* Copy editor */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Edit copy</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setCopy(template.defaults)}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Reset
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {template.fields.map((f) => (
                  <div key={f.key}>
                    <label className="text-sm font-medium">{f.label}</label>
                    {f.kind === 'multiline' ? (
                      <textarea
                        value={copy[f.key] ?? ''}
                        maxLength={f.maxLen}
                        rows={3}
                        onChange={(e) => setCopy({ ...copy, [f.key]: e.target.value })}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    ) : (
                      <Input
                        value={copy[f.key] ?? ''}
                        maxLength={f.maxLen}
                        onChange={(e) => setCopy({ ...copy, [f.key]: e.target.value })}
                        className="mt-1"
                      />
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t space-y-2">
                  <div className="flex gap-2">
                    <Button onClick={() => exportFile('png')} disabled={!!busy}>
                      <Download className="h-4 w-4 mr-2" />{busy === 'png' ? 'Rendering…' : 'Print PNG (300dpi)'}
                    </Button>
                    <Button variant="outline" onClick={() => exportFile('svg')} disabled={!!busy}>
                      {busy === 'svg' ? 'Rendering…' : 'Download SVG'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PNG = {(template.width ?? 1100) * (template.exportScale ?? 3)}×{(template.height ?? 1700) * (template.exportScale ?? 3)} ({template.sizeLabel ?? '11×17 in'} at 300dpi).
                    SVG = vector for print vendors. Always scan-test a printed proof before mass production.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Live preview */}
            <Card className="lg:col-span-3">
              <CardHeader><CardTitle>Preview — {template.name}</CardTitle></CardHeader>
              <CardContent>
                {posterSvg ? (
                  <div className="rounded-lg bg-neutral-200 p-4 sm:p-6">
                    <div className="mx-auto max-w-md shadow-xl" dangerouslySetInnerHTML={{ __html: fluid(posterSvg) }} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-10 text-center">Select a campaign to render the poster.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
