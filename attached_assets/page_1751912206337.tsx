
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  User,
  FileText,
  Calendar,
  Phone,
  MapPin,
  Mail,
  Edit,
  Upload,
  Download,
  CheckCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MainLayout } from '@/components/layout/main-layout';
import { DOCUMENT_TYPES, USER_ROLES, EMPLOYMENT_TYPES } from '@/lib/constants';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  employeeId: string;
  role: string;
  employmentType: string;
  hireDate: string;
  ptoBalance: number;
  ptoUsed: number;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

interface Document {
  id: string;
  type: string;
  fileName: string;
  uploadedAt: string;
  expiresAt?: string;
  isRequired: boolean;
  isApproved: boolean;
}

interface PTORequest {
  id: string;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: string;
  createdAt: string;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [ptoHistory, setPtoHistory] = useState<PTORequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
      return;
    }

    if (session?.user?.onboardingStatus === 'PENDING') {
      router.push('/onboarding');
      return;
    }

    fetchUserProfile();
  }, [session, status, router]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      
      // Fetch user profile
      const profileResponse = await fetch('/api/user/profile');
      if (!profileResponse.ok) throw new Error('Failed to fetch profile');
      const profileData = await profileResponse.json();
      setUserProfile(profileData.user);

      // Fetch documents
      const docsResponse = await fetch('/api/user/documents');
      if (!docsResponse.ok) throw new Error('Failed to fetch documents');
      const docsData = await docsResponse.json();
      setDocuments(docsData.documents);

      // Fetch PTO history
      const ptoResponse = await fetch('/api/user/pto-history');
      if (!ptoResponse.ok) throw new Error('Failed to fetch PTO history');
      const ptoData = await ptoResponse.json();
      setPtoHistory(ptoData.requests);

    } catch (error) {
      console.error('Error fetching profile data:', error);
      setError('Failed to load profile data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="spinner border-primary"></div>
        </div>
      </MainLayout>
    );
  }

  if (!session || !userProfile) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-secondary-600">Unable to load profile information.</p>
        </div>
      </MainLayout>
    );
  }

  const getDocumentStatus = (doc: Document) => {
    if (!doc.isApproved) {
      return { status: 'pending', color: 'yellow', icon: Clock };
    }
    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      return { status: 'expired', color: 'red', icon: AlertTriangle };
    }
    return { status: 'approved', color: 'green', icon: CheckCircle };
  };

  const getPTOStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { variant: 'secondary' as const, text: 'Pending' },
      APPROVED: { variant: 'default' as const, text: 'Approved' },
      DENIED: { variant: 'destructive' as const, text: 'Denied' },
      CANCELLED: { variant: 'outline' as const, text: 'Cancelled' }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    return <Badge variant={config.variant}>{config.text}</Badge>;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-secondary-950">My Profile</h1>
            <p className="text-secondary-600 mt-1">
              Manage your personal information and documents
            </p>
          </div>
          <Button className="btn-primary flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Edit Profile
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="info" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="info">Personal Info</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="pto">PTO History</TabsTrigger>
          </TabsList>

          {/* Personal Information Tab */}
          <TabsContent value="info" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <Card className="roof-er-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Basic Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-secondary-600">First Name</label>
                      <p className="text-secondary-950">{userProfile.firstName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-secondary-600">Last Name</label>
                      <p className="text-secondary-950">{userProfile.lastName}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-secondary-600">Email</label>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-secondary-400" />
                      <p className="text-secondary-950">{userProfile.email}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-secondary-600">Phone</label>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-secondary-400" />
                      <p className="text-secondary-950">{userProfile.phone}</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-secondary-600">Address</label>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-secondary-400" />
                      <p className="text-secondary-950">
                        {userProfile.address}, {userProfile.city}, {userProfile.state} {userProfile.zipCode}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Employment Information */}
              <Card className="roof-er-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Employment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-secondary-600">Employee ID</label>
                    <p className="text-secondary-950 font-mono">{userProfile.employeeId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-secondary-600">Role</label>
                    <p className="text-secondary-950">
                      {USER_ROLES[userProfile.role as keyof typeof USER_ROLES] || userProfile.role}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-secondary-600">Employment Type</label>
                    <Badge variant="outline" className="mt-1">
                      {EMPLOYMENT_TYPES[userProfile.employmentType as keyof typeof EMPLOYMENT_TYPES]}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-secondary-600">Hire Date</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-secondary-400" />
                      <p className="text-secondary-950">
                        {new Date(userProfile.hireDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <label className="text-sm font-medium text-secondary-600">PTO Balance</label>
                      <p className="text-2xl font-bold text-primary">{userProfile.ptoBalance}</p>
                      <p className="text-xs text-secondary-500">days remaining</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-secondary-600">PTO Used</label>
                      <p className="text-2xl font-bold text-blue-600">{userProfile.ptoUsed}</p>
                      <p className="text-xs text-secondary-500">days this year</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Emergency Contact */}
              <Card className="roof-er-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    Emergency Contact
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-secondary-600">Contact Name</label>
                    <p className="text-secondary-950">{userProfile.emergencyContactName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-secondary-600">Phone Number</label>
                    <p className="text-secondary-950">{userProfile.emergencyContactPhone}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-secondary-600">Relationship</label>
                    <p className="text-secondary-950">{userProfile.emergencyContactRelation}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-6">
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  My Documents
                </CardTitle>
                <CardDescription>
                  Manage your uploaded documents and certifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {documents.length === 0 ? (
                    <div className="text-center py-8 text-secondary-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No documents uploaded yet</p>
                      <Button className="mt-4 btn-primary flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        Upload Document
                      </Button>
                    </div>
                  ) : (
                    documents.map((doc) => {
                      const { status, color, icon: StatusIcon } = getDocumentStatus(doc);
                      
                      return (
                        <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <StatusIcon className={`h-5 w-5 text-${color}-600`} />
                            <div>
                              <h4 className="font-medium text-secondary-950">
                                {DOCUMENT_TYPES[doc.type as keyof typeof DOCUMENT_TYPES] || doc.type}
                              </h4>
                              <p className="text-sm text-secondary-600">{doc.fileName}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-secondary-500">
                                  Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                                </span>
                                {doc.expiresAt && (
                                  <>
                                    <span className="text-xs text-secondary-400">•</span>
                                    <span className="text-xs text-secondary-500">
                                      Expires {new Date(doc.expiresAt).toLocaleDateString()}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={status === 'approved' ? 'default' : status === 'pending' ? 'secondary' : 'destructive'}
                            >
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </Badge>
                            {doc.isRequired && (
                              <Badge variant="outline" className="text-primary border-primary">
                                Required
                              </Badge>
                            )}
                            <Button variant="outline" size="sm" className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              Download
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {documents.length > 0 && (
                  <div className="flex justify-center pt-6 border-t mt-6">
                    <Button className="btn-outline flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Upload New Document
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PTO History Tab */}
          <TabsContent value="pto" className="space-y-6">
            <Card className="roof-er-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  PTO History
                </CardTitle>
                <CardDescription>
                  View your time off requests and history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {ptoHistory.length === 0 ? (
                    <div className="text-center py-8 text-secondary-500">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No PTO requests yet</p>
                      <Button className="mt-4 btn-primary">
                        Request Time Off
                      </Button>
                    </div>
                  ) : (
                    ptoHistory.map((request) => (
                      <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-medium text-secondary-950">
                              {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                            </h4>
                            {getPTOStatusBadge(request.status)}
                          </div>
                          <p className="text-sm text-secondary-600 mb-1">
                            {request.days} day{request.days !== 1 ? 's' : ''}
                          </p>
                          {request.reason && (
                            <p className="text-sm text-secondary-500">
                              Reason: {request.reason}
                            </p>
                          )}
                          <p className="text-xs text-secondary-400 mt-1">
                            Requested {new Date(request.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {ptoHistory.length > 0 && (
                  <div className="flex justify-center pt-6 border-t mt-6">
                    <Button className="btn-primary">
                      Request New PTO
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
