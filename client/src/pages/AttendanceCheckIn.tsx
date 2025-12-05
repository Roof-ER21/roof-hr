import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, AlertCircle, MapPin, User, Mail, Loader2, Calendar, Clock } from 'lucide-react';

interface CheckInData {
  name: string;
  email?: string;
  location: 'RICHMOND' | 'PHILLY' | 'DMV';
  latLng?: string;
}

interface SessionInfo {
  id: string;
  name: string;
  location: 'RICHMOND' | 'PHILLY' | 'DMV';
  status: 'ACTIVE' | 'CLOSED';
  startsAt: string;
  expiresAt: string;
  notes: string | null;
}

export default function AttendanceCheckIn() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [geolocation, setGeolocation] = useState<string | null>(null);

  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('sid');
  const token = urlParams.get('t');

  // Check if we have valid session parameters
  const isValidSession = sessionId && token;

  // Fetch session details using public endpoint
  const { data: sessionInfo, isLoading: isLoadingSession, error: sessionError } = useQuery<SessionInfo>({
    queryKey: [`/api/attendance/sessions/${sessionId}/public?t=${token}`],
    enabled: !!isValidSession,
    retry: false,
  });

  // Request geolocation permission
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeolocation(`${position.coords.latitude},${position.coords.longitude}`);
          setLocationPermission('granted');
        },
        () => {
          setLocationPermission('denied');
        }
      );
    }
  }, []);

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: (data: CheckInData) => {
      if (!isValidSession) {
        throw new Error('Invalid session parameters');
      }
      return apiRequest(`/api/attendance/sessions/${sessionId}/check-in?t=${token}`, {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          latLng: geolocation,
        }),
      });
    },
    onSuccess: () => {
      setCheckInSuccess(true);
      toast({
        title: 'Check-In Successful',
        description: 'You have been successfully checked in.',
      });
      
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/');
      }, 3000);
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to check in';
      toast({
        title: 'Check-In Failed',
        description: errorMessage,
        variant: 'destructive',
      });
      
      // If session is invalid, redirect to home
      if (errorMessage.includes('Session not found') || errorMessage.includes('expired')) {
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    checkInMutation.mutate({
      name: formData.get('name') as string,
      email: formData.get('email') as string || undefined,
      location: formData.get('location') as CheckInData['location'],
    });
  };

  // If loading session, show loading state
  if (isLoadingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
            <CardTitle>Loading Session</CardTitle>
            <CardDescription>
              Please wait while we load the session details...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // If not a valid session or session error, show error
  if (!isValidSession || sessionError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Invalid Session</CardTitle>
            <CardDescription>
              This check-in link is invalid or has expired. Please scan a valid QR code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => navigate('/')}
              data-testid="button-go-home"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (checkInSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Check-In Successful!</CardTitle>
            <CardDescription className="mt-2">
              You have been checked in to {sessionInfo?.name || 'the session'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-center text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mr-1" />
                {sessionInfo?.location || 'Location recorded'}
              </div>
            </div>
            <Alert>
              <AlertDescription>
                You will be redirected in a few seconds...
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check-in form
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Attendance Check-In</CardTitle>
          <CardDescription>
            {sessionInfo ? (
              <div className="space-y-2 mt-2">
                <div className="font-medium">{sessionInfo.name}</div>
                <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {sessionInfo.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(sessionInfo.startsAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ) : (
              'Please enter your details to check in to the session'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">
                Full Name <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  name="name"
                  placeholder="Enter your full name"
                  required
                  disabled={checkInMutation.isPending}
                  className="pl-10"
                  data-testid="input-name"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">
                Email <span className="text-sm text-muted-foreground">(Optional)</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="your.email@example.com"
                  disabled={checkInMutation.isPending}
                  className="pl-10"
                  data-testid="input-email"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="location">
                Location <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                <Select name="location" required defaultValue={sessionInfo?.location || "RICHMOND"}>
                  <SelectTrigger className="pl-10" data-testid="select-location">
                    <SelectValue placeholder="Select your location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RICHMOND">Richmond</SelectItem>
                    <SelectItem value="PHILLY">Philadelphia</SelectItem>
                    <SelectItem value="DMV">DMV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {locationPermission === 'granted' && (
              <Alert>
                <MapPin className="h-4 w-4" />
                <AlertDescription>
                  Your location will be recorded for attendance verification.
                </AlertDescription>
              </Alert>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={checkInMutation.isPending}
              data-testid="button-submit"
            >
              {checkInMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking In...
                </>
              ) : (
                'Check In'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Having trouble? Contact your session organizer.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}