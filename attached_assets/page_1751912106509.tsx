
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Check, User, FileText, ClipboardCheck, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Logo } from '@/components/ui/logo';
import { EMPLOYEE_COMMITMENTS, DOCUMENT_TYPES } from '@/lib/constants';

const steps = [
  { id: 1, title: 'Personal Information', icon: User },
  { id: 2, title: 'Document Upload', icon: FileText },
  { id: 3, title: 'Review & Complete', icon: ClipboardCheck }
];

interface PersonalInfo {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    firstName: '',
    lastName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    dateOfBirth: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: ''
  });

  const [documents, setDocuments] = useState<File[]>([]);
  const [requiredDocs, setRequiredDocs] = useState<string[]>([]);

  useEffect(() => {
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    if (session.user.onboardingStatus === 'COMPLETED') {
      router.push('/dashboard');
      return;
    }

    // Set required documents based on employment type
    const docs = session.user.employmentType === 'W2' 
      ? ['DRIVERS_LICENSE', 'I9_FORM', 'W4_FORM']
      : ['DRIVERS_LICENSE', 'W9_FORM'];
    
    setRequiredDocs(docs);

    // Pre-fill name from session
    if (session.user.name) {
      const names = session.user.name.split(' ');
      setPersonalInfo(prev => ({
        ...prev,
        firstName: names[0] || '',
        lastName: names.slice(1).join(' ') || ''
      }));
    }
  }, [session, router]);

  const handlePersonalInfoSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/onboarding/personal-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personalInfo)
      });

      if (!response.ok) {
        throw new Error('Failed to save personal information');
      }

      setCurrentStep(2);
    } catch (error) {
      setError('Failed to save personal information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async () => {
    setLoading(true);
    setError('');

    try {
      // In a real implementation, you would upload files to storage
      // For now, we'll simulate the process
      
      const response = await fetch('/api/onboarding/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentCount: documents.length })
      });

      if (!response.ok) {
        throw new Error('Failed to upload documents');
      }

      setCurrentStep(3);
    } catch (error) {
      setError('Failed to upload documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      // Update session
      await update();
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      setError('Failed to complete onboarding. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/50 to-muted">
      <div className="mobile-container py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Logo size="lg" className="mb-6" />
          <h1 className="text-3xl font-bold text-secondary-950 mb-2">
            Welcome to Roof-ER!
          </h1>
          <p className="text-secondary-600 mb-6">
            Let's get you set up with everything you need to succeed
          </p>
          <Progress value={progress} className="max-w-md mx-auto" />
        </div>

        {/* Steps indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep > step.id
                    ? 'bg-primary border-primary text-white'
                    : currentStep === step.id
                    ? 'border-primary text-primary bg-white'
                    : 'border-secondary-300 text-secondary-400 bg-white'
                }`}>
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`ml-2 text-sm font-medium ${
                  currentStep >= step.id ? 'text-primary' : 'text-secondary-400'
                }`}>
                  {step.title}
                </span>
                {index < steps.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-secondary-300 ml-4" />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6 max-w-2xl mx-auto">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step Content */}
        <div className="max-w-2xl mx-auto">
          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Tell us about yourself so we can set up your profile
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="form-label">First Name</Label>
                    <Input
                      id="firstName"
                      value={personalInfo.firstName}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, firstName: e.target.value }))}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="form-label">Last Name</Label>
                    <Input
                      id="lastName"
                      value={personalInfo.lastName}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, lastName: e.target.value }))}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone" className="form-label">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={personalInfo.phone}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, phone: e.target.value }))}
                      className="form-input"
                      placeholder="(555) 123-4567"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateOfBirth" className="form-label">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={personalInfo.dateOfBirth}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                      className="form-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address" className="form-label">Address</Label>
                  <Input
                    id="address"
                    value={personalInfo.address}
                    onChange={(e) => setPersonalInfo(prev => ({ ...prev, address: e.target.value }))}
                    className="form-input"
                    placeholder="123 Main Street"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city" className="form-label">City</Label>
                    <Input
                      id="city"
                      value={personalInfo.city}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, city: e.target.value }))}
                      className="form-input"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="state" className="form-label">State</Label>
                    <Input
                      id="state"
                      value={personalInfo.state}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, state: e.target.value }))}
                      className="form-input"
                      placeholder="CA"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="zipCode" className="form-label">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      value={personalInfo.zipCode}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, zipCode: e.target.value }))}
                      className="form-input"
                      placeholder="12345"
                      required
                    />
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h4 className="font-medium text-secondary-950 mb-4">Emergency Contact</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergencyContactName" className="form-label">Contact Name</Label>
                      <Input
                        id="emergencyContactName"
                        value={personalInfo.emergencyContactName}
                        onChange={(e) => setPersonalInfo(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                        className="form-input"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergencyContactPhone" className="form-label">Contact Phone</Label>
                      <Input
                        id="emergencyContactPhone"
                        type="tel"
                        value={personalInfo.emergencyContactPhone}
                        onChange={(e) => setPersonalInfo(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                        className="form-input"
                        required
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Label htmlFor="emergencyContactRelation" className="form-label">Relationship</Label>
                    <Input
                      id="emergencyContactRelation"
                      value={personalInfo.emergencyContactRelation}
                      onChange={(e) => setPersonalInfo(prev => ({ ...prev, emergencyContactRelation: e.target.value }))}
                      className="form-input"
                      placeholder="Spouse, Parent, Sibling, etc."
                      required
                    />
                  </div>
                </div>

                <Button 
                  onClick={handlePersonalInfoSubmit}
                  disabled={loading}
                  className="w-full btn-primary"
                >
                  {loading ? 'Saving...' : 'Continue to Documents'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Document Upload */}
          {currentStep === 2 && (
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Required Documents
                </CardTitle>
                <CardDescription>
                  Upload the following documents to complete your profile
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {requiredDocs.map((docType) => (
                    <div key={docType} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-secondary-950">
                          {DOCUMENT_TYPES[docType as keyof typeof DOCUMENT_TYPES]}
                        </h4>
                        <Badge variant="outline" className="text-primary border-primary">
                          Required
                        </Badge>
                      </div>
                      <p className="text-sm text-secondary-600 mb-3">
                        Please upload a clear photo or scan of your document
                      </p>
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          Choose File
                        </Button>
                        <span className="text-sm text-secondary-500">
                          No file selected
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <Alert>
                  <AlertDescription>
                    <strong>Document Requirements:</strong> All documents must be current, legible, 
                    and show your full name. Accepted formats: JPG, PNG, PDF (max 10MB each).
                  </AlertDescription>
                </Alert>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleDocumentUpload}
                    disabled={loading}
                    className="flex-1 btn-primary"
                  >
                    {loading ? 'Uploading...' : 'Continue to Review'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Review & Complete */}
          {currentStep === 3 && (
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  Review & Complete
                </CardTitle>
                <CardDescription>
                  Review your information and acknowledge our commitments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Summary */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium text-secondary-950 mb-3">Your Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-secondary-600">Name:</span>
                    <span>{personalInfo.firstName} {personalInfo.lastName}</span>
                    <span className="text-secondary-600">Phone:</span>
                    <span>{personalInfo.phone}</span>
                    <span className="text-secondary-600">Employment Type:</span>
                    <span>{session?.user.employmentType === 'W2' ? 'W-2 Employee' : '1099 Contractor'}</span>
                    <span className="text-secondary-600">Documents:</span>
                    <span>{requiredDocs.length} uploaded</span>
                  </div>
                </div>

                {/* Employee Commitments */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium text-secondary-950 mb-3">
                    Your Commitment to Roof-ER
                  </h4>
                  <p className="text-sm text-secondary-600 mb-4">
                    By joining Roof-ER, you agree to uphold our core values and commitments:
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {EMPLOYEE_COMMITMENTS.map((commitment, index) => (
                      <div key={index} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{commitment}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Core Values */}
                <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20">
                  <h4 className="font-medium text-secondary-950 mb-2">Our Core Values</h4>
                  <div className="flex justify-center gap-6 text-sm">
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span className="font-medium text-primary">Integrity</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span className="font-medium text-primary">Quality</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span className="font-medium text-primary">Simplicity</span>
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(2)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    onClick={handleComplete}
                    disabled={loading}
                    className="flex-1 btn-primary"
                  >
                    {loading ? 'Completing...' : 'Complete Onboarding'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
