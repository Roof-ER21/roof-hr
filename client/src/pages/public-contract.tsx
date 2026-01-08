import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle, Eraser, FileText, Download, PenLine } from 'lucide-react';

interface ContractData {
  id: string;
  recipientName: string;
  recipientEmail: string;
  title: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  status: string;
  fieldValues?: Record<string, any>;
  createdAt: string;
  alreadySigned?: boolean;
  message?: string;
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

export default function PublicContractPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  // Form state
  const [signature, setSignature] = useState<string | null>(null);
  const [signatureAddress, setSignatureAddress] = useState('');
  const [hasReviewed, setHasReviewed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Fetch contract data
  const { data: contract, isLoading, error } = useQuery<ContractData>({
    queryKey: ['/api/public/contract', token],
    queryFn: async () => {
      const response = await fetch(`/api/public/contract/${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load contract');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async (formData: { signature: string; signatureAddress: string }) => {
      const response = await fetch(`/api/public/contract/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sign contract');
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: 'Contract Signed',
        description: 'Your contract has been successfully signed. You will receive a confirmation email.',
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
        description: 'Please sign the contract before submitting.',
        variant: 'destructive',
      });
      return;
    }

    if (!hasReviewed) {
      toast({
        title: 'Review Required',
        description: 'Please confirm that you have read and understood the contract.',
        variant: 'destructive',
      });
      return;
    }

    submitMutation.mutate({
      signature,
      signatureAddress,
    });
  };

  const handleDownload = () => {
    if (token) {
      window.open(`/api/public/contract/${token}/download`, '_blank');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <p className="mt-4 text-gray-600">Loading contract...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Contract Not Available</h2>
            <p className="mt-2 text-gray-600 text-center">
              {(error as Error).message}
            </p>
            <p className="mt-4 text-sm text-gray-500">
              If you believe this is an error, please contact HR.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already signed state
  if (contract?.alreadySigned || submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-xl font-semibold text-gray-900">Contract Signed Successfully</h2>
            <p className="mt-2 text-gray-600 text-center">
              {submitted
                ? 'Thank you for signing! A confirmation email will be sent to you shortly.'
                : 'This contract has already been signed. Thank you!'}
            </p>
            <div className="mt-6 p-4 bg-gray-100 rounded-lg w-full max-w-md">
              <p className="text-sm text-gray-700"><strong>Contract:</strong> {contract?.title}</p>
              <p className="text-sm text-gray-700"><strong>Recipient:</strong> {contract?.recipientName}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Contract ready for signing
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <CardTitle className="text-2xl">{contract?.title}</CardTitle>
                <CardDescription>
                  Please review and sign this contract
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Recipient:</span>
                <span className="ml-2 font-medium">{contract?.recipientName}</span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>
                <span className="ml-2 font-medium">{contract?.recipientEmail}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contract PDF Viewer */}
        {contract?.fileUrl && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Contract Document</CardTitle>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden bg-gray-100" style={{ height: '600px' }}>
                <iframe
                  src={`/api/public/contract/${token}/download#toolbar=1&navpanes=0`}
                  className="w-full h-full"
                  title="Contract PDF"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Contract Content (if no PDF) */}
        {!contract?.fileUrl && contract?.content && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Contract Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="prose max-w-none p-4 bg-white border rounded-lg"
                dangerouslySetInnerHTML={{ __html: contract.content }}
              />
            </CardContent>
          </Card>
        )}

        {/* Signature Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PenLine className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Sign Contract</CardTitle>
            </div>
            <CardDescription>
              Please review the contract above, then provide your signature below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Review Confirmation */}
              <div className="flex items-start space-x-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Checkbox
                  id="review-confirm"
                  checked={hasReviewed}
                  onCheckedChange={(checked) => setHasReviewed(checked === true)}
                />
                <div>
                  <label
                    htmlFor="review-confirm"
                    className="text-sm font-medium cursor-pointer"
                  >
                    I confirm that I have read and understood the entire contract
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    By checking this box, you acknowledge that you have carefully reviewed all terms and conditions.
                  </p>
                </div>
              </div>

              {/* Address Input (Multi-line) */}
              <div className="space-y-2">
                <Label htmlFor="address">Your Address (optional)</Label>
                <Textarea
                  id="address"
                  placeholder="123 Main Street&#10;City, State ZIP"
                  value={signatureAddress}
                  onChange={(e) => setSignatureAddress(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  Enter your address as it should appear on the contract (multi-line format).
                </p>
              </div>

              {/* Signature Canvas */}
              <SignatureCanvas
                signature={signature}
                onSignatureChange={setSignature}
              />

              {/* Submit Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitMutation.isPending || !signature || !hasReviewed}
                  className="min-w-[200px]"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    <>
                      <PenLine className="h-4 w-4 mr-2" />
                      Sign Contract
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>ROOF-ER HR Management System</p>
          <p className="mt-1">If you have questions about this contract, please contact HR.</p>
        </div>
      </div>
    </div>
  );
}
