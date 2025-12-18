import { useState, useRef, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle, Eraser, Package, Clock, Lock, CalendarClock, Eye, PenLine } from 'lucide-react';

interface EquipmentItem {
  name: string;
  quantity: number;
  received?: boolean;
}

interface AgreementData {
  id: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole?: string;
  employeeStartDate?: string;
  items: string;
  status: string;
  createdAt: string;
  alreadySigned?: boolean;
  signedAt?: string;
}

// Signature Canvas Component
function SignatureCanvas({
  onSignatureChange,
  signature
}: {
  onSignatureChange: (data: string | null) => void;
  signature: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureData = canvas.toDataURL('image/png');
    onSignatureChange(signatureData);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-2">
      <Label>Signature *</Label>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-1 bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={150}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
        <Eraser className="h-4 w-4 mr-2" />
        Clear Signature
      </Button>
    </div>
  );
}

export default function EquipmentAgreementForm() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  // Form state
  const [signature, setSignature] = useState<string | null>(null);
  const [items, setItems] = useState<EquipmentItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  // Fetch agreement data
  const { data: agreement, isLoading, error } = useQuery<AgreementData>({
    queryKey: ['/api/public/equipment-agreement', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/equipment-agreement/${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load agreement');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Parse items when agreement loads
  useEffect(() => {
    if (agreement?.items) {
      try {
        const parsedItems: EquipmentItem[] = JSON.parse(agreement.items);
        // Initialize received status to true by default
        setItems(parsedItems.map(item => ({ ...item, received: true })));
      } catch (e) {
        console.error('Failed to parse items:', e);
        setItems([]);
      }
    }
  }, [agreement?.items]);

  // Check if the start date has been reached (for locking the form)
  const isStartDateReached = useMemo(() => {
    if (!agreement?.employeeStartDate) return true; // No start date means no lock
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(agreement.employeeStartDate);
    startDate.setHours(0, 0, 0, 0);
    return today >= startDate;
  }, [agreement?.employeeStartDate]);

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await fetch(`/api/public/equipment-agreement/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit agreement');
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: 'Agreement Signed',
        description: 'Your equipment agreement has been successfully signed.',
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

  const handleItemChange = (index: number, received: boolean) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], received };
      return newItems;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!signature) {
      toast({
        title: 'Signature Required',
        description: 'Please sign the form before submitting.',
        variant: 'destructive',
      });
      return;
    }

    // Check if at least one item is received
    const hasReceivedItems = items.some(item => item.received);
    if (!hasReceivedItems) {
      toast({
        title: 'Items Required',
        description: 'Please check at least one item that you have received.',
        variant: 'destructive',
      });
      return;
    }

    const formData = {
      signatureData: signature,
      items: items,
    };

    submitMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-gray-600">Loading agreement...</p>
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
            {isExpired ? (
              <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            ) : (
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            )}
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {isExpired ? 'Link Expired' : 'Invalid Link'}
            </h2>
            <p className="text-gray-600">
              {isExpired
                ? 'This equipment agreement link has expired. Please contact HR for a new link.'
                : 'This equipment agreement link is invalid. Please contact HR for assistance.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted || agreement?.alreadySigned || agreement?.status === 'SIGNED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Agreement Signed</h2>
            <p className="text-gray-600">
              Thank you! Your equipment agreement has been successfully signed and recorded.
            </p>
            {agreement?.signedAt && (
              <p className="text-sm text-gray-500 mt-4">
                Signed on: {new Date(agreement.signedAt).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="https://lh3.googleusercontent.com/a/ACg8ocLV5bFgDxfg7P9BHJbvJqGTRKnPvLK9_cC9N0oqxw=s96-c"
            alt="Roof-ER Logo"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">
            Equipment Agreement
          </h1>
          <p className="text-gray-600 mt-2">
            Welcome, {agreement?.employeeName}!
          </p>
          {agreement?.employeeRole && (
            <p className="text-sm text-gray-500">
              Position: {agreement.employeeRole}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Review Mode Banner - when start date reached but not yet reviewed */}
          {isStartDateReached && !hasReviewed && (
            <Card className="mb-6 bg-green-50 border-green-200">
              <CardHeader>
                <CardTitle className="text-lg text-green-800 flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Review Your Equipment Agreement
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-green-900">
                <p>
                  Please carefully review the equipment items listed below and the return policy.
                  Once you've reviewed everything, click the button at the bottom to proceed to signing.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Equipment Items */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Equipment Provided</CardTitle>
              </div>
              <CardDescription>
                {isStartDateReached && hasReviewed
                  ? 'Please check each item you have received from the company'
                  : 'Review the equipment items you will receive'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No equipment items listed</p>
              ) : isStartDateReached && hasReviewed ? (
                // Sign mode - with checkboxes
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Checkbox
                          id={`item-${index}`}
                          checked={item.received}
                          onCheckedChange={(checked) => handleItemChange(index, !!checked)}
                        />
                        <Label htmlFor={`item-${index}`} className="font-medium cursor-pointer">
                          {item.name}
                        </Label>
                      </div>
                      {item.quantity > 1 && (
                        <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                          Qty: {item.quantity}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Review mode - read-only list (no checkboxes)
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-4 h-4 rounded border border-gray-300 bg-white flex items-center justify-center">
                          <Package className="w-3 h-3 text-gray-400" />
                        </div>
                        <span className="font-medium text-gray-700">
                          {item.name}
                        </span>
                      </div>
                      {item.quantity > 1 && (
                        <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                          Qty: {item.quantity}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Equipment Return Policy */}
          <Card className="mb-6 bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="text-lg text-amber-800">Equipment Return Policy</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-900 space-y-3">
              <p>
                Upon termination of Agreement by Contractor or Company, any equipment provided or
                made available to Contractor must be returned to Company in like-condition,
                provided normal wear and tear.
              </p>
              <p>
                If materials are not returned in like condition, charges will accrue against
                Contractor's commission payables per the fee schedule below. If Contractor's
                commission payable are less than the amount due, Contractor will be invoiced
                according to the following fee schedule and will have thirty (30) days from
                the date of termination of Agreement to submit payment to The Roof Docs LLC by check:
              </p>
              <div className="bg-white rounded-lg p-4 mt-4">
                <h4 className="font-semibold mb-2">Fee Schedule:</h4>
                <ul className="space-y-1">
                  <li>Ladder: <strong>$300</strong></li>
                  <li>iPad w/ keyboard set (includes iPad charger and keyboard charger): <strong>$500</strong></li>
                  <li>High-powered Flashlight (includes flashlight charger with wall cube and car cube): <strong>$70</strong></li>
                  <li>Two Company Polos: <strong>$140 Total</strong> ($70/ea)</li>
                  <li>Company Winter Jacket: <strong>$250</strong></li>
                  <li>Company Long-sleeve shirt: <strong>$70</strong></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Acknowledgment */}
          <Card className="mb-6 bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg text-blue-800">Acknowledgment</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-900">
              <p>
                By signing below, I acknowledge that I have received the equipment items checked above
                from The Roof Docs LLC. I understand that I am responsible for these items and agree
                to return them in good condition upon request or termination of my employment/contract.
              </p>
              <p className="mt-2">
                I also acknowledge that I have read and understand the Equipment Return Policy above,
                and agree to the terms and conditions regarding the return and/or replacement of
                company equipment.
              </p>
            </CardContent>
          </Card>

          {/* Locked State Notice - Show when start date not reached */}
          {!isStartDateReached && agreement?.employeeStartDate && (
            <Card className="mb-6 bg-sky-50 border-sky-200">
              <CardHeader>
                <CardTitle className="text-lg text-sky-800 flex items-center gap-2">
                  <CalendarClock className="h-5 w-5" />
                  Scheduled for Review on Your Start Date
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-sky-900 space-y-3">
                <p>
                  You can review your equipment agreement now, but signing will be available on your start date:{' '}
                  <strong>
                    {new Date(agreement.employeeStartDate).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </strong>
                </p>
                <p>
                  On your start date, you will review all equipment and tools with your manager
                  before signing to confirm receipt.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Signature Section */}
          {isStartDateReached && hasReviewed ? (
            // Sign mode - show signature canvas
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PenLine className="h-5 w-5 text-primary" />
                  Sign Below
                </CardTitle>
                <CardDescription>
                  Please sign to confirm you have received the equipment items listed above
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <SignatureCanvas
                  signature={signature}
                  onSignatureChange={setSignature}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee Name</Label>
                    <Input
                      value={agreement?.employeeName || ''}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      value={new Date().toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : isStartDateReached && !hasReviewed ? (
            // Review mode - show message about signing after review
            <Card className="mb-6 bg-gray-50 border-gray-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-gray-600">
                  <PenLine className="h-5 w-5" />
                  Signature (After Review)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  After reviewing the equipment list and return policy above, click the button below
                  to proceed to signing.
                </p>
              </CardContent>
            </Card>
          ) : (
            // Locked mode - before start date
            <Card className="mb-6 opacity-60">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-gray-500">
                  <Lock className="h-4 w-4" />
                  Signature (Available on Start Date)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  The signature section will be unlocked on your start date when you
                  will review the equipment with your manager.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {isStartDateReached && !hasReviewed ? (
            // Review mode - show "Continue to Sign" button
            <Button
              type="button"
              className="w-full bg-green-600 hover:bg-green-700"
              size="lg"
              onClick={() => setHasReviewed(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              I've Reviewed - Continue to Sign
            </Button>
          ) : (
            // Submit button (locked or sign mode)
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={!isStartDateReached || !hasReviewed || submitMutation.isPending || !signature}
            >
              {!isStartDateReached ? (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Available on Start Date
                </>
              ) : submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <PenLine className="h-4 w-4 mr-2" />
                  Sign Agreement
                </>
              )}
            </Button>
          )}

          <p className="text-center text-sm text-gray-500 mt-4">
            {isStartDateReached && !hasReviewed
              ? 'Review the equipment list and return policy, then click above to proceed to signing.'
              : 'By signing and submitting this form, you acknowledge receipt of the equipment items listed above and agree to the Equipment Return Policy.'}
          </p>
        </form>
      </div>
    </div>
  );
}
