import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Upload,
  Shield,
  Store,
  Building2,
  RefreshCw,
  FileText,
  User,
  ExternalLink,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FolderSync,
  Megaphone,
  Target
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDropzone } from 'react-dropzone';
import { format } from 'date-fns';

// Category configuration
const CATEGORIES = [
  {
    id: 'insurance-sales',
    name: 'Insurance Sales',
    icon: Shield,
    color: 'bg-red-500',
    description: 'Insurance sales representatives'
  },
  {
    id: 'retail-closer',
    name: 'Retail Closer',
    icon: Target,
    color: 'bg-green-500',
    description: 'Retail closing sales positions'
  },
  {
    id: 'retail-marketing',
    name: 'Retail Marketing',
    icon: Megaphone,
    color: 'bg-purple-500',
    description: 'Retail marketing and lead generation'
  },
  {
    id: 'office',
    name: 'Office',
    icon: Building2,
    color: 'bg-orange-500',
    description: 'Administrative and office roles'
  },
  {
    id: 'production-coordinator',
    name: 'Production Coordinator',
    icon: Store,
    color: 'bg-blue-500',
    description: 'Production coordination and scheduling'
  },
  {
    id: 'field-tech',
    name: 'Field Tech',
    icon: RefreshCw,
    color: 'bg-cyan-500',
    description: 'Field technicians and installers'
  }
] as const;

type CategoryId = typeof CATEGORIES[number]['id'];

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  resumeUrl: string;
  status: string;
  stage: string;
  source: string;
  appliedDate: string;
}

interface Sourcer {
  id: string;
  firstName: string;
  lastName: string;
  screenerColor?: string;
  activeAssignments?: number;
}

