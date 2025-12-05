import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare,
  CheckCircle,
  AlertCircle,
  User,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Interview {
  id: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  position: string;
  scheduledDate: string;
  type: string;
  duration: number;
  status: string;
}

interface InterviewFeedbackFormProps {
  interview: Interview;
  onSubmitted?: () => void;
}

const feedbackSchema = z.object({
  interviewId: z.string(),
  interviewerId: z.string(),
  technicalSkills: z.number().min(1).max(5),
  communication: z.number().min(1).max(5),
  problemSolving: z.number().min(1).max(5),
  culturalFit: z.number().min(1).max(5),
  overallRating: z.number().min(1).max(5),
  strengths: z.string().min(10, 'Please provide detailed feedback'),
  concerns: z.string().min(10, 'Please provide detailed feedback'),
  recommendation: z.enum(['HIRE', 'NO_HIRE', 'UNDECIDED']),
  additionalNotes: z.string().optional(),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

const StarRating = ({ 
  value, 
  onChange, 
  label 
}: { 
  value: number; 
  onChange: (value: number) => void; 
  label: string;
}) => {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`h-6 w-6 ${
              star <= value 
                ? 'text-yellow-400 fill-current' 
                : 'text-gray-300 hover:text-yellow-200'
            } transition-colors`}
          >
            <Star className="h-full w-full" />
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        {value === 1 && 'Poor'}
        {value === 2 && 'Below Average'}
        {value === 3 && 'Average'}
        {value === 4 && 'Good'}
        {value === 5 && 'Excellent'}
      </p>
    </div>
  );
};

export function InterviewFeedbackForm({ interview, onSubmitted }: InterviewFeedbackFormProps) {
  const { toast } = useToast();

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      interviewId: interview.id,
      interviewerId: '', // Will be set from auth context
      technicalSkills: 3,
      communication: 3,
      problemSolving: 3,
      culturalFit: 3,
      overallRating: 3,
      strengths: '',
      concerns: '',
      recommendation: 'UNDECIDED',
      additionalNotes: '',
    },
  });

  const submitFeedbackMutation = useMutation({
    mutationFn: (data: FeedbackFormData) => 
      apiRequest('/api/interviews/feedback', 'POST', data),
    onSuccess: () => {
      toast({
        title: 'Feedback Submitted',
        description: 'Interview feedback has been successfully recorded',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/interviews'] });
      if (onSubmitted) onSubmitted();
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to submit feedback',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: FeedbackFormData) => {
    submitFeedbackMutation.mutate(data);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'HIRE': return 'bg-green-100 text-green-800';
      case 'NO_HIRE': return 'bg-red-100 text-red-800';
      case 'UNDECIDED': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const watchedRecommendation = form.watch('recommendation');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Interview Feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Interview Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
          <div>
            <Label className="text-sm font-medium text-gray-600">Candidate</Label>
            <p className="font-medium">{interview.candidateName}</p>
            <p className="text-sm text-gray-600">{interview.candidateEmail}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Position</Label>
            <p className="font-medium">{interview.position}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Interview Date</Label>
            <p className="font-medium">{formatDate(interview.scheduledDate)}</p>
          </div>
          <div>
            <Label className="text-sm font-medium text-gray-600">Type & Duration</Label>
            <p className="font-medium">{interview.type} - {interview.duration} minutes</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Rating Categories */}
            <div className="space-y-6">
              <h3 className="text-lg font-medium">Performance Ratings</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="technicalSkills"
                  render={({ field }) => (
                    <FormItem>
                      <StarRating
                        value={field.value}
                        onChange={field.onChange}
                        label="Technical Skills"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="communication"
                  render={({ field }) => (
                    <FormItem>
                      <StarRating
                        value={field.value}
                        onChange={field.onChange}
                        label="Communication"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="problemSolving"
                  render={({ field }) => (
                    <FormItem>
                      <StarRating
                        value={field.value}
                        onChange={field.onChange}
                        label="Problem Solving"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="culturalFit"
                  render={({ field }) => (
                    <FormItem>
                      <StarRating
                        value={field.value}
                        onChange={field.onChange}
                        label="Cultural Fit"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <FormField
                control={form.control}
                name="overallRating"
                render={({ field }) => (
                  <FormItem>
                    <StarRating
                      value={field.value}
                      onChange={field.onChange}
                      label="Overall Rating"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Detailed Feedback */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Detailed Feedback</h3>
              
              <FormField
                control={form.control}
                name="strengths"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Candidate Strengths</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What were the candidate's main strengths during the interview? Include specific examples..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="concerns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Areas of Concern</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What concerns or areas for improvement did you identify? Be specific..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="additionalNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Notes</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any additional observations, follow-up actions, or comments..."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Recommendation */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="recommendation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hiring Recommendation</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select recommendation" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="HIRE">
                          <div className="flex items-center gap-2">
                            <ThumbsUp className="h-4 w-4 text-green-600" />
                            Recommend to Hire
                          </div>
                        </SelectItem>
                        <SelectItem value="NO_HIRE">
                          <div className="flex items-center gap-2">
                            <ThumbsDown className="h-4 w-4 text-red-600" />
                            Do Not Recommend
                          </div>
                        </SelectItem>
                        <SelectItem value="UNDECIDED">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                            Need More Information
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="p-4 rounded-lg border">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getRecommendationColor(watchedRecommendation)}>
                    {watchedRecommendation === 'HIRE' && 'Recommend to Hire'}
                    {watchedRecommendation === 'NO_HIRE' && 'Do Not Recommend'}
                    {watchedRecommendation === 'UNDECIDED' && 'Need More Information'}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  {watchedRecommendation === 'HIRE' && 'You believe this candidate would be a good fit for the position and team.'}
                  {watchedRecommendation === 'NO_HIRE' && 'You do not recommend this candidate for the position at this time.'}
                  {watchedRecommendation === 'UNDECIDED' && 'You need additional information or interviews before making a recommendation.'}
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="submit"
                disabled={submitFeedbackMutation.isPending}
                className="min-w-[150px]"
              >
                {submitFeedbackMutation.isPending ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}