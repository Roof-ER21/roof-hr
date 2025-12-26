import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, MapPin, Users, Video, Edit2, Trash2, X } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, setHours, setMinutes } from 'date-fns';

interface Meeting {
  id: number;
  title: string;
  description: string;
  type: 'TEAM' | 'DEPARTMENT' | 'ONE_ON_ONE' | 'ALL_HANDS' | 'TRAINING' | 'INTERVIEW';
  startTime: string;
  endTime: string;
  roomId?: number;
  virtualLink?: string;
  attendees: number[];
}

interface MeetingRoom {
  id: number;
  name: string;
  capacity: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

const MEETING_TYPE_COLORS: Record<Meeting['type'], string> = {
  TEAM: 'bg-blue-500',
  DEPARTMENT: 'bg-green-500',
  ONE_ON_ONE: 'bg-purple-500',
  ALL_HANDS: 'bg-red-500',
  TRAINING: 'bg-orange-500',
  INTERVIEW: 'bg-yellow-500',
};

const MEETING_TYPE_LABELS: Record<Meeting['type'], string> = {
  TEAM: 'Team Meeting',
  DEPARTMENT: 'Department',
  ONE_ON_ONE: 'One-on-One',
  ALL_HANDS: 'All Hands',
  TRAINING: 'Training',
  INTERVIEW: 'Interview',
};

const TIME_SLOTS = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM

export default function CalendarScheduler() {
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [selectedAttendees, setSelectedAttendees] = useState<number[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'TEAM' as Meeting['type'],
    startTime: '',
    endTime: '',
    roomId: undefined as number | undefined,
    virtualLink: '',
  });

