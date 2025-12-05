import { useState } from 'react';
import { DndContext, useDndMonitor, useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  X, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar,
  Star,
  Brain,
  Target,
  TrendingUp,
  Award
} from 'lucide-react';
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
  aiInsights?: {
    strengths: string[];
    concerns: string[];
    recommendations: string[];
    skillGaps: string[];
  };
}

interface CandidateComparisonProps {
  isOpen: boolean;
  onClose: () => void;
  initialCandidates?: Candidate[];
}

export function CandidateComparison({ isOpen, onClose, initialCandidates = [] }: CandidateComparisonProps) {
  const [comparedCandidates, setComparedCandidates] = useState<Candidate[]>(initialCandidates);
  const maxComparisonSlots = 3;

  const { setNodeRef } = useDroppable({
    id: 'candidate-comparison-area',
  });

  useDndMonitor({
    onDragEnd: (event) => {
      const { active, over } = event;
      
      if (over?.id === 'candidate-comparison-area' && active.data.current?.candidate) {
        const candidate = active.data.current.candidate as Candidate;
        
        // Check if candidate is already in comparison
        if (!comparedCandidates.find(c => c.id === candidate.id)) {
          // Only add if we haven't reached the limit
          if (comparedCandidates.length < maxComparisonSlots) {
            setComparedCandidates(prev => [...prev, candidate]);
          }
        }
      }
    },
  });

  const removeCandidate = (candidateId: string) => {
    setComparedCandidates(prev => prev.filter(c => c.id !== candidateId));
  };

  const clearAll = () => {
    setComparedCandidates([]);
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b bg-gray-50">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Candidate Comparison</h2>
              <p className="text-gray-600 mt-1">
                Drag candidates here to compare side-by-side ({comparedCandidates.length}/{maxComparisonSlots})
              </p>
            </div>
            <div className="flex gap-2">
              {comparedCandidates.length > 0 && (
                <Button variant="outline" onClick={clearAll}>
                  Clear All
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div 
          ref={setNodeRef}
          className="p-6 overflow-auto max-h-[calc(90vh-140px)]"
        >
          {comparedCandidates.length === 0 ? (
            <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="text-center">
                <Target className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Drop Candidates Here</h3>
                <p className="text-gray-600">
                  Drag candidates from the list to compare them side-by-side
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  You can compare up to {maxComparisonSlots} candidates at once
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(comparedCandidates.length, 3)}, 1fr)` }}>
              {comparedCandidates.map((candidate) => (
                <Card key={candidate.id} className="relative">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {candidate.firstName} {candidate.lastName}
                          </CardTitle>
                          <p className="text-sm text-gray-600">{candidate.position}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCandidate(candidate.id)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    <Badge className={getStatusColor(candidate.status)}>
                      {candidate.status}
                    </Badge>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Contact Information */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-gray-700">Contact</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-gray-400" />
                          <span className="truncate">{candidate.email}</span>
                        </div>
                        {candidate.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span>{candidate.phone}</span>
                          </div>
                        )}
                        {candidate.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span>{candidate.location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Application Details */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-gray-700">Application</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span>Applied {format(new Date(candidate.appliedAt), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-3 h-3 text-gray-400" />
                          <span>Source: {candidate.source}</span>
                        </div>
                      </div>
                    </div>

                    {/* AI Scores */}
                    {(candidate.aiMatchScore || candidate.aiPotentialScore) && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-gray-700 flex items-center gap-1">
                            <Brain className="w-3 h-3" />
                            AI Analysis
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {candidate.aiMatchScore && (
                              <div className="text-center p-2 bg-gray-50 rounded">
                                <div className={`text-lg font-bold ${getScoreColor(candidate.aiMatchScore)}`}>
                                  {candidate.aiMatchScore}%
                                </div>
                                <div className="text-xs text-gray-600">Match</div>
                              </div>
                            )}
                            {candidate.aiPotentialScore && (
                              <div className="text-center p-2 bg-gray-50 rounded">
                                <div className={`text-lg font-bold ${getScoreColor(candidate.aiPotentialScore)}`}>
                                  {candidate.aiPotentialScore}%
                                </div>
                                <div className="text-xs text-gray-600">Potential</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Skills */}
                    {candidate.skills && candidate.skills.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-gray-700">Skills</h4>
                          <div className="flex flex-wrap gap-1">
                            {candidate.skills.slice(0, 6).map((skill, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {candidate.skills.length > 6 && (
                              <Badge variant="secondary" className="text-xs">
                                +{candidate.skills.length - 6} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* AI Insights */}
                    {candidate.aiInsights && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h4 className="font-medium text-sm text-gray-700">AI Insights</h4>
                          
                          {candidate.aiInsights.strengths.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <Award className="w-3 h-3 text-green-600" />
                                <span className="text-xs font-medium text-green-700">Strengths</span>
                              </div>
                              <ul className="text-xs text-gray-600 space-y-1">
                                {candidate.aiInsights.strengths.slice(0, 2).map((strength, index) => (
                                  <li key={index} className="flex items-start gap-1">
                                    <span className="text-green-500 mt-0.5">•</span>
                                    <span>{strength}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {candidate.aiInsights.concerns.length > 0 && (
                            <div>
                              <div className="flex items-center gap-1 mb-1">
                                <TrendingUp className="w-3 h-3 text-yellow-600" />
                                <span className="text-xs font-medium text-yellow-700">Areas to Explore</span>
                              </div>
                              <ul className="text-xs text-gray-600 space-y-1">
                                {candidate.aiInsights.concerns.slice(0, 2).map((concern, index) => (
                                  <li key={index} className="flex items-start gap-1">
                                    <span className="text-yellow-500 mt-0.5">•</span>
                                    <span>{concern}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Experience */}
                    {candidate.experience && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-gray-700">Experience</h4>
                          <p className="text-xs text-gray-600 line-clamp-3">
                            {candidate.experience}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Notes */}
                    {candidate.notes && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm text-gray-700">Notes</h4>
                          <p className="text-xs text-gray-600 line-clamp-3">
                            {candidate.notes}
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}