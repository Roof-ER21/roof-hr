import { useDraggable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Mail,
  Calendar,
  MoreVertical,
  Brain,
  Move,
  FileText
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Position colors for visual identification (with dark mode support)
const POSITION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Insurance Sales': {
    bg: 'bg-red-100 dark:bg-red-900/40',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-400 dark:border-red-500'
  },
  'Retail Closer': {
    bg: 'bg-green-100 dark:bg-green-900/40',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-400 dark:border-green-500'
  },
  'Retail Marketing': {
    bg: 'bg-purple-100 dark:bg-purple-900/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-400 dark:border-purple-500'
  },
  'Office': {
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-400 dark:border-orange-500'
  },
  'Production Coordinator': {
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-400 dark:border-blue-500'
  },
  'Field Tech': {
    bg: 'bg-cyan-100 dark:bg-cyan-900/40',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-400 dark:border-cyan-500'
  },
};

function getPositionColor(position: string) {
  return POSITION_COLORS[position] || {
    bg: 'bg-gray-100 dark:bg-gray-800/40',
    text: 'text-gray-700 dark:text-gray-300',
    border: 'border-gray-400 dark:border-gray-500'
  };
}

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position: string;
  location?: string;
  source: string;
  status: string;
  appliedAt: string;
  experience?: string;
  skills?: string[];
  notes?: string;
  aiMatchScore?: number;
  aiPotentialScore?: number;
  assignedTo?: string | null;
  sourcer?: {
    id: string;
    firstName: string;
    lastName: string;
    screenerColor: string;
  };
}

interface DraggableCandidateCardProps {
  candidate: Candidate;
  onStatusChange?: (candidateId: string, newStatus: string) => void;
  onEdit?: (candidate: Candidate) => void;
  onAnalyze?: (candidate: Candidate) => void;
  onScheduleInterview?: (candidate: Candidate) => void;
  onEmail?: (candidate: Candidate) => void;
  onNotes?: (candidate: Candidate) => void;
  onClick?: (candidate: Candidate) => void;
  isDragDisabled?: boolean;
  isSelected?: boolean;
  onSelect?: (candidateId: string, selected: boolean) => void;
  showCheckbox?: boolean;
}

export function DraggableCandidateCard({
  candidate,
  onStatusChange,
  onEdit,
  onAnalyze,
  onScheduleInterview,
  onEmail,
  onNotes,
  onClick,
  isDragDisabled = false,
  isSelected = false,
  onSelect,
  showCheckbox = false
}: DraggableCandidateCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: candidate.id,
    data: {
      candidate: candidate,
    },
    disabled: isDragDisabled,
  });

  // Handle click - simple since drag is isolated to handle only
  const handleCardClick = (e: React.MouseEvent) => {
    // Only trigger if we have a click handler
    if (onClick) {
      onClick(candidate);
    }
  };

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const positionColor = getPositionColor(candidate.position);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 hover:shadow-sm transition-all duration-150 border-l-4 ${positionColor.border} ${
        isDragging ? 'opacity-50 shadow-lg scale-105 z-50' : ''
      }`}
      onClick={handleCardClick}
      {...attributes}
    >
      {/* Checkbox for bulk selection */}
      {showCheckbox && (
        <div
          className="flex-shrink-0 mr-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => {
              onSelect?.(candidate.id, checked === true);
            }}
            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
          />
        </div>
      )}

      {/* Name, sourcer dot, and dead type badge */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {candidate.firstName} {candidate.lastName}
        </span>
        {/* Sourcer color dot - gray if unassigned */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white shadow-sm"
          style={{ backgroundColor: candidate.sourcer?.screenerColor || '#D1D5DB' }}
          title={candidate.sourcer
            ? `Assigned to: ${candidate.sourcer.firstName} ${candidate.sourcer.lastName}`
            : 'Unassigned'}
        />
        {/* Show dead type badge if applicable */}
        {candidate.status === 'DEAD_BY_US' && (
          <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0 flex-shrink-0">
            By Us
          </Badge>
        )}
        {candidate.status === 'DEAD_BY_CANDIDATE' && (
          <Badge className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0 flex-shrink-0">
            By Candidate
          </Badge>
        )}
      </div>

      {/* Minimal actions */}
      <div className="flex items-center gap-0.5 ml-2 flex-shrink-0">
        {!isDragDisabled && (
          <div
            className="p-1 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing"
            title="Drag to move"
            onClick={(e) => e.stopPropagation()}
            {...listeners}
          >
            <Move className="w-3.5 h-3.5 text-gray-400" />
          </div>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onAnalyze && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onAnalyze(candidate);
              }}>
                <Brain className="w-4 h-4 mr-2" />
                AI Analysis
              </DropdownMenuItem>
            )}
            {onEmail && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onEmail(candidate);
              }}>
                <Mail className="w-4 h-4 mr-2" />
                Send Email
              </DropdownMenuItem>
            )}
            {onNotes && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onNotes(candidate);
              }}>
                <FileText className="w-4 h-4 mr-2" />
                View Notes
              </DropdownMenuItem>
            )}
            {onScheduleInterview && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onScheduleInterview(candidate);
              }}>
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Interview
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}