  // Calculate date range for API query
  const dateRange = useMemo(() => {
    const start = currentWeekStart;
    const end = addDays(start, 6);
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    };
  }, [currentWeekStart]);

  // Fetch meetings
  const { data: meetings = [], isLoading: loadingMeetings } = useQuery<Meeting[]>({
    queryKey: [`/api/meetings?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`],
  });

  // Fetch meeting rooms
  const { data: rooms = [] } = useQuery<MeetingRoom[]>({
    queryKey: ['/api/meeting-rooms'],
  });

  // Fetch users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Create meeting mutation
  const createMeetingMutation = useMutation({
    mutationFn: (data: Partial<Meeting>) => apiRequest('/api/meetings', { method: 'POST' }, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      toast({ title: 'Meeting created successfully' });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create meeting', description: error.message, variant: 'destructive' });
    },
  });

  // Update meeting mutation
  const updateMeetingMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Meeting> & { id: number }) =>
      apiRequest(`/api/meetings/${id}`, { method: 'PUT' }, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      toast({ title: 'Meeting updated successfully' });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update meeting', description: error.message, variant: 'destructive' });
    },
  });

  // Delete meeting mutation
  const deleteMeetingMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/meetings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      toast({ title: 'Meeting deleted successfully' });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete meeting', description: error.message, variant: 'destructive' });
    },
  });

  // Navigate weeks
  const goToPreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const goToToday = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
    setSelectedDay(new Date());
  };

  // Open dialog for new meeting
  const openNewMeetingDialog = (date: Date, hour: number) => {
    const startDateTime = setMinutes(setHours(date, hour), 0);
    const endDateTime = setMinutes(setHours(date, hour + 1), 0);

    setSelectedTimeSlot({ date, hour });
    setFormData({
      title: '',
      description: '',
      type: 'TEAM',
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      roomId: undefined,
      virtualLink: '',
    });
    setSelectedAttendees([]);
    setSelectedMeeting(null);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  // Open dialog for existing meeting
  const openEditMeetingDialog = (meeting: Meeting) => {
    setFormData({
      title: meeting.title,
      description: meeting.description,
      type: meeting.type,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      roomId: meeting.roomId,
      virtualLink: meeting.virtualLink || '',
    });
    setSelectedAttendees(meeting.attendees || []);
    setSelectedMeeting(meeting);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  // Close dialog and reset state
  const closeDialog = () => {
    setIsDialogOpen(false);
    setSelectedMeeting(null);
    setIsEditing(false);
    setSelectedTimeSlot(null);
    setFormData({
      title: '',
      description: '',
      type: 'TEAM',
      startTime: '',
      endTime: '',
      roomId: undefined,
      virtualLink: '',
    });
    setSelectedAttendees([]);
  };

  // Handle form submission
  const handleSubmit = () => {
    if (!formData.title || !formData.startTime || !formData.endTime) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    const meetingData = {
      ...formData,
      attendees: selectedAttendees,
    };

    if (isEditing && selectedMeeting) {
      updateMeetingMutation.mutate({ ...meetingData, id: selectedMeeting.id });
    } else {
      createMeetingMutation.mutate(meetingData);
    }
  };

  // Handle delete
  const handleDelete = () => {
    if (selectedMeeting && window.confirm('Are you sure you want to delete this meeting?')) {
      deleteMeetingMutation.mutate(selectedMeeting.id);
    }
  };

  // Toggle attendee selection
  const toggleAttendee = (userId: number) => {
    setSelectedAttendees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Get meetings for a specific day and hour
  const getMeetingsForSlot = (date: Date, hour: number) => {
    return meetings.filter((meeting) => {
      const meetingStart = parseISO(meeting.startTime);
      const meetingHour = meetingStart.getHours();
      return isSameDay(meetingStart, date) && meetingHour === hour;
    });
  };

  // Get all days in current week
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  }, [currentWeekStart]);

  // Render day header
  const renderDayHeader = (date: Date) => {
    const isToday = isSameDay(date, new Date());
    return (
      <div
        className={`flex-1 text-center py-3 border-b ${
          isToday ? 'bg-blue-50 font-semibold' : ''
        }`}
      >
        <div className="text-xs text-gray-500">{format(date, 'EEE')}</div>
        <div className={`text-lg ${isToday ? 'text-blue-600' : ''}`}>
          {format(date, 'd')}
        </div>
      </div>
    );
  };

  // Render meeting block
  const renderMeeting = (meeting: Meeting) => {
    return (
      <div
        key={meeting.id}
        onClick={(e) => {
          e.stopPropagation();
          openEditMeetingDialog(meeting);
        }}
        className={`${
          MEETING_TYPE_COLORS[meeting.type]
        } text-white text-xs p-2 rounded mb-1 cursor-pointer hover:opacity-90 transition-opacity`}
      >
        <div className="font-semibold truncate">{meeting.title}</div>
        <div className="flex items-center gap-1 text-white/90">
          <Clock className="h-3 w-3" />
          <span>{format(parseISO(meeting.startTime), 'HH:mm')}</span>
        </div>
      </div>
    );
  };

  // Render time slot
  const renderTimeSlot = (date: Date, hour: number) => {
    const slotMeetings = getMeetingsForSlot(date, hour);
    return (
      <div
        onClick={() => openNewMeetingDialog(date, hour)}
        className="border-b border-r p-1 min-h-[60px] hover:bg-gray-50 cursor-pointer transition-colors"
      >
        {slotMeetings.map((meeting) => renderMeeting(meeting))}
      </div>
    );
  };

  if (loadingMeetings) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading calendar...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Meeting Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium px-3">
                  {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                </div>
                <Button variant="ghost" size="icon" onClick={goToNextWeek}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button size="sm" onClick={() => openNewMeetingDialog(new Date(), 9)}>
                <Plus className="h-4 w-4 mr-1" />
                New Meeting
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b">
            {Object.entries(MEETING_TYPE_LABELS).map(([type, label]) => (
              <div key={type} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${MEETING_TYPE_COLORS[type as Meeting['type']]}`} />
                <span className="text-sm text-gray-600">{label}</span>
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="border rounded-lg overflow-hidden">
            {/* Day Headers */}
            <div className="flex bg-gray-50">
              <div className="w-20 border-r" />
              {weekDays.map((date) => (
                <div key={date.toISOString()} className="flex-1 border-r last:border-r-0">
                  {renderDayHeader(date)}
                </div>
              ))}
            </div>

            {/* Time Slots */}
            <div className="bg-white">
              {TIME_SLOTS.map((hour) => (
                <div key={hour} className="flex">
                  {/* Hour Label */}
                  <div className="w-20 border-r py-2 px-3 text-sm text-gray-600 font-medium">
                    {format(setHours(new Date(), hour), 'h a')}
                  </div>
                  {/* Day Slots */}
                  {weekDays.map((date) => (
                    <div key={`${date.toISOString()}-${hour}`} className="flex-1">
                      {renderTimeSlot(date, hour)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meeting Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {isEditing ? 'Edit Meeting' : 'New Meeting'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Meeting title"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Meeting description"
                rows={3}
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="type">Meeting Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: Meeting['type']) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MEETING_TYPE_LABELS).map(([type, label]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${MEETING_TYPE_COLORS[type as Meeting['type']]}`} />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={formData.startTime ? format(parseISO(formData.startTime), "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: new Date(e.target.value).toISOString() })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time *</Label>
                <Input
                  id="endTime"
                  type="datetime-local"
                  value={formData.endTime ? format(parseISO(formData.endTime), "yyyy-MM-dd'T'HH:mm") : ''}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: new Date(e.target.value).toISOString() })
                  }
                />
              </div>
            </div>

            {/* Room */}
            <div className="space-y-2">
              <Label htmlFor="room" className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                Room (Optional)
              </Label>
              <Select
                value={formData.roomId?.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, roomId: value ? parseInt(value) : undefined })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No room</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={room.id.toString()}>
                      {room.name} (Capacity: {room.capacity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Virtual Link */}
            <div className="space-y-2">
              <Label htmlFor="virtualLink" className="flex items-center gap-1">
                <Video className="h-4 w-4" />
                Virtual Meeting Link (Optional)
              </Label>
              <Input
                id="virtualLink"
                value={formData.virtualLink}
                onChange={(e) => setFormData({ ...formData, virtualLink: e.target.value })}
                placeholder="https://meet.google.com/..."
              />
            </div>

            {/* Attendees */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                Attendees (Optional)
              </Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {users.length === 0 ? (
                  <div className="text-sm text-gray-500">No users available</div>
                ) : (
                  users.map((user) => (
                    <div key={user.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`attendee-${user.id}`}
                        checked={selectedAttendees.includes(user.id)}
                        onChange={() => toggleAttendee(user.id)}
                        className="rounded"
                      />
                      <label htmlFor={`attendee-${user.id}`} className="text-sm flex-1 cursor-pointer">
                        {user.name} ({user.role})
                      </label>
                    </div>
                  ))
                )}
              </div>
              {selectedAttendees.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedAttendees.map((userId) => {
                    const user = users.find((u) => u.id === userId);
                    return user ? (
                      <Badge key={userId} variant="secondary" className="gap-1">
                        {user.name}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => toggleAttendee(userId)}
                        />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            {isEditing && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {isEditing ? (
                <>
                  <Edit2 className="h-4 w-4 mr-1" />
                  Update
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Create
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
