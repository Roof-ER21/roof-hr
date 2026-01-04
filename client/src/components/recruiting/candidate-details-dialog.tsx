import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  User, Mail, Phone, Calendar, Users, ChevronRight, Pencil,
  Brain, FileText, CheckCircle, XCircle, Clock, AlertCircle,
  ClipboardList, Sparkles, TrendingUp, ShieldAlert, ExternalLink,
  Loader2, Trash2, MessageSquare, FileQuestion, Video, MapPin, UserX
} from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { InterviewQuestionsDialog } from './interview-questions-dialog';

interface CandidateNote {
  id: string;
  candidateId: string;
  authorId: string;
  content: string;
  type: 'GENERAL' | 'INTERVIEW' | 'REFERENCE' | 'INTERNAL';
  createdAt: string;
}

interface CandidateDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: any | null;
  availableEmployees: Array<{ id: string; firstName: string; lastName: string }>;
  onEditCandidate: (candidate: any) => void;
  onMoveToNextStage: (candidate: any, nextStatus: string) => void;
  onScheduleInterview: (candidate: any) => void;
  onSendEmail: (candidate: any) => void;
  onRunAIAnalysis: (candidateId: string) => void;
  getNextStatus: (currentStatus: string) => string | null;
  isAnalyzing?: boolean;
  isUpdating?: boolean;
}

