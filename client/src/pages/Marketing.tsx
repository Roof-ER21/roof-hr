import { useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MANAGER_ROLES, SUPER_ADMIN_EMAIL } from '@shared/constants/roles';
import {
  Megaphone, Eye, Calendar, TrendingUp, Users, QrCode,
  ArrowRight, AlertCircle, Trophy,
} from 'lucide-react';

// The Marketing hub reuses /api/qr-codes (sa21 = source of truth). Managers get
// the aggregate view; reps are sent to their own QR page (they don't get the
// company-wide leaderboard).
interface RepQRCode {
  id: string;
  slug: string;
  landingPageUrl: string;
  totalScans: number;
  totalAppointments: number;
  conversionRate: number;
  isActive: boolean;
  rep?: { firstName: string; lastName: string; position: string };
}

function StatCard({ label, value, sub, icon: Icon }: {
  label: string; value: string; sub: string; icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

const RANK_STYLES = ['text-amber-500', 'text-slate-400', 'text-orange-600'];

export default function Marketing() {
  const { user } = useAuth();
  const isManager = user?.email === SUPER_ADMIN_EMAIL || (!!user?.role && MANAGER_ROLES.includes(user.role));

  const { data: qrCodes = [], isLoading, error } = useQuery<RepQRCode[]>({
    queryKey: ['/api/qr-codes'],
    enabled: isManager,
  });

  const { data: campaigns = [] } = useQuery<Array<{ id: string; totalScans: number; isActive: boolean }>>({
    queryKey: ['/api/marketing/campaigns'],
    enabled: isManager,
  });
  const campaignScans = campaigns.reduce((s, c) => s + (c.totalScans || 0), 0);
  const activeCampaigns = campaigns.filter((c) => c.isActive).length;

  const stats = useMemo(() => {
    const totals = qrCodes.reduce(
      (acc, qr) => ({
        scans: acc.scans + qr.totalScans,
        appts: acc.appts + qr.totalAppointments,
        active: acc.active + (qr.isActive ? 1 : 0),
      }),
      { scans: 0, appts: 0, active: 0 },
    );
    const conversion = totals.scans > 0 ? (totals.appts / totals.scans) * 100 : 0;
    const leaders = [...qrCodes].sort((a, b) => b.totalScans - a.totalScans).slice(0, 8);
    const maxScans = leaders.reduce((m, qr) => Math.max(m, qr.totalScans), 0);
    return { totals, conversion, leaders, maxScans };
  }, [qrCodes]);

  // Reps don't get the aggregate hub — send them to their own QR page.
  if (!isManager) return <Navigate to="/qr-codes" replace />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/15 p-3">
            <Megaphone className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Marketing</h1>
            <p className="text-muted-foreground mt-1">
              Rep QR-code performance and lead capture — synced live with Susan AI-21.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="font-medium">Couldn't reach the QR system (Susan AI-21).</p>
          <p className="text-sm text-muted-foreground">{(error as Error)?.message || 'Please try again shortly.'}</p>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center items-center py-16 text-muted-foreground">Loading marketing metrics…</div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Total Scans" value={String(stats.totals.scans)} sub="All-time QR scans" icon={Eye} />
            <StatCard label="Leads Captured" value={String(stats.totals.appts)} sub="Appointments via QR" icon={Calendar} />
            <StatCard label="Conversion Rate" value={`${stats.conversion.toFixed(1)}%`} sub="Scan → lead, company-wide" icon={TrendingUp} />
            <StatCard label="Active Reps" value={String(stats.totals.active)} sub={`of ${qrCodes.length} QR codes`} icon={Users} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Leaderboard */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" /> Top Performers
                </CardTitle>
                <Link to="/qr-codes">
                  <Button variant="ghost" size="sm">View all <ArrowRight className="h-4 w-4 ml-1" /></Button>
                </Link>
              </CardHeader>
              <CardContent>
                {stats.leaders.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No QR scan activity yet.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.leaders.map((qr, i) => (
                      <div key={qr.id} className="flex items-center gap-3">
                        <div className={`w-6 text-center font-bold ${RANK_STYLES[i] || 'text-muted-foreground'}`}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">
                              {qr.rep?.firstName} {qr.rep?.lastName}
                              {!qr.isActive && <Badge variant="secondary" className="ml-2 text-[10px]">Inactive</Badge>}
                            </span>
                            <span className="text-sm text-muted-foreground shrink-0">
                              {qr.totalScans} scans · {qr.conversionRate.toFixed(0)}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${stats.maxScans > 0 ? (qr.totalScans / stats.maxScans) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Channels / quick nav */}
            <Card>
              <CardHeader><CardTitle>Channels</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Link to="/qr-codes" className="block">
                  <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    <div className="rounded-md bg-primary/10 p-2"><QrCode className="h-5 w-5 text-primary" /></div>
                    <div className="min-w-0">
                      <p className="font-medium">Rep QR Codes</p>
                      <p className="text-xs text-muted-foreground truncate">Per-rep landing pages &amp; scans</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                  </div>
                </Link>
                <Link to="/marketing/campaigns" className="block">
                  <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                    <div className="rounded-md bg-primary/10 p-2"><Megaphone className="h-5 w-5 text-primary" /></div>
                    <div className="min-w-0">
                      <p className="font-medium">Campaigns</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {activeCampaigns} active · {campaignScans} scans — yard signs, print &amp; more
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                  </div>
                </Link>
                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Leads captured here attribute through to CC24.
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
