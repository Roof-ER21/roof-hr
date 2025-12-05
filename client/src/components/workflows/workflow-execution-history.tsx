import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, CheckCircle, XCircle, Clock, User, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface WorkflowExecutionHistoryProps {
  workflowId: string;
}

export function WorkflowExecutionHistory({ workflowId }: WorkflowExecutionHistoryProps) {
  const { data: executions = [], isLoading } = useQuery({
    queryKey: [`/api/workflows/${workflowId}/executions`],
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'RUNNING':
        return <Play className="h-4 w-4 text-blue-600 animate-pulse" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      RUNNING: 'bg-blue-100 text-blue-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
    };
    return <Badge className={colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>{status}</Badge>;
  };

  const getTriggerBadge = (source: string) => {
    const colors = {
      MANUAL: 'bg-purple-100 text-purple-800',
      AUTO: 'bg-indigo-100 text-indigo-800',
      SCHEDULED: 'bg-orange-100 text-orange-800',
      STAGE_CHANGE: 'bg-blue-100 text-blue-800',
    };
    return <Badge variant="outline" className={colors[source as keyof typeof colors] || ''}>{source}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading execution history...
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Executions Yet</h3>
        <p className="text-muted-foreground">
          This workflow hasn't been executed. It will run automatically when triggered 
          or you can run it manually using the "Run Now" button.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
          <p className="text-sm font-medium text-blue-900">
            Execution History ({executions.length} total)
          </p>
          <p className="text-xs text-blue-700">
            Shows all past runs of this workflow with their status and trigger source
          </p>
        </div>
        
        {executions.map((execution: any) => (
          <div key={execution.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(execution.status)}
                <span className="font-medium">
                  Execution #{execution.id.slice(-8)}
                </span>
                {getStatusBadge(execution.status)}
              </div>
              {getTriggerBadge(execution.triggerSource)}
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
              <div>
                <span className="text-muted-foreground">Started:</span>
                <p className="font-medium">
                  {execution.startedAt ? format(new Date(execution.startedAt), 'MMM d, yyyy h:mm a') : 'N/A'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Completed:</span>
                <p className="font-medium">
                  {execution.completedAt ? format(new Date(execution.completedAt), 'MMM d, yyyy h:mm a') : 'In Progress'}
                </p>
              </div>
            </div>
            
            {execution.triggeredBy && (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <User className="h-3 w-3" />
                <span>Triggered by: {execution.triggeredBy}</span>
              </div>
            )}
            
            {execution.context && (
              <div className="mt-3 p-2 bg-muted rounded text-xs">
                <span className="font-medium">Context:</span>
                <pre className="mt-1 whitespace-pre-wrap">
                  {typeof execution.context === 'string' 
                    ? JSON.stringify(JSON.parse(execution.context), null, 2).slice(0, 200)
                    : JSON.stringify(execution.context, null, 2).slice(0, 200)}
                  {(typeof execution.context === 'string' ? execution.context : JSON.stringify(execution.context)).length > 200 && '...'}
                </pre>
              </div>
            )}
            
            {execution.error && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                <span className="font-medium">Error:</span> {execution.error}
              </div>
            )}
            
            {execution.status === 'COMPLETED' && execution.stepsCompleted && (
              <div className="mt-2 text-sm text-green-600">
                ✓ {execution.stepsCompleted} steps completed successfully
              </div>
            )}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}