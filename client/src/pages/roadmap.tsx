import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  ChevronRight, 
  Target, 
  Clock, 
  Users, 
  Mail, 
  Workflow, 
  Brain, 
  BarChart3,
  CheckCircle2,
  Circle,
  AlertCircle,
  Rocket,
  Calendar,
  TrendingUp,
  FileText
} from 'lucide-react';

interface RoadmapPhase {
  id: number;
  title: string;
  icon: any;
  status: 'completed' | 'in-progress' | 'upcoming';
  progress: number;
  timeline: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  features: {
    title: string;
    completed: boolean;
    description?: string;
  }[];
  metrics?: {
    label: string;
    value: string;
  }[];
}

export default function Roadmap() {
  const [selectedPhase, setSelectedPhase] = useState<number>(1);

  const phases: RoadmapPhase[] = [
    {
      id: 1,
      title: 'Indeed Integration & Candidate Sourcing',
      icon: Users,
      status: 'upcoming',
      progress: 0,
      timeline: '2-3 weeks',
      priority: 'HIGH',
      features: [
        { title: 'Indeed API Integration', completed: false, description: 'Automated job posting and application sync' },
        { title: 'LinkedIn Integration', completed: false, description: 'Professional profile sourcing' },
        { title: 'Bulk Candidate Import', completed: false, description: 'CSV/Excel upload with duplicate detection' },
        { title: 'AI Evaluation on Import', completed: false, description: 'Automatic candidate scoring' },
      ],
      metrics: [
        { label: 'Expected Time Saved', value: '15 hrs/week' },
        { label: 'Import Capacity', value: '500+ candidates/day' },
      ]
    },
    {
      id: 2,
      title: 'Advanced Interview Automation',
      icon: Calendar,
      status: 'upcoming',
      progress: 0,
      timeline: '2-3 weeks',
      priority: 'HIGH',
      features: [
        { title: 'Smart Scheduling', completed: false, description: 'AI-powered optimal time suggestions' },
        { title: 'Zoom Integration', completed: false, description: 'Auto-meeting creation with recording' },
        { title: 'Google Meet Integration', completed: false, description: 'Seamless video interview setup' },
        { title: 'Multi-Interviewer Coordination', completed: false, description: 'Panel interview management' },
        { title: 'Interview Analytics', completed: false, description: 'Performance and conversion metrics' },
      ],
      metrics: [
        { label: 'Scheduling Time Reduction', value: '70%' },
        { label: 'No-Show Rate Improvement', value: '40%' },
      ]
    },
    {
      id: 3,
      title: 'Enhanced Communication',
      icon: Mail,
      status: 'upcoming',
      progress: 0,
      timeline: '2-3 weeks',
      priority: 'MEDIUM',
      features: [
        { title: 'Multi-Step Email Campaigns', completed: false, description: 'Drip campaigns with personalization' },
        { title: 'SMS Integration (Twilio)', completed: false, description: 'Two-way messaging support' },
        { title: 'Communication Analytics', completed: false, description: 'Open rates and engagement tracking' },
        { title: 'AI Content Generation', completed: false, description: 'Personalized message creation' },
      ],
      metrics: [
        { label: 'Expected Open Rate', value: '45%+' },
        { label: 'Response Rate Increase', value: '3x' },
      ]
    },
    {
      id: 4,
      title: 'Advanced Workflow Automation',
      icon: Workflow,
      status: 'upcoming',
      progress: 0,
      timeline: '3-4 weeks',
      priority: 'MEDIUM',
      features: [
        { title: 'Visual Workflow Builder', completed: false, description: 'Drag-and-drop automation designer' },
        { title: 'Complex Logic Support', completed: false, description: 'If/then/else and loop conditions' },
        { title: 'Enhanced HR Agents', completed: false, description: 'Candidate nurturing and compliance bots' },
        { title: 'Error Handling System', completed: false, description: 'Automatic retry and fallback flows' },
      ],
      metrics: [
        { label: 'Process Automation', value: '80%' },
        { label: 'Error Rate Reduction', value: '60%' },
      ]
    },
    {
      id: 5,
      title: 'AI-Powered Enhancements',
      icon: Brain,
      status: 'upcoming',
      progress: 0,
      timeline: '3-4 weeks',
      priority: 'HIGH',
      features: [
        { title: 'Advanced Resume Analysis', completed: false, description: 'Deep skills extraction and matching' },
        { title: 'Predictive Success Modeling', completed: false, description: 'Performance and retention predictions' },
        { title: 'Salary Benchmarking', completed: false, description: 'Market-based compensation analysis' },
        { title: 'Dynamic Interview Questions', completed: false, description: 'Role-specific adaptive questioning' },
      ],
      metrics: [
        { label: 'Prediction Accuracy', value: '85%+' },
        { label: 'Quality of Hire', value: '+30%' },
      ]
    },
    {
      id: 6,
      title: 'Enterprise Analytics',
      icon: BarChart3,
      status: 'upcoming',
      progress: 0,
      timeline: '3-4 weeks',
      priority: 'MEDIUM',
      features: [
        { title: 'Pipeline Analytics', completed: false, description: 'Funnel conversion and drop-off analysis' },
        { title: 'Time & Cost Metrics', completed: false, description: 'Time-to-hire and cost-per-hire tracking' },
        { title: 'Predictive Analytics', completed: false, description: 'Turnover and demand forecasting' },
        { title: 'Custom Dashboards', completed: false, description: 'Executive and department-specific views' },
      ],
      metrics: [
        { label: 'Decision Speed', value: '+50%' },
        { label: 'Cost Savings', value: '35%' },
      ]
    }
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in-progress':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-100 text-red-800';
      case 'MEDIUM':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const overallProgress = Math.round(
    phases.reduce((acc, phase) => acc + phase.progress, 0) / phases.length
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Enhancement Roadmap</h1>
        </div>
        <p className="text-muted-foreground">
          Track the progress of HR Management System enhancements and upcoming features
        </p>
      </div>

      {/* Overall Progress */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Overall Progress
          </CardTitle>
          <CardDescription>
            System enhancement completion across all phases
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Progress</span>
              <span className="font-semibold">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-3" />
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">0</div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">0</div>
                <div className="text-sm text-muted-foreground">In Progress</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">6</div>
                <div className="text-sm text-muted-foreground">Upcoming</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Phase Timeline */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Implementation Timeline</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {phases.map((phase) => (
            <Card 
              key={phase.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedPhase === phase.id ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setSelectedPhase(phase.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <phase.icon className="h-8 w-8 text-primary" />
                  <div className="flex gap-2">
                    <Badge className={getPriorityColor(phase.priority)}>
                      {phase.priority}
                    </Badge>
                    <Badge className={getStatusColor(phase.status)}>
                      {phase.status.replace('-', ' ')}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="text-lg mt-2">{phase.title}</CardTitle>
                <CardDescription className="flex items-center gap-2 mt-2">
                  <Clock className="h-4 w-4" />
                  {phase.timeline}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Progress value={phase.progress} className="h-2" />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {phase.features.filter(f => f.completed).length} of {phase.features.length} features
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Selected Phase Details */}
      {selectedPhase && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                {(() => {
                  const Icon = phases[selectedPhase - 1].icon;
                  return Icon ? <Icon className="h-6 w-6 text-primary" /> : null;
                })()}
                Phase {selectedPhase}: {phases[selectedPhase - 1].title}
              </CardTitle>
              <div className="flex gap-2">
                <Badge className={getPriorityColor(phases[selectedPhase - 1].priority)}>
                  {phases[selectedPhase - 1].priority} Priority
                </Badge>
                <Badge className={getStatusColor(phases[selectedPhase - 1].status)}>
                  {phases[selectedPhase - 1].status.replace('-', ' ')}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="features" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="features">Features</TabsTrigger>
                <TabsTrigger value="metrics">Expected Metrics</TabsTrigger>
                <TabsTrigger value="technical">Technical Details</TabsTrigger>
              </TabsList>
              
              <TabsContent value="features" className="space-y-4 mt-4">
                <div className="space-y-3">
                  {phases[selectedPhase - 1].features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                      {feature.completed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-400 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium">{feature.title}</div>
                        {feature.description && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {feature.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <Progress 
                    value={phases[selectedPhase - 1].progress} 
                    className="h-3" 
                  />
                  <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                    <span>Progress</span>
                    <span>{phases[selectedPhase - 1].progress}% Complete</span>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="metrics" className="mt-4">
                {phases[selectedPhase - 1].metrics ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {phases[selectedPhase - 1].metrics.map((metric, index) => (
                      <div key={index} className="p-4 rounded-lg border">
                        <div className="text-2xl font-bold text-primary">
                          {metric.value}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {metric.label}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No metrics defined for this phase.</p>
                )}
              </TabsContent>
              
              <TabsContent value="technical" className="mt-4">
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted">
                    <h4 className="font-semibold mb-2">Implementation Timeline</h4>
                    <p className="text-sm text-muted-foreground">
                      Estimated: {phases[selectedPhase - 1].timeline}
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <h4 className="font-semibold mb-2">Technical Requirements</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {selectedPhase === 1 && (
                        <>
                          <li>• Indeed Publisher API integration</li>
                          <li>• LinkedIn Recruiter API setup</li>
                          <li>• Background job processing</li>
                          <li>• Enhanced data validation</li>
                        </>
                      )}
                      {selectedPhase === 2 && (
                        <>
                          <li>• Zoom SDK integration</li>
                          <li>• Google Meet API</li>
                          <li>• Calendar availability algorithms</li>
                          <li>• Real-time notification system</li>
                        </>
                      )}
                      {selectedPhase === 3 && (
                        <>
                          <li>• Twilio API integration</li>
                          <li>• SendGrid enhanced tracking</li>
                          <li>• Email tracking pixels</li>
                          <li>• Natural language processing</li>
                        </>
                      )}
                      {selectedPhase === 4 && (
                        <>
                          <li>• Workflow engine implementation</li>
                          <li>• State machine architecture</li>
                          <li>• Event-driven design</li>
                          <li>• Webhook management</li>
                        </>
                      )}
                      {selectedPhase === 5 && (
                        <>
                          <li>• Enhanced OpenAI GPT-4 integration</li>
                          <li>• Machine learning models</li>
                          <li>• Data pipeline for training</li>
                          <li>• Real-time inference engine</li>
                        </>
                      )}
                      {selectedPhase === 6 && (
                        <>
                          <li>• Business intelligence tools</li>
                          <li>• Data warehouse setup</li>
                          <li>• ETL pipelines</li>
                          <li>• Advanced visualization libraries</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="mt-8 flex justify-center gap-4">
        <Button variant="outline" className="gap-2">
          <FileText className="h-4 w-4" />
          View Full Documentation
        </Button>
        <Button className="gap-2">
          <Target className="h-4 w-4" />
          Start Next Phase
        </Button>
      </div>
    </div>
  );
}