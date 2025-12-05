import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, AlertCircle, Eraser } from 'lucide-react';

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

export default function EquipmentChecklistForm() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [signature, setSignature] = useState<string | null>(null);

  // Clothing
  const [grayPolo, setGrayPolo] = useState(false);
  const [blackPolo, setBlackPolo] = useState(false);
  const [grayZip, setGrayZip] = useState(false);
  const [blackZip, setBlackZip] = useState(false);
  const [clothingNone, setClothingNone] = useState(false);
  const [clothingOther, setClothingOther] = useState('');

  // Materials
  const [ipadWithKeyboard, setIpadWithKeyboard] = useState(false);
  const [flashlightSet, setFlashlightSet] = useState(false);
  const [ladder, setLadder] = useState(false);
  const [ipadOnly, setIpadOnly] = useState(false);
  const [keyboardOnly, setKeyboardOnly] = useState(false);
  const [flashlightOnly, setFlashlightOnly] = useState(false);
  const [materialsNone, setMaterialsNone] = useState(false);
  const [materialsOther, setMaterialsOther] = useState('');

  // Return section
  const [itemsNotReturned, setItemsNotReturned] = useState('');

  // Submitted state
  const [submitted, setSubmitted] = useState(false);

  // Fetch checklist data
  const { data: checklist, isLoading, error } = useQuery({
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
      const response = await fetch(`/api/public/equipment-checklist/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit checklist');
      }
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: 'Checklist Submitted',
        description: 'Your equipment checklist has been successfully submitted.',
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

    const formData = {
      // Clothing
      grayPoloReceived: grayPolo,
      blackPoloReceived: blackPolo,
      grayZipReceived: grayZip,
      blackZipReceived: blackZip,
      clothingNone,
      clothingOther: clothingOther || null,

      // Materials
      ipadWithKeyboardReceived: ipadWithKeyboard,
      flashlightSetReceived: flashlightSet,
      ladderReceived: ladder,
      ipadOnlyReceived: ipadOnly,
      keyboardOnlyReceived: keyboardOnly,
      flashlightOnlyReceived: flashlightOnly,
      materialsNone,
      materialsOther: materialsOther || null,

      // Signature
      signatureData: signature,

      // Return section (for RETURNED type)
      itemsNotReturned: itemsNotReturned || null,
    };

    submitMutation.mutate(formData);
  };

  // Handle "None" checkbox logic
  const handleClothingNone = (checked: boolean) => {
    setClothingNone(checked);
    if (checked) {
      setGrayPolo(false);
      setBlackPolo(false);
      setGrayZip(false);
      setBlackZip(false);
    }
  };

  const handleMaterialsNone = (checked: boolean) => {
    setMaterialsNone(checked);
    if (checked) {
      setIpadWithKeyboard(false);
      setFlashlightSet(false);
      setLadder(false);
      setIpadOnly(false);
      setKeyboardOnly(false);
      setFlashlightOnly(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-gray-600">Loading checklist...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid or Expired Link</h2>
            <p className="text-gray-600">
              This equipment checklist link is invalid or has expired.
              Please contact HR for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted || checklist?.status === 'SIGNED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Checklist Submitted</h2>
            <p className="text-gray-600">
              Thank you! Your equipment checklist has been successfully submitted and recorded.
            </p>
            {checklist?.signedAt && (
              <p className="text-sm text-gray-500 mt-4">
                Signed on: {new Date(checklist.signedAt).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const isReturnForm = checklist?.type === 'RETURNED';

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
            Employee Material Checklist
          </h1>
          {checklist && (
            <p className="text-gray-600 mt-2">
              {checklist.employeeName} - {isReturnForm ? 'Equipment Return' : 'Equipment Received'}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">
                Please check all the clothing you {isReturnForm ? 'are returning' : 'received'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="grayPolo"
                    checked={grayPolo}
                    onCheckedChange={(c) => { setGrayPolo(!!c); setClothingNone(false); }}
                    disabled={clothingNone}
                  />
                  <Label htmlFor="grayPolo">Gray Polo with Logo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="blackPolo"
                    checked={blackPolo}
                    onCheckedChange={(c) => { setBlackPolo(!!c); setClothingNone(false); }}
                    disabled={clothingNone}
                  />
                  <Label htmlFor="blackPolo">Black Polo with Logo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="grayZip"
                    checked={grayZip}
                    onCheckedChange={(c) => { setGrayZip(!!c); setClothingNone(false); }}
                    disabled={clothingNone}
                  />
                  <Label htmlFor="grayZip">Gray Zip with Logo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="blackZip"
                    checked={blackZip}
                    onCheckedChange={(c) => { setBlackZip(!!c); setClothingNone(false); }}
                    disabled={clothingNone}
                  />
                  <Label htmlFor="blackZip">Black Zip with Logo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="clothingNone"
                    checked={clothingNone}
                    onCheckedChange={(c) => handleClothingNone(!!c)}
                  />
                  <Label htmlFor="clothingNone">None</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clothingOther">Other (please specify)</Label>
                  <Input
                    id="clothingOther"
                    value={clothingOther}
                    onChange={(e) => setClothingOther(e.target.value)}
                    placeholder="Other clothing items..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">
                Please mark all the materials you {isReturnForm ? 'are returning' : 'received'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ipadWithKeyboard"
                    checked={ipadWithKeyboard}
                    onCheckedChange={(c) => { setIpadWithKeyboard(!!c); setMaterialsNone(false); }}
                    disabled={materialsNone}
                  />
                  <Label htmlFor="ipadWithKeyboard">iPad with Keyboard set (includes iPad charger, keyboard charger, charger cube)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="flashlightSet"
                    checked={flashlightSet}
                    onCheckedChange={(c) => { setFlashlightSet(!!c); setMaterialsNone(false); }}
                    disabled={materialsNone}
                  />
                  <Label htmlFor="flashlightSet">Flashlight Set (includes flashlight charger, charger cube, car plug in)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ladder"
                    checked={ladder}
                    onCheckedChange={(c) => { setLadder(!!c); setMaterialsNone(false); }}
                    disabled={materialsNone}
                  />
                  <Label htmlFor="ladder">Ladder</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ipadOnly"
                    checked={ipadOnly}
                    onCheckedChange={(c) => { setIpadOnly(!!c); setMaterialsNone(false); }}
                    disabled={materialsNone}
                  />
                  <Label htmlFor="ipadOnly">iPad Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="keyboardOnly"
                    checked={keyboardOnly}
                    onCheckedChange={(c) => { setKeyboardOnly(!!c); setMaterialsNone(false); }}
                    disabled={materialsNone}
                  />
                  <Label htmlFor="keyboardOnly">Keyboard Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="flashlightOnly"
                    checked={flashlightOnly}
                    onCheckedChange={(c) => { setFlashlightOnly(!!c); setMaterialsNone(false); }}
                    disabled={materialsNone}
                  />
                  <Label htmlFor="flashlightOnly">Flashlight Only</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="materialsNone"
                    checked={materialsNone}
                    onCheckedChange={(c) => handleMaterialsNone(!!c)}
                  />
                  <Label htmlFor="materialsNone">None</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="materialsOther">Other (please specify)</Label>
                  <Input
                    id="materialsOther"
                    value={materialsOther}
                    onChange={(e) => setMaterialsOther(e.target.value)}
                    placeholder="Other materials..."
                  />
                </div>
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
                  <li>• Ladder: <strong>$300</strong></li>
                  <li>• iPad w/ keyboard set (includes iPad charger and keyboard charger): <strong>$500</strong></li>
                  <li>• High-powered Flashlight (includes flashlight charger with wall cube and car cube): <strong>$70</strong></li>
                  <li>• Two Company Polos: <strong>$140 Total</strong> ($70/ea)</li>
                  <li>• Company Winter Jacket: <strong>$250</strong></li>
                  <li>• Company Long-sleeve shirt: <strong>$70</strong></li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Return Section (for RETURNED type) */}
          {isReturnForm && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Items NOT Returned</CardTitle>
                <CardDescription>
                  Please list any items that you are NOT returning:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={itemsNotReturned}
                  onChange={(e) => setItemsNotReturned(e.target.value)}
                  placeholder="List any items not being returned..."
                  rows={4}
                />
              </CardContent>
            </Card>
          )}

          {/* Signature Section */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">
                Please Sign and Date {isReturnForm ? 'That You Have Returned Everything Above' : 'That You Have Received the Above Items'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <SignatureCanvas
                signature={signature}
                onSignatureChange={setSignature}
              />

              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  value={new Date().toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitMutation.isPending || !signature}
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Checklist'
            )}
          </Button>

          <p className="text-center text-sm text-gray-500 mt-4">
            By signing and submitting this form, you acknowledge receipt/return of the items listed above.
          </p>
        </form>
      </div>
    </div>
  );
}
