import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Map, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface TourStep {
  id: string;
  title: string;
  description: string;
  element?: string; // CSS selector for highlighting
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: () => void;
  route?: string; // Route to navigate to
  tips?: string[]; // Additional tips for this step
}

const tourSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ROOF-ER HR System! 🎉',
    description: 'Let me guide you through our comprehensive HR management platform. This tour will help you understand all the key features and how to use them effectively.',
    tips: [
      'You can restart this tour anytime from the Help menu',
      'Each section has its own contextual help',
      'Use Susan AI for instant assistance'
    ]
  },
  {
    id: 'dashboard',
    title: 'Your Command Center',
    description: 'The dashboard provides a real-time overview of all HR activities, metrics, and important notifications. You can see employee stats, pending tasks, and recent activities at a glance.',
    route: '/dashboard',
    element: '.dashboard-container',
    position: 'bottom',
    tips: [
      'Customize your dashboard widgets',
      'Set up notifications for important events',
      'Export reports directly from here'
    ]
  },
  {
    id: 'employees',
    title: 'Employee Management',
    description: 'Access complete employee profiles, manage personal information, track performance, and handle all employee-related tasks in one centralized location.',
    route: '/employees',
    element: '.sidebar-employees',
    position: 'right',
    tips: [
      'Use filters to quickly find employees',
      'Bulk actions save time for multiple updates',
      'Employee profiles include complete history'
    ]
  },
  {
    id: 'recruitment',
    title: 'Smart Recruitment Pipeline',
    description: 'Our AI-powered recruitment system helps you manage candidates, schedule interviews, and make data-driven hiring decisions. Drag and drop candidates through stages easily.',
    route: '/recruitment',
    element: '.sidebar-recruitment',
    position: 'right',
    tips: [
      'AI predicts candidate success probability',
      'Automated email templates save time',
      'Interview scheduling is fully integrated'
    ]
  },
  {
    id: 'pto',
    title: 'PTO Management',
    description: 'Handle time-off requests efficiently with our three-tier policy system. Set company, department, and individual policies with automatic conflict detection.',
    route: '/pto-management',
    element: '.sidebar-pto',
    position: 'right',
    tips: [
      'Blackout dates prevent conflicts',
      'Automatic balance calculations',
      'Manager approval workflow built-in'
    ]
  },
  {
    id: 'tools',
    title: 'Tools & Equipment Tracking',
    description: 'Track company assets, manage assignments, and maintain inventory of all tools and equipment. Generate reports and monitor usage patterns.',
    route: '/tools',
    element: '.sidebar-tools',
    position: 'right',
    tips: [
      'QR codes for quick check-in/out',
      'Maintenance schedules prevent issues',
      'Assignment history for accountability'
    ]
  },
  {
    id: 'contracts',
    title: 'Contract Management',
    description: 'Create, send, and track employment contracts with built-in e-signature support. Templates make standardization easy.',
    route: '/contracts',
    element: '.sidebar-contracts',
    position: 'right',
    tips: [
      'Pre-filled templates save time',
      'Automatic reminders for renewals',
      'Digital signatures are legally binding'
    ]
  },
  {
    id: 'susan-ai',
    title: 'Meet Susan AI - Your HR Assistant',
    description: 'Susan AI is your intelligent assistant that can help with any HR task. Ask questions, execute commands, or get insights using natural language.',
    route: '/susan-ai',
    element: '.floating-orb',
    position: 'left',
    tips: [
      'Try: "Show me all pending PTO requests"',
      'Try: "Schedule interview for John Smith"',
      'Try: "Generate performance report"'
    ]
  },
  {
    id: 'complete',
    title: 'Tour Complete! 🚀',
    description: "You're all set! Remember, Susan AI is always here to help. Click the orange orb anytime for assistance, or access detailed help from any page.",
    tips: [
      'Press ? for keyboard shortcuts',
      'Check Settings for personalization',
      'Join our community for tips and updates'
    ]
  }
];

