import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { Loader2, ArrowRight, AtSign } from 'lucide-react';

interface StageNotesDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => Promise<void>;
  candidateName: string;
  fromStatus: string;
  toStatus: string;
  isSubmitting?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  APPLIED: 'Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'Interview',
  OFFER: 'Offer',
  HIRED: 'Hired',
  DEAD: 'Dead',
  DEAD_BY_US: 'Dead (By Us)',
  DEAD_BY_CANDIDATE: 'Dead (By Candidate)',
  NO_SHOW: 'No Show',
};

export function StageNotesDialog({
  open,
  onClose,
  onSubmit,
  candidateName,
  fromStatus,
  toStatus,
  isSubmitting = false,
}: StageNotesDialogProps) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // @mention autocomplete state
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  // Fetch users for @mention
  const { data: users = [] } = useQuery<Array<{ id: string; firstName: string; lastName: string }>>({
    queryKey: ['/api/users'],
    enabled: open,
  });

  const handleSubmit = async () => {
    if (!notes.trim()) {
      setError('Please add a note before moving this candidate.');
      return;
    }
    setError('');
    await onSubmit(notes.trim());
    setNotes('');
  };

  const handleClose = () => {
    setNotes('');
    setError('');
    setShowMentionDropdown(false);
    onClose();
  };

  // @mention handlers
  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setNotes(value);
    if (error) setError('');

    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([a-zA-Z]*)$/);

    if (atMatch) {
      setMentionSearch(atMatch[1].toLowerCase());
      setMentionStartPos(cursorPos - atMatch[0].length);
      setShowMentionDropdown(true);
      setSelectedMentionIndex(0);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentionDropdown) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex((prev) => Math.min(prev + 1, filteredMentionUsers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredMentionUsers.length > 0) {
      e.preventDefault();
      insertMention(filteredMentionUsers[selectedMentionIndex]);
    } else if (e.key === 'Escape') {
      setShowMentionDropdown(false);
    }
  };

  const insertMention = (mentionUser: { id: string; firstName: string; lastName: string }) => {
    const mentionText = `@${mentionUser.firstName} ${mentionUser.lastName}`;
    const beforeMention = notes.slice(0, mentionStartPos);
    const afterMention = notes.slice(noteTextareaRef.current?.selectionStart || mentionStartPos);
    const newValue = beforeMention + mentionText + ' ' + afterMention;
    setNotes(newValue);
    setShowMentionDropdown(false);

    setTimeout(() => {
      if (noteTextareaRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length + 1;
        noteTextareaRef.current.focus();
        noteTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const filteredMentionUsers = users.filter((u) =>
    `${u.firstName} ${u.lastName}`.toLowerCase().includes(mentionSearch) ||
    u.firstName.toLowerCase().startsWith(mentionSearch) ||
    u.lastName.toLowerCase().startsWith(mentionSearch)
  ).slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-blue-600" />
            Moving to {STATUS_LABELS[toStatus] || toStatus}
          </DialogTitle>
          <DialogDescription>
            Add a note for <span className="font-medium">{candidateName}</span> before moving from {STATUS_LABELS[fromStatus] || fromStatus} to {STATUS_LABELS[toStatus] || toStatus}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="stage-notes" className="flex items-center gap-1">
              Note <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Textarea
                id="stage-notes"
                ref={noteTextareaRef}
                value={notes}
                onChange={handleNoteChange}
                onKeyDown={handleNoteKeyDown}
                placeholder="Why is this candidate being moved? Type @ to tag someone..."
                className="min-h-[120px] resize-none"
              />
              {showMentionDropdown && filteredMentionUsers.length > 0 && (
                <div className="absolute z-50 bottom-full mb-1 left-0 w-full bg-background border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                  <div className="p-1">
                    <div className="px-2 py-1 text-xs text-muted-foreground border-b mb-1">
                      <AtSign className="h-3 w-3 inline mr-1" />
                      Mention someone
                    </div>
                    {filteredMentionUsers.map((mentionUser, index) => (
                      <button
                        key={mentionUser.id}
                        type="button"
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted cursor-pointer ${
                          index === selectedMentionIndex ? 'bg-muted' : ''
                        }`}
                        onClick={() => insertMention(mentionUser)}
                        onMouseEnter={() => setSelectedMentionIndex(index)}
                      >
                        <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
                          {mentionUser.firstName[0]}{mentionUser.lastName[0]}
                        </div>
                        <span>{mentionUser.firstName} {mentionUser.lastName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
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
                Moving...
              </>
            ) : (
              <>Move Candidate</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