const noteTypeConfig = {
  GENERAL: { label: 'General', color: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' },
  INTERVIEW: { label: 'Interview', color: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' },
  REFERENCE: { label: 'Reference', color: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' },
  INTERNAL: { label: 'Internal', color: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200' },
};

// Helper to convert Google Drive URLs to proxy URLs for seamless viewing
const getResumeViewUrl = (resumeUrl: string): string => {
  if (!resumeUrl) return '';

  // Check if it's a Google Drive URL
  const driveMatch = resumeUrl.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
  if (driveMatch) {
    const fileId = driveMatch[1];
    // Use our proxy endpoint
    return `/api/resumes/view/${fileId}`;
  }

  // For non-Google Drive URLs, return as-is
  return resumeUrl;
};

const statusColors: Record<string, string> = {
  APPLIED: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
  SCREENING: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
  INTERVIEW: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
  OFFER: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200',
  HIRED: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
  REJECTED: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  DEAD_BY_US: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
  DEAD_BY_CANDIDATE: 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200',
  NO_SHOW: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200',
};

// Helper to parse interview Q&A from notes content
const parseInterviewQA = (content: string): Array<{ question: string; answer: string }> => {
  const lines = content.split('\n');
  const qa: Array<{ question: string; answer: string }> = [];
  let currentQ = '';
  let currentA = '';

  for (const line of lines) {
    if (line.match(/^Q\d+:/)) {
      if (currentQ && currentA) {
        qa.push({ question: currentQ, answer: currentA.trim() });
      }
      currentQ = line.replace(/^Q\d+:\s*/, '');
      currentA = '';
    } else if (line.startsWith('A:')) {
      currentA = line.replace(/^A:\s*/, '');
    } else if (currentA && line.trim()) {
      currentA += ' ' + line.trim();
    }
  }
  if (currentQ && currentA) {
    qa.push({ question: currentQ, answer: currentA.trim() });
  }
  return qa;
};

function YesNoIndicator({ value, label }: { value: boolean | null | undefined; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {value === null || value === undefined ? (
        <Badge variant="outline" className="text-xs">Not answered</Badge>
      ) : value ? (
        <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" /> Yes
        </Badge>
      ) : (
        <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 text-xs">
          <XCircle className="h-3 w-3 mr-1" /> No
        </Badge>
      )}
    </div>
  );
}

function AIInsightsSummary({ candidate }: { candidate: any }) {
  // Parse AI insights
  let aiInsights = null;
  let fullAnalysis = null;
  if (candidate.aiInsights) {
    try {
      aiInsights = JSON.parse(candidate.aiInsights);
      fullAnalysis = aiInsights.analysis || null;
    } catch (e) {
      console.error('Failed to parse AI insights:', e);
    }
  }

  const risks = candidate.riskFactors ? JSON.parse(candidate.riskFactors) : [];
  const strengths = fullAnalysis?.strengths || [];

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700';
    if (score >= 60) return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700';
    if (score >= 40) return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-700';
    return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700';
  };

  if (!candidate.matchScore && !candidate.predictedSuccessScore) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">No AI analysis yet. Run analysis to get insights.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-4 rounded-lg border space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <span className="font-semibold">AI Analysis</span>
      </div>

      {/* Score Badges */}
      <div className="flex flex-wrap gap-2">
        {candidate.matchScore && (
          <Badge className={`${getScoreColor(candidate.matchScore)} border`}>
            Match: {candidate.matchScore}%
          </Badge>
        )}
        {candidate.cultureFitScore && (
          <Badge className={`${getScoreColor(candidate.cultureFitScore)} border`}>
            Culture: {Math.round(candidate.cultureFitScore)}%
          </Badge>
        )}
        {candidate.technicalFitScore && (
          <Badge className={`${getScoreColor(candidate.technicalFitScore)} border`}>
            Technical: {Math.round(candidate.technicalFitScore)}%
          </Badge>
        )}
        {candidate.predictedTenure && (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            {candidate.predictedTenure} mo tenure
          </Badge>
        )}
      </div>

      {/* Top Strengths */}
      {strengths.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
            <TrendingUp className="h-3 w-3" /> Top Strengths
          </div>
          <div className="flex flex-wrap gap-1">
            {strengths.slice(0, 3).map((s: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs bg-green-50 dark:bg-green-950">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Top Risks */}
      {risks.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400">
            <ShieldAlert className="h-3 w-3" /> Key Risks
          </div>
          <div className="flex flex-wrap gap-1">
            {risks.slice(0, 2).map((r: any, i: number) => (
              <Badge key={i} variant="outline" className="text-xs bg-red-50 dark:bg-red-950">
                {typeof r === 'string' ? r : r.risk || r.factor}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CandidateDetailsDialog({
  isOpen,
  onOpenChange,
  candidate,
  availableEmployees,
  onEditCandidate,
  onMoveToNextStage,
  onScheduleInterview,
  onSendEmail,
  onRunAIAnalysis,
  getNextStatus,
  isAnalyzing,
  isUpdating,
}: CandidateDetailsDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState<'GENERAL' | 'INTERVIEW' | 'REFERENCE' | 'INTERNAL'>('GENERAL');

  // Resume blob URL state for authenticated loading
  const [resumeBlobUrl, setResumeBlobUrl] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // Interview status update state
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [statusDialogType, setStatusDialogType] = useState<'COMPLETED' | 'CANCELLED' | null>(null);
  const [statusDialogInterview, setStatusDialogInterview] = useState<any>(null);
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [notesError, setNotesError] = useState('');

  // Fetch resume with authentication to bypass iframe auth issues
  useEffect(() => {
    if (!candidate?.resumeUrl || !isOpen) {
      setResumeBlobUrl(null);
      return;
    }

    const fetchResume = async () => {
      setResumeLoading(true);
      setResumeError(null);

      // Extract fileId from Google Drive URL
      const driveMatch = candidate.resumeUrl.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
      if (!driveMatch) {
        // Non-Google Drive URL - use directly
        setResumeBlobUrl(candidate.resumeUrl);
        setResumeLoading(false);
        return;
      }

      const fileId = driveMatch[1];
      const token = localStorage.getItem('sessionToken');

      try {
        const response = await fetch(`/api/resumes/view/${fileId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          throw new Error('Failed to load resume');
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setResumeBlobUrl(url);
      } catch (err) {
        console.error('Resume fetch error:', err);
        setResumeError('Unable to load resume');
      } finally {
        setResumeLoading(false);
      }
    };

    fetchResume();

    // Cleanup blob URL on unmount or when candidate changes
    return () => {
      if (resumeBlobUrl && resumeBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(resumeBlobUrl);
      }
    };
  }, [candidate?.resumeUrl, candidate?.id, isOpen]);

  // Fetch notes
  const { data: notes = [], isLoading: notesLoading } = useQuery<CandidateNote[]>({
    queryKey: [`/api/candidates/${candidate?.id}/notes`],
    enabled: !!candidate?.id && isOpen,
  });

  // Fetch users for author names
  const { data: users = [] } = useQuery<Array<{ id: string; firstName: string; lastName: string }>>({
    queryKey: ['/api/users'],
    enabled: isOpen,
  });

  // Fetch interviews for the candidate
  const { data: interviews = [] } = useQuery<Array<{
    id: string;
    candidateId: string;
    scheduledDate: string;
    status: string;
    type: string;
    duration: number;
    location?: string;
    meetingLink?: string;
    notes?: string;
  }>>({
    queryKey: [`/api/interviews/candidate/${candidate?.id}`],
    enabled: !!candidate?.id && isOpen,
  });

  // Create note mutation
  const createNoteMutation = useMutation({
    mutationFn: (data: { content: string; type: string }) =>
      apiRequest(`/api/candidates/${candidate?.id}/notes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidate?.id}/notes`] });
      setNewNote('');
      toast({ title: 'Note added', description: 'The note has been added successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add note.', variant: 'destructive' });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) =>
      apiRequest(`/api/candidates/notes/${noteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidate?.id}/notes`] });
      toast({ title: 'Note deleted', description: 'The note has been deleted.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete note.', variant: 'destructive' });
    },
  });

  // Update interview status mutation
  const updateInterviewStatusMutation = useMutation({
    mutationFn: async ({ interviewId, status, outcomeNotes: notes }: { interviewId: string; status: string; outcomeNotes?: string }) => {
      return await apiRequest(`/api/interviews/${interviewId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, outcomeNotes: notes }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/interviews/candidate/${candidate?.id}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/interviews'] });
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidate?.id}/notes`] });

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

  // Get interview type icon
  const getInterviewTypeIcon = (type: string) => {
    switch (type) {
      case 'PHONE': return <Phone className="h-4 w-4" />;
      case 'VIDEO': return <Video className="h-4 w-4" />;
      case 'IN_PERSON': return <MapPin className="h-4 w-4" />;
      case 'PANEL': return <Users className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const handleAddNote = () => {
    if (newNote.trim()) {
      createNoteMutation.mutate({ content: newNote.trim(), type: noteType });
    }
  };

  // Map authors to notes
  const notesWithAuthors = notes.map((note) => {
    const author = users.find((u) => u.id === note.authorId);
    return { ...note, author };
  });

  // Parse interview screening data
  let screeningData: any = null;
  if (candidate?.interviewScreeningData) {
    try {
      screeningData = JSON.parse(candidate.interviewScreeningData);
    } catch (e) {
      console.error('Failed to parse screening data:', e);
    }
  }

  const assignedEmployee = availableEmployees.find((e) => e.id === candidate?.assignedTo);

  if (!candidate) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden p-0">
          <div className="flex flex-col h-full max-h-[90vh]">
            {/* Header */}
            <DialogHeader className="px-6 py-4 border-b bg-muted/30">
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle className="text-xl">
                    {candidate.firstName} {candidate.lastName}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-2 mt-1">
                    <span>{candidate.position}</span>
                    <Badge className={statusColors[candidate.status] || 'bg-gray-100'}>
                      {candidate.status}
                    </Badge>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Main Content - Side by Side */}
            <div className="flex flex-1 overflow-hidden">
              {/* LEFT PANEL - Candidate Info */}
              <div className="w-[400px] flex-shrink-0 border-r overflow-y-auto">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4">
                    {/* Contact Info */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Contact
                      </h4>
                      <div className="space-y-2">
                        <a
                          href={`mailto:${candidate.email}`}
                          className="flex items-center gap-2 text-sm hover:text-blue-600 transition-colors"
                        >
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {candidate.email}
                        </a>
                        <a
                          href={`tel:${candidate.phone}`}
                          className="flex items-center gap-2 text-sm hover:text-blue-600 transition-colors"
                        >
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          {candidate.phone || 'No phone'}
                        </a>
                      </div>
                    </div>

                    <Separator />

                    {/* Key Info */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Key Info
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> Applied
                          </span>
                          <span>{format(new Date(candidate.appliedDate), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Updated
                          </span>
                          <span>{format(new Date(candidate.updatedAt), 'MMM d, yyyy')}</span>
                        </div>
                        {assignedEmployee && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" /> Assigned To
                            </span>
                            <Badge variant="outline">
                              {assignedEmployee.firstName} {assignedEmployee.lastName}
                            </Badge>
                          </div>
                        )}
                        {candidate.referralName && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" /> Referred By
                            </span>
                            <span className="font-medium">{candidate.referralName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Interview Screening (if completed) */}
                    {screeningData && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Interview Screening
                          </h4>
                          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 space-y-1">
                            <YesNoIndicator value={screeningData.hasDriversLicense} label="License Verified" />
                            <YesNoIndicator value={screeningData.hasReliableVehicle} label="Vehicle Verified" />
                            <YesNoIndicator value={screeningData.hasClearCommunication} label="Clear Communication" />
                            {candidate.interviewScreeningDate && (
                              <div className="pt-2 border-t mt-2 text-xs text-muted-foreground">
                                Screened: {format(new Date(candidate.interviewScreeningDate), 'MMM d, yyyy')}
                              </div>
                            )}
                            {candidate.interviewScreeningNotes && (
                              <div className="pt-2">
                                <span className="text-xs text-muted-foreground">Notes:</span>
                                <p className="text-sm">{candidate.interviewScreeningNotes}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Custom Tags */}
                    {candidate.customTags && candidate.customTags.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            Tags
                          </h4>
                          <div className="flex flex-wrap gap-1">
                            {candidate.customTags.map((tag: string, i: number) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </ScrollArea>
              </div>

              {/* RIGHT PANEL - AI Insights, Resume, Notes */}
              <div className="flex-1 overflow-y-auto">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4">
                    {/* AI Insights Summary */}
                    <AIInsightsSummary candidate={candidate} />

                    {/* Interviews Section */}
                    {interviews.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Interviews ({interviews.length})
                          </h4>
                          <div className="space-y-2">
                            {interviews.map((interview: any) => (
                              <div
                                key={interview.id}
                                className="p-3 bg-background border rounded-lg space-y-2"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center gap-2">
                                    {getInterviewTypeIcon(interview.type)}
                                    <span className="text-sm font-medium">{interview.type} Interview</span>
                                  </div>
                                  <Badge
                                    variant={
                                      interview.status === 'COMPLETED' ? 'default' :
                                      interview.status === 'SCHEDULED' ? 'secondary' :
                                      interview.status === 'CANCELLED' ? 'destructive' :
                                      interview.status === 'NO_SHOW' ? 'destructive' :
                                      'outline'
                                    }
                                  >
                                    {interview.status === 'NO_SHOW' ? 'NO SHOW' : interview.status}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {format(new Date(interview.scheduledDate), 'PPP p')} ET • {interview.duration} min
                                </div>
                                {interview.location && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" /> {interview.location}
                                  </div>
                                )}
                                {interview.meetingLink && (
                                  <a
                                    href={interview.meetingLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3" /> Join Meeting
                                  </a>
                                )}

                                {/* Action buttons for SCHEDULED interviews */}
                                {interview.status === 'SCHEDULED' && (
                                  <div className="flex flex-wrap gap-2 pt-2 border-t">
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
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Resume Preview - Embedded PDF */}
                    {candidate.resumeUrl && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                          Resume
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (resumeBlobUrl) {
                                window.open(resumeBlobUrl, '_blank');
                              } else {
                                window.open(getResumeViewUrl(candidate.resumeUrl), '_blank');
                              }
                            }}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            New Tab
                          </Button>
                        </h4>
                        <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                          {resumeLoading ? (
                            <div className="w-full h-[300px] flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                              <span className="ml-2 text-muted-foreground">Loading resume...</span>
                            </div>
                          ) : resumeError ? (
                            <div className="w-full h-[300px] flex flex-col items-center justify-center text-muted-foreground">
                              <AlertCircle className="h-8 w-8 mb-2" />
                              <span>{resumeError}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => window.open(candidate.resumeUrl, '_blank')}
                              >
                                Open Original Link
                              </Button>
                            </div>
                          ) : resumeBlobUrl ? (
                            <iframe
                              src={resumeBlobUrl}
                              className="w-full h-[300px]"
                              title="Resume Preview"
                            />
                          ) : (
                            <div className="w-full h-[300px] flex items-center justify-center text-muted-foreground">
                              <FileText className="h-8 w-8 mr-2" />
                              <span>No preview available</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Interview Responses (parsed from INTERVIEW type notes) */}
                    {(() => {
                      const interviewNotes = notes.filter((n) => n.type === 'INTERVIEW');
                      if (interviewNotes.length === 0) return null;

                      return (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                              <FileQuestion className="h-4 w-4" />
                              Interview Responses
                            </h4>
                            <div className="space-y-4 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                              {interviewNotes.map((note, noteIdx) => {
                                const qa = parseInterviewQA(note.content);
                                const author = users.find((u) => u.id === note.authorId);
                                if (qa.length === 0) return null;
                                return (
                                  <div key={note.id} className="space-y-2">
                                    {noteIdx > 0 && <Separator className="my-2" />}
                                    <div className="text-xs text-muted-foreground mb-2">
                                      {author ? `${author.firstName} ${author.lastName}` : 'Unknown'} - {format(new Date(note.createdAt), 'MMM d, h:mm a')}
                                    </div>
                                    {qa.map((item, i) => (
                                      <div key={i} className="border-l-2 border-blue-500 dark:border-blue-400 pl-3 py-1">
                                        <p className="text-sm font-medium">{item.question}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{item.answer}</p>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    <Separator />

                    {/* Notes Section */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Notes ({notes.length})
                      </h4>

                      {/* Add Note Form */}
                      <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                        <div className="flex gap-2">
                          <Select
                            value={noteType}
                            onValueChange={(v: any) => setNoteType(v)}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GENERAL">General</SelectItem>
                              <SelectItem value="INTERVIEW">Interview</SelectItem>
                              <SelectItem value="REFERENCE">Reference</SelectItem>
                              <SelectItem value="INTERNAL">Internal</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={handleAddNote}
                            disabled={!newNote.trim() || createNoteMutation.isPending}
                          >
                            {createNoteMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Add'
                            )}
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Add a note..."
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          className="min-h-[60px] resize-none"
                        />
                      </div>

                      {/* Notes List */}
                      {notesLoading ? (
                        <div className="text-center py-4 text-muted-foreground">
                          Loading notes...
                        </div>
                      ) : notesWithAuthors.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">
                          No notes yet
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {notesWithAuthors.map((note) => (
                            <div
                              key={note.id}
                              className="p-3 bg-background border rounded-lg space-y-2"
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className={noteTypeConfig[note.type].color}>
                                    {noteTypeConfig[note.type].label}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {note.author
                                      ? `${note.author.firstName} ${note.author.lastName}`
                                      : 'Unknown'}{' '}
                                    - {format(new Date(note.createdAt), 'MMM d, h:mm a')}
                                  </span>
                                </div>
                                {user?.role !== 'EMPLOYEE' && user?.id === note.authorId && (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => deleteNoteMutation.mutate(note.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 py-4 border-t bg-muted/30 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => onEditCandidate(candidate)}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextStatus = getNextStatus(candidate.status);
                  if (nextStatus) {
                    onMoveToNextStage(candidate, nextStatus);
                  }
                }}
                disabled={!getNextStatus(candidate.status) || isUpdating}
              >
                <ChevronRight className="h-4 w-4 mr-1" />
                Move to {getNextStatus(candidate.status) || 'Final'}
              </Button>

              <Button variant="outline" size="sm" onClick={() => onScheduleInterview(candidate)}>
                <Calendar className="h-4 w-4 mr-1" />
                Schedule
              </Button>

              <Button variant="outline" size="sm" onClick={() => onSendEmail(candidate)}>
                <Mail className="h-4 w-4 mr-1" />
                Email
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => setShowInterviewDialog(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <ClipboardList className="h-4 w-4 mr-1" />
                Start Interview
              </Button>

              {!candidate.matchScore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRunAIAnalysis(candidate.id)}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4 mr-1" />
                  )}
                  AI Analysis
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interview Questions Dialog */}
      <InterviewQuestionsDialog
        isOpen={showInterviewDialog}
        onOpenChange={setShowInterviewDialog}
        candidate={
          candidate
            ? {
                id: candidate.id,
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                position: candidate.position,
              }
            : null
        }
      />

      {/* Interview Status Update Dialog (for Complete/Cancel with required notes) */}
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
              <Label htmlFor="outcome-notes-dialog" className="flex items-center gap-1">
                Notes <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="outcome-notes-dialog"
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
    </>
  );
}
