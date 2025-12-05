
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  FileText,
  Plus,
  Award,
  Clock,
  ExternalLink,
  Download,
  Upload
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/main-layout';

interface SafetyTraining {
  id: string;
  trainingType: string;
  trainingName: string;
  provider: string;
  completedDate: string;
  expirationDate?: string;
  certificateUrl?: string;
  oshaRequired: boolean;
}

interface SafetyIncident {
  id: string;
  incidentDate: string;
  location: string;
  description: string;
  severity: string;
  injuryType?: string;
  bodyPart?: string;
  treatmentRequired: boolean;
  oshaReportable: boolean;
  createdAt: string;
}

export default function SafetyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [trainings, setTrainings] = useState<SafetyTraining[]>([]);
  const [incidents, setIncidents] = useState<SafetyIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Incident form state
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [incidentLocation, setIncidentLocation] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState('MEDIUM');
  const [injuryType, setInjuryType] = useState('');
  const [bodyPart, setBodyPart] = useState('');
  const [treatmentRequired, setTreatmentRequired] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user?.onboardingStatus === 'PENDING') {
      router.push('/onboarding');
      return;
    }

    fetchSafetyData();
  }, [session, status, router]);

  const fetchSafetyData = async () => {
    try {
      setLoading(true);
      
      // Fetch safety trainings
      const trainingsResponse = await fetch('/api/safety/trainings');
      if (!trainingsResponse.ok) throw new Error('Failed to fetch trainings');
      const trainingsData = await trainingsResponse.json();
      setTrainings(trainingsData.trainings);

      // Fetch safety incidents
      const incidentsResponse = await fetch('/api/safety/incidents');
      if (!incidentsResponse.ok) throw new Error('Failed to fetch incidents');
      const incidentsData = await incidentsResponse.json();
      setIncidents(incidentsData.incidents);

    } catch (error) {
      console.error('Error fetching safety data:', error);
      setError('Failed to load safety data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitIncident = async () => {
    if (!incidentLocation || !incidentDescription) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const response = await fetch('/api/safety/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: incidentLocation.trim(),
          description: incidentDescription.trim(),
          severity: incidentSeverity,
          injuryType: injuryType.trim() || undefined,
          bodyPart: bodyPart.trim() || undefined,
          treatmentRequired
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to report incident');
      }

      setSuccess('Safety incident reported successfully. Your manager and HR have been notified.');
      setShowIncidentForm(false);
      resetIncidentForm();
      
      // Refresh data
      await fetchSafetyData();

    } catch (error: any) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetIncidentForm = () => {
    setIncidentLocation('');
    setIncidentDescription('');
    setIncidentSeverity('MEDIUM');
    setInjuryType('');
    setBodyPart('');
    setTreatmentRequired(false);
  };

  const getSeverityBadge = (severity: string) => {
    const config = {
      LOW: { variant: 'secondary' as const, text: 'Low' },
      MEDIUM: { variant: 'default' as const, text: 'Medium' },
      HIGH: { variant: 'destructive' as const, text: 'High' },
      CRITICAL: { variant: 'destructive' as const, text: 'Critical' }
    };
    
    const severityConfig = config[severity as keyof typeof config] || config.MEDIUM;
    return <Badge variant={severityConfig.variant}>{severityConfig.text}</Badge>;
  };

  const getTrainingStatus = (training: SafetyTraining) => {
    if (training.expirationDate) {
      const expDate = new Date(training.expirationDate);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry < 0) {
        return { status: 'expired', color: 'red', text: 'Expired' };
      } else if (daysUntilExpiry <= 30) {
        return { status: 'expiring', color: 'yellow', text: 'Expires Soon' };
      }
    }
    return { status: 'current', color: 'green', text: 'Current' };
  };

  const safetyScore = Math.round(((trainings.filter(t => getTrainingStatus(t).status === 'current').length) / Math.max(trainings.length, 1)) * 100);

  if (status === 'loading' || loading) {
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

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-secondary-950">Safety & Compliance</h1>
            <p className="text-secondary-600 mt-1">
              OSHA training, certifications, and incident reporting
            </p>
          </div>
          <Dialog open={showIncidentForm} onOpenChange={setShowIncidentForm}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                Report Incident
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Report Safety Incident
                </DialogTitle>
                <DialogDescription>
                  Report any safety incidents, near misses, or hazards immediately
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <div>
                  <Label htmlFor="location" className="form-label">Location *</Label>
                  <Input
                    id="location"
                    value={incidentLocation}
                    onChange={(e) => setIncidentLocation(e.target.value)}
                    className="form-input"
                    placeholder="Job site address, office location, etc."
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description" className="form-label">Description *</Label>
                  <Textarea
                    id="description"
                    value={incidentDescription}
                    onChange={(e) => setIncidentDescription(e.target.value)}
                    className="form-input"
                    placeholder="Describe what happened in detail..."
                    rows={4}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="severity" className="form-label">Severity</Label>
                  <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low - Near miss, no injury</SelectItem>
                      <SelectItem value="MEDIUM">Medium - Minor injury</SelectItem>
                      <SelectItem value="HIGH">High - Significant injury</SelectItem>
                      <SelectItem value="CRITICAL">Critical - Serious injury/fatality</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(incidentSeverity === 'MEDIUM' || incidentSeverity === 'HIGH' || incidentSeverity === 'CRITICAL') && (
                  <>
                    <div>
                      <Label htmlFor="injuryType" className="form-label">Type of Injury</Label>
                      <Input
                        id="injuryType"
                        value={injuryType}
                        onChange={(e) => setInjuryType(e.target.value)}
                        className="form-input"
                        placeholder="Cut, bruise, sprain, fracture, etc."
                      />
                    </div>

                    <div>
                      <Label htmlFor="bodyPart" className="form-label">Body Part Affected</Label>
                      <Input
                        id="bodyPart"
                        value={bodyPart}
                        onChange={(e) => setBodyPart(e.target.value)}
                        className="form-input"
                        placeholder="Hand, back, leg, head, etc."
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="treatment"
                        checked={treatmentRequired}
                        onChange={(e) => setTreatmentRequired(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="treatment" className="text-sm">Medical treatment required</Label>
                    </div>
                  </>
                )}

                <Alert className="border-orange-200 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    <strong>Important:</strong> For serious injuries requiring immediate medical attention, 
                    call 911 first, then report the incident here.
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowIncidentForm(false)}
                    className="flex-1"
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmitIncident}
                    disabled={submitting || !incidentLocation || !incidentDescription}
                    className="flex-1 btn-primary"
                  >
                    {submitting ? 'Reporting...' : 'Submit Report'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        {/* Safety Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Safety Score</CardTitle>
              <Shield className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 animate-count-up">
                {safetyScore}%
              </div>
              <p className="text-xs text-secondary-600">
                Compliance rating
              </p>
            </CardContent>
          </Card>

          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Trainings</CardTitle>
              <Award className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 animate-count-up">
                {trainings.filter(t => getTrainingStatus(t).status === 'current').length}
              </div>
              <p className="text-xs text-secondary-600">
                Current certifications
              </p>
            </CardContent>
          </Card>

          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 animate-count-up">
                {trainings.filter(t => getTrainingStatus(t).status === 'expiring').length}
              </div>
              <p className="text-xs text-secondary-600">
                Need renewal
              </p>
            </CardContent>
          </Card>

          <Card className="roof-er-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Incidents Reported</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 animate-count-up">
                {incidents.length}
              </div>
              <p className="text-xs text-secondary-600">
                This year
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="trainings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="trainings">Safety Trainings</TabsTrigger>
            <TabsTrigger value="incidents">Incident Reports</TabsTrigger>
            <TabsTrigger value="resources">OSHA Resources</TabsTrigger>
          </TabsList>

          {/* Safety Trainings Tab */}
          <TabsContent value="trainings" className="space-y-6">
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  My Safety Trainings
                </CardTitle>
                <CardDescription>
                  Track your OSHA training and safety certifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {trainings.length === 0 ? (
                    <div className="text-center py-8 text-secondary-500">
                      <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No safety trainings recorded</p>
                      <Button className="mt-4 btn-outline flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload Certificate
                      </Button>
                    </div>
                  ) : (
                    trainings.map((training) => {
                      const status = getTrainingStatus(training);
                      
                      return (
                        <div key={training.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-medium text-secondary-950">{training.trainingName}</h4>
                              <Badge 
                                variant={status.status === 'current' ? 'default' : status.status === 'expiring' ? 'secondary' : 'destructive'}
                              >
                                {status.text}
                              </Badge>
                              {training.oshaRequired && (
                                <Badge variant="outline" className="text-blue-600 border-blue-300">
                                  OSHA Required
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-secondary-600 space-y-1">
                              <p>Provider: {training.provider}</p>
                              <p>Completed: {new Date(training.completedDate).toLocaleDateString()}</p>
                              {training.expirationDate && (
                                <p>Expires: {new Date(training.expirationDate).toLocaleDateString()}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {training.certificateUrl && (
                              <Button variant="outline" size="sm" className="flex items-center gap-1">
                                <Download className="h-3 w-3" />
                                Certificate
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {trainings.length > 0 && (
                  <div className="flex justify-center pt-6 border-t mt-6">
                    <Button className="btn-outline flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload New Certificate
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Incident Reports Tab */}
          <TabsContent value="incidents" className="space-y-6">
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  Safety Incident Reports
                </CardTitle>
                <CardDescription>
                  View your submitted safety incident reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {incidents.length === 0 ? (
                    <div className="text-center py-8 text-secondary-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50 text-green-500" />
                      <p className="text-green-600 font-medium">No incidents reported</p>
                      <p className="text-sm">Keep up the great safety work!</p>
                    </div>
                  ) : (
                    incidents.map((incident) => (
                      <div key={incident.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <h4 className="font-medium text-secondary-950">
                              {new Date(incident.incidentDate).toLocaleDateString()}
                            </h4>
                            {getSeverityBadge(incident.severity)}
                            {incident.oshaReportable && (
                              <Badge variant="outline" className="text-orange-600 border-orange-300">
                                OSHA Reportable
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-sm text-secondary-600 space-y-1">
                          <p><strong>Location:</strong> {incident.location}</p>
                          <p><strong>Description:</strong> {incident.description}</p>
                          {incident.injuryType && (
                            <p><strong>Injury Type:</strong> {incident.injuryType}</p>
                          )}
                          {incident.bodyPart && (
                            <p><strong>Body Part:</strong> {incident.bodyPart}</p>
                          )}
                          {incident.treatmentRequired && (
                            <p className="text-red-600"><strong>Medical treatment required</strong></p>
                          )}
                          <p className="text-secondary-400">
                            Reported: {new Date(incident.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* OSHA Resources Tab */}
          <TabsContent value="resources" className="space-y-6">
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  OSHA Resources & Guidelines
                </CardTitle>
                <CardDescription>
                  Important safety resources and compliance information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-secondary-950 mb-2">Fall Protection Standards</h4>
                    <p className="text-sm text-secondary-600 mb-3">
                      OSHA 1926.501 - Requirements for fall protection in construction
                    </p>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      View Guidelines
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-secondary-950 mb-2">Ladder Safety</h4>
                    <p className="text-sm text-secondary-600 mb-3">
                      OSHA 1926.1053 - Safe use of ladders and scaffolds
                    </p>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      View Guidelines
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-secondary-950 mb-2">Hazard Communication</h4>
                    <p className="text-sm text-secondary-600 mb-3">
                      Understanding and handling hazardous materials on job sites
                    </p>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      View Guidelines
                    </Button>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium text-secondary-950 mb-2">Emergency Procedures</h4>
                    <p className="text-sm text-secondary-600 mb-3">
                      What to do in case of workplace accidents or emergencies
                    </p>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      View Guidelines
                    </Button>
                  </div>
                </div>

                <Alert className="border-blue-200 bg-blue-50">
                  <Shield className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    <strong>Remember:</strong> Safety is everyone's responsibility. When in doubt, 
                    stop work and ask your supervisor. No job is worth risking your safety.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
