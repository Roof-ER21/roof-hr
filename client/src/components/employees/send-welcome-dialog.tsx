import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  position?: string;
  department?: string;
}

interface SendWelcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  preselectedIds?: string[];
}

export function SendWelcomeDialog({
  open,
  onOpenChange,
  employees,
  preselectedIds = []
}: SendWelcomeDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(preselectedIds));
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sendEmailsMutation = useMutation({
    mutationFn: async (employeeIds: string[]) => {
      const response = await fetch('/api/users/send-welcome-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ employeeIds, password: 'Susan2025' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send emails');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Welcome Emails Sent',
        description: `Successfully sent ${data.sent} emails. ${data.failed > 0 ? `${data.failed} failed.` : ''}`,
        variant: data.failed > 0 ? 'destructive' : 'default'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      onOpenChange(false);
      setSelectedIds(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const toggleAll = () => {
    if (selectedIds.size === employees.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(employees.map(e => e.id)));
    }
  };

  const toggleEmployee = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSend = () => {
    if (selectedIds.size === 0) {
      toast({
        title: 'No employees selected',
        description: 'Please select at least one employee to send welcome emails.',
        variant: 'destructive'
      });
      return;
    }
    sendEmailsMutation.mutate(Array.from(selectedIds));
  };

  const allSelected = selectedIds.size === employees.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < employees.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Welcome Emails
          </DialogTitle>
          <DialogDescription>
            Select employees to send welcome emails with their login credentials (password: Susan2025).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={allSelected}
                onCheckedChange={toggleAll}
                className={someSelected ? 'data-[state=checked]:bg-gray-400' : ''}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                {allSelected ? 'Deselect All' : 'Select All'} ({employees.length} employees)
              </label>
            </div>
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selected
            </span>
          </div>

          <ScrollArea className="h-[300px] rounded-md border p-4">
            <div className="space-y-2">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center space-x-3 p-2 rounded hover:bg-gray-50"
                >
                  <Checkbox
                    id={`emp-${employee.id}`}
                    checked={selectedIds.has(employee.id)}
                    onCheckedChange={() => toggleEmployee(employee.id)}
                  />
                  <label
                    htmlFor={`emp-${employee.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium">
                      {employee.firstName} {employee.lastName}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {employee.email}
                      {employee.position && ` - ${employee.position}`}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendEmailsMutation.isPending || selectedIds.size === 0}
          >
            {sendEmailsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send to {selectedIds.size} Employee{selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
