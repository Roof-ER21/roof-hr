import { useState } from 'react';
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
  Loader2, Trash2, MessageSquare
} from 'lucide-react';
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
  GENERAL: { label: 'General', color: 'bg-gray-100 text-gray-800' },
  INTERVIEW: { label: 'Interview', color: 'bg-blue-100 text-blue-800' },
  REFERENCE: { label: 'Reference', color: 'bg-green-100 text-green-800' },
  INTERNAL: { label: 'Internal', color: 'bg-orange-100 text-orange-800' },
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
  APPLIED: 'bg-blue-100 text-blue-800',
  SCREENING: 'bg-yellow-100 text-yellow-800',
  INTERVIEW: 'bg-purple-100 text-purple-800',
  OFFER: 'bg-indigo-100 text-indigo-800',
  HIRED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  DEAD_BY_US: 'bg-red-100 text-red-800',
  DEAD_BY_CANDIDATE: 'bg-orange-100 text-orange-800',
  NO_SHOW: 'bg-gray-100 text-gray-800',
};

function YesNoIndicator({ value, label }: { value: boolean | null | undefined; label: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {value === null || value === undefined ? (
        <Badge variant="outline" className="text-xs">Not answered</Badge>
      ) : value ? (
        <Badge className="bg-green-100 text-green-800 text-xs">
          <CheckCircle className="h-3 w-3 mr-1" /> Yes
        </Badge>
      ) : (
        <Badge className="bg-red-100 text-red-800 text-xs">
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
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 40) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  if (!candidate.matchScore && !candidate.predictedSuccessScore) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">No AI analysis yet. Run analysis to get insights.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border space-y-3">
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
          <div className="flex items-center gap-1 text-xs font-medium text-green-700">
            <TrendingUp className="h-3 w-3" /> Top Strengths
          </div>
          <div className="flex flex-wrap gap-1">
            {strengths.slice(0, 3).map((s: string, i: number) => (
              <Badge key={i} variant="outline" className="text-xs bg-green-50">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Top Risks */}
      {risks.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs font-medium text-red-700">
            <ShieldAlert className="h-3 w-3" /> Key Risks
          </div>
          <div className="flex flex-wrap gap-1">
            {risks.slice(0, 2).map((r: any, i: number) => (
              <Badge key={i} variant="outline" className="text-xs bg-red-50">
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
                          <div className="bg-blue-50 rounded-lg p-3 space-y-1">
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

                    {/* Resume Preview - Embedded PDF */}
                    {candidate.resumeUrl && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                          Resume
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(getResumeViewUrl(candidate.resumeUrl), '_blank')}
                          >
                            <ExternalLink className="h-3 w-3 mr-1" />
                            New Tab
                          </Button>
                        </h4>
                        <div className="border rounded-lg overflow-hidden bg-white">
                          <iframe
                            src={getResumeViewUrl(candidate.resumeUrl)}
                            className="w-full h-[300px]"
                            title="Resume Preview"
                          />
                        </div>
                      </div>
                    )}

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
    </>
  );
}
