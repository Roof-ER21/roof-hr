
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  Thermometer,
  Wind,
  Cloud,
  Sun,
  User
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MainLayout } from '@/components/layout/main-layout';

interface CheckIn {
  id: string;
  latitude: number;
  longitude: number;
  location?: string;
  jobSite?: string;
  checkInTime: string;
  checkOutTime?: string;
  weatherCondition?: string;
  temperature?: number;
  windSpeed?: number;
}

interface WeatherData {
  condition: string;
  temperature: number;
  windSpeed: number;
  description: string;
}

export default function CheckInPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [jobSite, setJobSite] = useState('');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user?.onboardingStatus === 'PENDING') {
      router.push('/onboarding');
      return;
    }

    fetchCheckIns();
    
    // Check if user has an active check-in
    checkActiveCheckIn();
  }, [session, status, router]);

  const fetchCheckIns = async () => {
    try {
      const response = await fetch('/api/checkin/history');
      if (!response.ok) throw new Error('Failed to fetch check-ins');
      const data = await response.json();
      setCheckIns(data.checkIns);
    } catch (error) {
      console.error('Error fetching check-ins:', error);
    }
  };

  const checkActiveCheckIn = async () => {
    try {
      const response = await fetch('/api/checkin/status');
      if (!response.ok) return;
      const data = await response.json();
      setIsCheckedIn(data.isCheckedIn);
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  const getCurrentLocation = () => {
    setGettingLocation(true);
    setError('');

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        
        // Get weather data for the location
        await fetchWeatherData(latitude, longitude);
        setGettingLocation(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setError('Unable to get your location. Please ensure location services are enabled.');
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const fetchWeatherData = async (lat: number, lng: number) => {
    try {
      // Mock weather data - in production, you'd call a real weather API
      const mockWeather: WeatherData = {
        condition: 'Sunny',
        temperature: 72,
        windSpeed: 8,
        description: 'Clear skies, good working conditions'
      };
      setWeatherData(mockWeather);
    } catch (error) {
      console.error('Weather fetch error:', error);
      // Continue without weather data
    }
  };

  const handleCheckIn = async () => {
    if (!currentLocation) {
      setError('Please get your current location first');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
          jobSite: jobSite.trim() || undefined,
          weatherCondition: weatherData?.condition,
          temperature: weatherData?.temperature,
          windSpeed: weatherData?.windSpeed
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check in');
      }

      setSuccess('Successfully checked in! Your location and time have been recorded.');
      setIsCheckedIn(true);
      setJobSite('');
      await fetchCheckIns();

    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch('/api/checkin/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to check out');
      }

      setSuccess('Successfully checked out! Have a safe trip.');
      setIsCheckedIn(false);
      await fetchCheckIns();

    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case 'sunny':
      case 'clear':
        return Sun;
      case 'cloudy':
      case 'overcast':
        return Cloud;
      case 'windy':
        return Wind;
      default:
        return Cloud;
    }
  };

  if (status === 'loading') {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="spinner border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!session) {
    return null;
  }

  const WeatherIcon = weatherData ? getWeatherIcon(weatherData.condition) : Cloud;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-secondary-950">GPS Check-In</h1>
          <p className="text-secondary-600 mt-1">
            Track your location and work hours with GPS verification
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Current Status */}
        <Card className="roof-er-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              {isCheckedIn ? (
                <div>
                  <Badge className="mb-4 bg-green-100 text-green-800 border-green-300">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Checked In
                  </Badge>
                  <p className="text-secondary-600 mb-4">
                    You are currently checked in to your job site
                  </p>
                  <Button 
                    onClick={handleCheckOut}
                    disabled={loading}
                    className="btn-secondary"
                  >
                    {loading ? 'Checking Out...' : 'Check Out'}
                  </Button>
                </div>
              ) : (
                <div>
                  <Badge variant="outline" className="mb-4">
                    <Clock className="h-3 w-3 mr-1" />
                    Not Checked In
                  </Badge>
                  <p className="text-secondary-600 mb-4">
                    Check in to start tracking your work location and time
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {!isCheckedIn && (
          <>
            {/* Location & Weather */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="roof-er-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Location
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!currentLocation ? (
                    <div className="text-center">
                      <p className="text-secondary-600 mb-4">
                        Get your current location to check in
                      </p>
                      <Button 
                        onClick={getCurrentLocation}
                        disabled={gettingLocation}
                        className="btn-outline"
                      >
                        {gettingLocation ? 'Getting Location...' : 'Get Current Location'}
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 text-green-600 mb-2">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">Location acquired</span>
                      </div>
                      <p className="text-sm text-secondary-600">
                        Latitude: {currentLocation.lat.toFixed(6)}
                      </p>
                      <p className="text-sm text-secondary-600">
                        Longitude: {currentLocation.lng.toFixed(6)}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="roof-er-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <WeatherIcon className="h-5 w-5 text-primary" />
                    Weather Conditions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {weatherData ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-secondary-600">Condition:</span>
                        <span className="font-medium">{weatherData.condition}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-secondary-600">Temperature:</span>
                        <div className="flex items-center gap-1">
                          <Thermometer className="h-4 w-4" />
                          <span className="font-medium">{weatherData.temperature}°F</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-secondary-600">Wind Speed:</span>
                        <div className="flex items-center gap-1">
                          <Wind className="h-4 w-4" />
                          <span className="font-medium">{weatherData.windSpeed} mph</span>
                        </div>
                      </div>
                      <p className="text-sm text-secondary-500 pt-2 border-t">
                        {weatherData.description}
                      </p>
                    </div>
                  ) : (
                    <p className="text-secondary-500">
                      Weather data will be available after getting location
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Check-in Form */}
            {currentLocation && (
              <Card className="roof-er-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-primary" />
                    Check In to Job Site
                  </CardTitle>
                  <CardDescription>
                    Record your arrival at the work location
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="jobSite" className="form-label">Job Site / Project (Optional)</Label>
                    <Input
                      id="jobSite"
                      value={jobSite}
                      onChange={(e) => setJobSite(e.target.value)}
                      className="form-input"
                      placeholder="e.g., Thompson Residence, 123 Main St"
                    />
                  </div>

                  <div className="flex justify-center pt-4">
                    <Button 
                      onClick={handleCheckIn}
                      disabled={loading || !currentLocation}
                      className="btn-primary px-8"
                    >
                      {loading ? 'Checking In...' : 'Check In'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Recent Check-ins */}
        <Card className="roof-er-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Check-ins
            </CardTitle>
            <CardDescription>
              Your location and time tracking history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {checkIns.length === 0 ? (
                <div className="text-center py-8 text-secondary-500">
                  <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No check-ins recorded yet</p>
                  <p className="text-sm">Your location history will appear here</p>
                </div>
              ) : (
                checkIns.slice(0, 10).map((checkIn) => (
                  <div key={checkIn.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {checkIn.jobSite || checkIn.location || 'Job Site'}
                        </span>
                        {!checkIn.checkOutTime && (
                          <Badge className="bg-green-100 text-green-800 border-green-300">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-secondary-600 space-y-1">
                        <p>
                          Check-in: {new Date(checkIn.checkInTime).toLocaleString()}
                        </p>
                        {checkIn.checkOutTime && (
                          <p>
                            Check-out: {new Date(checkIn.checkOutTime).toLocaleString()}
                          </p>
                        )}
                        {checkIn.weatherCondition && (
                          <p>
                            Weather: {checkIn.weatherCondition}
                            {checkIn.temperature && `, ${checkIn.temperature}°F`}
                            {checkIn.windSpeed && `, ${checkIn.windSpeed} mph wind`}
                          </p>
                        )}
                        <p className="text-xs">
                          Location: {checkIn.latitude.toFixed(4)}, {checkIn.longitude.toFixed(4)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Safety Notice */}
        <Alert className="border-blue-200 bg-blue-50">
          <AlertTriangle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Safety First:</strong> Always prioritize safety over check-in requirements. 
            If you're in an unsafe situation or emergency, focus on getting to safety first.
          </AlertDescription>
        </Alert>
      </div>
    </MainLayout>
  );
}
