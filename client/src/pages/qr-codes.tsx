import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QrCode, Link, Eye, Calendar, TrendingUp, Plus } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface RepQRCode {
  id: string;
  repId: string;
  qrCodeUrl: string;
  landingPageUrl: string;
  totalScans: number;
  totalAppointments: number;
  conversionRate: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  rep?: {
    firstName: string;
    lastName: string;
    position: string;
  };
}

const createQRCodeSchema = z.object({
  repId: z.string(),
  landingPageUrl: z.string().url('Must be a valid URL'),
});

type CreateQRCodeForm = z.infer<typeof createQRCodeSchema>;

export default function QRCodes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedQRCode, setSelectedQRCode] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: qrCodes = [], isLoading } = useQuery<RepQRCode[]>({
    queryKey: ['/api/qr-codes'],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  const form = useForm<CreateQRCodeForm>({
    resolver: zodResolver(createQRCodeSchema),
    defaultValues: {
      repId: '',
      landingPageUrl: '',
    },
  });

  const createQRCodeMutation = useMutation({
    mutationFn: async (data: CreateQRCodeForm) => {
      // Generate QR code URL using a placeholder service (in production, use proper QR generation)
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(data.landingPageUrl)}`;
      
      const response = await apiRequest('POST', '/api/qr-codes', {
        ...data,
        qrCodeUrl,
      });
    },
    onSuccess: () => {
      toast({
        title: 'QR Code created',
        description: 'The QR code has been created successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/qr-codes'] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create QR code. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Merge user data with QR code data
  const enrichedQRCodes = qrCodes.map(qr => {
    const userData = users.find((u: any) => u.id === qr.repId);
    return {
      ...qr,
      rep: userData ? {
        firstName: userData.firstName,
        lastName: userData.lastName,
        position: userData.position,
      } : undefined,
    };
  });

  const salesReps = users.filter((u: any) => 
    u.role === 'EMPLOYEE' && (u.position?.toLowerCase().includes('sales') || u.department?.toLowerCase().includes('sales'))
  );

  const totalStats = enrichedQRCodes.reduce((acc, qr) => ({
    scans: acc.scans + qr.totalScans,
    appointments: acc.appointments + qr.totalAppointments,
    activeQRs: acc.activeQRs + (qr.isActive ? 1 : 0),
  }), { scans: 0, appointments: 0, activeQRs: 0 });

  const avgConversionRate = enrichedQRCodes.length > 0
    ? enrichedQRCodes.reduce((sum, qr) => sum + qr.conversionRate, 0) / enrichedQRCodes.length
    : 0;

  if (isLoading) {
    return <div className="flex justify-center items-center h-full">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">QR Code Management</h1>
          <p className="text-muted-foreground">Track and manage sales rep QR codes</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create QR Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New QR Code</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createQRCodeMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="repId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Representative</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select a rep</option>
                          {salesReps.map((rep: any) => (
                            <option key={rep.id} value={rep.id}>
                              {rep.firstName} {rep.lastName} - {rep.position}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="landingPageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Landing Page URL</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com/rep-landing" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createQRCodeMutation.isPending}>
                    {createQRCodeMutation.isPending ? 'Creating...' : 'Create QR Code'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.scans}</div>
            <p className="text-xs text-muted-foreground">
              All-time QR code scans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.appointments}</div>
            <p className="text-xs text-muted-foreground">
              Booked through QR codes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgConversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Average scan to appointment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active QR Codes</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.activeQRs}</div>
            <p className="text-xs text-muted-foreground">
              Currently active codes
            </p>
          </CardContent>
        </Card>
      </div>

      {/* QR Code List */}
      <Card>
        <CardHeader>
          <CardTitle>QR Codes by Representative</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {enrichedQRCodes.map((qr) => (
              <div
                key={qr.id}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                    <QrCode className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">
                      {qr.rep?.firstName} {qr.rep?.lastName}
                    </h3>
                    <p className="text-sm text-muted-foreground">{qr.rep?.position}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Link className="h-3 w-3 text-muted-foreground" />
                      <a
                        href={qr.landingPageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {qr.landingPageUrl}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{qr.totalScans}</p>
                    <p className="text-xs text-muted-foreground">Scans</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{qr.totalAppointments}</p>
                    <p className="text-xs text-muted-foreground">Appointments</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{qr.conversionRate.toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Conversion</p>
                  </div>
                  <Badge variant={qr.isActive ? 'default' : 'secondary'}>
                    {qr.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        View QR
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>QR Code for {qr.rep?.firstName} {qr.rep?.lastName}</DialogTitle>
                      </DialogHeader>
                      <div className="flex flex-col items-center space-y-4">
                        <img
                          src={qr.qrCodeUrl}
                          alt="QR Code"
                          className="w-64 h-64 border rounded"
                        />
                        <p className="text-sm text-muted-foreground text-center">
                          Scan this code to visit:<br />
                          {qr.landingPageUrl}
                        </p>
                        <Button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = qr.qrCodeUrl;
                            link.download = `qr-code-${qr.rep?.firstName}-${qr.rep?.lastName}.png`;
                            link.click();
                          }}
                        >
                          Download QR Code
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}