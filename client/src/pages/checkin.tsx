import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Navigation, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const checkinSchema = z.object({
  type: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'BREAK_START', 'BREAK_END']),
  jobSite: z.string().optional(),
  notes: z.string().optional(),
});

type CheckinFormData = z.infer<typeof checkinSchema>;

function Checkin() {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [address, setAddress] = useState<string>('');
  const [locationError, setLocationError] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: checkins, isLoading } = useQuery({
    queryKey: ['/api/checkins'],
    queryFn: async () => {
      const response = await fetch('/api/checkins', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch check-ins');
      return response.json();
    }
  });

  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    }
  });

  const form = useForm<CheckinFormData>({
    resolver: zodResolver(checkinSchema),
    defaultValues: {
      type: 'CLOCK_IN',
      jobSite: '',
      notes: '',
    }
  });

  const checkinMutation = useMutation({
    mutationFn: async (data: CheckinFormData) => {
      if (!location) {
        throw new Error('Location is required for check-in');
      }

      const response = await fetch('/api/checkins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          location,
          address,
        })
      });
      if (!response.ok) throw new Error('Failed to create check-in');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/checkins'] });
      form.reset();
      toast({
        title: 'Success',
        description: 'Check-in recorded successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to record check-in',
        variant: 'destructive'
      });
    }
  });

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }

    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocation({ latitude, longitude, accuracy });
        
        // Reverse geocode to get address
        fetch(`https://api.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then(response => response.json())
          .then(data => {
            if (data.display_name) {
              setAddress(data.display_name);
            }
          })
          .catch(() => {
            setAddress(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          });
      },
      (error) => {
        setLocationError(`Location error: ${error.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const onSubmit = (data: CheckinFormData) => {
    checkinMutation.mutate(data);
  };

  const getUserById = (id: string) => {
    return users?.find((user: any) => user.id === id);
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CLOCK_IN': return 'bg-green-100 text-green-800';
      case 'CLOCK_OUT': return 'bg-red-100 text-red-800';
      case 'BREAK_START': return 'bg-yellow-100 text-yellow-800';
      case 'BREAK_END': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'CLOCK_IN': return <Clock className="w-4 h-4" />;
      case 'CLOCK_OUT': return <Clock className="w-4 h-4" />;
      case 'BREAK_START': return <AlertTriangle className="w-4 h-4" />;
      case 'BREAK_END': return <AlertTriangle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatType = (type: string) => {
    return type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return <div className="p-8">Loading check-ins...</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-secondary-950">GPS Check-In</h1>
        <p className="mt-2 text-sm text-secondary-600">
          Track your work location and time for job sites
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Check-in Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Record Check-In
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="type">Check-in Type</Label>
                <Select onValueChange={(value) => form.setValue('type', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select check-in type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLOCK_IN">Clock In</SelectItem>
                    <SelectItem value="CLOCK_OUT">Clock Out</SelectItem>
                    <SelectItem value="BREAK_START">Break Start</SelectItem>
                    <SelectItem value="BREAK_END">Break End</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="jobSite">Job Site (Optional)</Label>
                <Input
                  id="jobSite"
                  {...form.register('jobSite')}
                  placeholder="Enter job site name or address"
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  {...form.register('notes')}
                  placeholder="Add any additional notes..."
                />
              </div>

              {/* Location Status */}
              <div className="space-y-2">
                <Label>Current Location</Label>
                <div className="p-3 bg-gray-50 rounded-lg">
                  {locationError ? (
                    <div className="flex items-center text-red-600">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      {locationError}
                    </div>
                  ) : location ? (
                    <div className="space-y-2">
                      <div className="flex items-center text-green-600">
                        <Navigation className="w-4 h-4 mr-2" />
                        Location acquired
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</div>
                        <div>Accuracy: {location.accuracy.toFixed(0)}m</div>
                        {address && <div>Address: {address}</div>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center text-yellow-600">
                      <Clock className="w-4 h-4 mr-2" />
                      Getting location...
                    </div>
                  )}
                </div>
                {locationError && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={getCurrentLocation}
                    className="w-full"
                  >
                    Retry Location
                  </Button>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={checkinMutation.isPending || !location}
              >
                {checkinMutation.isPending ? 'Recording...' : 'Record Check-In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Check-ins */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Check-ins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {checkins?.slice(0, 10).map((checkin: any) => {
                const employee = getUserById(checkin.employeeId);
                return (
                  <div key={checkin.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-secondary-200 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium">
                            {employee?.firstName?.[0]}{employee?.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{employee?.firstName} {employee?.lastName}</div>
                          <div className="text-sm text-secondary-500">{employee?.position}</div>
                        </div>
                      </div>
                      <Badge className={getTypeColor(checkin.type)}>
                        <div className="flex items-center">
                          {getTypeIcon(checkin.type)}
                          <span className="ml-1">{formatType(checkin.type)}</span>
                        </div>
                      </Badge>
                    </div>
                    
                    <div className="mt-3 space-y-1 text-sm text-secondary-600">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-2" />
                        {new Date(checkin.timestamp).toLocaleString()}
                      </div>
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 mr-2" />
                        {checkin.address || `${checkin.location.latitude.toFixed(6)}, ${checkin.location.longitude.toFixed(6)}`}
                      </div>
                      {checkin.jobSite && (
                        <div className="flex items-center">
                          <Navigation className="w-4 h-4 mr-2" />
                          {checkin.jobSite}
                        </div>
                      )}
                      {checkin.notes && (
                        <div className="mt-2 text-sm bg-gray-50 p-2 rounded">
                          {checkin.notes}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Checkin;
