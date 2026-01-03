import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Save, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const INTERVIEW_QUESTIONS = [
  { id: '1', question: 'Tell me about yourself and your background.' },
  { id: '2', question: 'Why are you interested in roofing sales specifically?' },
  { id: '3', question: 'Do you have any sales experience? Describe your most successful sale.' },
  { id: '4', question: 'How do you handle rejection or a homeowner saying no?' },
  { id: '5', question: 'Describe your ideal work day in this role.' },
  { id: '6', question: 'Where do you see yourself in 1-2 years?' },
  { id: '7', question: 'Are you comfortable with commission-based compensation?' },
  { id: '8', question: 'Can you work outdoors in various weather conditions?' },
  { id: '9', question: 'What questions do you have about the role or company?' },
  { id: '10', question: 'Why should we hire you over other candidates?' },
];

interface InterviewQuestionsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
  } | null;
}

export function InterviewQuestionsDialog({
  isOpen,
  onOpenChange,
  candidate,
}: InterviewQuestionsDialogProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Create note mutation
  const saveInterviewMutation = useMutation({
    mutationFn: (data: { content: string; type: string }) =>
      apiRequest(`/api/candidates/${candidate?.id}/notes`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/candidates/${candidate?.id}/notes`] });
      setAnswers({});
      onOpenChange(false);
      toast({
        title: 'Interview Saved',
        description: 'Interview responses have been saved to candidate notes.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save interview responses.',
        variant: 'destructive',
      });
    },
  });

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSaveInterview = () => {
    if (!candidate) return;

    const interviewerName = user ? `${user.firstName} ${user.lastName}` : 'Unknown Interviewer';
    const dateStr = format(new Date(), 'MMMM d, yyyy h:mm a');

    // Format the interview as a readable note
    const formattedInterview = [
      '=== STRUCTURED INTERVIEW ===',
      `Date: ${dateStr}`,
      `Interviewer: ${interviewerName}`,
      '',
      ...INTERVIEW_QUESTIONS.map((q) => {
        const answer = answers[q.id]?.trim() || '(No response recorded)';
        return `Q${q.id}: ${q.question}\nA: ${answer}\n`;
      }),
      '=== END OF INTERVIEW ===',
    ].join('\n');

    saveInterviewMutation.mutate({
      content: formattedInterview,
      type: 'INTERVIEW',
    });
  };

  const answeredCount = Object.values(answers).filter((a) => a?.trim()).length;

  const handleClose = () => {
    if (answeredCount > 0) {
      const confirmClose = window.confirm(
        'You have unsaved interview answers. Are you sure you want to close?'
      );
      if (!confirmClose) return;
    }
    setAnswers({});
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-600" />
            Interview Questions
          </DialogTitle>
          <DialogDescription>
            {candidate
              ? `Conducting interview for ${candidate.firstName} ${candidate.lastName} - ${candidate.position}`
              : 'Loading candidate...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-b">
          <Badge variant="outline" className="text-sm">
            {answeredCount} of {INTERVIEW_QUESTIONS.length} questions answered
          </Badge>
          <span className="text-xs text-muted-foreground">
            Answers will be saved to candidate notes
          </span>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[55vh] pr-4">
          <div className="space-y-6 py-4">
            {INTERVIEW_QUESTIONS.map((q, index) => (
              <div key={q.id} className="space-y-2">
                <Label className="text-sm font-semibold flex items-start gap-2">
                  <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">
                    {index + 1}
                  </span>
                  <span>{q.question}</span>
                </Label>
                <Textarea
                  placeholder="Type the candidate's response..."
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveInterview}
            disabled={saveInterviewMutation.isPending || answeredCount === 0}
          >
            {saveInterviewMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Interview ({answeredCount} answers)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
