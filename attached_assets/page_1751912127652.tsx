
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  FileText,
  Upload,
  Download,
  Trash2,
  Plus,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  Briefcase,
  MessageSquare,
  Video,
  Users as UsersIcon
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MainLayout } from '@/components/layout/main-layout';

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  stage: string;
  appliedDate: string;
  source?: string;
  desiredSalary?: number;
  availableStartDate?: string;
  lastContactDate?: string;
  rejectionReason?: string;
  position: {
    id: string;
    title: string;
    department: string;
  };
  assignedRecruiter?: {
    id: string;
    name: string;
  };
  documents: CandidateDocument[];
  interviews: CandidateInterview[];
  notes: CandidateNote[];
}

interface CandidateDocument {
  id: string;
  type: string;
  customType?: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  uploadedAt: string;
  description?: string;
  isVerified: boolean;
}

interface CandidateInterview {
  id: string;
  type: string;
  status: string;
  scheduledDate: string;
  duration?: number;
  location?: string;
  meetingLink?: string;
  notes?: string;
  score?: number;
  recommendation?: string;
  scheduler: {
    id: string;
    name: string;
  };
}

interface CandidateNote {
  id: string;
  subject?: string;
  content: string;
  category?: string;
  isPrivate: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string;
  };
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

const CANDIDATE_STAGES = [
  { key: 'APPLIED', label: 'Applied' },
  { key: 'INTERVIEW_SCHEDULED', label: 'Interview Scheduled' },
  { key: 'INTERVIEWED', label: 'Interviewed' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'DIDNT_ACCEPT', label: "Didn't Accept" },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'NA', label: 'N/A' }
];

const INTERVIEW_TYPES = [
  { key: 'PHONE', label: 'Phone Call' },
  { key: 'VIDEO', label: 'Video Call' },
  { key: 'IN_PERSON', label: 'In Person' },
  { key: 'PANEL', label: 'Panel Interview' }
];

