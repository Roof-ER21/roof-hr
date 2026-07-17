import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { QrCode, Link as LinkIcon, Eye, Calendar, TrendingUp, Plus, Pencil, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

// sa21 is the source of truth; a rep QR code == a sa21 employee_profile. This page
// mirrors it: managers see all reps read-only, a rep sees only their own row, and
// the system owner (super admin) can create / edit / delete.
const SUPER_ADMIN_EMAIL = 'ahmed.mahmoud@theroofdocs.com';
const SA21_ADMIN_URL = 'https://sa21.theroofdocs.com';

interface RepQRCode {
  id: string;
  repId: string;
  slug: string;
  qrCodeUrl: string;
  landingPageUrl: string;
  totalScans: number;
  totalAppointments: number;
  conversionRate: number;
  isActive: boolean;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  imageUrl?: string | null;
  rep?: { firstName: string; lastName: string; position: string };
}

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Must be a valid email').or(z.literal('')).optional(),
  phone_number: z.string().optional(),
  title: z.string().optional(),
  slug: z.string().optional(),
});
type ProfileForm = z.infer<typeof profileSchema>;

export default function QRCodes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RepQRCode | null>(null);

  const { data: qrCodes = [], isLoading, error } = useQuery<RepQRCode[]>({
    queryKey: ['/api/qr-codes'],
  });

  const createForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '', phone_number: '', title: '', slug: '' },
  });
  const editForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', email: '', phone_number: '', title: '', slug: '' },
  });

  const onError = (fallback: string) => (e: any) =>
    toast({ title: 'Error', description: e?.message || fallback, variant: 'destructive' });

  const createMutation = useMutation({
    mutationFn: (data: ProfileForm) => apiRequest('/api/qr-codes', 'POST', data),
    onSuccess: () => {
      toast({ title: 'QR code created', description: 'The rep profile + QR code were created in Susan AI-21.' });
      queryClient.invalidateQueries({ queryKey: ['/api/qr-codes'] });
      setIsCreateOpen(false);
      createForm.reset();
    },
    onError: onError('Failed to create QR code.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProfileForm }) => apiRequest(`/api/qr-codes/${id}`, 'PATCH', data),
    onSuccess: () => {
      toast({ title: 'QR code updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/qr-codes'] });
      setEditing(null);
    },
    onError: onError('Failed to update QR code.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/qr-codes/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'QR code deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/qr-codes'] });
    },
    onError: onError('Failed to delete QR code.'),
  });

  const openEdit = (qr: RepQRCode) => {
    editForm.reset({
      name: `${qr.rep?.firstName || ''} ${qr.rep?.lastName || ''}`.trim(),
      email: qr.email || '',
      phone_number: qr.phone || '',
      title: qr.title || '',
      slug: qr.slug || '',
    });
    setEditing(qr);
  };

  const totals = qrCodes.reduce(
    (acc, qr) => ({
      scans: acc.scans + qr.totalScans,
      appointments: acc.appointments + qr.totalAppointments,
      activeQRs: acc.activeQRs + (qr.isActive ? 1 : 0),
    }),
    { scans: 0, appointments: 0, activeQRs: 0 },
  );
  const avgConversion = qrCodes.length > 0
    ? qrCodes.reduce((s, qr) => s + qr.conversionRate, 0) / qrCodes.length
    : 0;

  if (isLoading) {
    return <div className="flex justify-center items-center h-full">Loading…</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium">Couldn't reach the QR system (Susan AI-21).</p>
        <p className="text-sm text-muted-foreground">{(error as Error)?.message || 'Please try again shortly.'}</p>
      </div>
    );
  }

  const profileFields = (form: typeof createForm) => (
    <>
      <FormField control={form.control} name="name" render={({ field }) => (
        <FormItem>
          <FormLabel>Rep name *</FormLabel>
          <FormControl><Input {...field} placeholder="Ben Salgado" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="email" render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl><Input {...field} type="email" placeholder="ben@theroofdocs.com" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="phone_number" render={({ field }) => (
        <FormItem>
          <FormLabel>Phone</FormLabel>
          <FormControl><Input {...field} placeholder="(703) 555-0100" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="title" render={({ field }) => (
        <FormItem>
          <FormLabel>Title</FormLabel>
          <FormControl><Input {...field} placeholder="Sales Representative" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="slug" render={({ field }) => (
        <FormItem>
          <FormLabel>Landing-page slug (optional)</FormLabel>
          <FormControl><Input {...field} placeholder="auto-generated from name" /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold">QR Code Management</h1>
          <p className="text-muted-foreground">
            {isSuperAdmin
              ? 'Create and manage sales-rep QR codes — synced with Susan AI-21.'
              : 'Rep QR code performance — scans, appointments, and conversion.'}
          </p>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-2">
            <a href={`${SA21_ADMIN_URL}/admin`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline"><ExternalLink className="h-4 w-4 mr-2" />sa21 admin (photos/videos)</Button>
            </a>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Create QR Code</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create rep QR code</DialogTitle></DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                    {profileFields(createForm)}
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending ? 'Creating…' : 'Create QR Code'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.scans}</div>
            <p className="text-xs text-muted-foreground">All-time QR code scans</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.appointments}</div>
            <p className="text-xs text-muted-foreground">Leads captured via QR</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgConversion.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Average scan → appointment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active QR Codes</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.activeQRs}</div>
            <p className="text-xs text-muted-foreground">Currently active codes</p>
          </CardContent>
        </Card>
      </div>

      {/* QR Code List */}
      <Card>
        <CardHeader>
          <CardTitle>{isSuperAdmin ? 'QR Codes by Representative' : qrCodes.length === 1 ? 'My QR Code' : 'QR Codes'}</CardTitle>
        </CardHeader>
        <CardContent>
          {qrCodes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No QR codes yet.</p>
          ) : (
            <div className="space-y-4">
              {qrCodes.map((qr) => (
                <div key={qr.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center shrink-0">
                      <QrCode className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{qr.rep?.firstName} {qr.rep?.lastName}</h3>
                      <p className="text-sm text-muted-foreground truncate">{qr.rep?.position}</p>
                      <div className="flex items-center gap-2 mt-1 min-w-0">
                        <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                        <a href={qr.landingPageUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate">
                          {qr.landingPageUrl}
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center"><p className="text-2xl font-bold">{qr.totalScans}</p><p className="text-xs text-muted-foreground">Scans</p></div>
                    <div className="text-center"><p className="text-2xl font-bold">{qr.totalAppointments}</p><p className="text-xs text-muted-foreground">Appts</p></div>
                    <div className="text-center"><p className="text-2xl font-bold">{qr.conversionRate.toFixed(1)}%</p><p className="text-xs text-muted-foreground">Conv.</p></div>
                    <Badge variant={qr.isActive ? 'default' : 'secondary'}>{qr.isActive ? 'Active' : 'Inactive'}</Badge>

                    <Dialog>
                      <DialogTrigger asChild><Button variant="outline" size="sm">View QR</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>QR Code — {qr.rep?.firstName} {qr.rep?.lastName}</DialogTitle></DialogHeader>
                        <div className="flex flex-col items-center space-y-4">
                          <img src={qr.qrCodeUrl} alt="QR Code" className="w-64 h-64 border rounded" />
                          <p className="text-sm text-muted-foreground text-center">Scan to visit:<br />{qr.landingPageUrl}</p>
                          <Button onClick={() => { const a = document.createElement('a'); a.href = qr.qrCodeUrl; a.download = `qr-${qr.slug || 'rep'}.png`; a.click(); }}>
                            Download QR Code
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>

                    {isSuperAdmin && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(qr)} title="Edit"><Pencil className="h-4 w-4" /></Button>
                        <Button
                          variant="ghost" size="icon" title="Delete"
                          onClick={() => { if (window.confirm(`Delete the QR profile for ${qr.rep?.firstName} ${qr.rep?.lastName}? This removes it in Susan AI-21.`)) deleteMutation.mutate(qr.id); }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog (super admin only) */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit rep QR code</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((d) => editing && updateMutation.mutate({ id: editing.id, data: d }))} className="space-y-4">
              {profileFields(editForm)}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving…' : 'Save changes'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
