import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Settings as SettingsIcon, 
  Building, 
  Clock, 
  Globe, 
  Phone, 
  Mail,
  MapPin,
  Save
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const companySettingsSchema = z.object({
  companyName: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  website: z.string().optional(),
  businessHours: z.object({
    start: z.string().min(1),
    end: z.string().min(1),
    timezone: z.string().min(1),
  }),
});

type CompanySettingsFormData = z.infer<typeof companySettingsSchema>;

function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    }
  });

  const form = useForm<CompanySettingsFormData>({
    resolver: zodResolver(companySettingsSchema),
    defaultValues: {
      companyName: settings?.companyName || 'ROOF-ER',
      address: settings?.address || '',
      phone: settings?.phone || '',
      email: settings?.email || '',
      website: settings?.website || '',
      businessHours: {
        start: settings?.businessHours?.start || '08:00',
        end: settings?.businessHours?.end || '17:00',
        timezone: settings?.businessHours?.timezone || 'America/New_York',
      },
    }
  });

  // Update form when settings data loads
  useEffect(() => {
    if (settings) {
      form.reset({
        companyName: settings.companyName || 'ROOF-ER',
        address: settings.address || '',
        phone: settings.phone || '',
        email: settings.email || '',
        website: settings.website || '',
        businessHours: {
          start: settings.businessHours?.start || '08:00',
          end: settings.businessHours?.end || '17:00',
          timezone: settings.businessHours?.timezone || 'America/New_York',
        },
      });
    }
  }, [settings, form]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: CompanySettingsFormData) => {
      const method = settings ? 'PATCH' : 'POST';
      const url = settings ? `/api/settings/${settings.id}` : '/api/settings';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: 'Success',
        description: 'Company settings updated successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: CompanySettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="p-8">Loading settings...</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-secondary-950">Company Settings</h1>
        <p className="mt-2 text-sm text-secondary-600">
          Manage company information, policies, and business rules
        </p>
      </div>

      <Tabs defaultValue="company" className="space-y-6">
        <TabsList>
          <TabsTrigger value="company">
            <Building className="w-4 h-4 mr-2" />
            Company Info
          </TabsTrigger>
          <TabsTrigger value="business">
            <Clock className="w-4 h-4 mr-2" />
            Business Hours
          </TabsTrigger>
        </TabsList>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="w-5 h-5 mr-2" />
                  Company Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    {...form.register('companyName')}
                    placeholder="Enter company name"
                  />
                </div>

                <div>
                  <Label htmlFor="address">Business Address</Label>
                  <Textarea
                    id="address"
                    {...form.register('address')}
                    placeholder="Enter complete business address"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="phone"
                        {...form.register('phone')}
                        placeholder="+1 (555) 123-4567"
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        {...form.register('email')}
                        placeholder="company@example.com"
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="website">Website (Optional)</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="website"
                      {...form.register('website')}
                      placeholder="https://www.company.com"
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>



          <TabsContent value="business" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Business Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="startTime">Business Start Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      {...form.register('businessHours.start')}
                    />
                  </div>

                  <div>
                    <Label htmlFor="endTime">Business End Time</Label>
                    <Input
                      id="endTime"
                      type="time"
                      {...form.register('businessHours.end')}
                    />
                  </div>

                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      {...form.register('businessHours.timezone')}
                      placeholder="America/New_York"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-secondary-900 mb-2">Business Hours Summary</h4>
                  <div className="text-sm text-secondary-700">
                    <p>
                      Business operates from{' '}
                      <span className="font-medium">{form.watch('businessHours.start') || '08:00'}</span>
                      {' '}to{' '}
                      <span className="font-medium">{form.watch('businessHours.end') || '17:00'}</span>
                      {' '}in{' '}
                      <span className="font-medium">{form.watch('businessHours.timezone') || 'America/New_York'}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Save Button - Fixed at bottom */}
          <div className="sticky bottom-0 bg-white p-4 border-t mt-8">
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateSettingsMutation.isPending}
                className="min-w-32"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
        </form>
      </Tabs>
    </div>
  );
}

export default Settings;
