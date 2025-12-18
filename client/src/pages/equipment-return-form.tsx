import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  MapPin,
  Package
} from 'lucide-react';

interface ChecklistData {
  id: string;
  employeeName: string;
  employeeEmail: string;
  status: string;
  type: string;
  scheduledDate?: string;
  scheduledTime?: string;
  signedAt?: string;
}

const TIME_SLOTS = [
  "9:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "12:00 PM - 1:00 PM",
  "1:00 PM - 2:00 PM",
  "2:00 PM - 3:00 PM",
  "3:00 PM - 4:00 PM",
  "4:00 PM - 5:00 PM"
];

export default function EquipmentReturnForm() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  // Form state
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Generate next 7 available days (excluding weekends)
  const availableDates = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    let currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() + 1); // Start from tomorrow

    while (dates.length < 7) {
      const dayOfWeek = currentDate.getDay();
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push(new Date(currentDate));
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  }, []);

  // Fetch checklist data
  const { data: checklist, isLoading, error } = useQuery<ChecklistData>({
    queryKey: ['/api/public/equipment-checklist', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/equipment-checklist/${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load checklist');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await fetch(`/api/public/equipment-checklist/${token}/schedule`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to schedule return');
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: 'Return Scheduled',
        description: 'Your equipment return has been scheduled successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDate) {
      toast({
        title: 'Date Required',
        description: 'Please select a date for your equipment return.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedTime) {
      toast({
        title: 'Time Required',
        description: 'Please select a time slot for your equipment return.',
        variant: 'destructive',
      });
      return;
    }

    const formData = {
      scheduledDate: selectedDate,
      scheduledTime: selectedTime,
      schedulingNotes: notes || null,
    };

    submitMutation.mutate(formData);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateValue = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage = (error as Error).message;
    const isExpired = errorMessage.includes('expired');

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {isExpired ? 'Link Expired' : 'Invalid Link'}
            </h2>
            <p className="text-gray-600">
              {isExpired
                ? 'This equipment return link has expired. Please contact HR for a new link.'
                : 'This equipment return link is invalid. Please contact HR for assistance.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If already scheduled, show the scheduled info
  if (submitted || (checklist?.scheduledDate && checklist?.scheduledTime)) {
    const scheduledDate = submitted ? selectedDate : checklist?.scheduledDate;
    const scheduledTime = submitted ? selectedTime : checklist?.scheduledTime;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Return Scheduled</h2>
            <p className="text-gray-600 mb-4">
              Your equipment return has been scheduled.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  {scheduledDate ? new Date(scheduledDate).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }) : 'Date pending'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="font-medium">{scheduledTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <span className="text-sm text-gray-600">The Roof Docs Office</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Please bring all company equipment to the office at your scheduled time.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="https://lh3.googleusercontent.com/a/ACg8ocLV5bFgDxfg7P9BHJbvJqGTRKnPvLK9_cC9N0oqxw=s96-c"
            alt="Roof-ER Logo"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">
            Schedule Equipment Return
          </h1>
          <p className="text-gray-600 mt-2">
            {checklist?.employeeName}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Info Card */}
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Package className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900">Equipment Return Required</h3>
                  <p className="text-sm text-blue-800 mt-1">
                    Please schedule a time to return all company equipment to the office.
                    Bring all items including iPad, keyboard, clothing, and any other company property.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Date Selection */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Select a Date</CardTitle>
              </div>
              <CardDescription>
                Choose a date within the next 7 business days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {availableDates.map((date) => {
                  const dateValue = formatDateValue(date);
                  const isSelected = selectedDate === dateValue;
                  return (
                    <button
                      key={dateValue}
                      type="button"
                      onClick={() => setSelectedDate(dateValue)}
                      className={`p-3 rounded-lg border-2 transition-all text-center ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-semibold">{formatDate(date)}</div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Time Selection */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Select a Time</CardTitle>
              </div>
              <CardDescription>
                Choose a 1-hour time slot for your visit
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {TIME_SLOTS.map((slot) => {
                  const isSelected = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      className={`p-3 rounded-lg border-2 transition-all text-sm ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Additional Notes (Optional)</CardTitle>
              <CardDescription>
                Let us know if you have any special requests or concerns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g., I may need help carrying equipment, I have questions about a missing item..."
                rows={3}
              />
            </CardContent>
          </Card>

          {/* Office Location */}
          <Card className="mb-6 bg-gray-50">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <MapPin className="h-6 w-6 text-gray-600 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">Drop-off Location</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    The Roof Docs Office<br />
                    Please bring all company equipment to the front desk.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitMutation.isPending || !selectedDate || !selectedTime}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scheduling...
              </>
            ) : (
              'Schedule Return'
            )}
          </Button>

          <p className="text-center text-sm text-gray-500 mt-4">
            You will receive a confirmation email with your scheduled appointment details.
          </p>
        </form>
      </div>
    </div>
  );
}
