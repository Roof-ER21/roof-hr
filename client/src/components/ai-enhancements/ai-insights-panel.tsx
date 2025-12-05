import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  FileText,
  AlertTriangle,
  Sparkles,
  Upload,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  TrendingUp,
  Target,
  Award,
  AlertOctagon,
  Briefcase,
  GraduationCap,
  ClipboardList,
  Info,
  ShieldAlert,
} from 'lucide-react';

interface AIInsightsPanelProps {
  candidateId: string;
  candidateData: any;
}

export function AIInsightsPanel({ candidateId, candidateData }: AIInsightsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [resumeText, setResumeText] = useState('');
  const [isParsingResume, setIsParsingResume] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dataAnalyzed: false,
    strengths: true,
    developmentAreas: true,
    riskFactors: true,
    recommendations: true,
  });

  // Parse resume mutation
  const parseResumeMutation = useMutation({
    mutationFn: async (text: string) => {
      return apiRequest('/api/ai/parse-resume', {
        method: 'POST',
        body: JSON.stringify({ resumeText: text, candidateId }),
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Resume Parsed Successfully',
        description: 'Resume data has been extracted and saved.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      setResumeText('');
      setIsParsingResume(false);
    },
    onError: (error: any) => {
      console.error('Resume parsing error:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'An error occurred while parsing the resume.';
      toast({
        title: 'Failed to Parse Resume',
        description: errorMessage,
        variant: 'destructive',
      });
      setIsParsingResume(false);
    },
  });

  // Parse existing data if available
  const parsedResumeData = candidateData.parsedResumeData ?
    JSON.parse(candidateData.parsedResumeData) : null;

  // Parse AI insights for detailed breakdown
  let aiInsights = null;
  let fullAnalysis = null;
  if (candidateData.aiInsights) {
    try {
      aiInsights = JSON.parse(candidateData.aiInsights);
      fullAnalysis = aiInsights.analysis || null;
    } catch (e) {
      console.error('Failed to parse AI insights:', e);
    }
  }

  const prediction = {
    successScore: candidateData.predictedSuccessScore,
    tenure: candidateData.predictedTenure,
    cultureFit: candidateData.cultureFitScore,
    technicalFit: candidateData.technicalFitScore,
    risks: candidateData.riskFactors ? JSON.parse(candidateData.riskFactors) : [],
    strengths: fullAnalysis?.strengths || [],
    developmentAreas: fullAnalysis?.developmentAreas || [],
    recommendedActions: fullAnalysis?.recommendedActions || [],
  };

  // Get analyzed data summary
  const candidateSnapshot = aiInsights?.candidateSnapshot || {};
  const jobRequirements = aiInsights?.jobRequirements || {};
  const analyzedAt = aiInsights?.analyzedAt ? new Date(aiInsights.analyzedAt).toLocaleString() : null;
  const analysisMethod = aiInsights?.method || 'AI Analysis';

  // Get stored resume text for reparsing
  const storedResumeText = candidateData.resumeText || '';

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-blue-50 border-blue-200';
    if (score >= 40) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="resume">Resume Data</TabsTrigger>
        </TabsList>

        {/* AI Analysis Tab - NEW Transparent Scoring */}
        <TabsContent value="analysis" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                AI Analysis Breakdown
              </CardTitle>
              <CardDescription>
                Transparent scoring and insights for {candidateData.firstName} {candidateData.lastName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Score Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {prediction.successScore && (
                  <div className={`text-center p-4 rounded-lg border-2 ${getScoreBgColor(prediction.successScore)}`}>
                    <div className={`text-3xl font-bold ${getScoreColor(prediction.successScore)}`}>
                      {prediction.successScore}%
                    </div>
                    <div className="text-sm font-medium mt-1">Match Score</div>
                    <div className="text-xs text-muted-foreground mt-1">Overall Success Prediction</div>
                  </div>
                )}
                {prediction.tenure && (
                  <div className="text-center p-4 rounded-lg border-2 bg-blue-50 border-blue-200">
                    <div className="text-3xl font-bold text-blue-600">
                      {prediction.tenure} mo
                    </div>
                    <div className="text-sm font-medium mt-1">Predicted Tenure</div>
                    <div className="text-xs text-muted-foreground mt-1">Expected Duration</div>
                  </div>
                )}
                {prediction.cultureFit && (
                  <div className={`text-center p-4 rounded-lg border-2 ${getScoreBgColor(prediction.cultureFit)}`}>
                    <div className={`text-3xl font-bold ${getScoreColor(prediction.cultureFit)}`}>
                      {prediction.cultureFit}%
                    </div>
                    <div className="text-sm font-medium mt-1">Culture Fit</div>
                    <div className="text-xs text-muted-foreground mt-1">Team Alignment</div>
                  </div>
                )}
                {prediction.technicalFit && (
                  <div className={`text-center p-4 rounded-lg border-2 ${getScoreBgColor(prediction.technicalFit)}`}>
                    <div className={`text-3xl font-bold ${getScoreColor(prediction.technicalFit)}`}>
                      {prediction.technicalFit}%
                    </div>
                    <div className="text-sm font-medium mt-1">Technical Fit</div>
                    <div className="text-xs text-muted-foreground mt-1">Skills Match</div>
                  </div>
                )}
              </div>

              {/* Analysis Details Sections */}
              {prediction.strengths && prediction.strengths.length > 0 && (
                <Collapsible
                  open={expandedSections.strengths}
                  onOpenChange={() => toggleSection('strengths')}
                >
                  <Card className="border-green-200 bg-green-50/50">
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="cursor-pointer hover:bg-green-100/50 transition-colors">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <Award className="h-5 w-5 text-green-600" />
                            <span>Candidate Strengths</span>
                            <Badge variant="secondary">{prediction.strengths.length}</Badge>
                          </div>
                          <ChevronDown className={`h-5 w-5 transition-transform ${expandedSections.strengths ? 'rotate-180' : ''}`} />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <ul className="space-y-2">
                          {prediction.strengths.map((strength: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{strength}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {prediction.developmentAreas && prediction.developmentAreas.length > 0 && (
                <Collapsible
                  open={expandedSections.developmentAreas}
                  onOpenChange={() => toggleSection('developmentAreas')}
                >
                  <Card className="border-blue-200 bg-blue-50/50">
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="cursor-pointer hover:bg-blue-100/50 transition-colors">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            <span>Development Areas</span>
                            <Badge variant="secondary">{prediction.developmentAreas.length}</Badge>
                          </div>
                          <ChevronDown className={`h-5 w-5 transition-transform ${expandedSections.developmentAreas ? 'rotate-180' : ''}`} />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <ul className="space-y-2">
                          {prediction.developmentAreas.map((area: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Target className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                              <span className="text-sm">{area}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {prediction.risks && prediction.risks.length > 0 && (
                <Collapsible
                  open={expandedSections.riskFactors}
                  onOpenChange={() => toggleSection('riskFactors')}
                >
                  <Card className="border-red-200 bg-red-50/50">
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="cursor-pointer hover:bg-red-100/50 transition-colors">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-red-600" />
                            <span>Risk Factors</span>
                            <Badge variant="secondary">{prediction.risks.length}</Badge>
                          </div>
                          <ChevronDown className={`h-5 w-5 transition-transform ${expandedSections.riskFactors ? 'rotate-180' : ''}`} />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <ul className="space-y-3">
                          {prediction.risks.map((risk: any, idx: number) => (
                            <li key={idx} className="border-l-4 border-red-400 pl-3 py-2 bg-white rounded-r">
                              <div className="flex items-start gap-2 mb-1">
                                <Badge variant={
                                  risk.severity === 'HIGH' ? 'destructive' :
                                  risk.severity === 'MEDIUM' ? 'default' : 'secondary'
                                } className="mt-0.5">
                                  {risk.severity}
                                </Badge>
                                <span className="text-sm font-medium">{risk.factor}</span>
                              </div>
                              {risk.mitigation && (
                                <div className="text-xs text-muted-foreground mt-1 ml-16">
                                  <strong>Mitigation:</strong> {risk.mitigation}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {prediction.recommendedActions && prediction.recommendedActions.length > 0 && (
                <Collapsible
                  open={expandedSections.recommendations}
                  onOpenChange={() => toggleSection('recommendations')}
                >
                  <Card className="border-purple-200 bg-purple-50/50">
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="cursor-pointer hover:bg-purple-100/50 transition-colors">
                        <CardTitle className="flex items-center justify-between text-base">
                          <div className="flex items-center gap-2">
                            <ClipboardList className="h-5 w-5 text-purple-600" />
                            <span>Recommended Actions</span>
                            <Badge variant="secondary">{prediction.recommendedActions.length}</Badge>
                          </div>
                          <ChevronDown className={`h-5 w-5 transition-transform ${expandedSections.recommendations ? 'rotate-180' : ''}`} />
                        </CardTitle>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <ol className="space-y-2 list-decimal list-inside">
                          {prediction.recommendedActions.map((action: string, idx: number) => (
                            <li key={idx} className="text-sm pl-2">
                              {action}
                            </li>
                          ))}
                        </ol>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              )}

              {/* Data Sources Section */}
              <Collapsible
                open={expandedSections.dataAnalyzed}
                onOpenChange={() => toggleSection('dataAnalyzed')}
              >
                <Card className="border-gray-200 bg-gray-50/50">
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-gray-100/50 transition-colors">
                      <CardTitle className="flex items-center justify-between text-base">
                        <div className="flex items-center gap-2">
                          <Info className="h-5 w-5 text-gray-600" />
                          <span>Data Sources & Analysis Method</span>
                        </div>
                        <ChevronDown className={`h-5 w-5 transition-transform ${expandedSections.dataAnalyzed ? 'rotate-180' : ''}`} />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-4">
                      {analyzedAt && (
                        <div className="text-xs text-muted-foreground">
                          <strong>Analyzed:</strong> {analyzedAt}
                        </div>
                      )}
                      {analysisMethod && (
                        <div className="text-xs text-muted-foreground">
                          <strong>Method:</strong> {analysisMethod}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <Briefcase className="h-4 w-4" />
                            Candidate Data
                          </h4>
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <div>Position: {candidateSnapshot.position || candidateData.position}</div>
                            <div>Experience: {candidateSnapshot.experience || 'Not specified'} years</div>
                            <div>Resume Parsed: {candidateSnapshot.hasParsedResume ? 'Yes' : 'No'}</div>
                            {parsedResumeData?.skills?.technical && (
                              <div>Skills Analyzed: {parsedResumeData.skills.technical.length} technical skills</div>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                            <GraduationCap className="h-4 w-4" />
                            Position Requirements
                          </h4>
                          <div className="text-xs space-y-1 text-muted-foreground">
                            <div>Position: {jobRequirements.position || candidateData.position}</div>
                            <div>Required Experience: {jobRequirements.requiredExperience || 'Not specified'} years</div>
                            {jobRequirements.preferredSkills && (
                              <div>Key Skills: {jobRequirements.preferredSkills.join(', ')}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {!aiInsights && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No AI analysis available yet. Run AI analysis from the candidate actions menu to generate insights.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overview Tab - Original */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                AI-Powered Insights Summary
              </CardTitle>
              <CardDescription>
                Quick overview for {candidateData.firstName} {candidateData.lastName}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {prediction.successScore && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {prediction.successScore}%
                    </div>
                    <div className="text-sm text-muted-foreground">Success Score</div>
                  </div>
                )}
                {prediction.tenure && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {prediction.tenure} mo
                    </div>
                    <div className="text-sm text-muted-foreground">Predicted Tenure</div>
                  </div>
                )}
                {prediction.cultureFit && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {prediction.cultureFit}%
                    </div>
                    <div className="text-sm text-muted-foreground">Culture Fit</div>
                  </div>
                )}
                {prediction.technicalFit && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {prediction.technicalFit}%
                    </div>
                    <div className="text-sm text-muted-foreground">Technical Fit</div>
                  </div>
                )}
              </div>

              {prediction.risks && prediction.risks.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Risk Factors:</strong>
                    <ul className="mt-2 space-y-1">
                      {prediction.risks.slice(0, 3).map((risk: any, idx: number) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Badge variant={
                            risk.severity === 'HIGH' ? 'destructive' :
                            risk.severity === 'MEDIUM' ? 'default' : 'secondary'
                          }>
                            {risk.severity}
                          </Badge>
                          <span className="text-sm">{risk.factor}</span>
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resume Tab - Original */}
        <TabsContent value="resume" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resume Parser & Analysis
              </CardTitle>
              <CardDescription>
                Extract structured data from resume text
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!parsedResumeData && (
                <div className="space-y-4">
                  <textarea
                    className="w-full min-h-[200px] p-3 border rounded-md"
                    placeholder="Paste resume text here..."
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                  <Button
                    onClick={() => {
                      setIsParsingResume(true);
                      parseResumeMutation.mutate(resumeText);
                    }}
                    disabled={!resumeText || isParsingResume}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isParsingResume ? 'Parsing...' : 'Parse Resume'}
                  </Button>
                </div>
              )}

              {parsedResumeData && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Personal Information</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Email: {parsedResumeData.personalInfo?.email}</div>
                      <div>Phone: {parsedResumeData.personalInfo?.phone}</div>
                      <div>Location: {parsedResumeData.personalInfo?.location}</div>
                      {parsedResumeData.personalInfo?.linkedIn && (
                        <div>LinkedIn: {parsedResumeData.personalInfo.linkedIn}</div>
                      )}
                    </div>
                  </div>

                  {parsedResumeData.experience && (
                    <div>
                      <h4 className="font-semibold mb-2">Experience</h4>
                      {parsedResumeData.experience.slice(0, 3).map((exp: any, idx: number) => (
                        <div key={idx} className="mb-3 p-3 bg-secondary/50 rounded">
                          <div className="font-medium">{exp.position}</div>
                          <div className="text-sm text-muted-foreground">
                            {exp.company} • {exp.duration}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {parsedResumeData.skills && (
                    <div>
                      <h4 className="font-semibold mb-2">Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {parsedResumeData.skills.technical?.map((skill: string, idx: number) => (
                          <Badge key={idx} variant="secondary">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!storedResumeText) {
                        toast({
                          title: 'No Resume Text',
                          description: 'No resume text available to reparse. Please upload a resume first.',
                          variant: 'destructive',
                        });
                        return;
                      }
                      setIsParsingResume(true);
                      parseResumeMutation.mutate(storedResumeText);
                    }}
                    disabled={!storedResumeText || isParsingResume}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isParsingResume ? 'animate-spin' : ''}`} />
                    {isParsingResume ? 'Reparsing...' : 'Re-parse Resume'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
