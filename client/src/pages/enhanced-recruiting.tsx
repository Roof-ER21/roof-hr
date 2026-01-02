import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DndContext, DragOverlay, closestCenter, useDroppable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Users, UserPlus, UserCheck, Calendar, Phone, Mail, FileText,
  Clock, ChevronRight, CheckCircle, XCircle, AlertCircle,
  Download, Upload, Send, MoreVertical, Brain, Star,
  TrendingUp, Award, Zap, GitCompare, MailIcon, X, FileUp, Pencil,
  Shield, Store, Building2, RefreshCw, User, ExternalLink,
  CheckCircle2, Loader2, FolderSync, Megaphone, Target,
  Clipboard, Wrench, Eye, Check, ChevronsUpDown
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { CandidateComparison } from '@/components/recruiting/candidate-comparison';
import { InterviewScheduler } from '@/components/recruiting/interview-scheduler';
import { InterviewDashboard } from '@/components/recruiting/interview-dashboard';
import { DraggableCandidateCard } from '@/components/recruiting/draggable-candidate-card';
import { EmailTemplateGenerator } from '@/components/recruiting/email-template-generator';
import { EmailCampaignManager } from '@/components/recruiting/email-campaign-manager';
import { WorkflowBuilder } from '@/components/workflows/workflow-builder';
// CandidateQuestionnaire removed - no longer showing popup when moving to Hired
import { CandidateNotes } from '@/components/CandidateNotes';
import { ChatbotWidget } from '@/components/recruitment/chatbot-widget';
import { AIInsightsPanel } from '@/components/ai-enhancements/ai-insights-panel';
import { InPersonInterviewScreening, type ScreeningData } from '@/components/recruiting/in-person-interview-screening';
import { HireCandidateModal, type HireData } from '@/components/recruiting/hire-candidate-modal';
import type { Candidate } from '@shared/schema';
import { useDropzone } from 'react-dropzone';
import { format, isSameDay, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { Calendar as CalendarUI } from '@/components/ui/calendar';
import { DEPARTMENTS } from '@/../../shared/constants/departments';

// Droppable Column Component
function DroppableColumn({ status, children, disabled = false }: { status: string; children: React.ReactNode; disabled?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    disabled, // Prevents drops when disabled
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${
        isOver && !disabled ? 'bg-blue-50 border-2 border-blue-300 border-dashed rounded-lg' : ''
      }`}
      title={disabled ? 'SOURCERs cannot move candidates to this stage. Contact a manager.' : undefined}
    >
      {children}
    </div>
  );
}

const stages = {
  APPLIED: { name: 'Application Review', next: 'SCREENING', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-semibold' },
  SCREENING: { name: 'Phone Screening', next: 'INTERVIEW', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-semibold' },
  INTERVIEW: { name: 'Interview Process', next: 'OFFER', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-semibold' },
  OFFER: { name: 'Offer Extended', next: 'HIRED', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-semibold' },
  HIRED: { name: 'Hired', next: null, color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 font-semibold' },
  DEAD: { name: 'Dead', next: null, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 font-semibold' },
  // Keep these for internal status but combine in display
  DEAD_BY_US: { name: 'DEAD by us', next: null, color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 font-semibold' },
  DEAD_BY_CANDIDATE: { name: 'DEAD by candidate', next: null, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 font-semibold' },
  NO_SHOW: { name: 'No Show', next: null, color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 font-semibold' }
};

// Display stages for Kanban view (combines DEAD_BY_US and DEAD_BY_CANDIDATE into one column)
const kanbanStages = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'DEAD'] as const;

const positionTypes = [
  'Insurance Sales',
  'Retail Closer',
  'Retail Marketing',
  'Office',
  'Production Coordinator',
  'Field Tech',
  'Field Worker',
  'Sales Representative',
  'Project Manager',
  'Administrative Assistant',
  'Safety Coordinator',
  'Quality Inspector',
  'Crew Lead',
  'Customer Service Rep',
  'Marketing Specialist',
  'Operations Manager'
];

// Edit Candidate Form Component
function EditCandidateForm({
  candidate,
  positionTypes,
  onSubmit,
  onCancel,
  isPending
}: {
  candidate: Candidate;
  positionTypes: string[];
  onSubmit: (data: Partial<Candidate>) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [firstName, setFirstName] = useState(candidate.firstName);
  const [lastName, setLastName] = useState(candidate.lastName);
  const [email, setEmail] = useState(candidate.email || '');
  const [phone, setPhone] = useState(candidate.phone || '');
  const [position, setPosition] = useState(candidate.position);
  const [notes, setNotes] = useState(candidate.notes || '');
  const [referralName, setReferralName] = useState(candidate.referralName || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ firstName, lastName, email, phone, position, notes, referralName });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="edit-firstName">First Name</Label>
          <Input
            id="edit-firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="edit-lastName">Last Name</Label>
          <Input
            id="edit-lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="edit-email">Email</Label>
        <Input
          id="edit-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="edit-phone">Phone</Label>
        <Input
          id="edit-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="edit-position">Position</Label>
        <Select value={position} onValueChange={setPosition}>
          <SelectTrigger>
            <SelectValue placeholder="Select position" />
          </SelectTrigger>
          <SelectContent>
            {positionTypes.map(pos => (
              <SelectItem key={pos} value={pos}>{pos}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="edit-notes">Notes</Label>
        <Textarea
          id="edit-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="edit-referralName">Referred By</Label>
        <Input
          id="edit-referralName"
          value={referralName}
          onChange={(e) => setReferralName(e.target.value)}
          placeholder="Who referred this candidate?"
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </form>
  );
}

// Position colors for visual identification in Kanban and List views (with dark mode support)
const POSITION_COLORS: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  'Insurance Sales': {
    bg: 'bg-red-100 dark:bg-red-900/40',
    text: 'text-red-800 dark:text-red-300',
    border: 'border-red-400 dark:border-red-500',
    badge: 'bg-red-500'
  },
  'Retail Closer': {
    bg: 'bg-green-100 dark:bg-green-900/40',
    text: 'text-green-800 dark:text-green-300',
    border: 'border-green-400 dark:border-green-500',
    badge: 'bg-green-500'
  },
  'Retail Marketing': {
    bg: 'bg-purple-100 dark:bg-purple-900/40',
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-400 dark:border-purple-500',
    badge: 'bg-purple-500'
  },
  'Office': {
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-400 dark:border-orange-500',
    badge: 'bg-orange-500'
  },
  'Production Coordinator': {
    bg: 'bg-blue-100 dark:bg-blue-900/40',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-400 dark:border-blue-500',
    badge: 'bg-blue-500'
  },
  'Field Tech': {
    bg: 'bg-cyan-100 dark:bg-cyan-900/40',
    text: 'text-cyan-800 dark:text-cyan-300',
    border: 'border-cyan-400 dark:border-cyan-500',
    badge: 'bg-cyan-500'
  },
  // Default fallback
  'default': {
    bg: 'bg-gray-100 dark:bg-gray-800/40',
    text: 'text-gray-800 dark:text-gray-300',
    border: 'border-gray-400 dark:border-gray-500',
    badge: 'bg-gray-500'
  },
};

// Get position color (returns default if not found)
function getPositionColor(position: string) {
  return POSITION_COLORS[position] || POSITION_COLORS['default'];
}

// Category configuration for Resume Uploader
const RESUME_CATEGORIES = [
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
    icon: Clipboard,
    color: 'bg-blue-500',
    description: 'Production coordination and scheduling'
  },
  {
    id: 'field-tech',
    name: 'Field Tech',
    icon: Wrench,
    color: 'bg-cyan-500',
    description: 'Field technicians and installers'
  }
] as const;

type CategoryId = typeof RESUME_CATEGORIES[number]['id'];

// Resume Uploader Content Component
function ResumeUploaderContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<CategoryId>('insurance-sales');
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [sourceFolderId, setSourceFolderId] = useState('');

  // Sourcer assignment dialog state
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState<any>(null);
  const [selectedSourcer, setSelectedSourcer] = useState<string>('');
  const [referralName, setReferralName] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [sourcerComboboxOpen, setSourcerComboboxOpen] = useState(false);

  // Query for recent uploads
  const { data: recentData, isLoading: isLoadingRecent, refetch: refetchRecent } = useQuery({
    queryKey: ['/api/resumes/recent', activeCategory],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/resumes/recent?category=${activeCategory}&limit=20`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch recent resumes');
      return res.json();
    }
  });

  // Fetch available sourcers for assignment dialog
  const { data: sourcers } = useQuery<{id: string; firstName: string; lastName: string; email?: string; screenerColor?: string; activeAssignments?: number}[]>({
    queryKey: ['/api/sourcers/available'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/sourcers/available', {
        headers: { 'Authorization': `Bearer ${token}` },
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

      const token = localStorage.getItem('token');
      const response = await fetch('/api/resumes/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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
      // Show sourcer assignment dialog instead of just toast
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
      const token = localStorage.getItem('token');
      const response = await fetch('/api/resumes/sync-from-drive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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

  const activeCategoryData = RESUME_CATEGORIES.find(c => c.id === activeCategory)!;

  // Handle sourcer assignment completion (v2)
  const handleAssignmentComplete = async () => {
    console.log('[Assignment v2] handleAssignmentComplete called', { selectedSourcer, pendingCandidate, referralName });
    if (!pendingCandidate) return;

    setIsAssigning(true);

    try {
      const token = localStorage.getItem('token');

      // Update candidate with referral name if provided
      if (referralName.trim()) {
        console.log('[Assignment] Saving referral name:', referralName.trim());
        const updateResponse = await fetch(`/api/candidates/${pendingCandidate.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ referralName: referralName.trim() }),
        });

        if (!updateResponse.ok) {
          console.error('[Referral] Failed to save referral name');
        }
      }

      // Assign sourcer if selected
      if (selectedSourcer) {
        console.log('[Assignment] Making API call to assign sourcer', { candidateId: pendingCandidate.id, hrMemberId: selectedSourcer });
        const response = await fetch(`/api/candidates/${pendingCandidate.id}/assign-sourcer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ hrMemberId: selectedSourcer }),
        });
        console.log('[Assignment] API response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Assignment failed');
        }

        const sourcerName = sourcers?.find(s => s.id === selectedSourcer);
        toast({
          title: 'Candidate Created & Assigned',
          description: `${pendingCandidate.firstName} ${pendingCandidate.lastName} assigned to ${sourcerName?.firstName} ${sourcerName?.lastName}${referralName.trim() ? ` (Referred by: ${referralName.trim()})` : ''}`,
        });
      } else {
        toast({
          title: 'Resume Uploaded',
          description: `Created candidate: ${pendingCandidate.firstName} ${pendingCandidate.lastName}${referralName.trim() ? ` (Referred by: ${referralName.trim()})` : ''}`,
        });
      }
    } catch (error: any) {
      console.error('[Assignment] Failed:', error);
      toast({
        title: 'Assignment Failed',
        description: `${pendingCandidate.firstName} ${pendingCandidate.lastName} created but assignment failed: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      // Always clean up and close dialog
      setIsAssigning(false);
      setShowAssignmentDialog(false);
      setPendingCandidate(null);
      setSelectedSourcer('');
      setReferralName('');
      refetchRecent();
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sourcers/available'] });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <p className="text-muted-foreground">
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
                  {RESUME_CATEGORIES.map((cat) => (
                    <Button
                      key={cat.id}
                      variant={activeCategory === cat.id ? 'default' : 'outline'}
                      size="sm"
                      className={`gap-1 ${activeCategory === cat.id ? cat.color + ' text-white' : ''}`}
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
          {RESUME_CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.id} value={cat.id} className={`flex items-center gap-2 ${cat.color} text-white data-[state=active]:ring-2 data-[state=active]:ring-offset-2`}>
              <cat.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{cat.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {RESUME_CATEGORIES.map((cat) => (
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
                          AI is extracting candidate information
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
                          AI will automatically extract the candidate's name and create their profile
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
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {recentData.candidates.map((candidate: any) => (
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
                                <span>{candidate.stage || candidate.status}</span>
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
                  AI extracts names and creates candidates automatically
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sourcer Assignment Dialog */}
      <Dialog open={showAssignmentDialog} onOpenChange={(open) => {
        if (!open && !isAssigning) {
          setShowAssignmentDialog(false);
          setPendingCandidate(null);
          setSelectedSourcer('');
          setReferralName('');
          setSourcerComboboxOpen(false);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Candidate Details</DialogTitle>
            <DialogDescription>
              Candidate <strong>{pendingCandidate?.firstName} {pendingCandidate?.lastName}</strong> created successfully.
              Add optional details before continuing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Referral Name Input */}
            <div className="space-y-2">
              <Label htmlFor="referral-name-input">Referred By (optional)</Label>
              <Input
                id="referral-name-input"
                placeholder="Enter referrer's name..."
                value={referralName}
                onChange={(e) => setReferralName(e.target.value)}
                disabled={isAssigning}
              />
              <p className="text-xs text-muted-foreground">
                If this candidate was referred by someone, enter their name here
              </p>
            </div>

            {/* Sourcer Selection - Searchable Combobox */}
            <div className="space-y-2">
              <Label>Assign Sourcer (optional)</Label>
              <Popover open={sourcerComboboxOpen} onOpenChange={setSourcerComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={sourcerComboboxOpen}
                    className="w-full justify-between"
                    disabled={isAssigning}
                  >
                    {selectedSourcer ? (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: sourcers?.find(s => s.id === selectedSourcer)?.screenerColor || '#6B7280' }}
                        />
                        <span>
                          {sourcers?.find(s => s.id === selectedSourcer)?.firstName}{' '}
                          {sourcers?.find(s => s.id === selectedSourcer)?.lastName}
                        </span>
                      </div>
                    ) : (
                      "Search or select a sourcer..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type name or email to search..." />
                    <CommandList>
                      <CommandEmpty>No sourcer found.</CommandEmpty>
                      <CommandGroup heading="Priority Sourcers">
                        {sourcers?.filter(s =>
                          s.email?.toLowerCase() === 'jobs@theroofdocs.com' ||
                          s.email?.toLowerCase() === 'sima.popal@theroofdocs.com'
                        ).map((sourcer) => (
                          <CommandItem
                            key={sourcer.id}
                            value={`${sourcer.firstName} ${sourcer.lastName} ${sourcer.email || ''}`}
                            onSelect={() => {
                              setSelectedSourcer(sourcer.id);
                              setSourcerComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${selectedSourcer === sourcer.id ? "opacity-100" : "opacity-0"}`}
                            />
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0 mr-2"
                              style={{ backgroundColor: sourcer.screenerColor || '#6B7280' }}
                            />
                            <span className="flex-1">{sourcer.firstName} {sourcer.lastName}</span>
                            <span className="text-muted-foreground text-xs">
                              ({sourcer.activeAssignments || 0} active)
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandGroup heading="All Sourcers">
                        {sourcers?.filter(s =>
                          s.email?.toLowerCase() !== 'jobs@theroofdocs.com' &&
                          s.email?.toLowerCase() !== 'sima.popal@theroofdocs.com'
                        ).map((sourcer) => (
                          <CommandItem
                            key={sourcer.id}
                            value={`${sourcer.firstName} ${sourcer.lastName} ${sourcer.email || ''}`}
                            onSelect={() => {
                              setSelectedSourcer(sourcer.id);
                              setSourcerComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${selectedSourcer === sourcer.id ? "opacity-100" : "opacity-0"}`}
                            />
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0 mr-2"
                              style={{ backgroundColor: sourcer.screenerColor || '#6B7280' }}
                            />
                            <span className="flex-1">{sourcer.firstName} {sourcer.lastName}</span>
                            <span className="text-muted-foreground text-xs">
                              ({sourcer.activeAssignments || 0} active)
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                jobs@ and sima@ appear first. Type to search by name or email.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isAssigning}
              onClick={() => {
                setShowAssignmentDialog(false);
                setPendingCandidate(null);
                setSelectedSourcer('');
                setReferralName('');
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
            <Button onClick={handleAssignmentComplete} disabled={isAssigning}>
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : selectedSourcer ? 'Assign & Continue' : 'Continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function EnhancedRecruiting() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    isLimitedSourcer,
    isLeadSourcer,
    isSourcer,
    isSourcerRole,
    isManager,
    canBulkManageCandidates,
    canAssignCandidates,
    canAccessEmailCampaigns,
    canAccessWorkflowManagement,
    canSeeAllRecruitmentStats,
  } = usePermissions();

  // Stages that SOURCERs can move candidates to (not OFFER, HIRED, or DEAD)
  const SOURCER_ALLOWED_STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW'];
  const userIsSourcerOnly = isSourcerRole() && !isManager();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPosition, setFilterPosition] = useState<string>('ALL');
  const [filterSourcer, setFilterSourcer] = useState<string>('ALL');
  const [filterReferral, setFilterReferral] = useState<string>('');
  const [filterDateType, setFilterDateType] = useState<'all' | 'specific' | 'range'>('all');
  const [filterDateSingle, setFilterDateSingle] = useState<Date | undefined>(undefined);
  const [filterDateStart, setFilterDateStart] = useState<Date | undefined>(undefined);
  const [filterDateEnd, setFilterDateEnd] = useState<Date | undefined>(undefined);
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'interviews' | 'campaigns' | 'workflows' | 'resume-uploads'>('kanban');
  const [showInterviewScheduler, setShowInterviewScheduler] = useState(false);
  const [selectedCandidateForInterview, setSelectedCandidateForInterview] = useState<Candidate | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [showEmailGenerator, setShowEmailGenerator] = useState(false);
  const [selectedCandidateForEmail, setSelectedCandidateForEmail] = useState<Candidate | null>(null);
  // Questionnaire state removed - no longer showing popup when moving to Hired
  // Dead type selection modal
  const [showDeadTypeModal, setShowDeadTypeModal] = useState(false);
  const [candidateForDeadType, setCandidateForDeadType] = useState<Candidate | null>(null);
  // Resume preview
  const [showResumePreview, setShowResumePreview] = useState(false);
  const [previewResumeUrl, setPreviewResumeUrl] = useState<string | null>(null);
  // Hire modal
  const [showHireModal, setShowHireModal] = useState(false);
  const [candidateToHire, setCandidateToHire] = useState<Candidate | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [selectedCandidateForNotes, setSelectedCandidateForNotes] = useState<Candidate | null>(null);
  const [showScreeningConfirmation, setShowScreeningConfirmation] = useState(false);
  const [candidateForScreening, setCandidateForScreening] = useState<{candidate: Candidate; nextStatus: string} | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [showCandidateDetails, setShowCandidateDetails] = useState(false);
  const [selectedAssignedEmployee, setSelectedAssignedEmployee] = useState<string>('');
  const [showInterviewScreening, setShowInterviewScreening] = useState(false);
  const [candidateForInterviewScreening, setCandidateForInterviewScreening] = useState<{candidate: Candidate; nextStatus: string} | null>(null);
  const [isCandidateDialogOpen, setIsCandidateDialogOpen] = useState(false);
  const [isNewHireDialogOpen, setIsNewHireDialogOpen] = useState(false);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [showEditCandidate, setShowEditCandidate] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);

  // Bulk selection state for group move
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());

  const location = useLocation();
  
  // Form schemas
  const candidateFormSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email'),
    phone: z.string().min(1, 'Phone is required'),
    position: z.string().min(1, 'Position is required'),
    resumeUrl: z.string().optional(),
    notes: z.string().optional(),
    referralName: z.string().optional()
  });

  const newHireFormSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email').min(1, 'Email is required'),
    phone: z.string().min(1, 'Phone is required'),
    position: z.string().min(1, 'Position is required'),
    department: z.string().min(1, 'Department is required'),
    startDate: z.string().min(1, 'Start date is required'),
    salary: z.string().optional(),
    reportingTo: z.string().optional(),
    shirtSize: z.string().min(1, 'Shirt size is required'),
    welcomePackageId: z.string().optional(),
    toolIds: z.array(z.string()).optional(),
    notes: z.string().optional()
  });

  // Form hooks
  const candidateForm = useForm({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      resumeUrl: '',
      notes: '',
      referralName: ''
    }
  });

  const newHireForm = useForm<z.infer<typeof newHireFormSchema>>({
    resolver: zodResolver(newHireFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      startDate: new Date().toISOString().split('T')[0],
      salary: '',
      reportingTo: '',
      shirtSize: '',
      welcomePackageId: '',
      toolIds: [],
      notes: ''
    }
  });

  // Test function to auto-fill form with Ahmed's details
  const testFillForm = () => {
    newHireForm.setValue('firstName', 'Ahmed');
    newHireForm.setValue('lastName', 'Mahmoud');
    newHireForm.setValue('email', 'ahmed.test@theroofdocs.com');
    newHireForm.setValue('phone', '(555) 123-4567');
    newHireForm.setValue('position', 'Sales Representative');
    newHireForm.setValue('department', 'Sales');
    newHireForm.setValue('shirtSize', 'L');
    newHireForm.setValue('salary', '$65,000');
    newHireForm.setValue('welcomePackageId', 'sales-welcome-pack');
    newHireForm.setValue('notes', 'Test onboarding for Ahmed with updated Sales Package');
    
    // Select some relevant tools
    if (toolsInventory && toolsInventory.length > 0) {
      const ipadTool = toolsInventory.find((tool: any) => tool.name.includes('iPad'));
      const ladderTool = toolsInventory.find((tool: any) => tool.name.includes('Ladder'));
      const selectedIds = [];
      if (ipadTool) selectedIds.push(ipadTool.id);
      if (ladderTool) selectedIds.push(ladderTool.id);
      setSelectedTools(selectedIds);
    }
    
    toast({
      title: "✅ Form Auto-filled",
      description: "Test data loaded for Ahmed with updated Sales Package (iPad, Keyboard Case, Ladder, Flashlight Set, and clothing)"
    });
  };
  
  // Debug effect to monitor interview screening state changes
  useEffect(() => {
    console.log('Interview screening state changed:', {
      showInterviewScreening,
      candidateForInterviewScreening: candidateForInterviewScreening ? {
        candidateName: `${candidateForInterviewScreening.candidate.firstName} ${candidateForInterviewScreening.candidate.lastName}`,
        currentStatus: candidateForInterviewScreening.candidate.status,
        nextStatus: candidateForInterviewScreening.nextStatus
      } : null
    });
  }, [showInterviewScreening, candidateForInterviewScreening]);
  
  // Fetch available tools inventory
  const { data: toolsInventory, isLoading: toolsLoading } = useQuery<any[]>({
    queryKey: ['/api/tools/inventory'],
    queryFn: async () => {
      const response = await fetch('/api/tools/inventory', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch tools');
      return response.json();
    }
  });

  // Fetch welcome package bundles
  const { data: welcomeBundles, isLoading: bundlesLoading } = useQuery<any[]>({
    queryKey: ['/api/tools/bundles'],
    queryFn: async () => {
      const response = await fetch('/api/tools/bundles', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch bundles');
      return response.json();
    }
  });

  // Fetch managers and admins for reporting dropdown
  const { data: managersAndAdmins = [], isLoading: managersLoading } = useQuery<any[]>({
    queryKey: ['/api/users?role=managers'],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const users = await response.json();
      return users.filter((u: any) => u.role === 'ADMIN' || u.role === 'MANAGER');
    }
  });

  const { data: candidates = [], isLoading } = useQuery<Candidate[]>({
    queryKey: ['/api/candidates'],
  });

  // Fetch available sourcers for filtering
  const { data: sourcers = [] } = useQuery<Array<{ id: string; firstName: string; lastName: string; screenerColor?: string }>>({
    queryKey: ['/api/sourcers/available'],
    queryFn: async () => {
      const response = await fetch('/api/sourcers/available', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch available employees for assignment
  const { data: availableEmployees = [] } = useQuery<Array<{ id: string; firstName: string; lastName: string; role: string; isActive: boolean }>>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const users = await response.json();
      // Filter to only show active employees/managers/admins
      return users.filter((u: { isActive: boolean; role: string }) => u.isActive && ['EMPLOYEE', 'MANAGER', 'ADMIN'].includes(u.role));
    }
  });

  // Get candidateId from URL params if present
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const candidateId = params.get('candidateId');
    
    console.log('Enhanced Recruiting - URL params check:', { 
      candidateId, 
      candidatesLength: candidates.length,
      url: window.location.href,
      search: location.search,
      locationSearch: location.search,
      pathname: location.pathname,
      candidatesLoaded: candidates.length > 0,
      firstCandidateId: candidates[0]?.id
    });
    
    if (candidateId && candidates.length > 0) {
      const candidate = candidates.find(c => c.id === candidateId);
      console.log('Enhanced Recruiting - Found candidate:', candidate);
      
      if (candidate) {
        console.log('Enhanced Recruiting - Opening candidate details modal');
        setSelectedCandidate(candidate);
        setShowCandidateDetails(true);
        // Clear the URL parameter after handling it
        setTimeout(() => {
          console.log('Enhanced Recruiting - Clearing URL params');
          window.history.replaceState({}, '', '/recruiting');
        }, 100);
      } else {
        console.log('Enhanced Recruiting - Candidate not found with ID:', candidateId);
        toast({
          title: 'Candidate not found',
          description: `No candidate found with ID: ${candidateId}`,
          variant: 'destructive',
        });
      }
    } else if (candidateId && candidates.length === 0) {
      console.log('Enhanced Recruiting - Waiting for candidates to load, candidateId:', candidateId);
    }
  }, [location, candidates, toast]);

  const updateCandidateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      // If user is SOURCER (not manager) and updating status, use the sourcer-move endpoint
      if (userIsSourcerOnly && data.status) {
        // Check if the target status is allowed for SOURCERs
        if (!SOURCER_ALLOWED_STAGES.includes(data.status)) {
          throw new Error('SOURCERs can only move candidates to Application Review, Phone Screening, or Interview Process. Contact a manager to move to later stages.');
        }
        return apiRequest(`/api/candidates/${id}/sourcer-move`, 'PATCH', { newStatus: data.status });
      }
      // Managers and others use the regular endpoint
      return apiRequest(`/api/candidates/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      toast({
        title: 'Success',
        description: 'Candidate updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update candidate',
        variant: 'destructive',
      });
    },
  });

  // Bulk status update mutation for group move
  const bulkStatusMutation = useMutation({
    mutationFn: ({ candidateIds, newStatus }: { candidateIds: string[]; newStatus: string }) =>
      apiRequest('/api/candidates/bulk-status', 'POST', { candidateIds, newStatus }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      setSelectedCandidates(new Set());
      toast({
        title: 'Candidates Moved',
        description: `${variables.candidateIds.length} candidate(s) moved to ${stages[variables.newStatus as keyof typeof stages]?.name || variables.newStatus}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Move Failed',
        description: error.message || 'Failed to move candidates',
        variant: 'destructive',
      });
    },
  });

  // Selection handlers for bulk operations
  const handleSelectCandidate = (candidateId: string, selected: boolean) => {
    setSelectedCandidates(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(candidateId);
      } else {
        newSet.delete(candidateId);
      }
      return newSet;
    });
  };

  const handleSelectAllInStage = (status: string) => {
    const candidatesInStage = candidatesByStatus[status as keyof typeof candidatesByStatus] || [];
    setSelectedCandidates(prev => {
      const newSet = new Set(prev);
      candidatesInStage.forEach(c => newSet.add(c.id));
      return newSet;
    });
  };

  const handleClearSelection = () => {
    setSelectedCandidates(new Set());
  };

  const handleBulkMove = (newStatus: string) => {
    if (selectedCandidates.size === 0) return;
    bulkStatusMutation.mutate({
      candidateIds: Array.from(selectedCandidates),
      newStatus
    });
  };

  // Hire candidate mutation (full onboarding)
  const hireCandidateMutation = useMutation({
    mutationFn: ({ candidateId, hireData }: { candidateId: string; hireData: HireData }) =>
      apiRequest(`/api/candidates/${candidateId}/hire`, 'POST', hireData),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tool-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setShowHireModal(false);
      setCandidateToHire(null);
      toast({
        title: 'Hired Successfully!',
        description: `${data.employee?.firstName || 'Employee'} has been hired and ${data.emailSent ? 'welcome email sent' : 'added to the system'}.`,
      });
    },
    onError: (error: any) => {
      // Close the modal on error so user can try again
      setShowHireModal(false);
      setCandidateToHire(null);
      toast({
        title: 'Hire Failed',
        description: error.message || 'Failed to hire candidate',
        variant: 'destructive',
      });
    },
  });

  const analyzeCandidateMutation = useMutation({
    mutationFn: (candidateId: string) => 
      apiRequest(`/api/candidates/${candidateId}/analyze`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      toast({
        title: 'Success',
        description: 'AI analysis completed successfully',
      });
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: (emailData: {
      to: string;
      subject: string;
      body: string;
      templateType: string;
    }) => apiRequest('/api/emails/send', 'POST', emailData),
    onSuccess: () => {
      toast({
        title: 'Email Sent',
        description: 'Email sent successfully',
      });
      setShowEmailGenerator(false);
      setSelectedCandidateForEmail(null);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send email',
        variant: 'destructive',
      });
    },
  });

  const createCandidateMutation = useMutation({
    mutationFn: (data: z.infer<typeof candidateFormSchema>) => 
      apiRequest('/api/candidates', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      toast({
        title: 'Success',
        description: 'Candidate added successfully',
      });
      candidateForm.reset();
      setIsCandidateDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add candidate',
        variant: 'destructive'
      });
    }
  });

  const createNewHireMutation = useMutation({
    mutationFn: async (data: z.infer<typeof newHireFormSchema>) => {
      console.log('📤 Submitting direct hire form:', data);
      const result = await apiRequest<{
        employee?: { name: string };
        firstName?: string;
        lastName?: string;
        onboarding?: { emailSent?: boolean; toolsAssigned?: number; welcomePackageAssigned?: boolean };
        emailSent?: boolean;
      }>('/api/employees/direct-hire', 'POST', data);
      console.log('✅ Direct hire response:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('🎉 New hire created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      
      // Extract name from response (handles both formats)
      const name = data.employee ? data.employee.name : `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'New hire';
      const emailStatus = data.onboarding?.emailSent || data.emailSent ? 'Welcome email sent!' : 'Email pending.';
      const toolsCount = data.onboarding?.toolsAssigned || 0;
      const packageStatus = data.onboarding?.welcomePackageAssigned ? ' Welcome package assigned.' : '';
      
      toast({
        title: 'Success! 🎉',
        description: `${name} added successfully! ${emailStatus}${packageStatus} ${toolsCount > 0 ? `${toolsCount} tools assigned.` : ''}`,
      });
      newHireForm.reset();
      setSelectedTools([]);
      setIsNewHireDialogOpen(false);
    },
    onError: (error: any) => {
      console.error('💥 Direct hire error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add new hire',
        variant: 'destructive'
      });
    }
  });

  const handleResumeUpload = async (file: File) => {
    setIsParsing(true);
    const formData = new FormData();
    formData.append('resume', file);
    
    try {
      const response = await fetch('/api/candidates/parse-resume', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to parse resume');
      }
      
      const parsedData = await response.json();
      
      // Auto-fill the form with parsed data
      candidateForm.setValue('firstName', parsedData.firstName || '');
      candidateForm.setValue('lastName', parsedData.lastName || '');
      candidateForm.setValue('email', parsedData.email || '');
      candidateForm.setValue('phone', parsedData.phone || '');
      candidateForm.setValue('position', parsedData.position || '');
      candidateForm.setValue('notes', parsedData.summary || '');
      candidateForm.setValue('resumeUrl', parsedData.resumeUrl || '');
      
      toast({
        title: 'Resume Parsed Successfully',
        description: 'Please review and confirm the extracted information before submitting.',
      });
    } catch (error) {
      console.error('Error parsing resume:', error);
      toast({
        title: 'Error',
        description: 'Failed to parse resume. Please enter information manually.',
        variant: 'destructive'
      });
    } finally {
      setIsParsing(false);
    }
  };

  const onCandidateSubmit = (data: z.infer<typeof candidateFormSchema>) => {
    createCandidateMutation.mutate(data);
  };

  const onNewHireSubmit = (data: z.infer<typeof newHireFormSchema>) => {
    createNewHireMutation.mutate(data);
  };

  const filteredCandidates = candidates.filter(candidate => {
    // Handle combined DEAD filter option
    const matchesFilter = filterStatus === 'ALL' ||
      (filterStatus === 'DEAD' ? (candidate.status === 'DEAD_BY_US' || candidate.status === 'DEAD_BY_CANDIDATE' || candidate.status === 'NO_SHOW') : candidate.status === filterStatus);
    const matchesPosition = filterPosition === 'ALL' || candidate.position === filterPosition;
    const matchesSourcer = filterSourcer === 'ALL' || (candidate as any).assignedTo === filterSourcer;
    const matchesReferral = filterReferral === '' ||
      (candidate.referralName && candidate.referralName.toLowerCase().includes(filterReferral.toLowerCase()));
    const matchesSearch = searchTerm === '' ||
      `${candidate.firstName} ${candidate.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      candidate.position.toLowerCase().includes(searchTerm.toLowerCase());

    // Date filter logic
    let matchesDate = true;
    if (filterDateType === 'specific' && filterDateSingle) {
      const candidateDate = candidate.createdAt ? new Date(candidate.createdAt) : null;
      matchesDate = candidateDate ? isSameDay(candidateDate, filterDateSingle) : false;
    } else if (filterDateType === 'range' && filterDateStart && filterDateEnd) {
      const candidateDate = candidate.createdAt ? new Date(candidate.createdAt) : null;
      matchesDate = candidateDate ? isWithinInterval(candidateDate, {
        start: startOfDay(filterDateStart),
        end: endOfDay(filterDateEnd)
      }) : false;
    }

    return matchesFilter && matchesPosition && matchesSourcer && matchesReferral && matchesSearch && matchesDate;
  });

  const candidatesByStatus = {
    APPLIED: filteredCandidates.filter(c => c.status === 'APPLIED'),
    SCREENING: filteredCandidates.filter(c => c.status === 'SCREENING'),
    INTERVIEW: filteredCandidates.filter(c => c.status === 'INTERVIEW'),
    OFFER: filteredCandidates.filter(c => c.status === 'OFFER'),
    HIRED: filteredCandidates.filter(c => c.status === 'HIRED'),
    // Combined DEAD column - shows DEAD_BY_US, DEAD_BY_CANDIDATE, and NO_SHOW
    DEAD: filteredCandidates.filter(c => c.status === 'DEAD_BY_US' || c.status === 'DEAD_BY_CANDIDATE' || c.status === 'NO_SHOW'),
  };
  
  // Helper function to get next status
  const getNextStatus = (currentStatus: string): string | null => {
    const statusFlow: Record<string, string> = {
      'APPLIED': 'SCREENING',
      'SCREENING': 'INTERVIEW',
      'INTERVIEW': 'OFFER',
      'OFFER': 'HIRED'
    };
    return statusFlow[currentStatus] || null;
  };

  const handleDragStart = (event: any) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const candidateId = active.id;
    const newStatus = over.id;
    const currentCandidate = candidates.find(c => c.id === candidateId);
    
    console.log('Drag-and-drop status change:', {
      candidateId,
      candidateName: currentCandidate ? `${currentCandidate.firstName} ${currentCandidate.lastName}` : 'Not found',
      currentStatus: currentCandidate?.status,
      newStatus,
      shouldTriggerScreening: newStatus === 'INTERVIEW' && currentCandidate?.status !== 'INTERVIEW'
    });

    if (!currentCandidate) return;

    // Check if moving to INTERVIEW status - requires screening for in-person interviews
    if (newStatus === 'INTERVIEW' && currentCandidate.status !== 'INTERVIEW') {
      // Check if candidate has previous screening data that passed all requirements
      let skipScreening = false;
      if (currentCandidate.interviewScreeningData) {
        try {
          const prevScreening = JSON.parse(currentCandidate.interviewScreeningData as string);
          // Skip if all previous requirements were met
          skipScreening = prevScreening.hasDriversLicense &&
                         prevScreening.hasReliableVehicle &&
                         prevScreening.hasClearCommunication;
        } catch (e) {
          skipScreening = false;
        }
      }

      if (!skipScreening) {
        console.log('Triggering interview screening for (drag):', currentCandidate.firstName, currentCandidate.lastName);
        // Store the candidate for interview screening
        setCandidateForInterviewScreening({
          candidate: currentCandidate,
          nextStatus: newStatus
        });
        // Show screening questions FIRST
        setShowInterviewScreening(true);
        return; // Don't proceed until screening is complete
      } else {
        console.log('Skipping screening - candidate passed all requirements previously');
      }
    }

    // Check if moving to HIRED - show hire confirmation modal
    if (newStatus === 'HIRED') {
      setCandidateToHire(currentCandidate);
      setShowHireModal(true);
      return;
    }

    // Check if moving to DEAD - show type selection modal
    if (newStatus === 'DEAD') {
      setCandidateForDeadType(currentCandidate);
      setShowDeadTypeModal(true);
      return;
    }

    // Directly update status without questionnaire
    updateCandidateMutation.mutate({
      id: candidateId,
      data: { status: newStatus as 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'DEAD_BY_US' | 'DEAD_BY_CANDIDATE' | 'NO_SHOW' }
    });
  };

  const activeDragCandidate = activeDragId 
    ? candidates.find(c => c.id === activeDragId) 
    : null;

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Recruitment Pipeline</h1>
            <p className="text-gray-600">Manage candidates through the hiring process</p>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={() => setIsCandidateDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Candidate
            </Button>
            <Button variant="secondary" onClick={() => setIsNewHireDialogOpen(true)}>
              <UserCheck className="mr-2 h-4 w-4" />
              Add New Hire
            </Button>
            <Button variant="outline" onClick={() => setShowComparison(true)}>
              <GitCompare className="mr-2 h-4 w-4" />
              Compare Candidates
            </Button>
            <Button variant="outline" onClick={() => setShowEmailGenerator(true)}>
              <MailIcon className="mr-2 h-4 w-4" />
              Email Templates
            </Button>
          </div>
        </div>

        {/* Pipeline Overview */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {Object.entries(candidatesByStatus).map(([status, candidates]) => (
            <Card key={status} className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-l-4"
                  style={{ borderLeftColor: stages[status as keyof typeof stages].color.includes('bg-') 
                    ? stages[status as keyof typeof stages].color.replace('bg-', '#') 
                    : '#3b82f6' }}
                  onClick={() => setFilterStatus(status)}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                      {stages[status as keyof typeof stages].name}
                    </p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{candidates.length}</p>
                  </div>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
                    <span className="text-xs font-semibold text-gray-700">{candidates.length}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <Badge variant="secondary" className="text-xs px-2 py-1">
                    {status.toLowerCase()}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Candidates ({filteredCandidates.length})</CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant={viewMode === 'kanban' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('kanban')}
                >
                  Kanban
                </Button>
                <Button 
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  List
                </Button>
                <Button 
                  variant={viewMode === 'interviews' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('interviews')}
                >
                  <Calendar className="mr-1 h-3 w-3" />
                  Interviews
                </Button>
                {/* Email campaigns - managers only, not for sourcers */}
                {canAccessEmailCampaigns() && (
                  <Button
                    variant={viewMode === 'campaigns' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('campaigns')}
                  >
                    <Mail className="mr-1 h-3 w-3" />
                    Email Campaigns
                  </Button>
                )}
                {/* Workflows - managers only, not for sourcers */}
                {canAccessWorkflowManagement() && (
                  <Button
                    variant={viewMode === 'workflows' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('workflows')}
                  >
                    <Zap className="mr-1 h-3 w-3" />
                    Workflows
                  </Button>
                )}
                {/* Resume uploads - managers and lead sourcers only */}
                {canBulkManageCandidates() && (
                  <Button
                    variant="default"
                    size="default"
                    onClick={() => setViewMode('resume-uploads')}
                    className={viewMode === 'resume-uploads'
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg'
                      : 'bg-green-500 hover:bg-green-600 text-white shadow-md'}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Resumes
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-6">
              <Input
                placeholder="Search candidates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs"
              />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="APPLIED">Applied</SelectItem>
                  <SelectItem value="SCREENING">Screening</SelectItem>
                  <SelectItem value="INTERVIEW">Interview</SelectItem>
                  <SelectItem value="OFFER">Offer</SelectItem>
                  <SelectItem value="HIRED">Hired</SelectItem>
                  <SelectItem value="DEAD">Dead (All)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPosition} onValueChange={setFilterPosition}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Positions</SelectItem>
                  {positionTypes.map(position => (
                    <SelectItem key={position} value={position}>{position}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Sourcer filter - only show if user can see all candidates */}
              {!isLimitedSourcer() && (
                <Select value={filterSourcer} onValueChange={setFilterSourcer}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by sourcer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Sourcers</SelectItem>
                    {sourcers.map((sourcer) => (
                      <SelectItem key={sourcer.id} value={sourcer.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: sourcer.screenerColor || '#6B7280' }}
                          />
                          <span>{sourcer.firstName} {sourcer.lastName}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Referral filter */}
              <Input
                placeholder="Filter by referral..."
                value={filterReferral}
                onChange={(e) => setFilterReferral(e.target.value)}
                className="w-[180px]"
              />
              {/* Date filter */}
              <Popover open={dateFilterOpen} onOpenChange={setDateFilterOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                    <Calendar className="mr-2 h-4 w-4" />
                    {filterDateType === 'all' ? (
                      'All Dates'
                    ) : filterDateType === 'specific' && filterDateSingle ? (
                      format(filterDateSingle, 'MMM d, yyyy')
                    ) : filterDateType === 'range' && filterDateStart && filterDateEnd ? (
                      `${format(filterDateStart, 'MMM d')} - ${format(filterDateEnd, 'MMM d')}`
                    ) : (
                      'Filter by date'
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="start">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Date Filter Type</Label>
                      <Select value={filterDateType} onValueChange={(value: 'all' | 'specific' | 'range') => {
                        setFilterDateType(value);
                        if (value === 'all') {
                          setFilterDateSingle(undefined);
                          setFilterDateStart(undefined);
                          setFilterDateEnd(undefined);
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Dates</SelectItem>
                          <SelectItem value="specific">Specific Day</SelectItem>
                          <SelectItem value="range">Date Range</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {filterDateType === 'specific' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Select Date</Label>
                        <CalendarUI
                          mode="single"
                          selected={filterDateSingle}
                          onSelect={(date) => {
                            setFilterDateSingle(date);
                            if (date) setDateFilterOpen(false);
                          }}
                          className="rounded-md border"
                        />
                      </div>
                    )}

                    {filterDateType === 'range' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Select Range</Label>
                        <div className="flex gap-2 items-center mb-2">
                          <Input
                            type="date"
                            value={filterDateStart ? format(filterDateStart, 'yyyy-MM-dd') : ''}
                            onChange={(e) => setFilterDateStart(e.target.value ? new Date(e.target.value + 'T12:00:00') : undefined)}
                            className="w-[130px]"
                          />
                          <span className="text-muted-foreground">to</span>
                          <Input
                            type="date"
                            value={filterDateEnd ? format(filterDateEnd, 'yyyy-MM-dd') : ''}
                            onChange={(e) => setFilterDateEnd(e.target.value ? new Date(e.target.value + 'T12:00:00') : undefined)}
                            className="w-[130px]"
                          />
                        </div>
                        <CalendarUI
                          mode="range"
                          selected={{
                            from: filterDateStart,
                            to: filterDateEnd
                          }}
                          onSelect={(range) => {
                            setFilterDateStart(range?.from);
                            setFilterDateEnd(range?.to);
                          }}
                          numberOfMonths={2}
                          className="rounded-md border"
                        />
                        {filterDateStart && filterDateEnd && (
                          <Button
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => setDateFilterOpen(false)}
                          >
                            Apply Range
                          </Button>
                        )}
                      </div>
                    )}

                    {filterDateType !== 'all' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          setFilterDateType('all');
                          setFilterDateSingle(undefined);
                          setFilterDateStart(undefined);
                          setFilterDateEnd(undefined);
                          setDateFilterOpen(false);
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Clear Date Filter
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Content based on view mode */}
            {viewMode === 'kanban' ? (
              <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {kanbanStages.map(status => {
                  // SOURCERs can only drop into allowed stages
                  const isDropDisabled = userIsSourcerOnly && !SOURCER_ALLOWED_STAGES.includes(status);
                  return (
                  <DroppableColumn key={status} status={status} disabled={isDropDisabled}>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {stages[status].name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleSelectAllInStage(status)}
                          >
                            Select All
                          </Button>
                          <Badge className={stages[status].color}>
                            {candidatesByStatus[status as keyof typeof candidatesByStatus]?.length || 0}
                          </Badge>
                        </div>
                      </div>
                    <div className="space-y-3">
                      {(candidatesByStatus[status as keyof typeof candidatesByStatus] || []).map(candidate => (
                        <DraggableCandidateCard
                          key={candidate.id}
                          candidate={{
                            ...candidate,
                            appliedAt: candidate.appliedDate ? new Date(candidate.appliedDate).toISOString() : new Date().toISOString(),
                            aiMatchScore: candidate.matchScore ?? undefined,
                            aiPotentialScore: candidate.potentialScore ?? undefined,
                            source: candidate.stage || 'APPLIED',
                            notes: candidate.notes ?? undefined
                          }}
                          showCheckbox={true}
                          isSelected={selectedCandidates.has(candidate.id)}
                          onSelect={handleSelectCandidate}
                          onClick={(clickedCandidate) => {
                            const originalCandidate = candidates.find(c => c.id === clickedCandidate.id);
                            if (originalCandidate) {
                              setSelectedCandidate(originalCandidate);
                              setShowCandidateDetails(true);
                            }
                          }}
                          onStatusChange={(candidateId, newStatus) => {
                            const currentCandidate = candidates.find(c => c.id === candidateId);
                            console.log('Status change triggered (Kanban):', {
                              candidateId,
                              candidateName: currentCandidate ? `${currentCandidate.firstName} ${currentCandidate.lastName}` : 'Not found',
                              currentStatus: currentCandidate?.status,
                              newStatus,
                              shouldTriggerScreening: newStatus === 'INTERVIEW' && currentCandidate?.status !== 'INTERVIEW'
                            });
                            
                            if (!currentCandidate) return;

                            // Check if moving to INTERVIEW status - requires screening for in-person interviews
                            if (newStatus === 'INTERVIEW' && currentCandidate.status !== 'INTERVIEW') {
                              // Check if candidate has previous screening data that passed all requirements
                              let skipScreening = false;
                              if (currentCandidate.interviewScreeningData) {
                                try {
                                  const prevScreening = JSON.parse(currentCandidate.interviewScreeningData as string);
                                  skipScreening = prevScreening.hasDriversLicense &&
                                                 prevScreening.hasReliableVehicle &&
                                                 prevScreening.hasClearCommunication;
                                } catch (e) {
                                  skipScreening = false;
                                }
                              }

                              if (!skipScreening) {
                                console.log('Triggering interview screening for:', currentCandidate.firstName, currentCandidate.lastName);
                                setCandidateForInterviewScreening({
                                  candidate: currentCandidate,
                                  nextStatus: newStatus
                                });
                                setShowInterviewScreening(true);
                                return;
                              }
                            }

                            // Check if moving to DEAD - show type selection modal
                            if (newStatus === 'DEAD') {
                              setCandidateForDeadType(currentCandidate);
                              setShowDeadTypeModal(true);
                              return;
                            }

                            // Directly update status without questionnaire
                            updateCandidateMutation.mutate({
                              id: candidateId,
                              data: { status: newStatus as 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'DEAD_BY_US' | 'DEAD_BY_CANDIDATE' | 'NO_SHOW' }
                            });
                          }}
                          onAnalyze={(candidate) => analyzeCandidateMutation.mutate(candidate.id)}
                          onEmail={(candidate) => {
                            const originalCandidate = candidates.find(c => c.id === candidate.id);
                            if (originalCandidate) {
                              setSelectedCandidateForEmail(originalCandidate);
                              setShowEmailGenerator(true);
                            }
                          }}
                          onNotes={(candidate) => {
                            const originalCandidate = candidates.find(c => c.id === candidate.id);
                            if (originalCandidate) {
                              setSelectedCandidateForNotes(originalCandidate);
                              setShowNotes(true);
                            }
                          }}
                          onScheduleInterview={(candidate) => {
                            const originalCandidate = candidates.find(c => c.id === candidate.id);
                            if (originalCandidate) {
                              setSelectedCandidateForInterview(originalCandidate);
                              setShowInterviewScheduler(true);
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  </DroppableColumn>
                  );
                })}
              </div>
            ) : viewMode === 'list' ? (
              // List View
              <div className="space-y-4">
                {filteredCandidates.map(candidate => (
                  <div key={candidate.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <DraggableCandidateCard
                        candidate={{
                          ...candidate,
                          appliedAt: candidate.appliedDate ? new Date(candidate.appliedDate).toISOString() : new Date().toISOString(),
                          aiMatchScore: candidate.matchScore ?? undefined,
                          aiPotentialScore: candidate.potentialScore ?? undefined,
                          source: candidate.stage || 'APPLIED',
                          notes: candidate.notes ?? undefined
                        }}
                        isDragDisabled={true}
                        onClick={(clickedCandidate) => {
                          const originalCandidate = candidates.find(c => c.id === clickedCandidate.id);
                          if (originalCandidate) {
                            setSelectedCandidate(originalCandidate);
                            setShowCandidateDetails(true);
                          }
                        }}
                        onStatusChange={(candidateId, newStatus) => {
                          const currentCandidate = candidates.find(c => c.id === candidateId);
                          console.log('Status change triggered:', {
                            candidateId,
                            candidateName: currentCandidate ? `${currentCandidate.firstName} ${currentCandidate.lastName}` : 'Not found',
                            currentStatus: currentCandidate?.status,
                            newStatus,
                            shouldTriggerScreening: newStatus === 'INTERVIEW' && currentCandidate?.status !== 'INTERVIEW'
                          });

                          if (!currentCandidate) return;

                          // Check if moving to INTERVIEW status - requires screening for in-person interviews
                          if (newStatus === 'INTERVIEW' && currentCandidate.status !== 'INTERVIEW') {
                            // Check if candidate has previous screening data that passed all requirements
                            let skipScreening = false;
                            if (currentCandidate.interviewScreeningData) {
                              try {
                                const prevScreening = JSON.parse(currentCandidate.interviewScreeningData as string);
                                skipScreening = prevScreening.hasDriversLicense &&
                                               prevScreening.hasReliableVehicle &&
                                               prevScreening.hasClearCommunication;
                              } catch (e) {
                                skipScreening = false;
                              }
                            }

                            if (!skipScreening) {
                              console.log('Triggering interview screening for:', currentCandidate.firstName, currentCandidate.lastName);
                              setCandidateForInterviewScreening({
                                candidate: currentCandidate,
                                nextStatus: newStatus
                              });
                              setShowInterviewScreening(true);
                              return;
                            }
                          }

                          // Directly update status without questionnaire
                          updateCandidateMutation.mutate({
                            id: candidateId,
                            data: { status: newStatus as 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'DEAD_BY_US' | 'DEAD_BY_CANDIDATE' | 'NO_SHOW' }
                          });
                        }}
                        onAnalyze={(candidate) => analyzeCandidateMutation.mutate(candidate.id)}
                        onEmail={(candidate) => {
                          const originalCandidate = candidates.find(c => c.id === candidate.id);
                          if (originalCandidate) {
                            setSelectedCandidateForEmail(originalCandidate);
                            setShowEmailGenerator(true);
                          }
                        }}
                        onNotes={(candidate) => {
                          const originalCandidate = candidates.find(c => c.id === candidate.id);
                          if (originalCandidate) {
                            setSelectedCandidateForNotes(originalCandidate);
                            setShowNotes(true);
                          }
                        }}
                        onScheduleInterview={(candidate) => {
                          const originalCandidate = candidates.find(c => c.id === candidate.id);
                          if (originalCandidate) {
                            setSelectedCandidateForInterview(originalCandidate);
                            setShowInterviewScheduler(true);
                          }
                        }}
                      />
                    </div>
                    <div className="flex-shrink-0">
                      <Select
                        value={candidate.status}
                        onValueChange={(newStatus) => {
                          const currentCandidate = candidates.find(c => c.id === candidate.id);
                          if (!currentCandidate) return;

                          // Check if moving to INTERVIEW status - requires screening for in-person interviews
                          if (newStatus === 'INTERVIEW' && currentCandidate.status !== 'INTERVIEW') {
                            let skipScreening = false;
                            if (currentCandidate.interviewScreeningData) {
                              try {
                                const prevScreening = JSON.parse(currentCandidate.interviewScreeningData as string);
                                skipScreening = prevScreening.hasDriversLicense &&
                                               prevScreening.hasReliableVehicle &&
                                               prevScreening.hasClearCommunication;
                              } catch (e) {
                                skipScreening = false;
                              }
                            }

                            if (!skipScreening) {
                              setCandidateForInterviewScreening({
                                candidate: currentCandidate,
                                nextStatus: newStatus
                              });
                              setShowInterviewScreening(true);
                              return;
                            }
                          }

                          // Check if moving to DEAD - show type selection modal
                          if (newStatus === 'DEAD') {
                            setCandidateForDeadType(currentCandidate);
                            setShowDeadTypeModal(true);
                            return;
                          }

                          // Directly update status without questionnaire
                          updateCandidateMutation.mutate({
                            id: candidate.id,
                            data: { status: newStatus as 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'DEAD_BY_US' | 'DEAD_BY_CANDIDATE' | 'NO_SHOW' }
                          });
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="APPLIED">Applied</SelectItem>
                          <SelectItem value="SCREENING">Screening</SelectItem>
                          <SelectItem value="INTERVIEW">Interview</SelectItem>
                          <SelectItem value="OFFER">Offer</SelectItem>
                          <SelectItem value="HIRED">Hired</SelectItem>
                          <SelectItem value="DEAD">Dead</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === 'interviews' ? (
              // Interview Dashboard View
              <InterviewDashboard />
            ) : viewMode === 'campaigns' ? (
              // Email Campaigns View
              <EmailCampaignManager />
            ) : viewMode === 'workflows' ? (
              // Workflow Automation View
              <div className="space-y-6">
                {/* Workflow Stage Connection Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      How Workflows Connect to Recruitment
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-blue-100 text-blue-800">APPLIED → SCREENING</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Triggers: AI resume screening, initial email
                        </p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-yellow-100 text-yellow-800">SCREENING → INTERVIEW</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Triggers: Schedule interview, send calendar invite
                        </p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-purple-100 text-purple-800">INTERVIEW → OFFER</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Triggers: Reference checks, offer letter prep
                        </p>
                      </div>
                      <div className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className="bg-green-100 text-green-800">OFFER → HIRED</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Triggers: Onboarding workflow, equipment setup
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Automatic Triggers:</strong> When you move a candidate between stages, 
                        active workflows will automatically execute their configured actions like sending emails, 
                        scheduling interviews, or running AI evaluations.
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                <WorkflowBuilder />
              </div>
            ) : viewMode === 'resume-uploads' ? (
              // Resume Uploads View
              <ResumeUploaderContent />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeDragCandidate ? (
          <DraggableCandidateCard
            candidate={{
              ...activeDragCandidate,
              appliedAt: activeDragCandidate.appliedDate ? new Date(activeDragCandidate.appliedDate).toISOString() : new Date().toISOString(),
              aiMatchScore: activeDragCandidate.matchScore ?? undefined,
              aiPotentialScore: activeDragCandidate.potentialScore ?? undefined,
              source: activeDragCandidate.stage || 'APPLIED',
              notes: activeDragCandidate.notes ?? undefined
            }}
            isDragDisabled={true}
          />
        ) : null}
      </DragOverlay>

      {/* Candidate Comparison Modal */}
      <CandidateComparison
        isOpen={showComparison}
        onClose={() => setShowComparison(false)}
      />

      {/* Email Template Generator Dialog */}
      <Dialog open={showEmailGenerator} onOpenChange={setShowEmailGenerator}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedCandidateForEmail
                ? `Send Email to ${selectedCandidateForEmail.firstName} ${selectedCandidateForEmail.lastName}`
                : 'Email Template Generator'
              }
            </DialogTitle>
            <DialogDescription>
              Generate and send personalized emails to candidates using AI-powered templates
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <EmailTemplateGenerator
              candidate={selectedCandidateForEmail ? {
                id: selectedCandidateForEmail.id,
                firstName: selectedCandidateForEmail.firstName,
                lastName: selectedCandidateForEmail.lastName,
                email: selectedCandidateForEmail.email,
                position: selectedCandidateForEmail.position
              } : undefined}
              onSendEmail={(emailData) => sendEmailMutation.mutate(emailData)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Interview Scheduler Dialog */}
      <Dialog open={showInterviewScheduler} onOpenChange={setShowInterviewScheduler}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Schedule Interview
              {selectedCandidateForInterview &&
                ` with ${selectedCandidateForInterview.firstName} ${selectedCandidateForInterview.lastName}`
              }
            </DialogTitle>
            <DialogDescription>
              Schedule and manage interviews with candidates including calendar integration
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {selectedCandidateForInterview && (
              <InterviewScheduler
                candidate={selectedCandidateForInterview}
                open={true}
                onScheduled={() => {
                  setShowInterviewScheduler(false);
                  setSelectedCandidateForInterview(null);
                  queryClient.invalidateQueries({ queryKey: ['/api/candidates'] });
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Questionnaire modal removed - no longer showing popup when moving to Hired */}

      {/* Hire Candidate Modal */}
      {showHireModal && candidateToHire && (
        <HireCandidateModal
          candidate={candidateToHire}
          onConfirm={(hireData) => {
            hireCandidateMutation.mutate({
              candidateId: candidateToHire.id,
              hireData,
            });
          }}
          onCancel={() => {
            setShowHireModal(false);
            setCandidateToHire(null);
          }}
          isLoading={hireCandidateMutation.isPending}
        />
      )}

      {/* Dead Type Selection Modal */}
      <Dialog open={showDeadTypeModal} onOpenChange={setShowDeadTypeModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Select Dead Type</DialogTitle>
            <DialogDescription>
              {candidateForDeadType && (
                <>Please select the reason for marking <strong>{candidateForDeadType.firstName} {candidateForDeadType.lastName}</strong> as dead.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (candidateForDeadType) {
                  updateCandidateMutation.mutate({
                    id: candidateForDeadType.id,
                    data: { status: 'DEAD_BY_US' }
                  });
                  setShowDeadTypeModal(false);
                  setCandidateForDeadType(null);
                }
              }}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Dead by Us
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => {
                if (candidateForDeadType) {
                  updateCandidateMutation.mutate({
                    id: candidateForDeadType.id,
                    data: { status: 'DEAD_BY_CANDIDATE' }
                  });
                  setShowDeadTypeModal(false);
                  setCandidateForDeadType(null);
                }
              }}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Dead by Candidate
            </Button>
            <Button
              className="bg-gray-600 hover:bg-gray-700 text-white"
              onClick={() => {
                if (candidateForDeadType) {
                  updateCandidateMutation.mutate({
                    id: candidateForDeadType.id,
                    data: { status: 'NO_SHOW' }
                  });
                  setShowDeadTypeModal(false);
                  setCandidateForDeadType(null);
                }
              }}
            >
              <XCircle className="mr-2 h-4 w-4" />
              No Show
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeadTypeModal(false);
                setCandidateForDeadType(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resume Preview Dialog */}
      <Dialog open={showResumePreview} onOpenChange={setShowResumePreview}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              Resume Preview
              <div className="flex gap-2">
                {previewResumeUrl && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(previewResumeUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Open in New Tab
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = previewResumeUrl;
                        link.download = 'resume';
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 h-full">
            {previewResumeUrl ? (
              previewResumeUrl.includes('drive.google.com') ? (
                <iframe
                  src={previewResumeUrl.replace('/view', '/preview')}
                  className="w-full h-full rounded-lg border"
                  title="Resume Preview"
                />
              ) : previewResumeUrl.endsWith('.pdf') || previewResumeUrl.includes('.pdf') ? (
                <iframe
                  src={previewResumeUrl}
                  className="w-full h-full rounded-lg border"
                  title="Resume Preview"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-16 w-16 mb-4" />
                  <p>Preview not available for this file type</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => window.open(previewResumeUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open File
                  </Button>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No resume available
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Candidate Notes Side Panel */}
      <Sheet open={showNotes} onOpenChange={setShowNotes}>
        <SheetContent side="right" className="w-[450px] sm:w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedCandidateForNotes &&
                `Notes for ${selectedCandidateForNotes.firstName} ${selectedCandidateForNotes.lastName}`
              }
            </SheetTitle>
            <SheetDescription>
              View and manage candidate notes and feedback
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {selectedCandidateForNotes && (
              <CandidateNotes candidateId={selectedCandidateForNotes.id} />
            )}
          </div>
        </SheetContent>
      </Sheet>
      
      {/* In-Person Interview Screening Dialog */}
      {showInterviewScreening && candidateForInterviewScreening && (
        <InPersonInterviewScreening
          isOpen={showInterviewScreening}
          onClose={() => {
            setShowInterviewScreening(false);
            setCandidateForInterviewScreening(null);
          }}
          candidate={candidateForInterviewScreening.candidate}
          onProceed={(screeningData) => {
            // Only proceed if all requirements are met or manager approves despite failures
            if (screeningData.allPassed) {
              // All requirements met - proceed normally
              updateCandidateMutation.mutate({
                id: candidateForInterviewScreening.candidate.id,
                data: { 
                  status: 'INTERVIEW',
                  notes: screeningData.notes 
                    ? `${candidateForInterviewScreening.candidate.notes || ''}\n\nInterview Screening: ${screeningData.notes}`.trim()
                    : candidateForInterviewScreening.candidate.notes
                }
              });
              toast({
                title: 'Screening Complete',
                description: 'Candidate passed all requirements. Now schedule the interview.'
              });
            } else {
              // Requirements not met but manager wants to proceed
              const failedRequirements = [];
              if (!screeningData.hasDriversLicense) failedRequirements.push('No Driver\'s License');
              if (!screeningData.hasReliableVehicle) failedRequirements.push('No Reliable Vehicle');
              if (!screeningData.hasClearCommunication) failedRequirements.push('Communication Issues');
              
              updateCandidateMutation.mutate({
                id: candidateForInterviewScreening.candidate.id,
                data: { 
                  status: 'INTERVIEW',
                  notes: `${candidateForInterviewScreening.candidate.notes || ''}\n\nInterview Screening Alert: ${failedRequirements.join(', ')}\nNotes: ${screeningData.notes}`.trim()
                }
              });
              toast({
                title: 'Screening Complete with Warnings',
                description: 'Managers have been alerted. Now schedule the interview.',
                variant: 'destructive'
              });
            }
            
            // Close screening dialog
            const candidateToSchedule = candidateForInterviewScreening.candidate;
            setShowInterviewScreening(false);
            setCandidateForInterviewScreening(null);
            
            // Now open the interview scheduler dialog AFTER screening is complete
            setTimeout(() => {
              setSelectedCandidateForInterview(candidateToSchedule);
              setShowInterviewScheduler(true);
            }, 300); // Small delay to ensure smooth transition between dialogs
          }}
          onCancel={() => {
            setShowInterviewScreening(false);
            setCandidateForInterviewScreening(null);
            toast({
              title: 'Screening Cancelled',
              description: 'Candidate remains in current stage'
            });
          }}
        />
      )}

      {/* Candidate Details Dialog - For viewing from notifications */}
      <Dialog open={showCandidateDetails} onOpenChange={setShowCandidateDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Candidate Details</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCandidateDetails(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              View comprehensive candidate information and AI analysis
            </DialogDescription>
          </DialogHeader>
          
          {selectedCandidate && (
            <div className="space-y-6">
              {/* Candidate Info */}
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold text-lg mb-2">
                  {selectedCandidate.firstName || 'Unknown'} {selectedCandidate.lastName || 'Candidate'}
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Position:</span>
                    <span className="ml-2 font-medium">{selectedCandidate.position || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <Badge className="ml-2" variant={
                      selectedCandidate.status === 'HIRED' ? 'default' :
                      selectedCandidate.status === 'REJECTED' ? 'destructive' :
                      'secondary'
                    }>
                      {selectedCandidate.status || 'Unknown'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <span className="ml-2">{selectedCandidate.email || 'No email provided'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="ml-2">{selectedCandidate.phone || 'No phone provided'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Applied:</span>
                    <span className="ml-2">{new Date(selectedCandidate.appliedDate).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Updated:</span>
                    <span className="ml-2">{new Date(selectedCandidate.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {selectedCandidate.assignedTo && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Assigned To:</span>
                      <Badge className="ml-2" variant="outline">
                        <Users className="h-3 w-3 mr-1" />
                        {availableEmployees.find((e: any) => e.id === selectedCandidate.assignedTo)?.firstName} {availableEmployees.find((e: any) => e.id === selectedCandidate.assignedTo)?.lastName}
                      </Badge>
                    </div>
                  )}
                  {selectedCandidate.referralName && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Referred By:</span>
                      <span className="ml-2 font-medium">{selectedCandidate.referralName}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* AI Analysis - Comprehensive Panel */}
              <AIInsightsPanel 
                candidateId={selectedCandidate.id} 
                candidateData={selectedCandidate} 
              />
              
              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingCandidate(selectedCandidate);
                    setShowEditCandidate(true);
                    setShowCandidateDetails(false);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit Candidate
                </Button>

                {selectedCandidate.resumeUrl && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPreviewResumeUrl(selectedCandidate.resumeUrl!);
                      setShowResumePreview(true);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View Resume
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => {
                    const nextStatus = getNextStatus(selectedCandidate.status);
                    if (nextStatus) {
                      // Directly update status without questionnaire
                      updateCandidateMutation.mutate({
                        id: selectedCandidate.id,
                        data: { status: nextStatus }
                      });
                    }
                  }}
                  disabled={!getNextStatus(selectedCandidate.status)}
                >
                  <ChevronRight className="h-4 w-4 mr-1" />
                  Move to {getNextStatus(selectedCandidate.status) || 'Final Stage'}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCandidateForInterview(selectedCandidate);
                    setShowInterviewScheduler(true);
                  }}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Schedule Interview
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCandidateForEmail(selectedCandidate);
                    setShowEmailGenerator(true);
                  }}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Send Email
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCandidateForNotes(selectedCandidate);
                    setShowNotes(true);
                  }}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  View Notes
                </Button>
                
                {!selectedCandidate.matchScore && (
                  <Button
                    variant="outline"
                    onClick={() => analyzeCandidateMutation.mutate(selectedCandidate.id)}
                    disabled={analyzeCandidateMutation.isPending}
                  >
                    <Brain className="h-4 w-4 mr-1" />
                    Run AI Analysis
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Add Candidate Dialog */}
      <Dialog open={isCandidateDialogOpen} onOpenChange={setIsCandidateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Candidate</DialogTitle>
          </DialogHeader>
          <form onSubmit={candidateForm.handleSubmit(onCandidateSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...candidateForm.register('firstName')}
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...candidateForm.register('lastName')}
                  placeholder="Enter last name"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...candidateForm.register('email')}
                placeholder="Enter email address"
              />
            </div>
            
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                {...candidateForm.register('phone')}
                placeholder="Enter phone number"
              />
            </div>
            
            <div>
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                {...candidateForm.register('position')}
                placeholder="Position applying for"
              />
            </div>
            
            <div>
              <Label htmlFor="resume">Resume Upload</Label>
              <div className="flex gap-2">
                <Input
                  id="resumeFile"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setResumeFile(file);
                      handleResumeUpload(file);
                    }
                  }}
                  disabled={isParsing}
                  className="flex-1"
                />
                {isParsing && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Brain className="h-4 w-4 animate-spin" />
                    Parsing resume...
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a resume to automatically extract candidate information using AI.
                <br />
                <span className="text-amber-600">Note: Text files (.txt) work best. PDF parsing is limited.</span>
              </p>
              <Input
                id="resumeUrl"
                {...candidateForm.register('resumeUrl')}
                placeholder="Or paste a link to resume document (optional)"
                className="mt-2"
              />
            </div>
            
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...candidateForm.register('notes')}
                placeholder="Additional notes about the candidate"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="referralName">Referred By (optional)</Label>
              <Input
                id="referralName"
                {...candidateForm.register('referralName')}
                placeholder="Who referred this candidate?"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsCandidateDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCandidateMutation.isPending}>
                {createCandidateMutation.isPending ? 'Adding...' : 'Add Candidate'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Candidate Dialog */}
      <Dialog open={showEditCandidate} onOpenChange={(open) => {
        setShowEditCandidate(open);
        if (!open) setEditingCandidate(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Candidate</DialogTitle>
            <DialogDescription>
              Update candidate information
            </DialogDescription>
          </DialogHeader>
          {editingCandidate && (
            <EditCandidateForm
              candidate={editingCandidate}
              positionTypes={positionTypes}
              onSubmit={(data) => {
                updateCandidateMutation.mutate({
                  id: editingCandidate.id,
                  data
                }, {
                  onSuccess: () => {
                    setShowEditCandidate(false);
                    setEditingCandidate(null);
                    toast({
                      title: 'Candidate Updated',
                      description: 'Candidate information has been saved.',
                    });
                  }
                });
              }}
              onCancel={() => {
                setShowEditCandidate(false);
                setEditingCandidate(null);
              }}
              isPending={updateCandidateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add New Hire Dialog */}
      <Dialog open={isNewHireDialogOpen} onOpenChange={setIsNewHireDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Hire - Direct Employee Onboarding</DialogTitle>
            <DialogDescription>
              Create a new employee account directly and start the onboarding process with welcome packages and tool assignments.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={newHireForm.handleSubmit(onNewHireSubmit)} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                This will create an employee account directly and start the onboarding process:
                • Send welcome email with credentials
                • Schedule onboarding tasks
                • Generate employment contract
                • Assign tools & equipment with inventory tracking
                • Create Google Drive folder
                • Set up PTO balance
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hire-firstName">First Name *</Label>
                <Input
                  id="hire-firstName"
                  {...newHireForm.register('firstName')}
                  placeholder="Enter first name"
                />
              </div>
              <div>
                <Label htmlFor="hire-lastName">Last Name *</Label>
                <Input
                  id="hire-lastName"
                  {...newHireForm.register('lastName')}
                  placeholder="Enter last name"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hire-email">Email *</Label>
                <Input
                  id="hire-email"
                  type="email"
                  {...newHireForm.register('email')}
                  placeholder="email@theroofdocs.com"
                />
              </div>
              <div>
                <Label htmlFor="hire-phone">Phone *</Label>
                <Input
                  id="hire-phone"
                  {...newHireForm.register('phone')}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hire-position">Position *</Label>
                <Input
                  id="hire-position"
                  {...newHireForm.register('position')}
                  placeholder="e.g., Roofing Technician"
                />
              </div>
              <div>
                <Label htmlFor="hire-department">Department *</Label>
                <Select
                  value={newHireForm.watch('department')}
                  onValueChange={(value) => newHireForm.setValue('department', value)}
                >
                  <SelectTrigger id="hire-department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hire-startDate">Start Date *</Label>
                <Input
                  id="hire-startDate"
                  type="date"
                  {...newHireForm.register('startDate')}
                />
              </div>
              <div>
                <Label htmlFor="hire-salary">Salary</Label>
                <Input
                  id="hire-salary"
                  {...newHireForm.register('salary')}
                  placeholder="e.g., $50,000 (optional)"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="hire-shirtSize">Shirt Size *</Label>
                <Select
                  value={newHireForm.watch('shirtSize')}
                  onValueChange={(value) => {
                    newHireForm.setValue('shirtSize', value);
                    
                    // Check size availability when welcome package is selected
                    const packageId = newHireForm.watch('welcomePackageId');
                    if (packageId && welcomeBundles && toolsInventory) {
                      const selectedBundle = welcomeBundles.find(b => b.id === packageId);
                      if (selectedBundle && selectedBundle.items) {
                        const clothingItems = selectedBundle.items.filter((item: any) => item.requiresSize);
                        
                        // Check availability for each clothing item
                        const unavailableItems: string[] = [];
                        clothingItems.forEach((item: any) => {
                          // Find inventory items matching the clothing name
                          const inventoryItem = toolsInventory.find((tool: any) => 
                            tool.name === item.itemName && 
                            tool.category === 'CLOTHING'
                          );
                          
                          if (inventoryItem) {
                            // Check if size-specific inventory tracking is needed
                            // For now, we'll check general availability
                            if (inventoryItem.availableQuantity < item.quantity) {
                              unavailableItems.push(item.itemName);
                            }
                          } else {
                            // Item not found in inventory
                            unavailableItems.push(item.itemName);
                          }
                        });
                        
                        if (unavailableItems.length > 0) {
                          toast({
                            title: '⚠️ Size Availability Alert',
                            description: `The following items may not be available in ${value}: ${unavailableItems.join(', ')}. Please check inventory manually or select a different size.`,
                            variant: 'destructive',
                          });
                        }
                      }
                    }
                  }}
                >
                  <SelectTrigger id="hire-shirtSize">
                    <SelectValue placeholder="Select shirt size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">Small</SelectItem>
                    <SelectItem value="M">Medium</SelectItem>
                    <SelectItem value="L">Large</SelectItem>
                    <SelectItem value="XL">X-Large</SelectItem>
                    <SelectItem value="XXL">XX-Large</SelectItem>
                    <SelectItem value="3X">3X-Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="hire-welcomePackage">Welcome Package</Label>
                <Select
                  value={newHireForm.watch('welcomePackageId')}
                  onValueChange={(value) => newHireForm.setValue('welcomePackageId', value)}
                  disabled={bundlesLoading}
                >
                  <SelectTrigger id="hire-welcomePackage">
                    <SelectValue placeholder={bundlesLoading ? "Loading packages..." : "Select welcome package (optional)"} />
                  </SelectTrigger>
                  <SelectContent>
                    {bundlesLoading ? (
                      <SelectItem value="loading" disabled>
                        Loading welcome packages...
                      </SelectItem>
                    ) : welcomeBundles && welcomeBundles.length > 0 ? (
                      welcomeBundles.map((bundle) => {
                        // Check if all items in bundle are available
                        const selectedSize = newHireForm.watch('shirtSize');
                        const allItemsAvailable = bundle.items?.every((item: any) => {
                          // For clothing items, check specific size availability
                          if (item.requiresSize && item.availableBySize) {
                            if (!selectedSize) {
                              // No size selected, check if any size is available
                              return Object.values(item.availableBySize).some((count: any) => count >= item.quantity);
                            }
                            // Check specific size availability
                            const sizeAvailable = item.availableBySize[selectedSize] || 0;
                            return sizeAvailable >= item.quantity;
                          }
                          // For non-clothing items, use general availability
                          return item.isAvailable !== false;
                        }) ?? false;
                        
                        const needsSizeSelection = bundle.items?.some((item: any) => item.requiresSize) && !selectedSize;
                        
                        return (
                          <SelectItem 
                            key={bundle.id} 
                            value={bundle.id}
                            disabled={!allItemsAvailable || needsSizeSelection}
                          >
                            {bundle.name} 
                            {needsSizeSelection && ' (Select shirt size first)'}
                            {!needsSizeSelection && !allItemsAvailable && ' (Insufficient inventory)'}
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="none" disabled>
                        No welcome packages available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {/* Display package contents when selected */}
                {newHireForm.watch('welcomePackageId') && welcomeBundles && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
                    {(() => {
                      const selectedBundle = welcomeBundles.find(b => b.id === newHireForm.watch('welcomePackageId'));
                      if (!selectedBundle || !selectedBundle.items) return null;
                      
                      return (
                        <div>
                          <p className="font-medium text-blue-900 mb-1">📦 Package includes:</p>
                          <ul className="space-y-1 text-blue-700">
                            {selectedBundle.items.map((item: any, idx: number) => (
                              <li key={idx} className="flex items-center gap-1">
                                <span className="text-blue-500">•</span>
                                <span>{item.quantity}x {item.itemName}</span>
                                {item.requiresSize && (
                                  <span className="text-blue-600 text-xs">(Size: {newHireForm.watch('shirtSize') || 'Select size'})</span>
                                )}
                                {(() => {
                                  // Show size-specific availability for clothing items
                                  if (item.requiresSize && item.availableBySize) {
                                    const selectedSize = newHireForm.watch('shirtSize');
                                    if (selectedSize && item.availableBySize[selectedSize] !== undefined) {
                                      const sizeAvailable = item.availableBySize[selectedSize];
                                      const isAvailable = sizeAvailable >= item.quantity;
                                      return (
                                        <span className={`text-xs ml-1 ${isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                                          ({sizeAvailable} available in {selectedSize})
                                        </span>
                                      );
                                    } else if (selectedSize) {
                                      return (
                                        <span className="text-xs ml-1 text-red-600">
                                          (0 available in {selectedSize})
                                        </span>
                                      );
                                    } else {
                                      // No size selected, show general availability
                                      const availableSizes = Object.entries(item.availableBySize)
                                        .filter(([_, count]: [string, any]) => count > 0)
                                        .map(([size]) => size)
                                        .join(', ');
                                      return availableSizes ? (
                                        <span className="text-xs ml-1 text-gray-600">
                                          (Available in: {availableSizes})
                                        </span>
                                      ) : (
                                        <span className="text-xs ml-1 text-red-600">
                                          (Out of stock)
                                        </span>
                                      );
                                    }
                                  } else if (item.availableQuantity !== undefined) {
                                    // Non-clothing item
                                    return (
                                      <span className={`text-xs ml-1 ${item.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                                        ({item.availableQuantity} available)
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="hire-tools">Tools & Equipment</Label>
              <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                {toolsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading available tools...</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-2">Select tools and equipment to assign:</p>
                    <div className="space-y-2">
                      {toolsInventory && toolsInventory.length > 0 ? (
                        toolsInventory.filter(tool => tool.availableQuantity > 0).length > 0 ? (
                          toolsInventory.filter(tool => tool.availableQuantity > 0).map((tool) => (
                            <div key={tool.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`tool-${tool.id}`}
                                checked={selectedTools.includes(tool.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    const updated = [...selectedTools, tool.id];
                                    setSelectedTools(updated);
                                    newHireForm.setValue('toolIds', updated);
                                  } else {
                                    const updated = selectedTools.filter(id => id !== tool.id);
                                    setSelectedTools(updated);
                                    newHireForm.setValue('toolIds', updated);
                                  }
                                }}
                              />
                              <label
                                htmlFor={`tool-${tool.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                              >
                                {tool.name} ({tool.category}) - {tool.availableQuantity} available
                              </label>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500">No tools available for assignment</p>
                        )
                      ) : (
                        <p className="text-sm text-gray-500">No tools in inventory</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="hire-reportingTo">Reporting Manager</Label>
              <Select
                value={newHireForm.watch('reportingTo')}
                onValueChange={(value) => newHireForm.setValue('reportingTo', value)}
                disabled={managersLoading}
              >
                <SelectTrigger id="hire-reportingTo">
                  <SelectValue placeholder={managersLoading ? "Loading managers..." : "Select reporting manager (optional)"} />
                </SelectTrigger>
                <SelectContent>
                  {managersLoading ? (
                    <SelectItem value="loading" disabled>
                      Loading managers...
                    </SelectItem>
                  ) : managersAndAdmins && managersAndAdmins.length > 0 ? (
                    managersAndAdmins.map((manager) => (
                      <SelectItem key={manager.id} value={manager.email}>
                        {manager.firstName} {manager.lastName} - {manager.position || manager.role}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No managers available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="hire-notes">Additional Notes</Label>
              <Textarea
                id="hire-notes"
                {...newHireForm.register('notes')}
                placeholder="Any additional information about the new hire"
                rows={3}
              />
            </div>
            
            <div className="flex justify-between">
              <Button 
                type="button" 
                variant="secondary"
                onClick={testFillForm}
                className="bg-blue-100 hover:bg-blue-200"
              >
                🧪 Test Fill (Ahmed + Sales)
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsNewHireDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createNewHireMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {createNewHireMutation.isPending ? 'Processing...' : 'Add New Hire & Start Onboarding'}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Floating action bar for bulk selection */}
      {selectedCandidates.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 shadow-xl rounded-lg px-4 py-3 flex items-center gap-4 z-50 border dark:border-gray-700">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {selectedCandidates.size} candidate{selectedCandidates.size !== 1 ? 's' : ''} selected
          </span>
          <Select onValueChange={handleBulkMove} disabled={bulkStatusMutation.isPending}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Move to..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="APPLIED">Application Review</SelectItem>
              <SelectItem value="SCREENING">Phone Screening</SelectItem>
              <SelectItem value="INTERVIEW">Interview</SelectItem>
              <SelectItem value="OFFER">Offer</SelectItem>
              <SelectItem value="HIRED">Hired</SelectItem>
              <SelectItem value="DEAD_BY_US">Dead (By Us)</SelectItem>
              <SelectItem value="DEAD_BY_CANDIDATE">Dead (By Candidate)</SelectItem>
              <SelectItem value="NO_SHOW">No Show</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </DndContext>
  );
}