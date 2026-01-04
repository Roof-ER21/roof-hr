import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Clock, MapPin, Video, Phone, Users, User, CheckCircle, XCircle, AlertCircle, Send, Link2, AlertTriangle, UserX, Loader2 } from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';
import { format, addDays, setHours, setMinutes, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';

interface InterviewSchedulerProps {
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    email: string;
  };
  onScheduled?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function InterviewScheduler({ candidate, onScheduled, open, onOpenChange }: InterviewSchedulerProps) {
  const candidateId = candidate.id;
  const candidateName = `${candidate.firstName} ${candidate.lastName}`;
  const position = candidate.position;
  const { toast } = useToast();
  const [internalIsOpen, setInternalIsOpen] = useState(false);

  // Use controlled state if props provided, otherwise use internal state
  const isOpen = open !== undefined ? open : internalIsOpen;
  const setIsOpen = onOpenChange || setInternalIsOpen;
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [interviewType, setInterviewType] = useState<'PHONE' | 'VIDEO' | 'IN_PERSON' | 'TECHNICAL' | 'PANEL'>('VIDEO');
  const [duration, setDuration] = useState('60');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedInterviewer, setSelectedInterviewer] = useState('');
  const [panelMembers, setPanelMembers] = useState<string[]>([]);
  const [sendCalendarInvite, setSendCalendarInvite] = useState(true);
  const [sendReminder, setSendReminder] = useState(true);
  const [reminderHours, setReminderHours] = useState('24');
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [suggestedTimes, setSuggestedTimes] = useState<Date[]>([]);
  const [showConflictOverride, setShowConflictOverride] = useState(false);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [selectedOfficeLocation, setSelectedOfficeLocation] = useState<string>('');
  const [customInterviewer, setCustomInterviewer] = useState('');
  const [useCustomInterviewer, setUseCustomInterviewer] = useState(false);

  // Interview status update state
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusDialogType, setStatusDialogType] = useState<'COMPLETED' | 'CANCELLED' | null>(null);
  const [statusDialogInterview, setStatusDialogInterview] = useState<any>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [notesError, setNotesError] = useState('');

  // Office locations
  const officeLocations = {
    DMV: '8100 Boone Blvd, Vienna, VA 22182, Suite 400',
    PA: '851 Duportail Rd, Chesterbrook, PA 19087',
    RICHMOND: '2400 Old Brick Rd, Suite 105, Glen Allen, VA 23060',
    CUSTOM: '',
  };

  // Fetch available interviewers
  const { data: interviewers } = useQuery<Array<{ id: string; firstName: string; lastName: string; role: string }>>({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  // Fetch existing interviews for the candidate
  const { data: existingInterviews } = useQuery<Array<{ id: string; candidateId: string; scheduledDate: string; status: string }>>({
    queryKey: [`/api/interviews/candidate/${candidateId}`],
    enabled: isOpen,
  });

  // Fetch interviewer availability
  const { data: availability } = useQuery<Array<{ dayOfWeek: number; startTime: string; endTime: string }>>({
    queryKey: [`/api/interview-availability/${selectedInterviewer}`],
    enabled: !!selectedInterviewer && isOpen,
  });

  // Check for conflicts when date/time/interviewer changes
  const checkConflictsMutation = useMutation<
    { conflicts?: any[]; warnings?: string[]; suggestedTimes?: string[] },
    Error,
    {
      candidateId: string;
      interviewerId: string;
      scheduledDate: string;
      duration: number;
    }
  >({
    mutationFn: async (data) => {
      return await apiRequest('/api/interviews/check-conflicts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      setConflicts(data.conflicts || []);
      setWarnings(data.warnings || []);
      setSuggestedTimes(data.suggestedTimes?.map((t: string) => new Date(t)) || []);

      // If there are hard conflicts, show override option
      const hardConflicts = data.conflicts?.filter((c: any) => c.severity === 'hard') || [];
      if (hardConflicts.length > 0) {
        setShowConflictOverride(true);
      } else {
        setShowConflictOverride(false);
      }
    },
    onError: () => {
      // If conflict check fails, clear conflicts but allow scheduling
      setConflicts([]);
      setWarnings(['Unable to check for conflicts. Please verify availability manually.']);
    },
  });

  // Effect to check conflicts when inputs change
  useEffect(() => {
    if (selectedDate && selectedInterviewer && selectedTime) {
      setIsCheckingConflicts(true);
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const scheduledDate = setMinutes(setHours(selectedDate, hours), minutes);
      
      checkConflictsMutation.mutate({
        candidateId,
        interviewerId: selectedInterviewer,
        scheduledDate: scheduledDate.toISOString(),
        duration: parseInt(duration),
      });
      setIsCheckingConflicts(false);
    }
  }, [selectedDate, selectedTime, selectedInterviewer, duration]);

  const scheduleMutation = useMutation<
    any,
    any,
    any
  >({
    mutationFn: async (data: any) => {
      // Use /api/interviews/schedule for full integration (calendar + emails)
      const response: any = await apiRequest('/api/interviews/schedule', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      // Add additional interviewers (panel members) for any interview type
      if (panelMembers.length > 0) {
        await Promise.all(panelMembers.map(memberId =>
          apiRequest('/api/interview-panel-members', {
            method: 'POST',
            body: JSON.stringify({
              interviewId: response.id,
              userId: memberId,
              role: memberId === selectedInterviewer ? 'LEAD' : 'PARTICIPANT',
            }),
          })
        ));
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/interviews/candidate/${candidateId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/interviews'] });
      setIsOpen(false);
      resetForm();
      toast({
        title: 'Interview Scheduled',
        description: 'The interview has been scheduled successfully',
      });
      onScheduled?.();
    },
    onError: (error: any) => {
      const errorData = error.data || error;

      // Check if error is due to availability validation (400)
      if (error.status === 400 && errorData.error === 'Outside interviewer availability') {
        toast({
          title: 'Outside Available Hours',
          description: errorData.message || 'The selected time is outside the interviewer\'s available hours.',
          variant: 'destructive',
        });

        // Show available slots if provided
        if (errorData.availableSlots || errorData.suggestion) {
          setWarnings([errorData.suggestion || `Available times: ${errorData.availableSlots}`]);
        }
        return;
      }

      // Check if error is due to existing conflict (409)
      if (error.status === 409) {
        if (errorData.error === 'Interviewer has existing appointment') {
          toast({
            title: 'Interviewer Unavailable',
            description: errorData.message || 'The interviewer already has an appointment at this time.',
            variant: 'destructive',
          });
          setWarnings([errorData.message]);
        } else {
          // General conflicts (PTO, etc)
          setConflicts(errorData.conflicts || []);
          setSuggestedTimes(errorData.suggestedTimes?.map((t: string) => new Date(t)) || []);
          setWarnings(errorData.warnings || []);
          setShowConflictOverride(true);

          toast({
            title: 'Schedule Conflicts Detected',
            description: 'There are conflicts with the selected time. Please review and either choose another time or override.',
            variant: 'destructive',
          });
        }
        return;
      }

      // Generic error
      toast({
        title: 'Error',
        description: errorData.message || 'Failed to schedule interview',
        variant: 'destructive',
      });
    },
  });

  const generateMeetingLinkMutation = useMutation<
    { meetingLink?: string },
    any
  >({
    mutationFn: () => {
      // Calculate interview datetime if date/time are selected
      let interviewDate: string | undefined;
      if (selectedDate && selectedTime) {
        const [hours, minutes] = selectedTime.split(':').map(Number);
        const dateTime = new Date(selectedDate);
        dateTime.setHours(hours, minutes, 0, 0);
        interviewDate = dateTime.toISOString();
      }

      return apiRequest('/api/interviews/generate-meeting-link', {
        method: 'POST',
        body: JSON.stringify({
          type: interviewType,
          candidateName,
          interviewDate,
          durationMinutes: parseInt(duration)
        }),
      });
    },
    onSuccess: (data) => {
      // Ensure meetingLink is always a string to prevent controlled/uncontrolled switch
      setMeetingLink(data?.meetingLink || '');
      toast({
        title: 'Google Meet Link Generated',
        description: 'A Google Meet link has been created for the video interview',
      });
    },
    onError: (error: any) => {
      // Check if it's a Google Calendar configuration error
      const errorData = error?.data || error;
      if (errorData?.fallbackAvailable) {
        toast({
          title: 'Google Meet Not Configured',
          description: errorData.message || 'Please configure Google integration in Settings to generate Meet links.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Failed to Generate Link',
          description: error.message || 'Could not generate meeting link. Please try again or enter manually.',
          variant: 'destructive',
        });
      }
    },
  });

  // Update interview status mutation
  const updateInterviewStatusMutation = useMutation({
    mutationFn: async ({ interviewId, status, outcomeNotes }: { interviewId: string; status: string; outcomeNotes?: string }) => {
      return await apiRequest(`/api/interviews/${interviewId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, outcomeNotes }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/interviews/candidate/${candidateId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/interviews'] });
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      // Invalidate analytics to update interview metrics
      queryClient.invalidateQueries({ queryKey: ['recruiting-analytics'] });

      const statusMessages: Record<string, string> = {
        COMPLETED: 'Interview marked as completed',
        CANCELLED: 'Interview cancelled',
        NO_SHOW: 'Candidate marked as no-show and moved to Dead status',
      };

      toast({
        title: 'Interview Updated',
        description: statusMessages[variables.status] || 'Interview status updated',
      });

      // Reset dialog state
      setShowStatusDialog(false);
      setStatusDialogType(null);
      setStatusDialogInterview(null);
      setOutcomeNotes('');
      setNotesError('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update interview status',
        variant: 'destructive',
      });
    },
  });

  // Handler for opening status dialog
  const handleOpenStatusDialog = (interview: any, type: 'COMPLETED' | 'CANCELLED') => {
    setStatusDialogInterview(interview);
    setStatusDialogType(type);
    setOutcomeNotes('');
    setNotesError('');
    setShowStatusDialog(true);
  };

  // Handler for submitting status with notes
  const handleSubmitStatus = () => {
    if (!outcomeNotes.trim()) {
      setNotesError('Please provide notes about this interview.');
      return;
    }

    if (statusDialogInterview && statusDialogType) {
      updateInterviewStatusMutation.mutate({
        interviewId: statusDialogInterview.id,
        status: statusDialogType,
        outcomeNotes: outcomeNotes.trim(),
      });
    }
  };

  // Handler for No Show (immediate, no dialog)
  const handleNoShow = (interview: any) => {
    if (window.confirm('Mark as No Show?\n\nThis will move the candidate to Dead status with a "No Show" tag.')) {
      updateInterviewStatusMutation.mutate({
        interviewId: interview.id,
        status: 'NO_SHOW',
      });
    }
  };

  const resetForm = () => {
    setSelectedDate(undefined);
    setSelectedTime('09:00');
    setInterviewType('VIDEO');
    setDuration('60');
    setLocation('');
    setMeetingLink('');
    setNotes('');
    setSelectedInterviewer('');
    setPanelMembers([]);
  };

  const handleSchedule = (forceSchedule = false) => {
    // Validate: either need a selected interviewer OR a custom interviewer name
    const hasInterviewer = useCustomInterviewer ? customInterviewer.trim() : selectedInterviewer;

    if (!selectedDate || !hasInterviewer) {
      toast({
        title: 'Missing Information',
        description: useCustomInterviewer
          ? 'Please select a date and enter interviewer name'
          : 'Please select a date and interviewer',
        variant: 'destructive',
      });
      return;
    }

    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledDate = setMinutes(setHours(selectedDate, hours), minutes);

    // Check if there are hard conflicts and not forcing
    const hardConflicts = conflicts.filter(c => c.severity === 'hard');
    if (hardConflicts.length > 0 && !forceSchedule && !showConflictOverride) {
      setShowConflictOverride(true);
      toast({
        title: 'Conflicts Detected',
        description: 'Please review the conflicts before scheduling',
        variant: 'destructive',
      });
      return;
    }

    scheduleMutation.mutate({
      candidateId,
      interviewerId: useCustomInterviewer ? undefined : selectedInterviewer,
      customInterviewerName: useCustomInterviewer ? customInterviewer.trim() : undefined,
      scheduledDate: scheduledDate.toISOString(),
      duration: parseInt(duration),
      type: interviewType,
      location: interviewType === 'IN_PERSON' ? location : undefined,
      meetingLink: ['VIDEO', 'PHONE'].includes(interviewType) ? meetingLink : undefined,
      notes,
      status: 'SCHEDULED',
      reminderHours: sendReminder ? parseInt(reminderHours) : undefined,
      sendCalendarInvite,
      forceSchedule, // Include this to override conflicts
    });
  };

  const getAvailableTimeSlots = () => {
    if (!selectedDate || !availability || !Array.isArray(availability)) return [];

    const dayOfWeek = selectedDate.getDay();
    const dayAvailability = availability.filter(slot => slot.dayOfWeek === dayOfWeek);

    const timeSlots: string[] = [];
    for (const slot of dayAvailability) {
      const [startHour, startMin] = slot.startTime.split(':').map(Number);
      const [endHour, endMin] = slot.endTime.split(':').map(Number);

      // Convert to minutes for easier comparison
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      // Generate 30-minute slots from start up to (but not including) end time
      for (let mins = startMinutes; mins < endMinutes; mins += 30) {
        const hour = Math.floor(mins / 60);
        const min = mins % 60;
        const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        timeSlots.push(time);
      }
    }

    return timeSlots;
  };

  const getInterviewTypeIcon = (type: string) => {
    switch (type) {
      case 'PHONE': return <Phone className="h-4 w-4" />;
      case 'VIDEO': return <Video className="h-4 w-4" />;
      case 'IN_PERSON': return <MapPin className="h-4 w-4" />;
      case 'PANEL': return <Users className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  // Format 24-hour time to 12-hour AM/PM format
  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // The actual scheduler content (shared between controlled and uncontrolled modes)
  const schedulerContent = (
    <Tabs defaultValue="schedule" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="schedule">Schedule New</TabsTrigger>
              <TabsTrigger value="history">Interview History</TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Interview Type</Label>
                  <Select value={interviewType} onValueChange={(value: any) => setInterviewType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHONE">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Phone Interview
                        </div>
                      </SelectItem>
                      <SelectItem value="VIDEO">
                        <div className="flex items-center gap-2">
                          <Video className="h-4 w-4" />
                          Video Interview
                        </div>
                      </SelectItem>
                      <SelectItem value="IN_PERSON">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          In-Person Interview
                        </div>
                      </SelectItem>
                      <SelectItem value="TECHNICAL">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Technical Interview
                        </div>
                      </SelectItem>
                      <SelectItem value="PANEL">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Panel Interview
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Duration (minutes)</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Primary Interviewer</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="use-custom-interviewer"
                      checked={useCustomInterviewer}
                      onChange={(e) => {
                        setUseCustomInterviewer(e.target.checked);
                        if (e.target.checked) {
                          setSelectedInterviewer('');
                        } else {
                          setCustomInterviewer('');
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="use-custom-interviewer" className="text-xs text-gray-600">
                      Add person not in list
                    </label>
                  </div>
                </div>

                {useCustomInterviewer ? (
                  <Input
                    value={customInterviewer}
                    onChange={(e) => setCustomInterviewer(e.target.value)}
                    placeholder="Enter interviewer name (e.g., John Smith - External Recruiter)"
                  />
                ) : (
                  <Select value={selectedInterviewer} onValueChange={setSelectedInterviewer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interviewer" />
                    </SelectTrigger>
                    <SelectContent>
                      {interviewers?.filter((user: any) => ['ADMIN', 'MANAGER'].includes(user.role))
                        .map((user: any) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName} - {user.position}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Show interviewer availability when selected */}
                {selectedInterviewer && !useCustomInterviewer && availability && Array.isArray(availability) && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-sm font-medium text-blue-800 flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Available Hours
                    </p>
                    {availability.filter((a: any) => a.isActive !== false).length > 0 ? (
                      <div className="mt-1 text-sm text-blue-700 space-y-1">
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, idx) => {
                          const daySlots = availability.filter((a: any) => a.dayOfWeek === idx && a.isActive !== false);
                          if (daySlots.length === 0) return null;
                          return (
                            <div key={day} className="flex gap-2">
                              <span className="font-medium w-20">{day}:</span>
                              <span>
                                {daySlots.map((slot: any, i: number) => (
                                  <span key={i}>
                                    {formatTime12Hour(slot.startTime)} - {formatTime12Hour(slot.endTime)}
                                    {i < daySlots.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-orange-600">
                        No availability set. Contact this person to set up their interview availability.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Additional Interviewers - available for all interview types */}
              <div className="space-y-2">
                <Label>Additional Interviewers (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Select additional team members to join this interview
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {interviewers?.filter((user: any) =>
                    ['ADMIN', 'MANAGER'].includes(user.role) && user.id !== selectedInterviewer
                  ).map((user: any) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`panel-${user.id}`}
                        checked={panelMembers.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPanelMembers([...panelMembers, user.id]);
                          } else {
                            setPanelMembers(panelMembers.filter(id => id !== user.id));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor={`panel-${user.id}`} className="text-sm">
                        {user.firstName} {user.lastName}
                      </label>
                    </div>
                  ))}
                </div>
                {panelMembers.length > 0 && (
                  <p className="text-xs text-green-600">
                    {panelMembers.length} additional interviewer{panelMembers.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => 
                      date < new Date() || date.getDay() === 0 || date.getDay() === 6
                    }
                    className="rounded-md border"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Time</Label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Always show default time slots - availability filtering is optional */}
                      {(() => {
                        const availableSlots = selectedInterviewer && availability && Array.isArray(availability) && availability.length > 0
                          ? getAvailableTimeSlots()
                          : [];

                        // If we have availability-based slots, use them; otherwise use defaults (7 AM - 6 PM ET)
                        const timeSlots = availableSlots.length > 0 ? availableSlots : [
                          '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
                          '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
                          '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00'
                        ];

                        return timeSlots.map(time => (
                          <SelectItem key={time} value={time}>{formatTime12Hour(time)} ET</SelectItem>
                        ));
                      })()}
                    </SelectContent>
                  </Select>

                  {selectedDate && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Scheduled for: {format(selectedDate, 'MMMM d, yyyy')} at {formatTime12Hour(selectedTime)} ET
                    </p>
                  )}
                </div>
              </div>

              {interviewType === 'IN_PERSON' && (
                <div className="space-y-3">
                  <Label>Location</Label>

                  {/* Office Location Checkboxes */}
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="loc-dmv"
                        name="officeLocation"
                        checked={selectedOfficeLocation === 'DMV'}
                        onChange={() => {
                          setSelectedOfficeLocation('DMV');
                          setLocation(officeLocations.DMV);
                        }}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="loc-dmv" className="text-sm font-medium">DMV Office</label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="loc-pa"
                        name="officeLocation"
                        checked={selectedOfficeLocation === 'PA'}
                        onChange={() => {
                          setSelectedOfficeLocation('PA');
                          setLocation(officeLocations.PA);
                        }}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="loc-pa" className="text-sm font-medium">PA Office</label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="loc-richmond"
                        name="officeLocation"
                        checked={selectedOfficeLocation === 'RICHMOND'}
                        onChange={() => {
                          setSelectedOfficeLocation('RICHMOND');
                          setLocation(officeLocations.RICHMOND);
                        }}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="loc-richmond" className="text-sm font-medium">Richmond Office</label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="loc-custom"
                        name="officeLocation"
                        checked={selectedOfficeLocation === 'CUSTOM'}
                        onChange={() => {
                          setSelectedOfficeLocation('CUSTOM');
                          setLocation('');
                        }}
                        className="rounded border-gray-300"
                      />
                      <label htmlFor="loc-custom" className="text-sm font-medium">Custom Location</label>
                    </div>
                  </div>

                  {/* Location Display/Input */}
                  <Input
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      if (selectedOfficeLocation !== 'CUSTOM') {
                        setSelectedOfficeLocation('CUSTOM');
                      }
                    }}
                    placeholder="Enter or select interview location"
                    className={selectedOfficeLocation !== 'CUSTOM' ? 'bg-gray-50' : ''}
                  />

                  {selectedOfficeLocation && selectedOfficeLocation !== 'CUSTOM' && (
                    <p className="text-xs text-muted-foreground">
                      Address auto-filled from {selectedOfficeLocation} office
                    </p>
                  )}
                </div>
              )}

              {['VIDEO', 'PHONE'].includes(interviewType) && (
                <div className="space-y-2">
                  <Label>Meeting Link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      placeholder="Enter or generate meeting link"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => generateMeetingLinkMutation.mutate()}
                      disabled={generateMeetingLinkMutation.isPending}
                    >
                      <Link2 className="h-4 w-4 mr-2" />
                      {generateMeetingLinkMutation.isPending ? 'Generating...' : 'Generate'}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Interview Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes or instructions for the interview"
                  rows={3}
                />
              </div>

              {/* Conflict Detection Display */}
              {(conflicts.length > 0 || warnings.length > 0) && (
                <div className="space-y-3">
                  {/* Hard Conflicts */}
                  {conflicts.filter(c => c.severity === 'hard').length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Schedule Conflicts Detected</AlertTitle>
                      <AlertDescription>
                        <div className="space-y-2 mt-2">
                          {conflicts
                            .filter(c => c.severity === 'hard')
                            .map((conflict, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                                <span className="text-sm">{conflict.message}</span>
                              </div>
                            ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Soft Conflicts/Warnings */}
                  {(conflicts.filter(c => c.severity === 'soft').length > 0 || warnings.length > 0) && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Scheduling Warnings</AlertTitle>
                      <AlertDescription>
                        <div className="space-y-2 mt-2">
                          {conflicts
                            .filter(c => c.severity === 'soft')
                            .map((conflict, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                                <span className="text-sm">{conflict.message}</span>
                              </div>
                            ))}
                          {warnings.map((warning, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                              <span className="text-sm">{warning}</span>
                            </div>
                          ))}
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Suggested Alternative Times */}
                  {suggestedTimes.length > 0 && (
                    <Alert>
                      <Clock className="h-4 w-4" />
                      <AlertTitle>Suggested Alternative Times</AlertTitle>
                      <AlertDescription>
                        <div className="space-y-2 mt-2">
                          <p className="text-sm mb-2">The following times are available for all participants:</p>
                          <div className="flex flex-wrap gap-2">
                            {suggestedTimes.slice(0, 5).map((time, idx) => (
                              <Button
                                key={idx}
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedDate(time);
                                  setSelectedTime(
                                    `${time.getHours().toString().padStart(2, '0')}:${time
                                      .getMinutes()
                                      .toString()
                                      .padStart(2, '0')}`
                                  );
                                  setConflicts([]);
                                  setWarnings([]);
                                  setShowConflictOverride(false);
                                }}
                              >
                                {format(time, 'MMM d, h:mm a')} ET
                              </Button>
                            ))}
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="calendar-invite"
                      checked={sendCalendarInvite}
                      onChange={(e) => setSendCalendarInvite(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="calendar-invite" className="text-sm">
                      Send calendar invite to candidate and interviewer
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="reminder"
                      checked={sendReminder}
                      onChange={(e) => setSendReminder(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="reminder" className="text-sm">
                      Send reminder before interview
                    </label>
                  </div>
                  {sendReminder && (
                    <Select value={reminderHours} onValueChange={setReminderHours}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 hour</SelectItem>
                        <SelectItem value="2">2 hours</SelectItem>
                        <SelectItem value="24">24 hours</SelectItem>
                        <SelectItem value="48">48 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                {showConflictOverride && conflicts.filter(c => c.severity === 'hard').length > 0 ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowConflictOverride(false);
                        setSuggestedTimes([]);
                      }}
                    >
                      Choose Different Time
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleSchedule(true)}
                      disabled={scheduleMutation.isPending}
                    >
                      {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule Anyway'}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => handleSchedule()}
                    disabled={scheduleMutation.isPending || isCheckingConflicts}
                  >
                    {scheduleMutation.isPending
                      ? 'Scheduling...'
                      : isCheckingConflicts
                      ? 'Checking Conflicts...'
                      : 'Schedule Interview'}
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {existingInterviews && existingInterviews.length > 0 ? (
                <div className="space-y-3">
                  {existingInterviews.map((interview: any) => (
                    <Card key={interview.id}>
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            {getInterviewTypeIcon(interview.type)}
                            <CardTitle className="text-base">{interview.type} Interview</CardTitle>
                          </div>
                          <Badge variant={
                            interview.status === 'COMPLETED' ? 'default' :
                            interview.status === 'SCHEDULED' ? 'secondary' :
                            interview.status === 'CANCELLED' ? 'destructive' :
                            interview.status === 'NO_SHOW' ? 'destructive' :
                            'outline'
                          }>
                            {interview.status === 'NO_SHOW' ? 'NO SHOW' : interview.status}
                          </Badge>
                        </div>
                        <CardDescription>
                          {format(new Date(interview.scheduledDate), 'PPP p')} ET
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm space-y-1">
                          <p>Duration: {interview.duration} minutes</p>
                          {interview.location && <p>Location: {interview.location}</p>}
                          {interview.meetingLink && (
                            <p>Meeting Link: <a href={interview.meetingLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Join</a></p>
                          )}
                          {interview.notes && <p className="text-muted-foreground">{interview.notes}</p>}
                          {interview.rating && (
                            <div className="flex items-center gap-2 mt-2">
                              <span>Rating:</span>
                              <div className="flex">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span key={star} className={star <= interview.rating ? 'text-yellow-500' : 'text-gray-300'}>
                                    ★
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Action buttons for SCHEDULED interviews */}
                          {interview.status === 'SCHEDULED' && (
                            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50"
                                onClick={() => handleOpenStatusDialog(interview, 'COMPLETED')}
                                disabled={updateInterviewStatusMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-orange-600 border-orange-200 hover:bg-orange-50"
                                onClick={() => handleOpenStatusDialog(interview, 'CANCELLED')}
                                disabled={updateInterviewStatusMutation.isPending}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => handleNoShow(interview)}
                                disabled={updateInterviewStatusMutation.isPending}
                              >
                                <UserX className="h-4 w-4 mr-1" />
                                No Show
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No interviews scheduled yet
                </p>
              )}

              {/* Status Update Dialog (for Complete/Cancel with required notes) */}
              <Dialog open={showStatusDialog} onOpenChange={(open) => {
                if (!open) {
                  setShowStatusDialog(false);
                  setStatusDialogType(null);
                  setStatusDialogInterview(null);
                  setOutcomeNotes('');
                  setNotesError('');
                }
              }}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {statusDialogType === 'COMPLETED' ? 'Complete Interview' : 'Cancel Interview'}
                    </DialogTitle>
                    <DialogDescription>
                      Please provide notes about this interview outcome. Notes will be saved to the candidate's profile.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="outcome-notes" className="flex items-center gap-1">
                        Notes <span className="text-red-500">*</span>
                      </Label>
                      <Textarea
                        id="outcome-notes"
                        value={outcomeNotes}
                        onChange={(e) => {
                          setOutcomeNotes(e.target.value);
                          if (notesError) setNotesError('');
                        }}
                        placeholder={statusDialogType === 'COMPLETED'
                          ? "How did the interview go? Any feedback or observations?"
                          : "Why was this interview cancelled?"
                        }
                        className="min-h-[120px] resize-none"
                      />
                      {notesError && (
                        <p className="text-sm text-red-500">{notesError}</p>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowStatusDialog(false)}
                      disabled={updateInterviewStatusMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmitStatus}
                      disabled={updateInterviewStatusMutation.isPending || !outcomeNotes.trim()}
                      className={statusDialogType === 'COMPLETED' ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      {updateInterviewStatusMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>Save</>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>
          </Tabs>
  );

  // If controlled externally (open prop provided), render content directly
  // This allows the component to work inside a Sheet or other container
  if (open !== undefined) {
    return schedulerContent;
  }

  // Standalone mode - wrap in Dialog with trigger button
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <CalendarIcon className="h-4 w-4 mr-2" />
          Schedule Interview
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Interview for {candidateName}</DialogTitle>
          <DialogDescription>
            Position: {position}
          </DialogDescription>
        </DialogHeader>
        {schedulerContent}
      </DialogContent>
    </Dialog>
  );
}