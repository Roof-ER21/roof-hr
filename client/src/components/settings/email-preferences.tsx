import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Users, Calendar, Package, Bell, Mail, AtSign } from 'lucide-react';

interface EmailPreferencesProps {
  userId?: string;
  compact?: boolean;
}

interface PreferencesData {
  userId: string;
  ptoNotifications: boolean;
  contractNotifications: boolean;
  reviewNotifications: boolean;
  taskNotifications: boolean;
  systemAnnouncements: boolean;
  weeklyDigest: boolean;
  mentionNotifications: boolean;
  interviewNotifications: boolean;
  calendarNotifications: boolean;
  onboardingNotifications: boolean;
  equipmentNotifications: boolean;
}

const defaultPreferences: Omit<PreferencesData, 'userId'> = {
  ptoNotifications: true,
  contractNotifications: true,
  reviewNotifications: true,
  taskNotifications: true,
  systemAnnouncements: true,
  weeklyDigest: false,
  mentionNotifications: true,
  interviewNotifications: true,
  calendarNotifications: true,
  onboardingNotifications: true,
  equipmentNotifications: true,
};

export function EmailPreferences({ userId, compact = false }: EmailPreferencesProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState<PreferencesData | null>(null);

  const { data: fetchedPreferences, isLoading } = useQuery({
    queryKey: ['email-preferences', userId],
    queryFn: async () => {
      if (!userId) return null;
      const response = await fetch(`/api/email-preferences/${userId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) {
          return { userId, ...defaultPreferences };
        }
        throw new Error('Failed to fetch email preferences');
      }
      return response.json();
    },
    enabled: !!userId,
  });

  useEffect(() => {
    if (fetchedPreferences) {
      setPreferences(fetchedPreferences);
    }
  }, [fetchedPreferences]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (updatedPrefs: Partial<PreferencesData>) => {
      if (!userId) throw new Error('No user ID');
      const response = await fetch(`/api/email-preferences/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updatedPrefs),
      });
      if (!response.ok) throw new Error('Failed to update preferences');
      return response.json();
    },
    onSuccess: (data) => {
      setPreferences(data);
      queryClient.invalidateQueries({ queryKey: ['email-preferences', userId] });
      toast({
        title: 'Preferences updated',
        description: 'Your email notification settings have been saved.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update preferences. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleToggle = (field: keyof Omit<PreferencesData, 'userId'>) => {
    if (!preferences) return;
    const newValue = !preferences[field];
    const updatedPrefs = { ...preferences, [field]: newValue };
    setPreferences(updatedPrefs);
    updatePreferencesMutation.mutate({ [field]: newValue });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="text-center p-4 text-muted-foreground">
        Please log in to manage your email preferences.
      </div>
    );
  }

  const prefs = preferences || { userId, ...defaultPreferences };

  // Compact version for dashboard
  if (compact) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3">
          <PreferenceToggle
            label="Interview reminders"
            checked={prefs.interviewNotifications}
            onToggle={() => handleToggle('interviewNotifications')}
            disabled={updatePreferencesMutation.isPending}
          />
          <PreferenceToggle
            label="@Mentions"
            checked={prefs.mentionNotifications}
            onToggle={() => handleToggle('mentionNotifications')}
            disabled={updatePreferencesMutation.isPending}
          />
          <PreferenceToggle
            label="PTO notifications"
            checked={prefs.ptoNotifications}
            onToggle={() => handleToggle('ptoNotifications')}
            disabled={updatePreferencesMutation.isPending}
          />
          <PreferenceToggle
            label="System announcements"
            checked={prefs.systemAnnouncements}
            onToggle={() => handleToggle('systemAnnouncements')}
            disabled={updatePreferencesMutation.isPending}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          See Settings for all notification options
        </p>
      </div>
    );
  }

  // Full version for settings page
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Notifications
        </CardTitle>
        <CardDescription>
          Choose which email notifications you want to receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Recruiting & Interviews */}
        <PreferenceSection
          icon={<Users className="h-4 w-4" />}
          title="Recruiting & Interviews"
        >
          <PreferenceToggle
            label="Interview scheduled/reminders"
            description="Get notified about upcoming interviews"
            checked={prefs.interviewNotifications}
            onToggle={() => handleToggle('interviewNotifications')}
            disabled={updatePreferencesMutation.isPending}
          />
          <PreferenceToggle
            label="Candidate status updates"
            description="Updates when candidates move through stages"
            checked={prefs.reviewNotifications}
            onToggle={() => handleToggle('reviewNotifications')}
            disabled={updatePreferencesMutation.isPending}
          />
          <PreferenceToggle
            label="@Mentions in candidate notes"
            description="Get notified when someone mentions you"
            checked={prefs.mentionNotifications}
            onToggle={() => handleToggle('mentionNotifications')}
            disabled={updatePreferencesMutation.isPending}
            icon={<AtSign className="h-3.5 w-3.5" />}
          />
        </PreferenceSection>

        <Separator />

        {/* Calendar & Events */}
        <PreferenceSection
          icon={<Calendar className="h-4 w-4" />}
          title="Calendar & Events"
        >
          <PreferenceToggle
            label="Calendar invites & reminders"
            description="Meeting invitations and event reminders"
            checked={prefs.calendarNotifications}
            onToggle={() => handleToggle('calendarNotifications')}
            disabled={updatePreferencesMutation.isPending}
          />
        </PreferenceSection>

        <Separator />

        {/* Onboarding & Equipment */}
        <PreferenceSection
          icon={<Package className="h-4 w-4" />}
          title="Onboarding & Equipment"
        >
          <PreferenceToggle
            label="Onboarding updates"
            description="New hire onboarding tasks and progress"
            checked={prefs.onboardingNotifications}
            onToggle={() => handleToggle('onboardingNotifications')}
            disabled={updatePreferencesMutation.isPending}
          />
          <PreferenceToggle
            label="Equipment agreements & returns"
            description="Equipment assignments and return reminders"
            checked={prefs.equipmentNotifications}
            onToggle={() => handleToggle('equipmentNotifications')}
            disabled={updatePreferencesMutation.isPending}
          />
        </PreferenceSection>

        <Separator />

        {/* HR & General */}
        <PreferenceSection
          icon={<Bell className="h-4 w-4" />}
          title="HR & General"
        >
          <PreferenceToggle
            label="PTO requests & approvals"
            description="Time off requests, approvals, and denials"
            checked={prefs.ptoNotifications}
            onToggle={() => handleToggle('ptoNotifications')}
            disabled={updatePreferencesMutation.isPending}
          />
          <PreferenceToggle
            label="Contract notifications"
            description="Contract assignments and updates"
            checked={prefs.contractNotifications}
            onToggle={() => handleToggle('contractNotifications')}
            disabled={updatePreferencesMutation.isPending}
          />
          <PreferenceToggle
            label="Task assignments"
            description="When tasks are assigned to you"
            checked={prefs.taskNotifications}
            onToggle={() => handleToggle('taskNotifications')}
            disabled={updatePreferencesMutation.isPending}
          />
          <PreferenceToggle
            label="System announcements"
            description="Important system updates and announcements"
            checked={prefs.systemAnnouncements}
            onToggle={() => handleToggle('systemAnnouncements')}
            disabled={updatePreferencesMutation.isPending}
          />
        </PreferenceSection>

        <Separator />

        {/* Digest */}
        <PreferenceSection
          icon={<Mail className="h-4 w-4" />}
          title="Digest"
        >
          <PreferenceToggle
            label="Weekly email digest"
            description="A summary of activity sent once per week"
            checked={prefs.weeklyDigest}
            onToggle={() => handleToggle('weeklyDigest')}
            disabled={updatePreferencesMutation.isPending}
          />
        </PreferenceSection>
      </CardContent>
    </Card>
  );
}

interface PreferenceSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function PreferenceSection({ icon, title, children }: PreferenceSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icon}
        {title}
      </div>
      <div className="space-y-3 pl-6">
        {children}
      </div>
    </div>
  );
}

interface PreferenceToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function PreferenceToggle({
  label,
  description,
  checked,
  onToggle,
  disabled,
  icon,
}: PreferenceToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1">
        <Label className="flex items-center gap-1.5 text-sm font-normal cursor-pointer">
          {icon}
          {label}
        </Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
    </div>
  );
}
