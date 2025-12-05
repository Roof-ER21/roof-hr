import { useDraggable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  MoreVertical,
  Star,
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
import { format } from 'date-fns';

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
  isDragDisabled = false
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPLIED': return 'bg-blue-100 text-blue-800';
      case 'SCREENING': return 'bg-yellow-100 text-yellow-800';
      case 'INTERVIEW': return 'bg-purple-100 text-purple-800';
      case 'OFFER': return 'bg-green-100 text-green-800';
      case 'HIRED': return 'bg-emerald-100 text-emerald-800';
      case 'REJECTED': return 'bg-gray-100 text-gray-800';
      case 'DEAD_BY_US': return 'bg-red-100 text-red-800';
      case 'DEAD_BY_CANDIDATE': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer hover:shadow-lg transition-all duration-200 overflow-hidden ${
        isDragging ? 'opacity-50 shadow-2xl scale-105 z-50' : ''
      } ${!isDragDisabled ? 'hover:scale-[1.02]' : ''}`}
      onClick={handleCardClick}
      {...attributes}
    >
      <CardHeader className="pb-2">
        {/* Top row: Avatar, icons */}
        <div className="flex justify-between items-center mb-2">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex items-center gap-1">
            {!isDragDisabled && (
              <div
                className="p-1.5 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing"
                title="Drag card to move"
                onClick={(e) => e.stopPropagation()}
                {...listeners}
              >
                <Move className="w-4 h-4 text-gray-400" />
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
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
        {/* Name - full width, prominent */}
        <CardTitle className="text-base font-semibold leading-tight">
          {candidate.firstName} {candidate.lastName}
        </CardTitle>
        {/* Position */}
        <p className="text-sm text-gray-600">{candidate.position}</p>
        {/* Status badge */}
        <Badge className={`${getStatusColor(candidate.status)} text-xs px-2 py-0.5 w-fit mt-1`}>
          {candidate.status.replace(/_/g, ' ')}
        </Badge>
      </CardHeader>

      <CardContent className="pt-0 pb-3 space-y-2">
        {/* Contact Information */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="truncate">{candidate.email}</span>
          </div>
          {candidate.phone && (
            <div className="flex items-center gap-2 min-w-0">
              <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">{candidate.phone}</span>
            </div>
          )}
          {candidate.location && (
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="truncate">{candidate.location}</span>
            </div>
          )}
        </div>

        {/* Application Date */}
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <Calendar className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">Applied {format(new Date(candidate.appliedAt), 'MMM dd, yyyy')}</span>
        </div>

        {/* AI Scores */}
        {(candidate.aiMatchScore || candidate.aiPotentialScore) && (
          <div className="flex items-center gap-3 pt-1">
            {candidate.aiMatchScore && (
              <div className="flex items-center gap-1 min-w-0">
                <Star className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-600 flex-shrink-0">Match:</span>
                <span className={`text-xs font-medium flex-shrink-0 ${getScoreColor(candidate.aiMatchScore)}`}>
                  {candidate.aiMatchScore}%
                </span>
              </div>
            )}
            {candidate.aiPotentialScore && (
              <div className="flex items-center gap-1 min-w-0">
                <Brain className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="text-xs text-gray-600 flex-shrink-0">Potential:</span>
                <span className={`text-xs font-medium flex-shrink-0 ${getScoreColor(candidate.aiPotentialScore)}`}>
                  {candidate.aiPotentialScore}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Skills Preview */}
        {candidate.skills && candidate.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {candidate.skills.slice(0, 3).map((skill, index) => (
              <Badge key={index} variant="secondary" className="text-xs px-1.5 py-0 truncate max-w-[80px]">
                {skill}
              </Badge>
            ))}
            {candidate.skills.length > 3 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 flex-shrink-0">
                +{candidate.skills.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Notes Preview */}
        {candidate.notes && (
          <p className="text-xs text-gray-600 line-clamp-2 pt-0.5">
            {candidate.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}