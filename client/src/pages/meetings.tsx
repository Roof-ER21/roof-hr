import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Video, Calendar, Users, Plus, Clock, MapPin, Link as LinkIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const meetingSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  attendeeIds: z.array(z.string()).min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  location: z.string().optional(),
  type: z.enum(['IN_PERSON', 'VIDEO', 'PHONE']),
  meetingLink: z.string().optional(),
});

type MeetingFormData = z.infer<typeof meetingSchema>;

function Meetings() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings, isLoading: meetingsLoading } = useQuery({
    queryKey: ['/api/meetings'],
    queryFn: async () => {
      const response = await fetch('/api/meetings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch meetings');
      return response.json();
    }
  });

  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    }
  });

  const form = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      title: '',
      description: '',
      attendeeIds: [],
      startTime: '',
      endTime: '',
      location: '',
      type: 'VIDEO',
      meetingLink: '',
    }
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: MeetingFormData) => {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...data,
          attendeeIds: selectedAttendees,
        })
      });
      if (!response.ok) throw new Error('Failed to create meeting');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      setIsDialogOpen(false);
      form.reset();
      setSelectedAttendees([]);
      toast({
        title: 'Success',
        description: 'Meeting scheduled successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to schedule meeting',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: MeetingFormData) => {
    createMeetingMutation.mutate(data);
  };

  const handleAttendeeChange = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedAttendees([...selectedAttendees, userId]);
    } else {
      setSelectedAttendees(selectedAttendees.filter(id => id !== userId));
    }
  };

  const getUserById = (id: string) => {
    return users?.find((user: any) => user.id === id);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'IN_PERSON': return 'bg-green-100 text-green-800';
      case 'VIDEO': return 'bg-blue-100 text-blue-800';
      case 'PHONE': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'IN_PERSON': return <MapPin className="w-4 h-4" />;
      case 'VIDEO': return <Video className="w-4 h-4" />;
      case 'PHONE': return <Clock className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString();
  };

  const getDuration = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diff = end.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${remainingMinutes}m`;
  };

  if (meetingsLoading) {
    return <div className="p-8">Loading meetings...</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-secondary-950">Meetings</h1>
          <p className="mt-2 text-sm text-secondary-600">
            Schedule and manage team meetings
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Schedule New Meeting</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="title">Meeting Title</Label>
                  <Input
                    id="title"
                    {...form.register('title')}
                    placeholder="Enter meeting title"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...form.register('description')}
                    placeholder="Meeting description or agenda"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="datetime-local"
                      {...form.register('startTime')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="datetime-local"
                      {...form.register('endTime')}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="type">Meeting Type</Label>
                  <Select onValueChange={(value) => form.setValue('type', value as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select meeting type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIDEO">Video Conference</SelectItem>
                      <SelectItem value="IN_PERSON">In Person</SelectItem>
                      <SelectItem value="PHONE">Phone Call</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="location">Location / Meeting Link</Label>
                  <Input
                    id="location"
                    {...form.register('location')}
                    placeholder="Meeting room, address, or video link"
                  />
                </div>
                
                <div>
                  <Label>Attendees</Label>
                  <div className="mt-2 max-h-48 overflow-y-auto border rounded-md p-3">
                    {users?.map((user: any) => (
                      <div key={user.id} className="flex items-center space-x-2 py-2">
                        <Checkbox
                          id={user.id}
                          checked={selectedAttendees.includes(user.id)}
                          onCheckedChange={(checked) => handleAttendeeChange(user.id, checked as boolean)}
                        />
                        <label htmlFor={user.id} className="text-sm cursor-pointer">
                          {user.firstName} {user.lastName} - {user.position}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMeetingMutation.isPending}>
                    {createMeetingMutation.isPending ? 'Scheduling...' : 'Schedule Meeting'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Meetings List */}
      <div className="space-y-6">
        {meetings?.map((meeting: any) => {
          const organizer = getUserById(meeting.organizerId);
          const attendees = meeting.attendeeIds?.map((id: string) => getUserById(id)).filter(Boolean) || [];
          
          return (
            <Card key={meeting.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      {getTypeIcon(meeting.type)}
                      <span className="ml-2">{meeting.title}</span>
                    </CardTitle>
                    <p className="text-sm text-secondary-600 mt-1">
                      Organized by {organizer?.firstName} {organizer?.lastName}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getTypeColor(meeting.type)}>
                      {meeting.type.replace('_', ' ')}
                    </Badge>
                    <Badge className={getStatusColor(meeting.status)}>
                      {meeting.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {meeting.description && (
                    <p className="text-sm text-secondary-700">{meeting.description}</p>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-secondary-500" />
                      <span className="text-sm">
                        {formatTime(meeting.startTime)} - {formatTime(meeting.endTime)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-secondary-500" />
                      <span className="text-sm">
                        Duration: {getDuration(meeting.startTime, meeting.endTime)}
                      </span>
                    </div>
                  </div>
                  
                  {meeting.location && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-secondary-500" />
                      <span className="text-sm">{meeting.location}</span>
                    </div>
                  )}
                  
                  {meeting.meetingLink && (
                    <div className="flex items-center space-x-2">
                      <LinkIcon className="w-4 h-4 text-secondary-500" />
                      <a
                        href={meeting.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        Join Meeting
                      </a>
                    </div>
                  )}
                  
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Users className="w-4 h-4 text-secondary-500" />
                      <span className="text-sm font-medium">Attendees ({attendees.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attendees.map((attendee: any) => (
                        <div key={attendee.id} className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1">
                          <div className="w-6 h-6 bg-secondary-200 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium">
                              {attendee.firstName?.[0]}{attendee.lastName?.[0]}
                            </span>
                          </div>
                          <span className="text-xs">{attendee.firstName} {attendee.lastName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {meeting.notes && (
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm font-medium mb-1">Notes:</p>
                      <p className="text-sm text-secondary-700">{meeting.notes}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default Meetings;
