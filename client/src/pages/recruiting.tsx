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
import { UserPlus, Calendar, Eye, MessageSquare, Plus, Users, Briefcase } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const candidateSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  position: z.string().min(1),
  resumeUrl: z.string().optional(),
  notes: z.string().optional(),
});

const interviewSchema = z.object({
  candidateId: z.string().min(1),
  scheduledDate: z.string().min(1),
  type: z.enum(['PHONE', 'VIDEO', 'IN_PERSON']),
  notes: z.string().optional(),
});

const newHireSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(1, 'Phone number is required'),
  position: z.string().min(1, 'Position is required'),
  department: z.string().min(1, 'Department is required'),
  startDate: z.string().min(1, 'Start date is required'),
  salary: z.string().min(1, 'Salary is required'),
  reportingTo: z.string().optional(),
  notes: z.string().optional(),
});

type CandidateFormData = z.infer<typeof candidateSchema>;
type InterviewFormData = z.infer<typeof interviewSchema>;
type NewHireFormData = z.infer<typeof newHireSchema>;

function Recruiting() {
  const [isCandidateDialogOpen, setIsCandidateDialogOpen] = useState(false);
  const [isInterviewDialogOpen, setIsInterviewDialogOpen] = useState(false);
  const [isNewHireDialogOpen, setIsNewHireDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: candidates, isLoading: candidatesLoading } = useQuery({
    queryKey: ['/api/candidates'],
    queryFn: async () => {
      const response = await fetch('/api/candidates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch candidates');
      return response.json();
    }
  });

  const { data: interviews, isLoading: interviewsLoading } = useQuery({
    queryKey: ['/api/interviews'],
    queryFn: async () => {
      const response = await fetch('/api/interviews', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch interviews');
      return response.json();
    }
  });

  const candidateForm = useForm<CandidateFormData>({
    resolver: zodResolver(candidateSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      resumeUrl: '',
      notes: '',
    }
  });

  const interviewForm = useForm<InterviewFormData>({
    resolver: zodResolver(interviewSchema),
    defaultValues: {
      candidateId: '',
      scheduledDate: '',
      type: 'PHONE',
      notes: '',
    }
  });

  const newHireForm = useForm<NewHireFormData>({
    resolver: zodResolver(newHireSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      startDate: new Date().toISOString().split('T')[0],
      salary: '',
      reportingTo: '',
      notes: '',
    }
  });

  const createCandidateMutation = useMutation({
    mutationFn: async (data: CandidateFormData) => {
      const response = await fetch('/api/candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create candidate');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      setIsCandidateDialogOpen(false);
      candidateForm.reset();
      toast({
        title: 'Success',
        description: 'Candidate added successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to add candidate',
        variant: 'destructive'
      });
    }
  });

  const createInterviewMutation = useMutation({
    mutationFn: async (data: InterviewFormData) => {
      const response = await fetch('/api/interviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...data,
          interviewerId: localStorage.getItem('userId') || '', // Should get from auth context
        })
      });
      if (!response.ok) throw new Error('Failed to create interview');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/interviews'] });
      setIsInterviewDialogOpen(false);
      interviewForm.reset();
      toast({
        title: 'Success',
        description: 'Interview scheduled successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to schedule interview',
        variant: 'destructive'
      });
    }
  });

  const updateCandidateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<any> }) => {
      const response = await fetch(`/api/candidates/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update candidate');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      toast({
        title: 'Success',
        description: 'Candidate updated successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to update candidate',
        variant: 'destructive'
      });
    }
  });

  const onCandidateSubmit = (data: CandidateFormData) => {
    createCandidateMutation.mutate(data);
  };

  const onInterviewSubmit = (data: InterviewFormData) => {
    createInterviewMutation.mutate(data);
  };

  const createNewHireMutation = useMutation({
    mutationFn: async (data: NewHireFormData) => {
      const response = await fetch('/api/employees/direct-hire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create new hire');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      setIsNewHireDialogOpen(false);
      newHireForm.reset();
      toast({
        title: 'Success',
        description: 'New hire added successfully. Welcome email and onboarding initiated.'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to add new hire',
        variant: 'destructive'
      });
    }
  });

  const onNewHireSubmit = (data: NewHireFormData) => {
    createNewHireMutation.mutate(data);
  };

  const handleStatusChange = (candidateId: string, newStatus: string) => {
    updateCandidateMutation.mutate({
      id: candidateId,
      data: { status: newStatus }
    });
  };

  const getCandidateById = (id: string) => {
    return candidates?.find((candidate: any) => candidate.id === id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPLIED': return 'bg-blue-100 text-blue-800';
      case 'SCREENING': return 'bg-yellow-100 text-yellow-800';
      case 'INTERVIEW': return 'bg-purple-100 text-purple-800';
      case 'OFFER': return 'bg-green-100 text-green-800';
      case 'HIRED': return 'bg-emerald-100 text-emerald-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInterviewTypeColor = (type: string) => {
    switch (type) {
      case 'PHONE': return 'bg-blue-100 text-blue-800';
      case 'VIDEO': return 'bg-purple-100 text-purple-800';
      case 'IN_PERSON': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getInterviewStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800';
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'RESCHEDULED': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isLoading = candidatesLoading || interviewsLoading;

  if (isLoading) {
    return <div className="p-8">Loading recruiting data...</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-secondary-950">Recruiting</h1>
        <p className="mt-2 text-sm text-secondary-600">
          Manage candidates and hiring pipeline
        </p>
      </div>

      <Tabs defaultValue="candidates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="candidates">
            <Users className="w-4 h-4 mr-2" />
            Candidates
          </TabsTrigger>
          <TabsTrigger value="interviews">
            <Calendar className="w-4 h-4 mr-2" />
            Interviews
          </TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Candidates</h2>
              <p className="text-sm text-secondary-600">Manage job applicants and their status</p>
            </div>
            <div className="flex gap-2">
              <Dialog open={isCandidateDialogOpen} onOpenChange={setIsCandidateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Candidate
                  </Button>
                </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Candidate</DialogTitle>
                </DialogHeader>
                <form onSubmit={candidateForm.handleSubmit(onCandidateSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        {...candidateForm.register('firstName')}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        {...candidateForm.register('lastName')}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      {...candidateForm.register('email')}
                      placeholder="Enter email address"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      {...candidateForm.register('phone')}
                      placeholder="Enter phone number"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      {...candidateForm.register('position')}
                      placeholder="Position applying for"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="resumeUrl">Resume URL</Label>
                    <Input
                      id="resumeUrl"
                      {...candidateForm.register('resumeUrl')}
                      placeholder="Link to resume document"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      {...candidateForm.register('notes')}
                      placeholder="Additional notes about the candidate"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsCandidateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createCandidateMutation.isPending}>
                      {createCandidateMutation.isPending ? 'Adding...' : 'Add Candidate'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isNewHireDialogOpen} onOpenChange={setIsNewHireDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" className="bg-green-600 hover:bg-green-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add New Hire
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Hire - Direct Employee Onboarding</DialogTitle>
                </DialogHeader>
                <form onSubmit={newHireForm.handleSubmit(onNewHireSubmit)} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      This will create an employee account directly and start the onboarding process:
                      • Send welcome email with credentials
                      • Schedule onboarding tasks
                      • Generate employment contract
                      • Assign tools & equipment
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hire-firstName">First Name *</Label>
                      <Input
                        id="hire-firstName"
                        {...newHireForm.register('firstName')}
                        placeholder="Enter first name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hire-lastName">Last Name *</Label>
                      <Input
                        id="hire-lastName"
                        {...newHireForm.register('lastName')}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hire-email">Email *</Label>
                      <Input
                        id="hire-email"
                        type="email"
                        {...newHireForm.register('email')}
                        placeholder="email@theroofdocs.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hire-phone">Phone *</Label>
                      <Input
                        id="hire-phone"
                        {...newHireForm.register('phone')}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hire-position">Position *</Label>
                      <Input
                        id="hire-position"
                        {...newHireForm.register('position')}
                        placeholder="e.g., Roofing Technician"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hire-department">Department *</Label>
                      <Select
                        value={newHireForm.watch('department')}
                        onValueChange={(value) => newHireForm.setValue('department', value)}
                      >
                        <SelectTrigger id="hire-department">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Operations">Operations</SelectItem>
                          <SelectItem value="Sales">Sales</SelectItem>
                          <SelectItem value="Service">Service</SelectItem>
                          <SelectItem value="Human Resources">Human Resources</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hire-startDate">Start Date *</Label>
                      <Input
                        id="hire-startDate"
                        type="date"
                        {...newHireForm.register('startDate')}
                      />
                    </div>
                    <div>
                      <Label htmlFor="hire-salary">Salary *</Label>
                      <Input
                        id="hire-salary"
                        {...newHireForm.register('salary')}
                        placeholder="e.g., $50,000"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="hire-reportingTo">Reporting Manager</Label>
                    <Input
                      id="hire-reportingTo"
                      {...newHireForm.register('reportingTo')}
                      placeholder="Manager's name or email"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="hire-notes">Additional Notes</Label>
                    <Textarea
                      id="hire-notes"
                      {...newHireForm.register('notes')}
                      placeholder="Any additional information about the new hire"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsNewHireDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createNewHireMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {createNewHireMutation.isPending ? 'Processing...' : 'Add New Hire & Start Onboarding'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Candidates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Candidate</th>
                      <th className="text-left py-3 px-4">Position</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Applied</th>
                      <th className="text-left py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates?.map((candidate: any) => (
                      <tr key={candidate.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-secondary-200 rounded-full flex items-center justify-center mr-3">
                              <span className="text-xs font-medium">
                                {candidate.firstName?.[0]}{candidate.lastName?.[0]}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium">{candidate.firstName} {candidate.lastName}</div>
                              <div className="text-sm text-secondary-500">{candidate.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">{candidate.position}</td>
                        <td className="py-3 px-4">
                          <Select
                            value={candidate.status}
                            onValueChange={(value) => handleStatusChange(candidate.id, value)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue>
                                <Badge className={getStatusColor(candidate.status)}>
                                  {candidate.status}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="APPLIED">Applied</SelectItem>
                              <SelectItem value="SCREENING">Screening</SelectItem>
                              <SelectItem value="INTERVIEW">Interview</SelectItem>
                              <SelectItem value="OFFER">Offer</SelectItem>
                              <SelectItem value="HIRED">Hired</SelectItem>
                              <SelectItem value="REJECTED">Rejected</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-3 px-4">
                          {new Date(candidate.appliedDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                            <Button variant="outline" size="sm">
                              <MessageSquare className="w-4 h-4 mr-1" />
                              Message
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interviews" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Interviews</h2>
              <p className="text-sm text-secondary-600">Schedule and manage candidate interviews</p>
            </div>
            <Dialog open={isInterviewDialogOpen} onOpenChange={setIsInterviewDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule Interview
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Schedule Interview</DialogTitle>
                </DialogHeader>
                <form onSubmit={interviewForm.handleSubmit(onInterviewSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="candidateId">Candidate</Label>
                    <Select onValueChange={(value) => interviewForm.setValue('candidateId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select candidate" />
                      </SelectTrigger>
                      <SelectContent>
                        {candidates?.map((candidate: any) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.firstName} {candidate.lastName} - {candidate.position}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="scheduledDate">Scheduled Date & Time</Label>
                    <Input
                      id="scheduledDate"
                      type="datetime-local"
                      {...interviewForm.register('scheduledDate')}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="type">Interview Type</Label>
                    <Select onValueChange={(value) => interviewForm.setValue('type', value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select interview type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PHONE">Phone</SelectItem>
                        <SelectItem value="VIDEO">Video</SelectItem>
                        <SelectItem value="IN_PERSON">In Person</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      {...interviewForm.register('notes')}
                      placeholder="Interview notes or preparation details"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsInterviewDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createInterviewMutation.isPending}>
                      {createInterviewMutation.isPending ? 'Scheduling...' : 'Schedule Interview'}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Scheduled Interviews</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Candidate</th>
                      <th className="text-left py-3 px-4">Date & Time</th>
                      <th className="text-left py-3 px-4">Type</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interviews?.map((interview: any) => {
                      const candidate = getCandidateById(interview.candidateId);
                      return (
                        <tr key={interview.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-secondary-200 rounded-full flex items-center justify-center mr-3">
                                <span className="text-xs font-medium">
                                  {candidate?.firstName?.[0]}{candidate?.lastName?.[0]}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium">{candidate?.firstName} {candidate?.lastName}</div>
                                <div className="text-sm text-secondary-500">{candidate?.position}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {new Date(interview.scheduledDate).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={getInterviewTypeColor(interview.type)}>
                              {interview.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={getInterviewStatusColor(interview.status)}>
                              {interview.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate">
                            {interview.notes || 'No notes'}
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

export default Recruiting;
