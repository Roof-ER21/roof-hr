import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MANAGER_ROLES, SUPER_ADMIN_EMAIL } from '@shared/constants/roles';
import { LayoutTemplate, Download, RotateCcw, Megaphone, ArrowRight } from 'lucide-react';
import { ensurePosterFonts, makeMeasure } from '@/lib/poster/fonts';
import {
  POSTER_TEMPLATES, templateById, qrSvgFromDataUri, posterFileName,
  DEFAULT_BRAND, type PosterTemplate,
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

/** Strip the fixed width/height so the inline preview scales to its container. */
function fluid(svg: string): string {
  return svg.replace(/(<svg[^>]*?) width="\d+" height="\d+"/, '$1 style="width:100%;height:auto;display:block"');
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

  useEffect(() => {
    let alive = true;
    ensurePosterFonts().then(() => { if (alive) setFontsReady(true); });
    return () => { alive = false; };
  }, []);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/marketing/campaigns'],
    enabled: isManager,
  });

  const campaign = campaigns.find((c) => c.id === campaignId) || campaigns[0];
  const template = templateById(templateId) || POSTER_TEMPLATES[0];
  const measure = useMemo(() => (fontsReady ? makeMeasure() : null), [fontsReady]);
  const qrSvg = campaign ? qrSvgFromDataUri(campaign.qrCodeUrl) : '';

  const posterSvg = useMemo(() => {
    if (!measure || !qrSvg) return '';
    return template.build({ copy, brand: DEFAULT_BRAND, qrSvg, measure, uid: 'main' });
  }, [template, copy, qrSvg, measure]);

  const minis = useMemo(() => {
    if (!measure || !qrSvg) return {} as Record<string, string>;
    const m: Record<string, string> = {};
    for (const t of POSTER_TEMPLATES) {
      m[t.id] = t.build({ copy: t.defaults, brand: DEFAULT_BRAND, qrSvg, measure, uid: `mini-${t.id}` });
    }
    return m;
  }, [qrSvg, measure]);

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
      if (kind === 'png') await downloadPosterPng(posterSvg, name);
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
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/15 p-3"><LayoutTemplate className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-3xl font-bold">Poster Templates</h1>
          <p className="text-muted-foreground">
            Pick a template, drop in a campaign's tracked QR code, tweak the copy, and download print-ready art.
          </p>
        </div>
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

          {/* Template picker */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {POSTER_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickTemplate(t)}
                className={`rounded-lg border-2 text-left overflow-hidden transition-colors ${t.id === template.id ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'}`}
              >
                <div className="bg-muted/40 p-3">
                  {minis[t.id] && <div dangerouslySetInnerHTML={{ __html: fluid(minis[t.id]) }} />}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
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
                    PNG = 3300×5100 (11×17in at 300dpi; scales cleanly to letter). SVG = vector for print vendors.
                    Always scan-test a printed proof before mass production.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Live preview */}
            <Card className="lg:col-span-3">
              <CardHeader><CardTitle>Preview — {template.name}</CardTitle></CardHeader>
              <CardContent>
                {posterSvg ? (
                  <div className="mx-auto max-w-md shadow-lg rounded overflow-hidden border" dangerouslySetInnerHTML={{ __html: fluid(posterSvg) }} />
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
