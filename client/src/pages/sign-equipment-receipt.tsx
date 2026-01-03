import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle, Eraser, Package, Lock, CalendarClock, PenLine } from 'lucide-react';

interface ReceiptItem {
  toolId: string;
  toolName: string;
  quantity: number;
}

interface Receipt {
  id: string;
  employeeName: string;
  position: string;
  startDate?: string;
  items: ReceiptItem[];
  status: string;
  signatureDate?: string;
}

interface TokenResponse {
  locked: boolean;
  unlockDate?: string;
  receipt: Receipt;
}

// Signature Canvas Component
function SignatureCanvas({
  onSignatureChange,
}: {
  onSignatureChange: (data: string | null) => void;
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

export default function SignEquipmentReceipt() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  // Form state
  const [signature, setSignature] = useState<string | null>(null);
  const [trainingAcknowledged, setTrainingAcknowledged] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Fetch receipt data via token
  const { data, isLoading, error } = useQuery<TokenResponse>({
    queryKey: ['equipment-receipt-token', token],
    queryFn: async () => {
      const response = await fetch(`/api/equipment-receipts/token/${token}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load receipt');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (formData: { signatureData: string; trainingAcknowledged: boolean }) => {
      const response = await fetch(`/api/equipment-receipts/token/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sign receipt');
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: 'Receipt Signed',
        description: 'Your equipment receipt has been successfully signed.',
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

    if (!signature) {
      toast({
        title: 'Signature Required',
        description: 'Please sign the form before submitting.',
        variant: 'destructive',
      });
      return;
    }

    if (!trainingAcknowledged) {
      toast({
        title: 'Training Acknowledgment Required',
        description: 'Please acknowledge that you have completed the required training.',
        variant: 'destructive',
      });
      return;
    }

    submitMutation.mutate({ signatureData: signature, trainingAcknowledged });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-gray-600">Loading equipment receipt...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    const errorMessage = (error as Error).message;
    const isExpired = errorMessage.includes('expired');
    const isAlreadySigned = errorMessage.includes('already been signed');

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            {isAlreadySigned ? (
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            ) : (
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            )}
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {isAlreadySigned ? 'Already Signed' : isExpired ? 'Link Expired' : 'Invalid Link'}
            </h2>
            <p className="text-gray-600">
              {isAlreadySigned
                ? 'This equipment receipt has already been signed.'
                : isExpired
                ? 'This link has expired. Please contact HR for a new link.'
                : errorMessage}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Receipt Signed!</h2>
            <p className="text-gray-600">
              Thank you! Your equipment receipt has been signed and recorded.
            </p>
            <p className="text-sm text-gray-500 mt-4">
              You can now close this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const receipt = data?.receipt;
  const isLocked = data?.locked;

  // Locked state - before start date
  if (isLocked && data?.unlockDate) {
    const unlockDate = new Date(data.unlockDate);

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
            <h1 className="text-2xl font-bold text-gray-900">Equipment Receipt</h1>
            <p className="text-gray-600 mt-2">Welcome, {receipt?.employeeName}!</p>
          </div>

          {/* Locked Notice */}
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardHeader className="text-center">
              <Lock className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <CardTitle className="text-xl text-amber-800">Signing Locked</CardTitle>
              <CardDescription className="text-amber-700">
                This equipment receipt will be available for signing on{' '}
                <strong>
                  {unlockDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-amber-800 text-sm">
                Please return on your first day to sign this receipt after receiving your equipment.
              </p>
            </CardContent>
          </Card>

          {/* Equipment Preview */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Equipment You'll Receive</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {receipt?.items.map((item, index) => (
                  <li key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{item.toolName}</span>
                    {item.quantity > 1 && (
                      <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                        Qty: {item.quantity}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Training Reminder */}
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg text-blue-800 flex items-center gap-2">
                <CalendarClock className="h-5 w-5" />
                Before Your Start Date
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-blue-900">
              <p>
                Make sure to complete your required training at{' '}
                <a href="https://a21.up.railway.app/" className="underline font-medium" target="_blank" rel="noopener noreferrer">
                  a21.up.railway.app
                </a>
                {' '}before your first day.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Signing form - start date reached
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
          <h1 className="text-2xl font-bold text-gray-900">Equipment Receipt</h1>
          <p className="text-gray-600 mt-2">Welcome, {receipt?.employeeName}!</p>
          {receipt?.position && (
            <p className="text-sm text-gray-500">Position: {receipt.position}</p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Equipment Items */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Equipment Received</CardTitle>
              </div>
              <CardDescription>
                Verify the equipment items you have received
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {receipt?.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium">{item.toolName}</span>
                    {item.quantity > 1 && (
                      <span className="text-sm text-gray-500 bg-gray-200 px-2 py-1 rounded">
                        Qty: {item.quantity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Equipment Return Policy */}
          <Card className="mb-6 bg-amber-50 border-amber-200">
            <CardHeader>
              <CardTitle className="text-lg text-amber-800">Equipment Return Policy</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-amber-900 space-y-3">
              <p>
                Upon termination, any equipment provided must be returned to the Company
                in like-condition, provided normal wear and tear.
              </p>
              <p>
                If materials are not returned in like condition, charges will accrue per
                the fee schedule. Unreturned items will be invoiced and payment is due
                within thirty (30) days.
              </p>
            </CardContent>
          </Card>

          {/* Training Acknowledgment */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Training Acknowledgment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="training"
                  checked={trainingAcknowledged}
                  onCheckedChange={(checked) => setTrainingAcknowledged(!!checked)}
                />
                <Label htmlFor="training" className="cursor-pointer leading-relaxed">
                  I acknowledge that I must complete the required training at{' '}
                  <a href="https://a21.up.railway.app/" className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">
                    a21.up.railway.app
                  </a>
                  {' '}and understand my responsibilities regarding company equipment.
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Signature Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PenLine className="h-5 w-5 text-primary" />
                Sign Below
              </CardTitle>
              <CardDescription>
                Sign to confirm you have received the equipment items listed above
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SignatureCanvas onSignatureChange={setSignature} />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Employee Name</Label>
                  <Input
                    value={receipt?.employeeName || ''}
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

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitMutation.isPending || !signature || !trainingAcknowledged}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <PenLine className="h-4 w-4 mr-2" />
                Sign Equipment Receipt
              </>
            )}
          </Button>

          <p className="text-center text-sm text-gray-500 mt-4">
            By signing, you acknowledge receipt of the equipment items listed above
            and agree to the Equipment Return Policy.
          </p>
        </form>
      </div>
    </div>
  );
}
