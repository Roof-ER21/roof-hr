/**
 * Offices — the list HR maintains themselves.
 *
 * Each office feeds three places: the welcome email ({{officeAddress}} and
 * {{meetPerson}}), the office picker when hiring or re-sending a welcome
 * email, and the location radios when scheduling an in-person interview.
 * Adding Pittsburgh here (Ryan, 9/2026) is what used to be a developer request.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from '@/hooks/use-toast';
import { MapPin, Plus, Pencil, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useAllOffices, type Office } from '@/hooks/useOffices';

export default function OfficesCard() {
  const queryClient = useQueryClient();
  const { data: offices = [], isLoading } = useAllOffices();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Office | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Office | null>(null);

  // Every picker in the app reads /api/offices, so a change here must refresh them too.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/offices'] });

  const toggleEnabled = useMutation({
    mutationFn: (row: Office) =>
      apiRequest(`/api/offices/${row.id}`, 'PATCH', { enabled: !row.enabled }),
    onSuccess: (_d, row) => {
      invalidate();
      toast({
        title: row.enabled ? 'Office hidden' : 'Office shown',
        description: row.enabled
          ? `${row.label} no longer appears when hiring or scheduling.`
          : `${row.label} is back in the pickers.`,
      });
    },
    onError: (err: Error) => toast({ title: 'Could not update', description: err.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: (row: Office) => apiRequest(`/api/offices/${row.id}`, 'DELETE'),
    onSuccess: (_d, row) => {
      invalidate();
      setConfirmRemove(null);
      toast({ title: 'Office removed', description: `${row.label} is gone from every picker. Past hires and interviews keep their address.` });
    },
    onError: (err: Error) => toast({ title: 'Could not remove', description: err.message, variant: 'destructive' }),
  });

  const active = offices.filter((o) => o.enabled).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Offices
          </CardTitle>
          <CardDescription>
            Where new hires report and where interviews happen. The address fills in
            "We are located at…" in the welcome email and the interview location; "Who they
            meet" fills in "you'll meet with…". {active} office{active === 1 ? '' : 's'} showing.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add office
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : offices.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No offices yet. Add the first one.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Office</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Who they meet</TableHead>
                <TableHead className="w-24">Showing</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offices.map((row) => (
                <TableRow key={row.id} className={row.enabled ? undefined : 'opacity-60'}>
                  <TableCell>
                    <div className="font-medium">{row.label}</div>
                    <div className="text-xs text-muted-foreground">{row.key}</div>
                  </TableCell>
                  <TableCell className="text-sm">{row.address}</TableCell>
                  <TableCell className="text-sm">{row.meetPerson}</TableCell>
                  <TableCell>
                    <Switch
                      checked={row.enabled}
                      onCheckedChange={() => toggleEnabled.mutate(row)}
                      aria-label={`Show ${row.label}`}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(row)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRemove(row)}
                        title="Remove"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <OfficeDialog open={addOpen} onOpenChange={setAddOpen} onSaved={invalidate} />
      <OfficeDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        office={editing}
        onSaved={invalidate}
      />

      <Dialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {confirmRemove?.label}?</DialogTitle>
            <DialogDescription>
              It disappears from the hire, welcome-email and interview pickers. Anything already
              scheduled or sent keeps its address. You can add it again later under the same name.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => confirmRemove && remove.mutate(confirmRemove)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function OfficeDialog({
  open,
  onOpenChange,
  office,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  office?: Office | null;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [meetPerson, setMeetPerson] = useState('');

  useEffect(() => {
    if (!open) return;
    setLabel(office?.label ?? '');
    setAddress(office?.address ?? '');
    setMeetPerson(office?.meetPerson ?? '');
  }, [open, office]);

  const save = useMutation({
    mutationFn: () => {
      const body = { label: label.trim(), address: address.trim(), meetPerson: meetPerson.trim() || 'the team' };
      return office
        ? apiRequest(`/api/offices/${office.id}`, 'PATCH', body)
        : apiRequest('/api/offices', 'POST', body);
    },
    onSuccess: () => {
      onSaved();
      onOpenChange(false);
      toast({ title: office ? 'Office updated' : 'Office added', description: `${label.trim()} is live in every picker.` });
    },
    onError: (err: Error) => toast({ title: 'Could not save', description: err.message, variant: 'destructive' }),
  });

  const canSave = label.trim().length > 0 && address.trim().length > 0 && !save.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{office ? `Edit ${office.label}` : 'Add an office'}</DialogTitle>
          <DialogDescription>
            The welcome email reads: "you'll meet with <b>{meetPerson.trim() || 'the team'}</b> and
            the team at the office… We are located at <b>{address.trim() || '…'}</b>".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="office-label">Name</Label>
            <Input
              id="office-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="PITT (Warrendale, PA)"
              autoFocus
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="office-address">Address</Label>
            <Input
              id="office-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="50 Pennwood Pl Suite 329, Warrendale, PA 15086"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="office-meet">Who they meet on day one</Label>
            <Input
              id="office-meet"
              value={meetPerson}
              onChange={(e) => setMeetPerson(e.target.value)}
              placeholder="Josh Morris and Jay Waseem"
            />
            <p className="text-xs text-muted-foreground">Leave blank for "the team".</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={() => save.mutate()}>
            {save.isPending ? 'Saving…' : office ? 'Save' : 'Add office'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
