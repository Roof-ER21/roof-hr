import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, FileText, Plus, Award, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const incidentSchema = z.object({
  incidentDate: z.string().min(1),
  location: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  injuryType: z.string().optional(),
  witnessIds: z.array(z.string()).optional(),
  actionsTaken: z.string().optional(),
});

const trainingSchema = z.object({
  employeeId: z.string().min(1),
  trainingType: z.string().min(1),
  completedDate: z.string().min(1),
  expirationDate: z.string().optional(),
  certificateUrl: z.string().optional(),
});

type IncidentFormData = z.infer<typeof incidentSchema>;
type TrainingFormData = z.infer<typeof trainingSchema>;

function Safety() {
  const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
  const [isTrainingDialogOpen, setIsTrainingDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: incidents, isLoading: incidentsLoading } = useQuery({
    queryKey: ['/api/safety/incidents'],
    queryFn: async () => {
      const response = await fetch('/api/safety/incidents', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch incidents');
      return response.json();
    }
  });

  const { data: training, isLoading: trainingLoading } = useQuery({
    queryKey: ['/api/safety/training'],
    queryFn: async () => {
      const response = await fetch('/api/safety/training', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch training');
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

  const incidentForm = useForm<IncidentFormData>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      incidentDate: '',
      location: '',
      description: '',
      severity: 'LOW',
      injuryType: '',
      witnessIds: [],
      actionsTaken: '',
    }
  });

  const trainingForm = useForm<TrainingFormData>({
    resolver: zodResolver(trainingSchema),
    defaultValues: {
      employeeId: '',
      trainingType: '',
      completedDate: '',
      expirationDate: '',
      certificateUrl: '',
    }
  });

  const createIncidentMutation = useMutation({
    mutationFn: async (data: IncidentFormData) => {
      const response = await fetch('/api/safety/incidents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create incident');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/safety/incidents'] });
      setIsIncidentDialogOpen(false);
      incidentForm.reset();
      toast({
        title: 'Success',
        description: 'Safety incident reported successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to report incident',
        variant: 'destructive'
      });
    }
  });

  const createTrainingMutation = useMutation({
    mutationFn: async (data: TrainingFormData) => {
      const response = await fetch('/api/safety/training', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...data,
          status: 'COMPLETED'
        })
      });
      if (!response.ok) throw new Error('Failed to create training record');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/safety/training'] });
      setIsTrainingDialogOpen(false);
      trainingForm.reset();
      toast({
        title: 'Success',
        description: 'Training record added successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to add training record',
        variant: 'destructive'
      });
    }
  });

  const onIncidentSubmit = (data: IncidentFormData) => {
    createIncidentMutation.mutate(data);
  };

  const onTrainingSubmit = (data: TrainingFormData) => {
    createTrainingMutation.mutate(data);
  };

  const getUserById = (id: string) => {
    return users?.find((user: any) => user.id === id);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'CRITICAL': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-red-100 text-red-800';
      case 'INVESTIGATING': return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED': return 'bg-blue-100 text-blue-800';
      case 'CLOSED': return 'bg-green-100 text-green-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'EXPIRED': return 'bg-red-100 text-red-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isLoading = incidentsLoading || trainingLoading;

  if (isLoading) {
    return <div className="p-8">Loading safety data...</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-secondary-950">Safety & Compliance</h1>
        <p className="mt-2 text-sm text-secondary-600">
          Manage safety incidents, training records, and OSHA compliance
        </p>
      </div>

      <Tabs defaultValue="incidents" className="space-y-6">
        <TabsList>
          <TabsTrigger value="incidents">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Incidents
          </TabsTrigger>
          <TabsTrigger value="training">
            <Award className="w-4 h-4 mr-2" />
            Training
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incidents" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Safety Incidents</h2>
              <p className="text-sm text-secondary-600">Track and manage workplace incidents</p>
            </div>
            <Dialog open={isIncidentDialogOpen} onOpenChange={setIsIncidentDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Report Incident
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Report Safety Incident</DialogTitle>
                </DialogHeader>
                <form onSubmit={incidentForm.handleSubmit(onIncidentSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="incidentDate">Incident Date</Label>
                      <Input
                        id="incidentDate"
                        type="date"
                        {...incidentForm.register('incidentDate')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="severity">Severity</Label>
                      <Select onValueChange={(value) => incidentForm.setValue('severity', value as any)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LOW">Low</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      {...incidentForm.register('location')}
                      placeholder="Where did the incident occur?"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...incidentForm.register('description')}
                      placeholder="Provide a detailed description of the incident"
                      rows={4}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="injuryType">Injury Type (if applicable)</Label>
                    <Input
                      id="injuryType"
                      {...incidentForm.register('injuryType')}
                      placeholder="Type of injury sustained"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="actionsTaken">Actions Taken</Label>
                    <Textarea
                      id="actionsTaken"
                      {...incidentForm.register('actionsTaken')}
                      placeholder="What immediate actions were taken?"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsIncidentDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createIncidentMutation.isPending}>
                      {createIncidentMutation.isPending ? 'Reporting...' : 'Report Incident'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Date</th>
                      <th className="text-left py-3 px-4">Location</th>
                      <th className="text-left py-3 px-4">Severity</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Reported By</th>
                      <th className="text-left py-3 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents?.map((incident: any) => {
                      const reporter = getUserById(incident.reportedBy);
                      return (
                        <tr key={incident.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            {new Date(incident.incidentDate).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">{incident.location}</td>
                          <td className="py-3 px-4">
                            <Badge className={getSeverityColor(incident.severity)}>
                              {incident.severity}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(incident.status)}>
                              {incident.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {reporter?.firstName} {reporter?.lastName}
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate">
                            {incident.description}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Training Records</h2>
              <p className="text-sm text-secondary-600">Manage employee safety training and certifications</p>
            </div>
            <Dialog open={isTrainingDialogOpen} onOpenChange={setIsTrainingDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Training
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Training Record</DialogTitle>
                </DialogHeader>
                <form onSubmit={trainingForm.handleSubmit(onTrainingSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="employeeId">Employee</Label>
                    <Select onValueChange={(value) => trainingForm.setValue('employeeId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {users?.map((user: any) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="trainingType">Training Type</Label>
                    <Select onValueChange={(value) => trainingForm.setValue('trainingType', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select training type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OSHA 10">OSHA 10</SelectItem>
                        <SelectItem value="OSHA 30">OSHA 30</SelectItem>
                        <SelectItem value="Fall Protection">Fall Protection</SelectItem>
                        <SelectItem value="First Aid">First Aid</SelectItem>
                        <SelectItem value="CPR">CPR</SelectItem>
                        <SelectItem value="Hazmat">Hazmat</SelectItem>
                        <SelectItem value="Confined Space">Confined Space</SelectItem>
                        <SelectItem value="Scaffolding">Scaffolding</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="completedDate">Completed Date</Label>
                      <Input
                        id="completedDate"
                        type="date"
                        {...trainingForm.register('completedDate')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="expirationDate">Expiration Date</Label>
                      <Input
                        id="expirationDate"
                        type="date"
                        {...trainingForm.register('expirationDate')}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="certificateUrl">Certificate URL</Label>
                    <Input
                      id="certificateUrl"
                      {...trainingForm.register('certificateUrl')}
                      placeholder="Link to certificate document"
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsTrainingDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createTrainingMutation.isPending}>
                      {createTrainingMutation.isPending ? 'Adding...' : 'Add Training'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Training Records</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Employee</th>
                      <th className="text-left py-3 px-4">Training Type</th>
                      <th className="text-left py-3 px-4">Completed</th>
                      <th className="text-left py-3 px-4">Expires</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Certificate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {training?.map((record: any) => {
                      const employee = getUserById(record.employeeId);
                      const isExpired = record.expirationDate && new Date(record.expirationDate) < new Date();
                      const status = isExpired ? 'EXPIRED' : record.status;
                      
                      return (
                        <tr key={record.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-secondary-200 rounded-full flex items-center justify-center mr-3">
                                <span className="text-xs font-medium">
                                  {employee?.firstName?.[0]}{employee?.lastName?.[0]}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium">{employee?.firstName} {employee?.lastName}</div>
                                <div className="text-sm text-secondary-500">{employee?.position}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">{record.trainingType}</td>
                          <td className="py-3 px-4">
                            {new Date(record.completedDate).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            {record.expirationDate 
                              ? new Date(record.expirationDate).toLocaleDateString()
                              : 'No expiration'
                            }
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={getStatusColor(status)}>
                              {status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {record.certificateUrl ? (
                              <Button variant="outline" size="sm" asChild>
                                <a href={record.certificateUrl} target="_blank" rel="noopener noreferrer">
                                  <FileText className="w-4 h-4 mr-2" />
                                  View
                                </a>
                              </Button>
                            ) : (
                              <span className="text-gray-500">No certificate</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Safety;
