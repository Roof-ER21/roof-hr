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
import { Loader2, FileText, Calendar } from 'lucide-react';

interface OfferNotesDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (notes: string, expectedDecisionDate?: string) => Promise<void>;
  candidateName: string;
  newStatus: string;
  isSubmitting?: boolean;
}

export function OfferNotesDialog({
  open,
  onClose,
  onSubmit,
  candidateName,
  newStatus,
  isSubmitting = false,
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

  const statusDisplay = newStatus === 'OFFER_SENT' ? 'Offer Sent' : 'Offer Pending';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Moving to {statusDisplay}
          </DialogTitle>
          <DialogDescription>
            Please provide an update on <span className="font-medium">{candidateName}</span>'s offer status.
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
              placeholder="What's the current status of this offer? Why hasn't this candidate been hired yet? What's the next step?"
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
              When do you expect to hear back from the candidate?
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
