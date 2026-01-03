import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle, Car, MessageSquare, UserCheck, RefreshCw, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Candidate } from '@shared/schema';
import { format } from 'date-fns';

interface InPersonInterviewScreeningProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate;
  onProceed: (data: ScreeningData) => void;
  onCancel: () => void;
}

export interface ScreeningData {
  hasDriversLicense: boolean;
  hasReliableVehicle: boolean;
  hasClearCommunication: boolean;
  notes?: string;
  allPassed: boolean;
}

interface PreviousScreening {
  hasDriversLicense: boolean;
  hasReliableVehicle: boolean;
  hasClearCommunication: boolean;
  notes?: string;
  date?: string;
}

export function InPersonInterviewScreening({
  isOpen,
  onClose,
  candidate,
  onProceed,
  onCancel
}: InPersonInterviewScreeningProps) {
  const { toast } = useToast();
  const [responses, setResponses] = useState({
    driversLicense: '',
    reliableVehicle: '',
    clearCommunication: '',
    notes: ''
  });
  const [showNoteRequirement] = useState(true); // Notes are always required
  const [isReScreening, setIsReScreening] = useState(false);
  const [previousScreening, setPreviousScreening] = useState<PreviousScreening | null>(null);

  // Parse previous screening data from candidate
  useEffect(() => {
    if (candidate?.interviewScreeningData) {
      try {
        const data = JSON.parse(candidate.interviewScreeningData as string);
        setPreviousScreening({
          ...data,
          date: candidate.interviewScreeningDate ? format(new Date(candidate.interviewScreeningDate), 'MMM d, yyyy') : undefined
        });

        // Check if previous screening had any failures
        const hadFailures = !data.hasDriversLicense || !data.hasReliableVehicle || !data.hasClearCommunication;
        setIsReScreening(hadFailures);

        // Pre-fill with previous responses
        setResponses({
          driversLicense: data.hasDriversLicense ? 'yes' : 'no',
          reliableVehicle: data.hasReliableVehicle ? 'yes' : 'no',
          clearCommunication: data.hasClearCommunication ? 'yes' : 'no',
          notes: ''
        });

        // Notes are always required regardless of screening results
      } catch (e) {
        setPreviousScreening(null);
        setIsReScreening(false);
      }
    } else {
      setPreviousScreening(null);
      setIsReScreening(false);
    }
  }, [candidate]);

  // Mutation to save screening data to candidate
  const saveScreeningMutation = useMutation({
    mutationFn: async (screeningData: ScreeningData) => {
      return apiRequest(`/api/candidates/${candidate.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          interviewScreeningData: JSON.stringify({
            hasDriversLicense: screeningData.hasDriversLicense,
            hasReliableVehicle: screeningData.hasReliableVehicle,
            hasClearCommunication: screeningData.hasClearCommunication
          }),
          interviewScreeningDate: new Date().toISOString(),
          interviewScreeningNotes: screeningData.notes || null,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
    },
  });

  const handleResponseChange = (field: string, value: string) => {
    setResponses(prev => ({ ...prev, [field]: value }));
    // Notes are always required - no conditional logic needed
  };

  const handleSubmit = async () => {
    // Validate all questions are answered
    if (!responses.driversLicense || !responses.reliableVehicle || !responses.clearCommunication) {
      toast({
        title: 'Missing Information',
        description: 'Please answer all screening questions',
        variant: 'destructive'
      });
      return;
    }

    const allPassed = responses.driversLicense === 'yes' &&
                     responses.reliableVehicle === 'yes' &&
                     responses.clearCommunication === 'yes';

    // Notes are always required
    if (!responses.notes.trim()) {
      toast({
        title: 'Notes Required',
        description: 'Please provide notes about the candidate before proceeding',
        variant: 'destructive'
      });
      return;
    }

    const screeningData: ScreeningData = {
      hasDriversLicense: responses.driversLicense === 'yes',
      hasReliableVehicle: responses.reliableVehicle === 'yes',
      hasClearCommunication: responses.clearCommunication === 'yes',
      notes: responses.notes || undefined,
      allPassed
    };

    try {
      // Save screening data to candidate record
      await saveScreeningMutation.mutateAsync(screeningData);

      // If not all passed, send alert to managers and admins
      if (!allPassed) {
        try {
          await sendAlertToManagers(candidate, screeningData);
        } catch (error) {
          console.error('Failed to send alert:', error);
        }
      }

      toast({
        title: 'Screening Saved',
        description: allPassed ? 'All requirements met. Proceeding to schedule interview.' : 'Screening saved. Managers have been notified.',
      });

      onProceed(screeningData);
    } catch (error) {
      console.error('Failed to save screening:', error);
      toast({
        title: 'Error',
        description: 'Failed to save screening data. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const sendAlertToManagers = async (candidate: Candidate, data: ScreeningData) => {
    // Send alert to managers and admins about the screening failure
    const failedQuestions = [];
    if (!data.hasDriversLicense) failedQuestions.push('Valid Driver\'s License');
    if (!data.hasReliableVehicle) failedQuestions.push('Reliable Vehicle');
    if (!data.hasClearCommunication) failedQuestions.push('Clear Communication');

    const alertMessage = {
      candidateId: candidate.id,
      candidateName: `${candidate.firstName} ${candidate.lastName}`,
      position: candidate.position,
      failedRequirements: failedQuestions,
      notes: data.notes,
      timestamp: new Date().toISOString()
    };

    // Send alert via API
    await fetch('/api/alerts/screening-failure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(alertMessage)
    });

    toast({
      title: 'Alert Sent',
      description: 'Managers and administrators have been notified of the screening results'
    });
  };

  const handleCancel = () => {
    setResponses({
      driversLicense: '',
      reliableVehicle: '',
      clearCommunication: '',
      notes: ''
    });
    onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReScreening ? <RefreshCw className="h-5 w-5" /> : <UserCheck className="h-5 w-5" />}
            {isReScreening ? 'Re-Screening Required' : 'In-Person Interview Screening'}
          </DialogTitle>
          <DialogDescription>
            {isReScreening ? (
              <>
                This candidate was previously screened on <strong>{previousScreening?.date}</strong> with some requirements not met.
                Please verify if anything has changed before scheduling another in-person interview.
              </>
            ) : (
              <>
                Before scheduling an in-person interview for <strong>{candidate.firstName} {candidate.lastName}</strong>,
                please complete this mandatory screening.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Previous Screening Summary (for re-screening) */}
          {isReScreening && previousScreening && (
            <Alert className="border-blue-200 bg-blue-50">
              <RefreshCw className="h-4 w-4" />
              <AlertDescription>
                <strong>Previous Screening Results ({previousScreening.date}):</strong>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center gap-2">
                    {previousScreening.hasDriversLicense ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={previousScreening.hasDriversLicense ? '' : 'text-red-600 font-medium'}>
                      Driver's License: {previousScreening.hasDriversLicense ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {previousScreening.hasReliableVehicle ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={previousScreening.hasReliableVehicle ? '' : 'text-red-600 font-medium'}>
                      Reliable Vehicle: {previousScreening.hasReliableVehicle ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {previousScreening.hasClearCommunication ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className={previousScreening.hasClearCommunication ? '' : 'text-red-600 font-medium'}>
                      Clear Communication: {previousScreening.hasClearCommunication ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
          {/* Driver's License Question */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-base font-medium">
              <Car className="h-4 w-4" />
              1. Does the candidate have a valid driver's license?
            </Label>
            <RadioGroup
              value={responses.driversLicense}
              onValueChange={(value) => handleResponseChange('driversLicense', value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="license-yes" />
                <Label htmlFor="license-yes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="license-no" />
                <Label htmlFor="license-no">No</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Reliable Vehicle Question */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-base font-medium">
              <Car className="h-4 w-4" />
              2. Does the candidate have a reliable vehicle?
            </Label>
            <RadioGroup
              value={responses.reliableVehicle}
              onValueChange={(value) => handleResponseChange('reliableVehicle', value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="vehicle-yes" />
                <Label htmlFor="vehicle-yes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="vehicle-no" />
                <Label htmlFor="vehicle-no">No</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Clear Communication Question */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-base font-medium">
              <MessageSquare className="h-4 w-4" />
              3. Does the candidate have clear communication skills?
            </Label>
            <RadioGroup
              value={responses.clearCommunication}
              onValueChange={(value) => handleResponseChange('clearCommunication', value)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="communication-yes" />
                <Label htmlFor="communication-yes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="communication-no" />
                <Label htmlFor="communication-no">No</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Notes Section - Always Required */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="flex items-center gap-1">
              Notes <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="notes"
              value={responses.notes}
              onChange={(e) => setResponses(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Provide notes about the candidate's screening responses, impressions, and any relevant observations..."
              className="min-h-[100px]"
            />
          </div>

          {/* Warning Alert */}
          {(responses.driversLicense === 'no' || responses.reliableVehicle === 'no' || responses.clearCommunication === 'no') && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This candidate does not meet all requirements for an in-person interview.
                If you proceed, managers and administrators will be notified.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={saveScreeningMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saveScreeningMutation.isPending}
            className={responses.driversLicense === 'yes' &&
                      responses.reliableVehicle === 'yes' &&
                      responses.clearCommunication === 'yes'
                      ? '' : 'bg-orange-600 hover:bg-orange-700'}
          >
            {saveScreeningMutation.isPending ? 'Processing...' : 
             (responses.driversLicense === 'yes' && 
              responses.reliableVehicle === 'yes' && 
              responses.clearCommunication === 'yes' 
              ? 'Schedule Interview' : 'Proceed with Caution')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}