export default function ResumeUploaderPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<CategoryId>('insurance-sales');
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [sourceFolderId, setSourceFolderId] = useState('');

  // Sourcer assignment dialog state
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState<any>(null);
  const [selectedSourcer, setSelectedSourcer] = useState<string>('');

  // Query for recent uploads
  const { data: recentData, isLoading: isLoadingRecent, refetch: refetchRecent } = useQuery({
    queryKey: ['/api/resumes/recent', activeCategory],
    queryFn: async () => {
      const res = await fetch(`/api/resumes/recent?category=${activeCategory}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch recent resumes');
      return res.json();
    }
  });

  // Query for available sourcers
  const { data: sourcers } = useQuery<Sourcer[]>({
    queryKey: ['/api/sourcers/available'],
    queryFn: async () => {
      const res = await fetch('/api/sourcers/available', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        credentials: 'include',
      });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ file, category }: { file: File; category: CategoryId }) => {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('category', category);

      const response = await fetch('/api/resumes/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Show sourcer assignment dialog
      setPendingCandidate(data.candidate);
      setShowAssignmentDialog(true);
    },
    onError: (error: Error) => {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Sync from Drive mutation
  const syncMutation = useMutation({
    mutationFn: async ({ category, sourceFolderId }: { category: CategoryId; sourceFolderId?: string }) => {
      const response = await fetch('/api/resumes/sync-from-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        credentials: 'include',
        body: JSON.stringify({ category, sourceFolderId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Sync Complete',
        description: `Processed ${data.processed} new resumes`,
      });
      setSyncDialogOpen(false);
      refetchRecent();
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Sync Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Dropzone handler
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate({ file: acceptedFiles[0], category: activeCategory });
    }
  }, [activeCategory, uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
    disabled: uploadMutation.isPending
  });

  const activeCategoryData = CATEGORIES.find(c => c.id === activeCategory)!;

  // Handle sourcer assignment completion
  const handleAssignmentComplete = async () => {
    if (selectedSourcer && pendingCandidate) {
      try {
        const response = await fetch(`/api/candidates/${pendingCandidate.id}/assign-sourcer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
          credentials: 'include',
          body: JSON.stringify({ hrMemberId: selectedSourcer }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Assignment failed with status ${response.status}`);
        }

        const sourcerName = sourcers?.find(s => s.id === selectedSourcer);
        toast({
          title: 'Candidate Created & Assigned',
          description: `${pendingCandidate.firstName} ${pendingCandidate.lastName} assigned to ${sourcerName?.firstName} ${sourcerName?.lastName}`,
        });
      } catch (error: any) {
        console.error('[Assignment] Failed:', error);
        toast({
          title: 'Assignment Failed',
          description: `${pendingCandidate.firstName} ${pendingCandidate.lastName} created but assignment failed: ${error.message}`,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Resume Uploaded',
        description: `Created candidate: ${pendingCandidate?.firstName} ${pendingCandidate?.lastName}`,
      });
    }
    // Clean up
    setShowAssignmentDialog(false);
    setPendingCandidate(null);
    setSelectedSourcer('');
    refetchRecent();
    queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
    queryClient.invalidateQueries({ queryKey: ['/api/sourcers/available'] });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Resume Uploader</h1>
          <p className="text-muted-foreground mt-1">
            Upload resumes to automatically create candidates in the recruiting pipeline
          </p>
        </div>
        <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="gap-2">
              <FolderSync className="h-4 w-4" />
              Sync from Drive
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sync Resumes from Google Drive</DialogTitle>
              <DialogDescription>
                Import resumes from a Google Drive folder. The folder should have subfolders
                named "Insurance Sales", "Retail Sales", and "Office".
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="folderId">Source Folder ID (optional)</Label>
                <Input
                  id="folderId"
                  placeholder="Leave empty to use default folder"
                  value={sourceFolderId}
                  onChange={(e) => setSourceFolderId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  The folder ID can be found in the Google Drive URL after /folders/
                </p>
              </div>
              <div className="space-y-2">
                <Label>Category to Sync</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={activeCategory === cat.id ? 'default' : 'outline'}
                      size="sm"
                      className="gap-1"
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      <cat.icon className="h-3 w-3" />
                      {cat.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSyncDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => syncMutation.mutate({
                  category: activeCategory,
                  sourceFolderId: sourceFolderId || undefined
                })}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Start Sync
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as CategoryId)}>
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className={`flex items-center gap-2 ${cat.color} text-white data-[state=active]:ring-2 data-[state=active]:ring-offset-2`}>
              <cat.icon className="h-4 w-4" />
              <span className="hidden md:inline">{cat.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.id} value={cat.id} className="mt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Upload Zone */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload Resume
                  </CardTitle>
                  <CardDescription>
                    {cat.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    {...getRootProps()}
                    className={`
                      border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
                      ${isDragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-muted-foreground/25 hover:border-primary/50'}
                      ${uploadMutation.isPending ? 'opacity-50 pointer-events-none' : ''}
                    `}
                  >
                    <input {...getInputProps()} />
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="h-12 w-12 mx-auto text-primary mb-4 animate-spin" />
                        <p className="font-medium">Processing resume...</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Susan AI is extracting candidate information
                        </p>
                      </>
                    ) : isDragActive ? (
                      <>
                        <Upload className="h-12 w-12 mx-auto text-primary mb-4" />
                        <p className="font-medium">Drop the resume here...</p>
                      </>
                    ) : (
                      <>
                        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="font-medium">Drag & drop a resume here</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          or click to select (PDF, DOC, DOCX)
                        </p>
                        <p className="text-xs text-muted-foreground mt-4">
                          Susan AI will automatically extract the candidate's name and create their profile
                        </p>
                      </>
                    )}
                  </div>

                  {/* Upload Stats */}
                  <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      AI-powered name extraction
                    </div>
                    <div>Max file size: 10MB</div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Uploads */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Recent Uploads
                    </span>
                    <Badge variant="secondary">
                      {recentData?.total || 0} total
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Recently uploaded resumes for {cat.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoadingRecent ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : recentData?.candidates?.length > 0 ? (
                    <div className="space-y-3">
                      {recentData.candidates.map((candidate: Candidate) => (
                        <div
                          key={candidate.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 rounded-full ${cat.color} flex items-center justify-center`}>
                              <User className="h-5 w-5 text-white" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {candidate.firstName} {candidate.lastName}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{candidate.stage}</span>
                                <span>•</span>
                                <span>{format(new Date(candidate.appliedDate), 'MMM d, yyyy')}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={candidate.source === 'Resume Upload' ? 'default' : 'secondary'}
                            >
                              {candidate.source === 'Resume Upload' ? 'Uploaded' : 'Synced'}
                            </Badge>
                            {candidate.resumeUrl && (
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                              >
                                <a
                                  href={candidate.resumeUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="View Resume"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No resumes uploaded yet for {cat.name}</p>
                      <p className="text-sm mt-1">Upload a resume to get started</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold">Direct Upload</h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop resumes directly into the upload zone
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <FolderSync className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold">Drive Sync</h3>
                <p className="text-sm text-muted-foreground">
                  Import multiple resumes from a Google Drive folder
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold">AI Processing</h3>
                <p className="text-sm text-muted-foreground">
                  Susan AI extracts names and creates candidates automatically
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sourcer Assignment Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={setShowAssignmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Sourcer</DialogTitle>
            <DialogDescription>
              Candidate <strong>{pendingCandidate?.firstName} {pendingCandidate?.lastName}</strong> created successfully.
              Would you like to assign a sourcer to this candidate?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="sourcer-select">Select Sourcer (optional)</Label>
            <Select value={selectedSourcer} onValueChange={setSelectedSourcer}>
              <SelectTrigger id="sourcer-select" className="mt-2">
                <SelectValue placeholder="Select a sourcer..." />
              </SelectTrigger>
              <SelectContent>
                {sourcers?.map((sourcer) => (
                  <SelectItem key={sourcer.id} value={sourcer.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: sourcer.screenerColor || '#6B7280' }}
                      />
                      <span>{sourcer.firstName} {sourcer.lastName}</span>
                      {sourcer.activeAssignments !== undefined && (
                        <span className="text-muted-foreground text-xs">
                          ({sourcer.activeAssignments} active)
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignmentDialog(false);
                setPendingCandidate(null);
                setSelectedSourcer('');
                toast({
                  title: 'Resume Uploaded',
                  description: `Created candidate: ${pendingCandidate?.firstName} ${pendingCandidate?.lastName}`,
                });
                refetchRecent();
                queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
              }}
            >
              Skip
            </Button>
            <Button onClick={handleAssignmentComplete}>
              {selectedSourcer ? 'Assign & Continue' : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
