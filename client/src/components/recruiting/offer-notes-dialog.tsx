import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, Calendar, User, Building2 } from 'lucide-react';
import type { DecisionType } from './decision-type-dialog';

interface OfferNotesDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (notes: string, expectedDecisionDate?: string) => Promise<void>;
  candidateName: string;
  newStatus: string;
  isSubmitting?: boolean;
  decisionType?: DecisionType;
}

export function OfferNotesDialog({
  open,
  onClose,
  onSubmit,
  candidateName,
  newStatus,
  isSubmitting = false,
  decisionType,
}: OfferNotesDialogProps) {
  const [notes, setNotes] = useState('');
  const [expectedDecisionDate, setExpectedDecisionDate] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!notes.trim()) {
      setError('Please provide an update on this candidate\'s status.');
      return;
    }

    setError('');
    await onSubmit(notes.trim(), expectedDecisionDate || undefined);
    setNotes('');
    setExpectedDecisionDate('');
  };

  const handleClose = () => {
    setNotes('');
    setExpectedDecisionDate('');
    setError('');
    onClose();
  };

  const isCandidateDeciding = decisionType === 'CANDIDATE_DECIDING';
  const isCompanyDeciding = decisionType === 'COMPANY_DECIDING';
  const statusDisplay = 'Decision Pending';

  const getPlaceholder = () => {
    if (isCandidateDeciding) {
      return "What offer details were presented? What is the candidate's timeline for deciding? Any concerns or questions they raised?";
    }
    if (isCompanyDeciding) {
      return "What internal approvals are needed? Who needs to review? What's the expected timeline for a decision?";
    }
    return "What's the current status of this offer? Why hasn't this candidate been hired yet? What's the next step?";
  };

  const getDateHelperText = () => {
    if (isCandidateDeciding) {
      return "When do you expect to hear back from the candidate?";
    }
    if (isCompanyDeciding) {
      return "When do you expect the internal decision to be made?";
    }
    return "When do you expect a decision?";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCandidateDeciding ? (
              <User className="h-5 w-5 text-blue-600" />
            ) : isCompanyDeciding ? (
              <Building2 className="h-5 w-5 text-purple-600" />
            ) : (
              <FileText className="h-5 w-5 text-indigo-600" />
            )}
            Moving to {statusDisplay}
            {decisionType && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isCandidateDeciding
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
              }`}>
                {isCandidateDeciding ? 'Candidate' : 'Company'}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Please provide an update on <span className="font-medium">{candidateName}</span>'s status.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-1">
              Status Update <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (error) setError('');
              }}
              placeholder={getPlaceholder()}
              className="min-h-[120px] resize-none"
            />
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedDate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Expected Decision Date (optional)
            </Label>
            <Input
              id="expectedDate"
              type="date"
              value={expectedDecisionDate}
              onChange={(e) => setExpectedDecisionDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">
              {getDateHelperText()}
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>Continue</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
