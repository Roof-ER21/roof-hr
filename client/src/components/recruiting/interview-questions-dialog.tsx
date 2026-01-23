import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, Save, Loader2, Shield, ShoppingBag, ArrowLeft } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Insurance/Roofing Sales Interview Questions
const INSURANCE_QUESTIONS = [
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

// Retail Interview Questions
const RETAIL_QUESTIONS = [
  { id: '1', question: 'Tell me about yourself and your previous work experience.' },
  { id: '2', question: 'Why are you interested in working in retail?' },
  { id: '3', question: 'Describe a time you provided excellent customer service.' },
  { id: '4', question: 'How do you handle a difficult or upset customer?' },
  { id: '5', question: 'Are you comfortable working weekends and flexible hours?' },
  { id: '6', question: 'How do you stay organized when handling multiple tasks?' },
  { id: '7', question: 'Describe your experience with point-of-sale systems or cash handling.' },
  { id: '8', question: 'How would you handle a situation where a customer wants a refund outside policy?' },
  { id: '9', question: 'What do you know about our products and company?' },
  { id: '10', question: 'Where do you see yourself in 1-2 years and why should we hire you?' },
];

type InterviewType = 'insurance' | 'retail' | null;

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
  const [interviewType, setInterviewType] = useState<InterviewType>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Get the appropriate questions based on type
  const questions = interviewType === 'insurance' ? INSURANCE_QUESTIONS : RETAIL_QUESTIONS;
  const typeLabel = interviewType === 'insurance' ? 'Insurance/Sales' : 'Retail';

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
      setInterviewType(null);
      onOpenChange(false);
      toast({
        title: 'Interview Saved',
        description: `${typeLabel} interview responses have been saved to candidate notes.`,
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
    if (!candidate || !interviewType) return;

    const interviewerName = user ? `${user.firstName} ${user.lastName}` : 'Unknown Interviewer';
    const dateStr = format(new Date(), 'MMMM d, yyyy h:mm a');

    // Format the interview as a readable note with type indicator
    const typeIndicator = interviewType === 'insurance' ? 'INSURANCE' : 'RETAIL';
    const formattedInterview = [
      `=== STRUCTURED INTERVIEW (${typeIndicator}) ===`,
      `Date: ${dateStr}`,
      `Interviewer: ${interviewerName}`,
      `Type: ${typeLabel}`,
      '',
      ...questions.map((q) => {
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
    setInterviewType(null);
    onOpenChange(false);
  };

  const handleBack = () => {
    if (answeredCount > 0) {
      const confirmBack = window.confirm(
        'You have unsaved answers. Going back will clear them. Continue?'
      );
      if (!confirmBack) return;
    }
    setAnswers({});
    setInterviewType(null);
  };

  // Type selection screen
  if (!interviewType) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-600" />
              Select Interview Type
            </DialogTitle>
            <DialogDescription>
              {candidate
                ? `Starting interview for ${candidate.firstName} ${candidate.lastName}`
                : 'Loading candidate...'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center mb-6">
              Choose the interview type based on the position:
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-3 hover:bg-blue-50 hover:border-blue-300"
                onClick={() => setInterviewType('insurance')}
              >
                <Shield className="h-10 w-10 text-blue-600" />
                <div className="text-center">
                  <div className="font-semibold">Insurance / Sales</div>
                  <div className="text-xs text-muted-foreground">Field reps, sales roles</div>
                </div>
              </Button>

              <Button
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-3 hover:bg-green-50 hover:border-green-300"
                onClick={() => setInterviewType('retail')}
              >
                <ShoppingBag className="h-10 w-10 text-green-600" />
                <div className="text-center">
                  <div className="font-semibold">Retail</div>
                  <div className="text-xs text-muted-foreground">Store, showroom roles</div>
                </div>
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Questions screen
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {interviewType === 'insurance' ? (
              <Shield className="h-5 w-5 text-blue-600" />
            ) : (
              <ShoppingBag className="h-5 w-5 text-green-600" />
            )}
            {typeLabel} Interview Questions
          </DialogTitle>
          <DialogDescription>
            {candidate
              ? `Conducting ${typeLabel.toLowerCase()} interview for ${candidate.firstName} ${candidate.lastName} - ${candidate.position}`
              : 'Loading candidate...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between py-2 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 px-2">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Badge
              variant="outline"
              className={interviewType === 'insurance' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}
            >
              {typeLabel}
            </Badge>
            <Badge variant="outline" className="text-sm">
              {answeredCount} of {questions.length} answered
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            Answers will be saved to candidate notes
          </span>
        </div>

        <div className="flex-1 overflow-y-auto max-h-[55vh] pr-4">
          <div className="space-y-6 py-4">
            {questions.map((q, index) => (
              <div key={q.id} className="space-y-2">
                <Label className="text-sm font-semibold flex items-start gap-2">
                  <span className={`rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 ${
                    interviewType === 'insurance'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
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
            className={interviewType === 'insurance' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
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
