import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2, Users } from 'lucide-react';

const OFFICE_LOCATIONS = {
  DMV: { label: 'DMV (Vienna, VA)', address: '8100 Boone Blvd, Vienna, VA 22182, Suite 400', meetPerson: 'Reese Samala' },
  PA: { label: 'PHI (Chesterbrook, PA)', address: '851 Duportail Rd, Chesterbrook, PA 19087', meetPerson: 'the team' },
  RICHMOND: { label: 'Richmond (Glen Allen, VA)', address: '2400 Old Brick Rd, Suite 105, Glen Allen, VA 23060', meetPerson: 'the team' },
} as const;

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
  const [welcomeEmailType, setWelcomeEmailType] = useState<'insurance' | 'retail' | 'none'>('insurance');
  const [officeLocation, setOfficeLocation] = useState<keyof typeof OFFICE_LOCATIONS>('DMV');
  const [ccSalesManagers, setCcSalesManagers] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch sales managers for CC options
  const { data: allUsers } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const salesManagers = (allUsers || []).filter((u: any) =>
    u.role === 'TERRITORY_MANAGER' || u.role === 'TERRITORY_SALES_MANAGER' || u.role === 'GENERAL_MANAGER'
  );

  const toggleCcManager = (email: string) => {
    setCcSalesManagers(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const sendEmailsMutation = useMutation({
    mutationFn: async (payload: {
      employeeIds: string[];
      welcomeEmailType: 'insurance' | 'retail' | 'none';
      officeLocation: string;
      ccRecipients: string[];
    }) => {
      const response = await fetch('/api/users/send-welcome-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ...payload, password: 'TRD2026!' })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send emails');
      }

      return response.json();
    },
    onSuccess: (data) => {
      const skippedMessage = data.skipped > 0 ? ` ${data.skipped} skipped.` : '';
      toast({
        title: 'Welcome Emails Sent',
        description: `Successfully sent ${data.sent} emails.${skippedMessage} ${data.failed > 0 ? `${data.failed} failed.` : ''}`.trim(),
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
    sendEmailsMutation.mutate({
      employeeIds: Array.from(selectedIds),
      welcomeEmailType,
      officeLocation,
      ccRecipients: ccSalesManagers,
    });
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
            Select employees to send welcome emails with their login credentials (password: TRD2026!).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Welcome Email Type</label>
              <Select value={welcomeEmailType} onValueChange={(value) => setWelcomeEmailType(value as 'insurance' | 'retail' | 'none')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select email type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="insurance">Insurance (Original)</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="none">None (Do Not Send)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Office Location</label>
              <Select value={officeLocation} onValueChange={(value) => setOfficeLocation(value as keyof typeof OFFICE_LOCATIONS)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select office" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(OFFICE_LOCATIONS).map(([key, loc]) => (
                    <SelectItem key={key} value={key}>{loc.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {salesManagers.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Users className="h-4 w-4" />
                CC Sales Managers
              </label>
              <div className="flex flex-wrap gap-3">
                {salesManagers.map((mgr: any) => (
                  <div key={mgr.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cc-${mgr.id}`}
                      checked={ccSalesManagers.includes(mgr.email)}
                      onCheckedChange={() => toggleCcManager(mgr.email)}
                    />
                    <label htmlFor={`cc-${mgr.id}`} className="text-sm cursor-pointer">
                      {mgr.firstName} {mgr.lastName}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

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
