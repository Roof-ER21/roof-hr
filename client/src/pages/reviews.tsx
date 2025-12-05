import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Star, FileText, Calendar, User, Clock, Plus, ChevronRight, Zap, Settings, Bell, Play, Pause } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import AICriteriaConfig from './ai-criteria-config';
import { format } from 'date-fns';

interface EmployeeReview {
  id: string;
  revieweeId: string;
  reviewerId: string;
  reviewPeriod: string;
  reviewType: 'QUARTERLY' | 'ANNUAL' | 'PROBATION' | 'PROJECT' | 'IMPROVEMENT';
  status: 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'ACKNOWLEDGED';
  overallRating?: number;
  performanceScore?: number;
  teamworkScore?: number;
  communicationScore?: number;
  technicalScore?: number;
  strengths?: string;
  areasForImprovement?: string;
  goals?: string;
  comments?: string;
  revieweeComments?: string;
  acknowledgedAt?: string;
  submittedAt?: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

const createReviewSchema = z.object({
  revieweeId: z.string().min(1, 'Please select an employee'),
  reviewPeriod: z.string().min(1, 'Please enter review period'),
  reviewType: z.enum(['QUARTERLY', 'ANNUAL', 'PROBATION', 'PROJECT', 'IMPROVEMENT']),
  dueDate: z.string().min(1, 'Please select due date'),
});

type CreateReviewForm = z.infer<typeof createReviewSchema>;

const reviewFormSchema = z.object({
  overallRating: z.number().min(1).max(5),
  performanceScore: z.number().min(1).max(5),
  teamworkScore: z.number().min(1).max(5),
  communicationScore: z.number().min(1).max(5),
  technicalScore: z.number().min(1).max(5),
  strengths: z.string().min(1, 'Please describe strengths'),
  areasForImprovement: z.string().min(1, 'Please describe areas for improvement'),
  goals: z.string().min(1, 'Please set goals'),
  comments: z.string().optional(),
});

type ReviewFormData = z.infer<typeof reviewFormSchema>;

export default function Reviews() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<EmployeeReview | null>(null);
  const [showAutomationDialog, setShowAutomationDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'reviews' | 'automation' | 'templates'>('reviews');

  const { data: reviews = [], isLoading } = useQuery<EmployeeReview[]>({
    queryKey: ['/api/reviews'],
  });

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['/api/performance-templates'],
    enabled: activeTab === 'templates' && (user?.role === 'ADMIN' || user?.role === 'MANAGER'),
  });

  const { data: automatedReviews = [] } = useQuery({
    queryKey: ['/api/automated-reviews'],
    enabled: activeTab === 'automation' && (user?.role === 'ADMIN' || user?.role === 'MANAGER'),
  });

  const { data: aiCriteria = [] } = useQuery({
    queryKey: ['/api/ai-criteria'],
    enabled: activeTab === 'automation' && (user?.role === 'ADMIN' || user?.role === 'MANAGER'),
  });

  const createForm = useForm<CreateReviewForm>({
    resolver: zodResolver(createReviewSchema),
    defaultValues: {
      revieweeId: '',
      reviewPeriod: '',
      reviewType: 'QUARTERLY',
      dueDate: '',
    },
  });

  const reviewForm = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      overallRating: 3,
      performanceScore: 3,
      teamworkScore: 3,
      communicationScore: 3,
      technicalScore: 3,
      strengths: '',
      areasForImprovement: '',
      goals: '',
      comments: '',
    },
  });

  const createReviewMutation = useMutation({
    mutationFn: async (data: CreateReviewForm) => {
      return apiRequest('/api/reviews', 'POST', {
        ...data,
        reviewerId: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reviews'] });
      toast({
        title: 'Success',
        description: 'Review created successfully',
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create review',
        variant: 'destructive',
      });
    },
  });

  const updateReviewMutation = useMutation({
    mutationFn: async ({ reviewId, data }: { reviewId: string; data: ReviewFormData }) => {
      return apiRequest(`/api/reviews/${reviewId}`, 'PATCH', {
        ...data,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reviews'] });
      toast({
        title: 'Success',
        description: 'Review submitted successfully',
      });
      setSelectedReview(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit review',
        variant: 'destructive',
      });
    },
  });

  const acknowledgeReview = useMutation({
    mutationFn: async (reviewId: string) => {
      return apiRequest(`/api/reviews/${reviewId}/acknowledge`, 'PATCH', {
        acknowledgedAt: new Date(),
        status: 'ACKNOWLEDGED'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/reviews'] });
      toast({
        title: 'Success',
        description: 'Review acknowledged successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to acknowledge review',
        variant: 'destructive',
      });
    },
  });

  const getUserById = (userId: string) => {
    return users.find((u: any) => u.id === userId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'SUBMITTED':
        return 'bg-green-100 text-green-800';
      case 'ACKNOWLEDGED':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'QUARTERLY':
        return 'Quarterly Review';
      case 'ANNUAL':
        return 'Annual Review';
      case 'PROBATION':
        return 'Probation Review';
      case 'PROJECT':
        return 'Project Review';
      case 'IMPROVEMENT':
        return 'Performance Improvement';
      default:
        return type;
    }
  };

  const myReviews = reviews.filter(r => r.revieweeId === user?.id);
  const reviewsToConduct = reviews.filter(r => r.reviewerId === user?.id);

  const StarRating = ({ value, onChange, readOnly = false }: { value: number; onChange?: (v: number) => void; readOnly?: boolean }) => {
    return (
      <div className="flex space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            className={`${readOnly ? 'cursor-default' : 'cursor-pointer'} transition-colors`}
          >
            <Star
              className={`w-5 h-5 ${
                star <= value
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-gray-200 text-gray-200'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-secondary-950">Employee Reviews</h1>
          <p className="text-secondary-600 mt-1">Manage performance reviews and feedback</p>
        </div>
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create Review
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Review</DialogTitle>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit((data) => createReviewMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="revieweeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {users.filter((u: any) => u.id !== user?.id).map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.firstName} {u.lastName} - {u.position}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="reviewType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Review Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="QUARTERLY">Quarterly Review</SelectItem>
                            <SelectItem value="ANNUAL">Annual Review</SelectItem>
                            <SelectItem value="PROBATION">Probation Review</SelectItem>
                            <SelectItem value="PROJECT">Project Review</SelectItem>
                            <SelectItem value="IMPROVEMENT">Performance Improvement</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="reviewPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Review Period</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Q1 2024" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} min={new Date().toISOString().split('T')[0]} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createReviewMutation.isPending}>
                      Create Review
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
          <TabsTrigger value="templates">AI Criteria</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-4">
          <Tabs defaultValue="my-reviews" className="w-full">
            <TabsList>
              <TabsTrigger value="my-reviews">My Reviews ({myReviews.length})</TabsTrigger>
              {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                <TabsTrigger value="to-conduct">To Conduct ({reviewsToConduct.length})</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="my-reviews" className="space-y-4">
          {myReviews.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No reviews found</p>
              </CardContent>
            </Card>
          ) : (
            myReviews.map((review) => {
              const reviewer = getUserById(review.reviewerId);
              return (
                <Card key={review.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{getTypeLabel(review.reviewType)}</CardTitle>
                        <p className="text-sm text-secondary-600 mt-1">
                          Period: {review.reviewPeriod} • Reviewer: {reviewer?.firstName} {reviewer?.lastName}
                        </p>
                      </div>
                      <Badge className={getStatusColor(review.status)}>
                        {review.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {review.status === 'SUBMITTED' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div>
                            <p className="text-sm font-medium">Overall</p>
                            <StarRating value={review.overallRating || 0} readOnly />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Performance</p>
                            <StarRating value={review.performanceScore || 0} readOnly />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Teamwork</p>
                            <StarRating value={review.teamworkScore || 0} readOnly />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Communication</p>
                            <StarRating value={review.communicationScore || 0} readOnly />
                          </div>
                          <div>
                            <p className="text-sm font-medium">Technical</p>
                            <StarRating value={review.technicalScore || 0} readOnly />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <p className="font-medium text-sm">Strengths</p>
                            <p className="text-sm text-secondary-700">{review.strengths}</p>
                          </div>
                          <div>
                            <p className="font-medium text-sm">Areas for Improvement</p>
                            <p className="text-sm text-secondary-700">{review.areasForImprovement}</p>
                          </div>
                          <div>
                            <p className="font-medium text-sm">Goals</p>
                            <p className="text-sm text-secondary-700">{review.goals}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center text-sm text-secondary-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        Due: {format(new Date(review.dueDate), 'MMM dd, yyyy')}
                      </div>
                      {review.status === 'SUBMITTED' && !review.acknowledgedAt && (
                        <Button 
                          size="sm"
                          onClick={() => acknowledgeReview.mutate(review.id)}
                          disabled={acknowledgeReview.isPending}
                        >
                          {acknowledgeReview.isPending ? 'Acknowledging...' : 'Acknowledge Review'}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

            <TabsContent value="to-conduct" className="space-y-4">
              {reviewsToConduct.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No reviews to conduct</p>
              </CardContent>
            </Card>
          ) : (
            reviewsToConduct.map((review) => {
              const reviewee = getUserById(review.revieweeId);
              return (
                <Card key={review.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center">
                          <User className="w-4 h-4 mr-2" />
                          {reviewee?.firstName} {reviewee?.lastName}
                        </CardTitle>
                        <p className="text-sm text-secondary-600 mt-1">
                          {reviewee?.position} • {getTypeLabel(review.reviewType)} • {review.reviewPeriod}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(review.status)}>
                          {review.status}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-secondary-600">
                        <Calendar className="w-4 h-4 mr-1" />
                        Due: {format(new Date(review.dueDate), 'MMM dd, yyyy')}
                      </div>
                      {review.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          onClick={() => setSelectedReview(review)}
                        >
                          Start Review
                        </Button>
                      )}
                      {review.status === 'IN_PROGRESS' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedReview(review)}
                        >
                          Continue Review
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
            </TabsContent>
          </Tabs>
        </TabsContent>

      {/* Review Form Dialog */}
      {selectedReview && (
        <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {getTypeLabel(selectedReview.reviewType)} - {getUserById(selectedReview.revieweeId)?.firstName} {getUserById(selectedReview.revieweeId)?.lastName}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="h-[70vh]">
              <Form {...reviewForm}>
                <form onSubmit={reviewForm.handleSubmit((data) => updateReviewMutation.mutate({ reviewId: selectedReview.id, data }))} className="space-y-6 p-1">
                  <div className="space-y-4">
                    <FormField
                      control={reviewForm.control}
                      name="overallRating"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Overall Rating</FormLabel>
                          <FormControl>
                            <StarRating value={field.value} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={reviewForm.control}
                        name="performanceScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Performance</FormLabel>
                            <FormControl>
                              <StarRating value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={reviewForm.control}
                        name="teamworkScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Teamwork</FormLabel>
                            <FormControl>
                              <StarRating value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={reviewForm.control}
                        name="communicationScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Communication</FormLabel>
                            <FormControl>
                              <StarRating value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={reviewForm.control}
                        name="technicalScore"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Technical Skills</FormLabel>
                            <FormControl>
                              <StarRating value={field.value} onChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={reviewForm.control}
                      name="strengths"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Strengths</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe the employee's key strengths..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={reviewForm.control}
                      name="areasForImprovement"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Areas for Improvement</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Identify areas where the employee can improve..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={reviewForm.control}
                      name="goals"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Goals for Next Period</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Set specific goals for the next review period..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={reviewForm.control}
                      name="comments"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Additional Comments (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any additional feedback or comments..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setSelectedReview(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={updateReviewMutation.isPending}>
                      Submit Review
                    </Button>
                  </div>
                </form>
              </Form>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}

      {/* Automation Tab Content - Moved from separate automation page */}
      {activeTab === 'automation' && (
        <div className="grid gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Performance Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {templates.length === 0 ? (
                  <div className="text-center py-8">
                    <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Found</h3>
                    <p className="text-gray-600">Create templates to standardize review processes.</p>
                  </div>
                ) : (
                  templates.map((template: any) => (
                    <div key={template.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                          <Badge className="mt-2">{template.type}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Play className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Automated Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {automatedReviews.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Automated Reviews</h3>
                    <p className="text-gray-600">Schedule automatic reviews to streamline the process.</p>
                  </div>
                ) : (
                  automatedReviews.map((review: any) => (
                    <div key={review.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">
                            {getUserById(review.employeeId)?.firstName} {getUserById(review.employeeId)?.lastName}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Reviewer: {getUserById(review.reviewerId)?.firstName} {getUserById(review.reviewerId)?.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            Scheduled: {new Date(review.scheduledDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Pause className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      </Tabs>

      {/* Automation Tab Content - Moved from separate automation page */}
      {activeTab === 'automation' && (
        <div className="grid gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Performance Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {templates.length === 0 ? (
                  <div className="text-center py-8">
                    <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Found</h3>
                    <p className="text-gray-600">Create templates to standardize review processes.</p>
                  </div>
                ) : (
                  templates.map((template: any) => (
                    <div key={template.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{template.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                          <Badge className="mt-2">{template.type}</Badge>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Play className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Automated Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {automatedReviews.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Automated Reviews</h3>
                    <p className="text-gray-600">Schedule automatic reviews to streamline the process.</p>
                  </div>
                ) : (
                  automatedReviews.map((review: any) => (
                    <div key={review.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">
                            {getUserById(review.employeeId)?.firstName} {getUserById(review.employeeId)?.lastName}
                          </h4>
                          <p className="text-sm text-gray-600">
                            Reviewer: {getUserById(review.reviewerId)?.firstName} {getUserById(review.reviewerId)?.lastName}
                          </p>
                          <p className="text-sm text-gray-500">
                            Scheduled: {new Date(review.scheduledDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            <Pause className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Criteria Tab Content */}
      {activeTab === 'templates' && (
        <div className="mt-6">
          <AICriteriaConfig />
        </div>
      )}
    </div>
  );
}