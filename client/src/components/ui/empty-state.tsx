import { ReactNode } from 'react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import {
  FileText,
  Users,
  Calendar,
  Briefcase,
  Inbox,
  Search,
  Plus,
  FolderOpen,
  ClipboardList,
  Bell,
  AlertCircle,
  type LucideIcon
} from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: ReactNode;
}

/**
 * Generic empty state component with customizable icon, text, and actions
 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className
      )}
    >
      <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-4">
          {description}
        </p>
      )}
      {children}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3 mt-4">
          {action && (
            <Button onClick={action.onClick}>
              <Plus className="w-4 h-4 mr-2" />
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Pre-built empty states for common scenarios

export function NoDocumentsState({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="No documents yet"
      description="Get started by uploading your first document. You can add policies, forms, handbooks, and more."
      action={onAdd ? { label: "Upload Document", onClick: onAdd } : undefined}
    />
  );
}

export function NoEmployeesState({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="No employees found"
      description="Add your first team member to get started with employee management."
      action={onAdd ? { label: "Add Employee", onClick: onAdd } : undefined}
    />
  );
}

export function NoCandidatesState({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={Briefcase}
      title="No candidates yet"
      description="Start building your talent pipeline by adding candidates or importing from job boards."
      action={onAdd ? { label: "Add Candidate", onClick: onAdd } : undefined}
    />
  );
}

export function NoPtoRequestsState() {
  return (
    <EmptyState
      icon={Calendar}
      title="No PTO requests"
      description="There are no pending time off requests to review at this time."
    />
  );
}

export function NoSearchResultsState({ query }: { query: string }) {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      description={`We couldn't find any matches for "${query}". Try adjusting your search terms.`}
    />
  );
}

export function NoNotificationsState() {
  return (
    <EmptyState
      icon={Bell}
      title="All caught up!"
      description="You have no new notifications. Check back later for updates."
    />
  );
}

export function NoContractsState({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={ClipboardList}
      title="No contracts yet"
      description="Create your first contract or template to streamline your hiring process."
      action={onAdd ? { label: "Create Contract", onClick: onAdd } : undefined}
    />
  );
}

export function EmptyFolderState() {
  return (
    <EmptyState
      icon={FolderOpen}
      title="This folder is empty"
      description="Upload files or create subfolders to organize your documents."
    />
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We encountered an error loading this content. Please try again.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      description={description}
      action={onRetry ? { label: "Try Again", onClick: onRetry } : undefined}
    />
  );
}

export function NoInterviewsState({ onSchedule }: { onSchedule?: () => void }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No interviews scheduled"
      description="Schedule interviews with candidates to continue the hiring process."
      action={onSchedule ? { label: "Schedule Interview", onClick: onSchedule } : undefined}
    />
  );
}

export function NoReviewsState({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={ClipboardList}
      title="No reviews yet"
      description="Start performance reviews to track employee growth and development."
      action={onAdd ? { label: "Start Review", onClick: onAdd } : undefined}
    />
  );
}