export function OnboardingTour() {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const navigate = useNavigate();
  const [hasSeenTour, setHasSeenTour] = useState(false);

  // Check if user has seen the tour
  useEffect(() => {
    const tourSeen = localStorage.getItem('onboarding-tour-completed');
    const tourDismissed = localStorage.getItem('onboarding-tour-dismissed');
    
    if (!tourSeen && !tourDismissed) {
      // Auto-start tour for new users
      setTimeout(() => {
        setIsActive(true);
      }, 1500);
    } else {
      setHasSeenTour(true);
    }
  }, []);

  // Handle step navigation
  useEffect(() => {
    if (!isActive) return;

    const step = tourSteps[currentStep];
    
    // Navigate to route if specified
    if (step.route) {
      navigate(step.route);
    }

    // Highlight element if specified
    if (step.element) {
      setTimeout(() => {
        const element = document.querySelector(step.element!) as HTMLElement;
        if (element) {
          setHighlightedElement(element);
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Add highlight class
          element.classList.add('tour-highlight');
        }
      }, 500);
    }

    return () => {
      // Clean up highlight
      if (highlightedElement) {
        highlightedElement.classList.remove('tour-highlight');
      }
    };
  }, [currentStep, isActive, navigate, highlightedElement]);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding-tour-dismissed', 'true');
    setIsActive(false);
    setHighlightedElement(null);
  };

  const completeTour = () => {
    localStorage.setItem('onboarding-tour-completed', 'true');
    setIsActive(false);
    setHighlightedElement(null);
    setHasSeenTour(true);
  };

  const restartTour = () => {
    setCurrentStep(0);
    setIsActive(true);
    localStorage.removeItem('onboarding-tour-dismissed');
  };

  const progress = ((currentStep + 1) / tourSteps.length) * 100;
  const step = tourSteps[currentStep];

  if (!isActive) {
    // Show restart button for users who have seen the tour
    if (hasSeenTour) {
      return (
        <button
          onClick={restartTour}
          className="fixed bottom-24 right-6 z-40 flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 border border-gray-200 dark:border-gray-700"
          title="Restart Tour"
        >
          <Map className="h-4 w-4" />
          <span className="text-sm font-medium">Tour Guide</span>
        </button>
      );
    }
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={handleSkip} />
      
      {/* Tour Card */}
      <Card className={cn(
        "fixed z-[60] max-w-md shadow-2xl border-2",
        "animate-in fade-in slide-in-from-bottom-4",
        currentStep === 0 ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" :
        currentStep === tourSteps.length - 1 ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" :
        step.position === 'top' ? "bottom-20 left-1/2 -translate-x-1/2" :
        step.position === 'bottom' ? "top-20 left-1/2 -translate-x-1/2" :
        step.position === 'left' ? "right-8 top-1/2 -translate-y-1/2" :
        step.position === 'right' ? "left-8 top-1/2 -translate-y-1/2" :
        "bottom-20 right-8"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <CardTitle className="text-lg">{step.title}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 -mt-1 -mr-2"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress} className="mt-2 h-1.5" />
        </CardHeader>
        
        <CardContent className="space-y-4">
          <CardDescription className="text-sm leading-relaxed">
            {step.description}
          </CardDescription>
          
          {/* Tips Section */}
          {step.tips && step.tips.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Quick Tips:</p>
              <ul className="space-y-1">
                {step.tips.map((tip, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">•</span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                Step {currentStep + 1} of {tourSteps.length}
              </Badge>
              {currentStep > 0 && currentStep < tourSteps.length - 1 && (
                <button
                  onClick={handleSkip}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Skip tour
                </button>
              )}
            </div>
            
            <div className="flex gap-2">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  className="h-8"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                className="h-8"
              >
                {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
                {currentStep < tourSteps.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Spotlight effect for highlighted elements */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .tour-highlight {
            position: relative;
            z-index: 51;
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
            border-radius: 4px;
            animation: pulse 2s infinite;
          }
          
          @keyframes pulse {
            0% {
              box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
            }
            50% {
              box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.2);
            }
            100% {
              box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
            }
          }
        `
      }} />
    </>
  );
}