import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import {
  CheckCircle,
  Circle,
  AlertTriangle,
  FileText,
  Package,
  Clock,
  ClipboardCheck,
  ExternalLink
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OnboardingStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  type: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  dueDate?: string;
  completedAt?: string;
  completedBy?: string;
  completedByRole?: 'EMPLOYEE' | 'MANAGER';
  documentId?: string;
  documentRequired?: boolean;
  documentViewed?: boolean;
  equipmentBundleId?: string;
  isOverdue?: boolean;
}

interface OnboardingInstance {
  id: string;
  type: 'workflow' | 'instance';
  templateId?: string;
  template?: { name: string; department?: string };
  status: string;
  startDate: string;
  completedAt?: string;
  steps: OnboardingStep[];
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

export function OnboardingTaskList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: onboardingList = [], isLoading, error } = useQuery<OnboardingInstance[]>({
    queryKey: ['/api/employee-portal/onboarding'],
    queryFn: () => apiRequest<OnboardingInstance[]>('/api/employee-portal/onboarding', 'GET'),
  });

  const completeMutation = useMutation({
    mutationFn: (stepId: string) =>
      apiRequest(`/api/onboarding-steps/${stepId}/complete`, 'PUT'),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/onboarding'] });
      toast({
        title: 'Task Completed',
        description: data.progress?.allCompleted
          ? 'Congratulations! You have completed all onboarding tasks!'
          : 'Great progress! Keep it up.',
      });
    },
    onError: (error: any) => {
      if (error.requiresDocument) {
        toast({
          title: 'Document Required',
          description: 'Please view the required document before completing this task.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error.message || 'Failed to complete task',
          variant: 'destructive',
        });
      }
    },
  });

  const markDocumentViewedMutation = useMutation({
    mutationFn: (stepId: string) =>
      apiRequest(`/api/onboarding-steps/${stepId}/mark-document-viewed`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/onboarding'] });
      toast({
        title: 'Document Viewed',
        description: 'You can now complete this task.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to mark document as viewed',
        variant: 'destructive',
      });
    },
  });

  const handleCompleteTask = (step: OnboardingStep) => {
    if (step.status === 'COMPLETED') return;

    if (step.documentRequired && !step.documentViewed) {
      toast({
        title: 'Document Required',
        description: 'Please view the required document before completing this task.',
        variant: 'destructive',
      });
      return;
    }

    completeMutation.mutate(step.id);
  };

  const handleViewDocument = (step: OnboardingStep) => {
    if (step.documentId) {
      // Open document in new tab
      window.open(`/documents?id=${step.documentId}`, '_blank');
      // Mark as viewed
      markDocumentViewedMutation.mutate(step.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your onboarding tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Failed to load onboarding tasks</p>
      </div>
    );
  }

  if (onboardingList.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardCheck className="w-12 h-12 text-green-500 mx-auto mb-4" />
        <h3 className="font-semibold text-lg mb-2">All Done!</h3>
        <p className="text-muted-foreground">You have no pending onboarding tasks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {onboardingList.map((instance) => (
        <div key={instance.id} className="border rounded-lg p-4 bg-card">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-semibold text-lg">
                {instance.template?.name || 'Onboarding Checklist'}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Clock className="w-4 h-4" />
                <span>Started {format(new Date(instance.startDate), 'MMM d, yyyy')}</span>
                {instance.template?.department && (
                  <>
                    <span>•</span>
                    <Badge variant="outline">{instance.template.department}</Badge>
                  </>
                )}
              </div>
            </div>
            <Badge
              variant={instance.progress.percentage === 100 ? 'default' : 'secondary'}
              className="text-sm"
            >
              {instance.progress.completed} / {instance.progress.total} complete
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <Progress value={instance.progress.percentage} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {instance.progress.percentage}% complete
            </p>
          </div>

          {/* Tasks */}
          <div className="space-y-2">
            {instance.steps.map((step) => {
              const isCompleted = step.status === 'COMPLETED';
              const needsDocument = step.documentRequired && !step.documentViewed && !isCompleted;

              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    step.isOverdue
                      ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20'
                      : isCompleted
                        ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20'
                        : 'border-border bg-background hover:bg-muted/50'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="pt-0.5">
                    <Checkbox
                      checked={isCompleted}
                      disabled={isCompleted || completeMutation.isPending || needsDocument}
                      onCheckedChange={() => handleCompleteTask(step)}
                      className={isCompleted ? 'bg-green-500 border-green-500' : ''}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                        {step.title}
                      </span>

                      {step.isOverdue && !isCompleted && (
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Overdue
                        </Badge>
                      )}

                      {step.documentId && (
                        <FileText className="w-4 h-4 text-blue-500" />
                      )}

                      {step.equipmentBundleId && (
                        <Package className="w-4 h-4 text-green-500" />
                      )}
                    </div>

                    {step.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {step.description}
                      </p>
                    )}

                    {/* Due Date */}
                    {step.dueDate && (
                      <p className={`text-xs mt-2 ${step.isOverdue && !isCompleted ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        Due: {format(new Date(step.dueDate), 'MMM d, yyyy')}
                      </p>
                    )}

                    {/* Document Required Notice */}
                    {needsDocument && step.documentId && (
                      <Button
                        size="sm"
                        variant="link"
                        className="p-0 h-auto mt-2 text-blue-600"
                        onClick={() => handleViewDocument(step)}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View required document first
                      </Button>
                    )}

                    {/* Completion Info */}
                    {isCompleted && step.completedAt && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Completed {format(new Date(step.completedAt), 'MMM d, yyyy')}
                        {step.completedByRole === 'MANAGER' && ' (by manager)'}
                      </p>
                    )}
                  </div>

                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : step.isOverdue ? (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
