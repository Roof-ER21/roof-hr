import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, MapPin, Video, Loader2 } from 'lucide-react';

interface CalendarEvent {
  id?: string;
  type: 'MEETING' | 'PTO' | 'INTERVIEW' | 'OTHER';
  title: string;
  description?: string;
  startDate: string | Date;
  endDate: string | Date;
  location?: string;
  allDay?: boolean;
  meetLink?: string;
  ptoType?: 'VACATION' | 'SICK' | 'PERSONAL';
}

interface EventFormModalProps {
  open: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  selectedDate?: Date;
}

export function EventFormModal({ open, onClose, event, selectedDate }: EventFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<{
    type: 'MEETING' | 'PTO' | 'INTERVIEW' | 'OTHER';
    title: string;
    description: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    location: string;
    allDay: boolean;
    addGoogleMeet: boolean;
    ptoType: 'VACATION' | 'SICK' | 'PERSONAL' | '';
  }>({
    type: 'MEETING',
    title: '',
    description: '',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '10:00',
    location: '',
    allDay: false,
    addGoogleMeet: false,
    ptoType: '',
  });

  // Initialize form when modal opens
  useEffect(() => {
    if (open) {
      if (event) {
        // Editing existing event
        const startDt = new Date(event.startDate);
        const endDt = new Date(event.endDate);
        setFormData({
          type: event.type,
          title: event.title,
          description: event.description || '',
          startDate: startDt.toISOString().split('T')[0],
          startTime: startDt.toTimeString().slice(0, 5),
          endDate: endDt.toISOString().split('T')[0],
          endTime: endDt.toTimeString().slice(0, 5),
          location: event.location || '',
          allDay: event.allDay || false,
          addGoogleMeet: !!event.meetLink,
          ptoType: event.ptoType || '',
        });
      } else {
        // Creating new event
        const dateToUse = selectedDate || new Date();
        const dateStr = dateToUse.toISOString().split('T')[0];
        setFormData({
          type: 'MEETING',
          title: '',
          description: '',
          startDate: dateStr,
          startTime: '09:00',
          endDate: dateStr,
          endTime: '10:00',
          location: '',
          allDay: false,
          addGoogleMeet: false,
          ptoType: '',
        });
      }
    }
  }, [open, event, selectedDate]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/google/calendar/user-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create event');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google/calendar/my-events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/google/calendar/user-events'] });
      toast({ title: 'Event created', description: 'Your calendar event has been created.' });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/google/calendar/user-events/${event?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update event');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google/calendar/my-events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/google/calendar/user-events'] });
      toast({ title: 'Event updated', description: 'Your calendar event has been updated.' });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!formData.title.trim()) {
      toast({ title: 'Error', description: 'Please enter an event title', variant: 'destructive' });
      return;
    }

    if (formData.type === 'PTO' && !formData.ptoType) {
      toast({ title: 'Error', description: 'Please select PTO type', variant: 'destructive' });
      return;
    }

    // Build date/time
    const startDateTime = formData.allDay
      ? new Date(`${formData.startDate}T00:00:00`)
      : new Date(`${formData.startDate}T${formData.startTime}:00`);

    const endDateTime = formData.allDay
      ? new Date(`${formData.endDate}T23:59:59`)
      : new Date(`${formData.endDate}T${formData.endTime}:00`);

    if (endDateTime <= startDateTime && !formData.allDay) {
      toast({ title: 'Error', description: 'End time must be after start time', variant: 'destructive' });
      return;
    }

    const payload = {
      type: formData.type,
      title: formData.title,
      description: formData.description || undefined,
      startDate: startDateTime.toISOString(),
      endDate: endDateTime.toISOString(),
      location: formData.location || undefined,
      allDay: formData.allDay,
      addGoogleMeet: formData.addGoogleMeet && formData.type !== 'PTO',
      ptoType: formData.type === 'PTO' ? formData.ptoType : undefined,
    };

    if (event?.id) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {event ? 'Edit Event' : 'Add Event'}
          </DialogTitle>
          <DialogDescription>
            {event ? 'Update the details of your calendar event.' : 'Create a new calendar event. Events will sync to Google Calendar.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Event Type */}
          <div className="space-y-2">
            <Label>Event Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: any) => setFormData({ ...formData, type: value, ptoType: value !== 'PTO' ? '' : formData.ptoType })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MEETING">Meeting</SelectItem>
                <SelectItem value="PTO">Time Off (PTO)</SelectItem>
                <SelectItem value="INTERVIEW">Interview</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* PTO Type (conditional) */}
          {formData.type === 'PTO' && (
            <div className="space-y-2">
              <Label>PTO Type</Label>
              <Select
                value={formData.ptoType}
                onValueChange={(value: any) => setFormData({ ...formData, ptoType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select PTO type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VACATION">Vacation</SelectItem>
                  <SelectItem value="SICK">Sick Leave</SelectItem>
                  <SelectItem value="PERSONAL">Personal Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Enter event title"
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="allDay"
              checked={formData.allDay}
              onCheckedChange={(checked) => setFormData({ ...formData, allDay: !!checked })}
            />
            <Label htmlFor="allDay" className="text-sm font-normal cursor-pointer">All day event</Label>
          </div>

          {/* Date/Time Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
            {!formData.allDay && (
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              />
            </div>
            {!formData.allDay && (
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Add event description (optional)"
              rows={3}
            />
          </div>

          {/* Location */}
          {formData.type !== 'PTO' && (
            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> Location
              </Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Add location (optional)"
              />
            </div>
          )}

          {/* Google Meet Toggle */}
          {formData.type !== 'PTO' && !event && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="addGoogleMeet"
                checked={formData.addGoogleMeet}
                onCheckedChange={(checked) => setFormData({ ...formData, addGoogleMeet: !!checked })}
              />
              <Label htmlFor="addGoogleMeet" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                <Video className="h-4 w-4" /> Add Google Meet link
              </Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {event ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                event ? 'Update Event' : 'Create Event'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
