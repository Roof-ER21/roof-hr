import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Eye, EyeOff, Key } from 'lucide-react';

interface PasswordResetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export function PasswordResetDialog({ isOpen, onClose, employee }: PasswordResetDialogProps) {
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      const response = await fetch(`/api/users/${employee.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ temporaryPassword: password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Password Reset Successfully',
        description: `Temporary password set for ${employee.firstName} ${employee.lastName}. They must change it on next login.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      onClose();
      setTemporaryPassword('');
      setError('');
    },
    onError: (error: any) => {
      setError(error.message || 'Failed to reset password');
    },
  });

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTemporaryPassword(password);
  };

  const handleSubmit = () => {
    if (!temporaryPassword || temporaryPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    setError('');
    resetPasswordMutation.mutate(temporaryPassword);
  };

  const handleClose = () => {
    setTemporaryPassword('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Reset Password
          </DialogTitle>
          <DialogDescription>
            Set a temporary password for <strong>{employee.firstName} {employee.lastName}</strong> ({employee.email}).
            They will be required to change this password on their next login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="temporaryPassword">Temporary Password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="temporaryPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={temporaryPassword}
                  onChange={(e) => setTemporaryPassword(e.target.value)}
                  placeholder="Enter temporary password (min 8 characters)"
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={generateRandomPassword}
              >
                Generate
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Password must be at least 8 characters long. Click "Generate" for a secure random password.
            </p>
          </div>

          {temporaryPassword && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Make sure to share this temporary password with the employee securely. 
                They will need to change it immediately after their first login.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={resetPasswordMutation.isPending || !temporaryPassword}
          >
            {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}