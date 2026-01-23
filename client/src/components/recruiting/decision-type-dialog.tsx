import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { User, Building2 } from 'lucide-react';

export type DecisionType = 'CANDIDATE_DECIDING' | 'COMPANY_DECIDING';

interface DecisionTypeDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (decisionType: DecisionType) => void;
  candidateName: string;
}

export function DecisionTypeDialog({
  open,
  onClose,
  onSelect,
  candidateName,
}: DecisionTypeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Decision Pending Status</DialogTitle>
          <DialogDescription>
            Who is making the decision for <span className="font-medium">{candidateName}</span>?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <Button
            variant="outline"
            className="h-auto p-4 flex flex-col items-center gap-2 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-900/20 dark:hover:border-blue-600"
            onClick={() => onSelect('CANDIDATE_DECIDING')}
          >
            <User className="h-8 w-8 text-blue-600" />
            <span className="font-medium">Candidate Deciding</span>
            <span className="text-xs text-muted-foreground text-center">
              Waiting for candidate to respond to our offer
            </span>
          </Button>

          <Button
            variant="outline"
            className="h-auto p-4 flex flex-col items-center gap-2 hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-900/20 dark:hover:border-purple-600"
            onClick={() => onSelect('COMPANY_DECIDING')}
          >
            <Building2 className="h-8 w-8 text-purple-600" />
            <span className="font-medium">Company Deciding</span>
            <span className="text-xs text-muted-foreground text-center">
              Internal review or approval pending
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
