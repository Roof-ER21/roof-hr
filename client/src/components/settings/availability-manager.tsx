import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Clock, Plus, Trash2, Save, Calendar } from 'lucide-react';

interface AvailabilitySlot {
  id?: string;
  interviewerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface AvailabilityManagerProps {
  userId?: string; // If provided, manage this user's availability (manager mode)
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const TIME_OPTIONS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00'
];

// Convert 24hr to 12hr format
const formatTime12Hour = (time24: string): string => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export function AvailabilityManager({ userId }: AvailabilityManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pendingSlots, setPendingSlots] = useState<Partial<AvailabilitySlot>[]>([]);

  // Determine which user's availability we're managing
  const targetUserId = userId || user?.id;
  const isOwnAvailability = !userId || userId === user?.id;
  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Fetch users for manager mode
  const { data: users } = useQuery<Array<{ id: string; firstName: string; lastName: string; role: string }>>({
    queryKey: ['/api/users'],
    enabled: isManager && !userId,
  });

  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(targetUserId);

  useEffect(() => {
    if (targetUserId) {
      setSelectedUserId(targetUserId);
    }
  }, [targetUserId]);

  // Fetch current availability
  const { data: availability = [], isLoading } = useQuery<AvailabilitySlot[]>({
    queryKey: [`/api/interview-availability/${selectedUserId}`],
    enabled: !!selectedUserId,
  });

  // Create availability mutation
  const createMutation = useMutation({
    mutationFn: (data: Partial<AvailabilitySlot>) =>
      apiRequest('/api/interview-availability', {
        method: 'POST',
        body: JSON.stringify({ ...data, interviewerId: selectedUserId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/interview-availability/${selectedUserId}`] });
      toast({ title: 'Success', description: 'Availability slot added' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add availability slot', variant: 'destructive' });
    },
  });

  // Update availability mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AvailabilitySlot> }) =>
      apiRequest(`/api/interview-availability/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/interview-availability/${selectedUserId}`] });
      toast({ title: 'Success', description: 'Availability updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update availability', variant: 'destructive' });
    },
  });

  // Delete availability mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/interview-availability/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/interview-availability/${selectedUserId}`] });
      toast({ title: 'Success', description: 'Availability slot removed' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove availability slot', variant: 'destructive' });
    },
  });

  const handleAddSlot = () => {
    setPendingSlots([...pendingSlots, {
      dayOfWeek: 1, // Monday default
      startTime: '09:00',
      endTime: '17:00',
      isActive: true,
    }]);
  };

  const handleSavePendingSlot = (index: number) => {
    const slot = pendingSlots[index];
    if (!slot.startTime || !slot.endTime || slot.dayOfWeek === undefined) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    if (slot.startTime >= slot.endTime) {
      toast({ title: 'Error', description: 'End time must be after start time', variant: 'destructive' });
      return;
    }

    createMutation.mutate(slot, {
      onSuccess: () => {
        const newPending = [...pendingSlots];
        newPending.splice(index, 1);
        setPendingSlots(newPending);
      },
    });
  };

  const handleRemovePendingSlot = (index: number) => {
    const newPending = [...pendingSlots];
    newPending.splice(index, 1);
    setPendingSlots(newPending);
  };

  const handleUpdatePendingSlot = (index: number, field: string, value: any) => {
    const newPending = [...pendingSlots];
    newPending[index] = { ...newPending[index], [field]: value };
    setPendingSlots(newPending);
  };

  const handleToggleActive = (slot: AvailabilitySlot) => {
    if (slot.id) {
      updateMutation.mutate({ id: slot.id, data: { isActive: !slot.isActive } });
    }
  };

  const handleDeleteSlot = (slot: AvailabilitySlot) => {
    if (slot.id && confirm('Are you sure you want to delete this availability slot?')) {
      deleteMutation.mutate(slot.id);
    }
  };

  // Group availability by day
  const slotsByDay = DAYS_OF_WEEK.map(day => ({
    ...day,
    slots: availability.filter(slot => slot.dayOfWeek === day.value),
  }));

  if (!selectedUserId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Interview Availability
          </CardTitle>
          <CardDescription>Loading user information...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {isOwnAvailability ? 'My Interview Availability' : 'Manage Interview Availability'}
        </CardTitle>
        <CardDescription>
          {isOwnAvailability
            ? 'Set the times you\'re available to conduct interviews'
            : 'Manage when team members are available for interviews'}
        </CardDescription>

        {/* Manager can select different users */}
        {isManager && !userId && (
          <div className="mt-4">
            <Label>Select User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {users?.filter(u => ['ADMIN', 'MANAGER'].includes(u.role)).map(u => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                    {u.id === user?.id && ' (You)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-muted-foreground">Loading availability...</p>
        ) : (
          <>
            {/* Current Availability by Day */}
            <div className="space-y-4">
              {slotsByDay.map(day => (
                <div key={day.value} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{day.label}</h4>
                    {day.slots.length === 0 && (
                      <Badge variant="outline" className="text-gray-500">Not available</Badge>
                    )}
                  </div>

                  {day.slots.length > 0 && (
                    <div className="space-y-2">
                      {day.slots.map(slot => (
                        <div key={slot.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className={slot.isActive ? '' : 'line-through text-gray-400'}>
                              {formatTime12Hour(slot.startTime)} - {formatTime12Hour(slot.endTime)}
                            </span>
                            {!slot.isActive && (
                              <Badge variant="secondary" className="text-xs">Disabled</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={slot.isActive}
                              onCheckedChange={() => handleToggleActive(slot)}
                              disabled={updateMutation.isPending}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSlot(slot)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pending New Slots */}
            {pendingSlots.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">New Availability Slots</h4>
                <div className="space-y-3">
                  {pendingSlots.map((slot, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <Select
                        value={slot.dayOfWeek?.toString()}
                        onValueChange={(v) => handleUpdatePendingSlot(index, 'dayOfWeek', parseInt(v))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Day" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS_OF_WEEK.map(d => (
                            <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={slot.startTime}
                        onValueChange={(v) => handleUpdatePendingSlot(index, 'startTime', v)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue placeholder="Start" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map(t => (
                            <SelectItem key={t} value={t}>{formatTime12Hour(t)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <span className="text-gray-500">to</span>

                      <Select
                        value={slot.endTime}
                        onValueChange={(v) => handleUpdatePendingSlot(index, 'endTime', v)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue placeholder="End" />
                        </SelectTrigger>
                        <SelectContent>
                          {TIME_OPTIONS.map(t => (
                            <SelectItem key={t} value={t}>{formatTime12Hour(t)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex gap-2 ml-auto">
                        <Button
                          size="sm"
                          onClick={() => handleSavePendingSlot(index)}
                          disabled={createMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemovePendingSlot(index)}
                        >
                          <Trash2 className="h-4 w-4 text-gray-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add Button */}
            <Button
              variant="outline"
              onClick={handleAddSlot}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Availability Slot
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