export default function CandidateProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const candidateId = params?.candidateId as string;

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Interview scheduling state
  const [showScheduleInterview, setShowScheduleInterview] = useState(false);
  const [schedulingInterview, setSchedulingInterview] = useState(false);
  const [newInterview, setNewInterview] = useState({
    type: 'IN_PERSON',
    scheduledDate: '',
    duration: 60,
    location: '',
    meetingLink: '',
    interviewerIds: [] as string[]
  });

  // Note adding state
  const [showAddNote, setShowAddNote] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [newNote, setNewNote] = useState({
    subject: '',
    content: '',
    category: 'general',
    isPrivate: false
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user?.onboardingStatus === 'PENDING') {
      router.push('/onboarding');
      return;
    }

    // Check if user has recruiting access
    const hasRecruitingAccess = session?.user?.role === 'ADMIN' || 
                              session?.user?.role === 'OWNER' || 
                              session?.user?.role === 'SALES_DIRECTOR' ||
                              session?.user?.role === 'HR_DIRECTOR' ||
                              session?.user?.role === 'HR_RECRUITER';

    if (!hasRecruitingAccess) {
      router.push('/dashboard');
      return;
    }

    if (candidateId) {
      fetchCandidateData();
      fetchTeamMembers();
    }
  }, [session, status, router, candidateId]);

  const fetchCandidateData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/recruiting/candidates/${candidateId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Candidate not found');
        }
        throw new Error('Failed to fetch candidate');
      }
      
      const data = await response.json();
      setCandidate(data.candidate);

    } catch (error: any) {
      console.error('Error fetching candidate:', error);
      setError(error.message || 'Failed to load candidate information');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch('/api/team/members');
      if (!response.ok) throw new Error('Failed to fetch team members');
      
      const data = await response.json();
      setTeamMembers(data.members);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  };

  const handleStageChange = async (newStage: string) => {
    if (!candidate) return;

    try {
      const response = await fetch(`/api/recruiting/candidates/${candidate.id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage })
      });

      if (!response.ok) {
        throw new Error('Failed to update candidate stage');
      }

      setCandidate(prev => prev ? { ...prev, stage: newStage } : null);

      if (newStage === 'ACCEPTED') {
        setSuccess('Candidate marked as accepted! Onboarding email will be sent automatically.');
      }

    } catch (error) {
      console.error('Error updating candidate stage:', error);
      setError('Failed to update candidate stage');
    }
  };

  const handleScheduleInterview = async () => {
    if (!candidate || !newInterview.scheduledDate || !newInterview.type) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSchedulingInterview(true);
      setError('');

      const response = await fetch(`/api/recruiting/candidates/${candidate.id}/interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newInterview)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to schedule interview');
      }

      setSuccess('Interview scheduled successfully! Notifications will be sent to all participants.');
      setShowScheduleInterview(false);
      setNewInterview({
        type: 'IN_PERSON',
        scheduledDate: '',
        duration: 60,
        location: '',
        meetingLink: '',
        interviewerIds: []
      });
      
      // Refresh candidate data
      await fetchCandidateData();

    } catch (error: any) {
      setError(error.message);
    } finally {
      setSchedulingInterview(false);
    }
  };

  const handleAddNote = async () => {
    if (!candidate || !newNote.content.trim()) {
      setError('Please enter note content');
      return;
    }

    try {
      setAddingNote(true);
      setError('');

      const response = await fetch(`/api/recruiting/candidates/${candidate.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add note');
      }

      setSuccess('Note added successfully!');
      setShowAddNote(false);
      setNewNote({
        subject: '',
        content: '',
        category: 'general',
        isPrivate: false
      });
      
      // Refresh candidate data
      await fetchCandidateData();

    } catch (error: any) {
      setError(error.message);
    } finally {
      setAddingNote(false);
    }
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      APPLIED: 'bg-blue-100 text-blue-800',
      INTERVIEW_SCHEDULED: 'bg-yellow-100 text-yellow-800',
      INTERVIEWED: 'bg-purple-100 text-purple-800',
      ACCEPTED: 'bg-green-100 text-green-800',
      DIDNT_ACCEPT: 'bg-orange-100 text-orange-800',
      REJECTED: 'bg-red-100 text-red-800',
      NA: 'bg-gray-100 text-gray-800'
    };
    return colors[stage] || 'bg-gray-100 text-gray-800';
  };

  const getInterviewTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      PHONE: Phone,
      VIDEO: Video,
      IN_PERSON: User,
      PANEL: UsersIcon
    };
    return icons[type] || User;
  };

  const getInterviewStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      SCHEDULED: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      CANCELLED: 'bg-red-100 text-red-800',
      RESCHEDULED: 'bg-yellow-100 text-yellow-800',
      NO_SHOW: 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (status === 'loading' || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="spinner border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (error && !candidate) {
    return (
      <MainLayout>
        <div className="max-w-2xl mx-auto mt-8">
          <Card className="roof-er-shadow border-red-200 bg-red-50/50">
            <CardContent className="text-center py-8">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-600" />
              <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Candidate</h3>
              <p className="text-red-800 mb-4">{error}</p>
              <Button onClick={() => router.push('/recruiting')} variant="outline">
                Back to Recruiting Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (!candidate) {
    return null;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => router.push('/recruiting')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-secondary-950">
              {candidate.firstName} {candidate.lastName}
            </h1>
            <p className="text-secondary-600 mt-1">
              Applied for {candidate.position.title} in {candidate.position.department}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={getStageColor(candidate.stage)}>
              {CANDIDATE_STAGES.find(s => s.key === candidate.stage)?.label || candidate.stage}
            </Badge>
            <Select value={candidate.stage} onValueChange={handleStageChange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CANDIDATE_STAGES.map((stage) => (
                  <SelectItem key={stage.key} value={stage.key}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Contact Info Card */}
        <Card className="roof-er-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-secondary-400" />
                <div>
                  <p className="text-sm font-medium text-secondary-950">{candidate.email}</p>
                  <p className="text-xs text-secondary-500">Email</p>
                </div>
              </div>
              
              {candidate.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-secondary-400" />
                  <div>
                    <p className="text-sm font-medium text-secondary-950">{candidate.phone}</p>
                    <p className="text-xs text-secondary-500">Phone</p>
                  </div>
                </div>
              )}
              
              {(candidate.city || candidate.state) && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-secondary-400" />
                  <div>
                    <p className="text-sm font-medium text-secondary-950">
                      {[candidate.city, candidate.state].filter(Boolean).join(', ')}
                    </p>
                    <p className="text-xs text-secondary-500">Location</p>
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-secondary-400" />
                <div>
                  <p className="text-sm font-medium text-secondary-950">
                    {new Date(candidate.appliedDate).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-secondary-500">Applied Date</p>
                </div>
              </div>
              
              {candidate.source && (
                <div className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 text-secondary-400" />
                  <div>
                    <p className="text-sm font-medium text-secondary-950">{candidate.source}</p>
                    <p className="text-xs text-secondary-500">Source</p>
                  </div>
                </div>
              )}
              
              {candidate.assignedRecruiter && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-secondary-400" />
                  <div>
                    <p className="text-sm font-medium text-secondary-950">{candidate.assignedRecruiter.name}</p>
                    <p className="text-xs text-secondary-500">Assigned Recruiter</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabbed Content */}
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="interviews">
              Interviews ({candidate.interviews?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="files">
              Files ({candidate.documents?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            {/* Additional Details */}
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle>Application Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {candidate.desiredSalary && (
                    <div>
                      <Label className="text-sm font-medium text-secondary-700">Desired Salary</Label>
                      <p className="text-sm text-secondary-950">${candidate.desiredSalary.toLocaleString()}</p>
                    </div>
                  )}
                  
                  {candidate.availableStartDate && (
                    <div>
                      <Label className="text-sm font-medium text-secondary-700">Available Start Date</Label>
                      <p className="text-sm text-secondary-950">
                        {new Date(candidate.availableStartDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  
                  {candidate.lastContactDate && (
                    <div>
                      <Label className="text-sm font-medium text-secondary-700">Last Contact</Label>
                      <p className="text-sm text-secondary-950">
                        {new Date(candidate.lastContactDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  
                  {candidate.rejectionReason && (
                    <div>
                      <Label className="text-sm font-medium text-secondary-700">Rejection Reason</Label>
                      <p className="text-sm text-red-600">{candidate.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Notes Section */}
            <Card className="roof-er-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Notes & Communications
                </CardTitle>
                <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="btn-primary">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Note</DialogTitle>
                      <DialogDescription>
                        Record communication or observations about this candidate
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="noteSubject">Subject (Optional)</Label>
                        <Input
                          id="noteSubject"
                          value={newNote.subject}
                          onChange={(e) => setNewNote(prev => ({ ...prev, subject: e.target.value }))}
                          placeholder="Phone call, email, meeting, etc."
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="noteContent">Content *</Label>
                        <Textarea
                          id="noteContent"
                          value={newNote.content}
                          onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                          placeholder="Enter your note here..."
                          rows={4}
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="noteCategory">Category</Label>
                        <Select value={newNote.category} onValueChange={(value) => setNewNote(prev => ({ ...prev, category: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="phone_call">Phone Call</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="meeting">Meeting</SelectItem>
                            <SelectItem value="reference_check">Reference Check</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowAddNote(false)}
                          className="flex-1"
                          disabled={addingNote}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleAddNote}
                          disabled={addingNote || !newNote.content.trim()}
                          className="flex-1 btn-primary"
                        >
                          {addingNote ? 'Adding...' : 'Add Note'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {candidate.notes?.length === 0 ? (
                  <div className="text-center py-8 text-secondary-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No notes yet</p>
                    <p className="text-sm">Add a note to track communications</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {candidate.notes?.map((note) => (
                      <div key={note.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            {note.subject && (
                              <h4 className="font-medium text-secondary-950">{note.subject}</h4>
                            )}
                            <p className="text-sm text-secondary-600">
                              By {note.author.name} • {new Date(note.createdAt).toLocaleString()}
                              {note.category && ` • ${note.category.replace('_', ' ')}`}
                            </p>
                          </div>
                          {note.isPrivate && (
                            <Badge variant="outline" className="text-xs">Private</Badge>
                          )}
                        </div>
                        <p className="text-sm text-secondary-950 whitespace-pre-wrap">{note.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="interviews" className="space-y-4">
            <Card className="roof-er-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Interview History
                </CardTitle>
                <Dialog open={showScheduleInterview} onOpenChange={setShowScheduleInterview}>
                  <DialogTrigger asChild>
                    <Button className="btn-primary">
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule Interview
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Schedule Interview</DialogTitle>
                      <DialogDescription>
                        Schedule a new interview with this candidate
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="interviewType">Interview Type *</Label>
                        <Select value={newInterview.type} onValueChange={(value) => setNewInterview(prev => ({ ...prev, type: value }))}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INTERVIEW_TYPES.map((type) => (
                              <SelectItem key={type.key} value={type.key}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="interviewDate">Date & Time *</Label>
                          <Input
                            id="interviewDate"
                            type="datetime-local"
                            value={newInterview.scheduledDate}
                            onChange={(e) => setNewInterview(prev => ({ ...prev, scheduledDate: e.target.value }))}
                            min={new Date().toISOString().slice(0, 16)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="duration">Duration (min)</Label>
                          <Input
                            id="duration"
                            type="number"
                            value={newInterview.duration}
                            onChange={(e) => setNewInterview(prev => ({ ...prev, duration: parseInt(e.target.value) || 60 }))}
                            min="15"
                            max="240"
                          />
                        </div>
                      </div>
                      
                      {(newInterview.type === 'IN_PERSON' || newInterview.type === 'PANEL') && (
                        <div>
                          <Label htmlFor="location">Location</Label>
                          <Input
                            id="location"
                            value={newInterview.location}
                            onChange={(e) => setNewInterview(prev => ({ ...prev, location: e.target.value }))}
                            placeholder="Office address, room number, etc."
                          />
                        </div>
                      )}
                      
                      {(newInterview.type === 'VIDEO' || newInterview.type === 'PANEL') && (
                        <div>
                          <Label htmlFor="meetingLink">Meeting Link</Label>
                          <Input
                            id="meetingLink"
                            value={newInterview.meetingLink}
                            onChange={(e) => setNewInterview(prev => ({ ...prev, meetingLink: e.target.value }))}
                            placeholder="Zoom, Teams, Google Meet link"
                          />
                        </div>
                      )}
                      
                      <div>
                        <Label>Interviewers</Label>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {teamMembers.map((member) => (
                            <label key={member.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={newInterview.interviewerIds.includes(member.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewInterview(prev => ({ 
                                      ...prev, 
                                      interviewerIds: [...prev.interviewerIds, member.id] 
                                    }));
                                  } else {
                                    setNewInterview(prev => ({ 
                                      ...prev, 
                                      interviewerIds: prev.interviewerIds.filter(id => id !== member.id) 
                                    }));
                                  }
                                }}
                                className="rounded"
                              />
                              <span className="text-sm">{member.name} ({member.role})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowScheduleInterview(false)}
                          className="flex-1"
                          disabled={schedulingInterview}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={handleScheduleInterview}
                          disabled={schedulingInterview || !newInterview.scheduledDate || !newInterview.type}
                          className="flex-1 btn-primary"
                        >
                          {schedulingInterview ? 'Scheduling...' : 'Schedule'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {candidate.interviews?.length === 0 ? (
                  <div className="text-center py-8 text-secondary-500">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No interviews scheduled</p>
                    <p className="text-sm">Schedule an interview to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {candidate.interviews?.map((interview) => {
                      const InterviewIcon = getInterviewTypeIcon(interview.type);
                      return (
                        <div key={interview.id} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <InterviewIcon className="h-5 w-5 text-primary" />
                              <div>
                                <h4 className="font-medium text-secondary-950">
                                  {INTERVIEW_TYPES.find(t => t.key === interview.type)?.label || interview.type}
                                </h4>
                                <p className="text-sm text-secondary-600">
                                  Scheduled by {interview.scheduler.name}
                                </p>
                              </div>
                            </div>
                            <Badge className={getInterviewStatusColor(interview.status)}>
                              {interview.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium text-secondary-700">Date & Time:</span>
                              <p className="text-secondary-950">
                                {new Date(interview.scheduledDate).toLocaleString()}
                              </p>
                            </div>
                            
                            {interview.duration && (
                              <div>
                                <span className="font-medium text-secondary-700">Duration:</span>
                                <p className="text-secondary-950">{interview.duration} minutes</p>
                              </div>
                            )}
                            
                            {interview.location && (
                              <div>
                                <span className="font-medium text-secondary-700">Location:</span>
                                <p className="text-secondary-950">{interview.location}</p>
                              </div>
                            )}
                            
                            {interview.meetingLink && (
                              <div>
                                <span className="font-medium text-secondary-700">Meeting Link:</span>
                                <a 
                                  href={interview.meetingLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  Join Meeting
                                </a>
                              </div>
                            )}
                            
                            {interview.score && (
                              <div>
                                <span className="font-medium text-secondary-700">Score:</span>
                                <p className="text-secondary-950">{interview.score}/10</p>
                              </div>
                            )}
                            
                            {interview.recommendation && (
                              <div>
                                <span className="font-medium text-secondary-700">Recommendation:</span>
                                <p className="text-secondary-950 capitalize">{interview.recommendation.replace('_', ' ')}</p>
                              </div>
                            )}
                          </div>
                          
                          {interview.notes && (
                            <div className="mt-3 pt-3 border-t">
                              <span className="font-medium text-secondary-700">Notes:</span>
                              <p className="text-sm text-secondary-950 mt-1 whitespace-pre-wrap">{interview.notes}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="files" className="space-y-4">
            <Card className="roof-er-shadow">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Documents & Files
                </CardTitle>
                <Button className="btn-primary">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
              </CardHeader>
              <CardContent>
                {candidate.documents?.length === 0 ? (
                  <div className="text-center py-8 text-secondary-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No files uploaded</p>
                    <p className="text-sm">Upload resume, portfolio, or other documents</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {candidate.documents?.map((document) => (
                      <div key={document.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-secondary-50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <div>
                            <h4 className="font-medium text-secondary-950">{document.fileName}</h4>
                            <p className="text-sm text-secondary-600">
                              {document.type.replace('_', ' ')} • 
                              {document.fileSize && ` ${(document.fileSize / 1024 / 1024).toFixed(2)} MB • `}
                              Uploaded {new Date(document.uploadedAt).toLocaleDateString()}
                            </p>
                            {document.description && (
                              <p className="text-xs text-secondary-500 mt-1">{document.description}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {document.isVerified && (
                            <Badge variant="default" className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verified
                            </Badge>
                          )}
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
