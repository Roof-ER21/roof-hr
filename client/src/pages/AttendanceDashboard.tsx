import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import QRCode from 'react-qr-code';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  QrCode,
  Users,
  Download,
  RefreshCw,
  Plus,
  X,
  Calendar,
  MapPin,
  Clock,
  FileText,
  Save,
  Eye,
  Edit,
  UserPlus,
  Copy,
  CheckCircle,
} from 'lucide-react';

interface AttendanceSession {
  id: string;
  name: string;
  location: 'RICHMOND' | 'PHILLY' | 'DMV';
  status: 'ACTIVE' | 'CLOSED';
  qrToken: string;
  qrUrl?: string;
  startsAt: string;
  expiresAt: string;
  notes: string | null;
  createdAt: string;
  checkIns?: AttendanceCheckIn[];
}

interface AttendanceCheckIn {
  id: string;
  sessionId: string;
  name: string;
  email: string | null;
  location: 'RICHMOND' | 'PHILLY' | 'DMV';
  checkedInAt: string;
  userId: string | null;
}

export default function AttendanceDashboard() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showManualCheckIn, setShowManualCheckIn] = useState(false);
  const [notes, setNotes] = useState('');
  const [urlCopied, setUrlCopied] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Connect to WebSocket
  useEffect(() => {
    const newSocket = io('/', {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Join session room for real-time updates
  useEffect(() => {
    if (socket && selectedSession) {
      socket.emit('join-session', selectedSession.id);

      // Listen for real-time check-ins
      socket.on(`attendance:${selectedSession.id}`, (data) => {
        if (data.type === 'check-in') {
          // Refresh the session data
          queryClient.invalidateQueries({ queryKey: [`/api/attendance/sessions/${selectedSession.id}`] });
        }
      });

      return () => {
        socket.emit('leave-session', selectedSession.id);
        socket.off(`attendance:${selectedSession.id}`);
      };
    }
  }, [socket, selectedSession, queryClient]);

  // Fetch active sessions
  const { data: sessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['/api/attendance/sessions?active=true'],
  });

  // Fetch selected session details
  const { data: sessionDetails } = useQuery({
    queryKey: selectedSession?.id ? [`/api/attendance/sessions/${selectedSession.id}`] : ['no-session'],
    enabled: !!selectedSession?.id,
    refetchInterval: selectedSession?.status === 'ACTIVE' ? 5000 : false, // Auto-refresh every 5 seconds for active sessions
  });

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: { name: string; location: string; startsAt: string; expiresAt: string }) =>
      apiRequest('/api/attendance/sessions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/sessions'] });
      // Ensure the new session includes the qrUrl from the backend response
      setSelectedSession(newSession);
      // Also invalidate the session details query to fetch complete data
      if (newSession.id) {
        queryClient.setQueryData([`/api/attendance/sessions/${newSession.id}`], newSession);
      }
      setShowCreateDialog(false);
      toast({
        title: 'Session Created',
        description: 'Attendance session has been created successfully.',
      });
    },
    onError: (error: any) => {
      console.error('Failed to create session:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create attendance session.',
        variant: 'destructive',
      });
    },
  });

  // Update session notes mutation
  const updateNotesMutation = useMutation({
    mutationFn: (notes: string) =>
      apiRequest(`/api/attendance/sessions/${selectedSession?.id}/notes`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/attendance/sessions/${selectedSession?.id}`] });
      toast({
        title: 'Notes Updated',
        description: 'Session notes have been saved.',
      });
    },
  });

  // Rotate token mutation
  const rotateTokenMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/attendance/sessions/${selectedSession?.id}/rotate-token`, {
        method: 'POST',
      }),
    onSuccess: (updatedSession) => {
      queryClient.invalidateQueries({ queryKey: [`/api/attendance/sessions/${selectedSession?.id}`] });
      setSelectedSession(updatedSession);
      toast({
        title: 'Token Rotated',
        description: 'QR code has been regenerated with a new token.',
      });
    },
  });

  // Close session mutation
  const closeSessionMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/attendance/sessions/${selectedSession?.id}/close`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendance/sessions'] });
      toast({
        title: 'Session Closed',
        description: 'Attendance session has been closed.',
      });
      setSelectedSession(null);
    },
  });

  // Manual check-in mutation
  const manualCheckInMutation = useMutation({
    mutationFn: (data: { name: string; email?: string; location: string }) =>
      apiRequest(`/api/attendance/sessions/${selectedSession?.id}/check-in?t=${selectedSession?.qrToken}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/attendance/sessions/${selectedSession?.id}`] });
      setShowManualCheckIn(false);
      toast({
        title: 'Check-In Successful',
        description: 'Attendee has been checked in.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Check-In Failed',
        description: error.message || 'Failed to check in attendee.',
        variant: 'destructive',
      });
    },
  });

  // Export attendance CSV
  const handleExport = async () => {
    if (!selectedSession) return;

    try {
      const response = await fetch(`/api/attendance/sessions/${selectedSession.id}/export.csv`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${selectedSession.name}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: 'Export Failed',
        description: 'Failed to export attendance data.',
        variant: 'destructive',
      });
    }
  };

  const currentSession = sessionDetails || selectedSession;

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Attendance Tracker</h1>
          <p className="text-muted-foreground mt-2">
            Manage attendance sessions with QR code check-in
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/attendance/admin">
            <Button variant="outline" data-testid="button-admin-dashboard">
              <Eye className="w-4 h-4 mr-2" />
              Admin Dashboard
            </Button>
          </Link>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-session">
                <Plus className="w-4 h-4 mr-2" />
                Create Session
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Attendance Session</DialogTitle>
                <DialogDescription>
                  Create a new session for tracking attendance
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  const now = new Date();
                  const expiresAt = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now
                  createSessionMutation.mutate({
                    name: formData.get('name') as string,
                    location: formData.get('location') as string,
                    startsAt: now.toISOString(),
                    expiresAt: expiresAt.toISOString(),
                  });
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="name">Session Name</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="e.g., Weekly Team Meeting"
                    required
                    data-testid="input-session-name"
                  />
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Select name="location" required>
                    <SelectTrigger data-testid="select-location">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RICHMOND">Richmond</SelectItem>
                      <SelectItem value="PHILLY">Philadelphia</SelectItem>
                      <SelectItem value="DMV">DMV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" data-testid="button-submit-session">
                  Create Session
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions List */}
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>Select a session to manage</CardDescription>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <p className="text-center text-muted-foreground">Loading...</p>
            ) : sessions.length === 0 ? (
              <p className="text-center text-muted-foreground">No active sessions</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session: AttendanceSession) => (
                  <Card
                    key={session.id}
                    className={`cursor-pointer transition-colors hover:bg-accent ${
                      currentSession?.id === session.id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedSession(session)}
                    data-testid={`card-session-${session.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold">{session.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <MapPin className="w-3 h-3" />
                            <span className="text-sm text-muted-foreground">
                              {session.location}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3" />
                            <span className="text-sm text-muted-foreground">
                              {session.startsAt ? format(new Date(session.startsAt), 'h:mm a') : 'Not set'}
                            </span>
                          </div>
                        </div>
                        <Badge variant={session.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {session.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* QR Code Display */}
        {currentSession && (
          <Card>
            <CardHeader>
              <CardTitle>QR Code</CardTitle>
              <CardDescription>{currentSession.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-4">
                {currentSession.status === 'ACTIVE' ? (
                  <>
                    {currentSession.qrUrl ? (
                      <>
                        <div className="bg-white p-4 rounded-lg shadow-lg">
                          <QRCode
                            value={currentSession.qrUrl}
                            size={240}
                            level="H"
                            data-testid="qr-code"
                          />
                        </div>
                        <div className="w-full bg-muted/50 p-3 rounded-lg">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground truncate flex-1">
                              {currentSession.qrUrl}
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                navigator.clipboard.writeText(currentSession.qrUrl || '');
                                setUrlCopied(true);
                                setTimeout(() => setUrlCopied(false), 2000);
                              }}
                              className="shrink-0"
                            >
                              {urlCopied ? (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-muted/50 p-8 rounded-lg">
                        <p className="text-center text-muted-foreground">Loading QR Code...</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rotateTokenMutation.mutate()}
                        data-testid="button-rotate-qr"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Rotate QR
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowManualCheckIn(true)}
                        data-testid="button-manual-checkin"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Manual Check-In
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground">Session is closed</p>
                )}

                <div className="w-full pt-4 border-t">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span>{currentSession.location}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Started:</span>
                      <span>{currentSession.startsAt ? format(new Date(currentSession.startsAt), 'h:mm a') : 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expires:</span>
                      <span>{currentSession.expiresAt ? format(new Date(currentSession.expiresAt), 'h:mm a') : 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-ins:</span>
                      <span>{currentSession.checkIns?.length || 0}</span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleExport}
                      disabled={!currentSession.checkIns?.length}
                      data-testid="button-export-csv"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Export CSV
                    </Button>
                    {currentSession.status === 'ACTIVE' && (
                      <Button
                        className="w-full"
                        variant="destructive"
                        onClick={() => closeSessionMutation.mutate()}
                        data-testid="button-close-session"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Close Session
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendees List */}
        {currentSession && (
          <Card>
            <CardHeader>
              <CardTitle>Attendees ({currentSession.checkIns?.length || 0})</CardTitle>
              <CardDescription>Real-time attendance list</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[400px] overflow-y-auto">
                {currentSession.checkIns && currentSession.checkIns.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentSession.checkIns.map((checkIn) => (
                        <TableRow key={checkIn.id} data-testid={`row-checkin-${checkIn.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{checkIn.name}</p>
                              {checkIn.email && (
                                <p className="text-sm text-muted-foreground">{checkIn.email}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {format(new Date(checkIn.checkedInAt), 'h:mm a')}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No check-ins yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Meeting Notes */}
      {currentSession && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Meeting Notes</CardTitle>
            <CardDescription>Record important points from the session</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Enter meeting notes..."
              value={notes || currentSession.notes || ''}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="mb-4"
              data-testid="textarea-notes"
            />
            <Button
              onClick={() => updateNotesMutation.mutate(notes)}
              disabled={notes === currentSession.notes}
              data-testid="button-save-notes"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Notes
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Manual Check-In Dialog */}
      <Dialog open={showManualCheckIn} onOpenChange={setShowManualCheckIn}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Check-In</DialogTitle>
            <DialogDescription>
              Add an attendee manually to the session
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              manualCheckInMutation.mutate({
                name: formData.get('name') as string,
                email: formData.get('email') as string,
                location: formData.get('location') as string,
              });
            }}
            className="space-y-4"
          >
            <div>
              <Label htmlFor="checkin-name">Name *</Label>
              <Input
                id="checkin-name"
                name="name"
                required
                placeholder="John Doe"
                data-testid="input-checkin-name"
              />
            </div>
            <div>
              <Label htmlFor="checkin-email">Email (Optional)</Label>
              <Input
                id="checkin-email"
                name="email"
                type="email"
                placeholder="john@example.com"
                data-testid="input-checkin-email"
              />
            </div>
            <div>
              <Label htmlFor="checkin-location">Location</Label>
              <Select name="location" defaultValue={currentSession?.location} required>
                <SelectTrigger data-testid="select-checkin-location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RICHMOND">Richmond</SelectItem>
                  <SelectItem value="PHILLY">Philadelphia</SelectItem>
                  <SelectItem value="DMV">DMV</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" data-testid="button-submit-checkin">
              Check In
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}