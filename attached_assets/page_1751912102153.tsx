
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Calendar,
  Clock,
  Video,
  MapPin,
  Plus,
  CheckCircle,
  AlertTriangle,
  User
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MainLayout } from '@/components/layout/main-layout';
import { USER_ROLES } from '@/lib/constants';

interface Meeting {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  isVirtual: boolean;
  meetingLink?: string;
  status: string;
  organizerId: string;
  attendeeId: string;
  organizer: {
    name: string;
    role: string;
  };
  attendee: {
    name: string;
    role: string;
  };
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  department?: string;
}

export default function MeetingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [isVirtual, setIsVirtual] = useState(false);
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user?.onboardingStatus === 'PENDING') {
      router.push('/onboarding');
      return;
    }

    fetchMeetingsData();
  }, [session, status, router]);

  const fetchMeetingsData = async () => {
    try {
      setLoading(true);
      
      // Fetch meetings
      const meetingsResponse = await fetch('/api/meetings');
      if (!meetingsResponse.ok) throw new Error('Failed to fetch meetings');
      const meetingsData = await meetingsResponse.json();
      setMeetings(meetingsData.meetings);

      // Fetch team members
      const teamResponse = await fetch('/api/team/members');
      if (!teamResponse.ok) throw new Error('Failed to fetch team members');
      const teamData = await teamResponse.json();
      setTeamMembers(teamData.members);

    } catch (error) {
      console.error('Error fetching meetings data:', error);
      setError('Failed to load meetings data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMeeting = async () => {
    if (!selectedMember || !title || !startDate || !startTime) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const startDateTime = new Date(`${startDate}T${startTime}`);
      const endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60000);

      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description.trim() || undefined,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          attendeeId: selectedMember,
          isVirtual,
          location: isVirtual ? undefined : location.trim() || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to schedule meeting');
      }

      setSuccess('Meeting scheduled successfully! Both participants will be notified.');
      setShowNewMeeting(false);
      resetForm();
      
      // Refresh data
      await fetchMeetingsData();

    } catch (error: any) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedMember('');
    setTitle('');
    setDescription('');
    setStartDate('');
    setStartTime('');
    setDuration('30');
    setIsVirtual(false);
    setLocation('');
  };

  const getMeetingStatusBadge = (status: string) => {
    const statusConfig = {
      SCHEDULED: { variant: 'default' as const, text: 'Scheduled', icon: Calendar },
      COMPLETED: { variant: 'secondary' as const, text: 'Completed', icon: CheckCircle },
      CANCELLED: { variant: 'destructive' as const, text: 'Cancelled', icon: AlertTriangle },
      RESCHEDULED: { variant: 'outline' as const, text: 'Rescheduled', icon: Clock }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.SCHEDULED;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  const isUpcoming = (meeting: Meeting) => {
    return new Date(meeting.startTime) > new Date();
  };

  const upcomingMeetings = meetings.filter(isUpcoming);
  const pastMeetings = meetings.filter(m => !isUpcoming(m));

  if (status === 'loading' || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="spinner border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-secondary-950">Meeting Scheduler</h1>
            <p className="text-secondary-600 mt-1">
              Schedule time with team members and track your meetings
            </p>
          </div>
          <Dialog open={showNewMeeting} onOpenChange={setShowNewMeeting}>
            <DialogTrigger asChild>
              <Button className="btn-primary flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Schedule Meeting
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule New Meeting</DialogTitle>
                <DialogDescription>
                  Book time with a team member
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <div>
                  <Label htmlFor="member" className="form-label">Team Member</Label>
                  <Select value={selectedMember} onValueChange={setSelectedMember}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select team member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <div>
                              <span className="font-medium">{member.name}</span>
                              <span className="text-xs text-secondary-500 ml-1">
                                ({USER_ROLES[member.role as keyof typeof USER_ROLES] || member.role})
                              </span>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="title" className="form-label">Meeting Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="form-input"
                    placeholder="Weekly check-in, project discussion, etc."
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="form-label">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="form-input"
                    placeholder="Meeting agenda or notes..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startDate" className="form-label">Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="form-input"
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="startTime" className="form-label">Time</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="duration" className="form-label">Duration</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isVirtual"
                      checked={isVirtual}
                      onChange={(e) => setIsVirtual(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="isVirtual" className="text-sm">Virtual meeting</Label>
                  </div>
                  
                  {!isVirtual && (
                    <div>
                      <Label htmlFor="location" className="form-label">Location</Label>
                      <Input
                        id="location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="form-input"
                        placeholder="Conference room, office, job site..."
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowNewMeeting(false)}
                    className="flex-1"
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmitMeeting}
                    disabled={submitting || !selectedMember || !title || !startDate || !startTime}
                    className="flex-1 btn-primary"
                  >
                    {submitting ? 'Scheduling...' : 'Schedule Meeting'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Meeting Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Meetings</CardTitle>
              <Calendar className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary animate-count-up">
                {upcomingMeetings.length}
              </div>
              <p className="text-xs text-secondary-600">
                Scheduled this week
              </p>
            </CardContent>
          </Card>

          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 animate-count-up">
                {teamMembers.length}
              </div>
              <p className="text-xs text-secondary-600">
                Available to meet
              </p>
            </CardContent>
          </Card>

          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Clock className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 animate-count-up">
                {meetings.filter(m => {
                  const meetingDate = new Date(m.startTime);
                  const now = new Date();
                  return meetingDate.getMonth() === now.getMonth() && meetingDate.getFullYear() === now.getFullYear();
                }).length}
              </div>
              <p className="text-xs text-secondary-600">
                Total meetings
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Meetings */}
        <Card className="roof-er-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Upcoming Meetings
            </CardTitle>
            <CardDescription>
              Your scheduled meetings and appointments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingMeetings.length === 0 ? (
                <div className="text-center py-8 text-secondary-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming meetings scheduled</p>
                  <p className="text-sm">Schedule your first meeting above</p>
                </div>
              ) : (
                upcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-secondary-950">{meeting.title}</h4>
                        {getMeetingStatusBadge(meeting.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-secondary-600 mb-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(meeting.startTime).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>
                            {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                            {new Date(meeting.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {meeting.isVirtual ? (
                            <>
                              <Video className="h-4 w-4" />
                              <span>Virtual</span>
                            </>
                          ) : (
                            <>
                              <MapPin className="h-4 w-4" />
                              <span>{meeting.location || 'TBD'}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-secondary-500">
                        With: {session.user.id === meeting.organizerId ? meeting.attendee.name : meeting.organizer.name}
                      </p>
                      {meeting.description && (
                        <p className="text-sm text-secondary-600 mt-1">{meeting.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Meetings */}
        {pastMeetings.length > 0 && (
          <Card className="roof-er-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-secondary-600" />
                Recent Meetings
              </CardTitle>
              <CardDescription>
                Your completed and past meetings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pastMeetings.slice(0, 5).map((meeting) => (
                  <div key={meeting.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium text-secondary-950">{meeting.title}</h4>
                        {getMeetingStatusBadge(meeting.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-secondary-600">
                        <span>{new Date(meeting.startTime).toLocaleDateString()}</span>
                        <span>
                          {new Date(meeting.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span>
                          With: {session.user.id === meeting.organizerId ? meeting.attendee.name : meeting.organizer.name}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {pastMeetings.length > 5 && (
                <div className="text-center pt-4 border-t">
                  <Button variant="outline" size="sm">
                    View All Past Meetings
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
