import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Users, TrendingUp, CheckCircle, XCircle, AlertCircle, User, Video, Phone, MapPin } from 'lucide-react';
import { format, isToday, isTomorrow, isThisWeek, isPast } from 'date-fns';

interface Interview {
  id: string;
  candidateId: string;
  interviewerId: string;
  scheduledDate: string;
  duration: number;
  type: 'PHONE' | 'VIDEO' | 'IN_PERSON' | 'TECHNICAL' | 'PANEL';
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  location?: string;
  meetingLink?: string;
  notes?: string;
  rating?: number;
  feedback?: string;
}

export function InterviewDashboard() {
  // Fetch upcoming interviews
  const { data: interviews = [], isLoading } = useQuery<Interview[]>({
    queryKey: ['/api/interviews'],
  });

  // Fetch candidates for interview details
  const { data: candidates = [] } = useQuery({
    queryKey: ['/api/candidates'],
  });

  // Fetch users for interviewer details
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
  });

  // Calculate statistics
  const upcomingInterviews = interviews.filter(i => 
    i.status === 'SCHEDULED' && !isPast(new Date(i.scheduledDate))
  );
  
  const todayInterviews = upcomingInterviews.filter(i => 
    isToday(new Date(i.scheduledDate))
  );
  
  const weekInterviews = upcomingInterviews.filter(i => 
    isThisWeek(new Date(i.scheduledDate))
  );
  
  const completedInterviews = interviews.filter(i => 
    i.status === 'COMPLETED'
  );
  
  const averageRating = completedInterviews.length > 0
    ? completedInterviews.reduce((sum, i) => sum + (i.rating || 0), 0) / completedInterviews.length
    : 0;

  const getInterviewTypeIcon = (type: string) => {
    switch (type) {
      case 'PHONE': return <Phone className="h-4 w-4" />;
      case 'VIDEO': return <Video className="h-4 w-4" />;
      case 'IN_PERSON': return <MapPin className="h-4 w-4" />;
      case 'PANEL': return <Users className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return <Badge variant="secondary">Scheduled</Badge>;
      case 'COMPLETED':
        return <Badge variant="default">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'NO_SHOW':
        return <Badge variant="outline">No Show</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getCandidateName = (candidateId: string) => {
    const candidate = candidates.find((c: any) => c.id === candidateId);
    return candidate ? `${candidate.firstName} ${candidate.lastName}` : 'Unknown Candidate';
  };

  const getInterviewerName = (interviewerId: string) => {
    const interviewer = users.find((u: any) => u.id === interviewerId);
    return interviewer ? `${interviewer.firstName} ${interviewer.lastName}` : 'Unknown Interviewer';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Today's Interviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayInterviews.length}</div>
            <p className="text-xs text-muted-foreground">
              {todayInterviews.length === 1 ? 'interview' : 'interviews'} scheduled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-500" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekInterviews.length}</div>
            <p className="text-xs text-muted-foreground">
              upcoming interviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-purple-500" />
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedInterviews.length}</div>
            <p className="text-xs text-muted-foreground">
              total interviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-500" />
              Average Rating
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageRating.toFixed(1)}</div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={star <= averageRating ? 'text-yellow-500' : 'text-gray-300'}
                >
                  ★
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Interviews */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Interviews</CardTitle>
          <CardDescription>
            Scheduled interviews for the next 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingInterviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No upcoming interviews scheduled
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingInterviews
                .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
                .slice(0, 10)
                .map((interview) => (
                  <div
                    key={interview.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {getInterviewTypeIcon(interview.type)}
                      </div>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {getCandidateName(interview.candidateId)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(interview.scheduledDate), 'PPP p')}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Interviewer: {getInterviewerName(interview.interviewerId)}
                        </div>
                        {interview.location && (
                          <div className="text-sm text-muted-foreground">
                            Location: {interview.location}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {interview.duration} min
                        </div>
                        {interview.meetingLink && (
                          <a
                            href={interview.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Join Meeting
                          </a>
                        )}
                      </div>
                      {getStatusBadge(interview.status)}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Interview Feedback */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Interview Feedback</CardTitle>
          <CardDescription>
            Latest feedback from completed interviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          {completedInterviews.filter(i => i.feedback).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No interview feedback available yet
            </div>
          ) : (
            <div className="space-y-4">
              {completedInterviews
                .filter(i => i.feedback)
                .slice(0, 5)
                .map((interview) => (
                  <div key={interview.id} className="border-l-4 border-primary pl-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {getCandidateName(interview.candidateId)}
                      </div>
                      <div className="flex items-center gap-2">
                        {interview.rating && (
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                className={star <= interview.rating! ? 'text-yellow-500' : 'text-gray-300'}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {interview.feedback}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      Interviewed by {getInterviewerName(interview.interviewerId)} on{' '}
                      {format(new Date(interview.scheduledDate), 'PP')}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}