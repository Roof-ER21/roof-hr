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
  Save,
  User,
  Cloud,
  FileBarChart
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ADMIN_ROLES, isAdmin } from '@shared/constants/roles';
import { useAuth } from '@/lib/auth';
import GoogleIntegration from './GoogleIntegration';
import ScheduledReports from './ScheduledReports';
import { AvailabilityManager } from '@/components/settings/availability-manager';

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

// Common timezones for US-based operations
const COMMON_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: 'UTC-5/-4' },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: 'UTC-6/-5' },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: 'UTC-7/-6' },
  { value: 'America/Phoenix', label: 'Arizona (MST, no DST)', offset: 'UTC-7' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: 'UTC-8/-7' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)', offset: 'UTC-9/-8' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)', offset: 'UTC-10' },
  { value: 'America/Puerto_Rico', label: 'Puerto Rico (AST)', offset: 'UTC-4' },
  { value: 'Pacific/Guam', label: 'Guam (ChST)', offset: 'UTC+10' },
  { value: 'Europe/London', label: 'London (GMT/BST)', offset: 'UTC+0/+1' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)', offset: 'UTC+1/+2' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 'UTC+9' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT/AEST)', offset: 'UTC+10/+11' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)', offset: 'UTC+0' },
];

function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Check if user is admin to show/hide admin-only tabs
  const userIsAdmin = isAdmin(user);

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

  // Fetch current user info for personal settings
  const { data: currentUser } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const response = await fetch('/api/user', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch user info');
      return response.json();
    }
  });

  const [selectedTimezone, setSelectedTimezone] = useState<string>('America/New_York');

  // Update selected timezone when user data loads
  useEffect(() => {
    if (currentUser?.timezone) {
      setSelectedTimezone(currentUser.timezone);
    }
  }, [currentUser]);

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

  // Mutation to update user timezone
  const updateTimezoneMutation = useMutation({
    mutationFn: async (timezone: string) => {
      const response = await fetch(`/api/users/${currentUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ timezone })
      });
      if (!response.ok) throw new Error('Failed to update timezone');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: 'Success',
        description: 'Your timezone has been updated successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update timezone',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: CompanySettingsFormData) => {
    updateSettingsMutation.mutate(data);
  };

  const handleTimezoneUpdate = () => {
    updateTimezoneMutation.mutate(selectedTimezone);
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

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="personal">
            <User className="w-4 h-4 mr-2" />
            Personal
          </TabsTrigger>
          {userIsAdmin && (
            <>
              <TabsTrigger value="company">
                <Building className="w-4 h-4 mr-2" />
                Company
              </TabsTrigger>
              <TabsTrigger value="business">
                <Clock className="w-4 h-4 mr-2" />
                Hours
              </TabsTrigger>
              <TabsTrigger value="google">
                <Cloud className="w-4 h-4 mr-2" />
                Google
              </TabsTrigger>
              <TabsTrigger value="reports">
                <FileBarChart className="w-4 h-4 mr-2" />
                Reports
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="personal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                Timezone Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="timezone">Your Timezone</Label>
                <p className="text-sm text-gray-600">
                  This timezone will be used for displaying interview times and calendar events.
                </p>
                <select
                  id="timezone"
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Current Selection</h4>
                <p className="text-sm text-blue-700">
                  {COMMON_TIMEZONES.find(tz => tz.value === selectedTimezone)?.label || selectedTimezone}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Local time: {new Date().toLocaleString('en-US', {
                    timeZone: selectedTimezone,
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZoneName: 'short'
                  })}
                </p>
              </div>

              <Button
                type="button"
                onClick={handleTimezoneUpdate}
                disabled={updateTimezoneMutation.isPending || selectedTimezone === currentUser?.timezone}
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateTimezoneMutation.isPending ? 'Saving...' : 'Save Timezone'}
              </Button>
            </CardContent>
          </Card>

          {/* Interview Availability Settings */}
          <AvailabilityManager />
        </TabsContent>

        {userIsAdmin && (
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
        )}

        {userIsAdmin && (
          <>
            <TabsContent value="google" className="space-y-6">
              <GoogleIntegration embedded />
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              <ScheduledReports embedded />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

export default Settings;
