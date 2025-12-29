import { useState, useRef, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { io } from 'socket.io-client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Textarea } from '@/components/ui/textarea';
import { FileText, AlertTriangle, Clock, Upload, ExternalLink, Calendar, Bell, File, X, RefreshCw, CloudDownload, Sparkles, Eye, Download, CheckCircle2, User as UserIcon, Check, ChevronsUpDown, FolderOpen, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, differenceInDays } from 'date-fns';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { User, CoiDocument } from '@/../../shared/schema';

// Helper function to convert date formats
// Parses MM/DD/YYYY or M/D/YYYY and returns YYYY-MM-DD for HTML date inputs
function formatDateForInput(dateStr: string | null | undefined): string {
  if (!dateStr) return '';

  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Try to parse MM/DD/YYYY or M/D/YYYY format
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const month = match[1].padStart(2, '0');
    const day = match[2].padStart(2, '0');
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  // Try to parse as a date and format
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    // Ignore parse errors
  }

  return '';
}

// Types for smart upload
interface COIParsedData {
  insuredName: string | null;      // Person name for employee matching
  rawInsuredName: string | null;   // Raw name from document (person or company)
  policyNumber: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  insurerName: string | null;
  coverageAmounts: {
    generalLiability?: number;
    workersComp?: number;
    autoLiability?: number;
    umbrella?: number;
  };
  documentType: 'WORKERS_COMP' | 'GENERAL_LIABILITY' | 'AUTO' | 'UMBRELLA' | 'UNKNOWN';
  rawText: string;
  confidence: number;
}

interface EmployeeMatch {
  employeeId: string | null;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'email' | 'partial' | 'none';
  matchedEmployee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  suggestedEmployees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    score: number;
  }>;
}

interface SmartUploadResponse {
  success: boolean;
  parsedData: COIParsedData;
  employeeMatch: EmployeeMatch;
  requiresConfirmation: boolean;
  document?: any;
  message?: string;
}

// Bulk import types
interface BulkPreviewItem {
  googleDriveId: string;
  fileName: string;
  webViewLink: string;
  parsedData: COIParsedData;
  employeeMatch: EmployeeMatch;
  alreadyImported: boolean;
}

interface BulkPreviewResponse {
  success: boolean;
  totalFiles: number;
  previews: BulkPreviewItem[];
  errors: { file: string; error: string }[];
  alreadyImported: number;
  message?: string;
}

interface BulkEditItem {
  selected: boolean;
  employeeId: string;
  externalName: string;
  useExternalName: boolean;
  type: 'WORKERS_COMP' | 'GENERAL_LIABILITY';
  issueDate: string;
  expirationDate: string;
  policyNumber: string;
  insurerName: string;
}

const formSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  type: z.enum(['WORKERS_COMP', 'GENERAL_LIABILITY']),
  documentUrl: z.string().min(1, 'Document URL is required'),
  issueDate: z.string().min(1, 'Issue date is required'),
  expirationDate: z.string().min(1, 'Expiration date is required'),
  notes: z.string().optional()
});

export default function CoiDocuments() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<CoiDocument | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'WORKERS_COMP' | 'GENERAL_LIABILITY'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED'>('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Smart upload states
  const [isSmartUploadOpen, setIsSmartUploadOpen] = useState(false);
  const [smartUploadFile, setSmartUploadFile] = useState<File | null>(null);
  const [smartUploadResult, setSmartUploadResult] = useState<SmartUploadResponse | null>(null);
  const [isSmartUploadLoading, setIsSmartUploadLoading] = useState(false);
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const smartFileInputRef = useRef<HTMLInputElement>(null);

  // Smart upload form fields (editable by user)
  const [smartFormData, setSmartFormData] = useState({
    employeeId: '',
    externalName: '', // For contractors not in the system
    useExternalName: false, // Toggle between employee selection and external name
    type: 'GENERAL_LIABILITY' as 'WORKERS_COMP' | 'GENERAL_LIABILITY',
    issueDate: '',
    expirationDate: '',
    notes: '',
    policyNumber: '',
    insurerName: '',
  });
  const [employeeNotFound, setEmployeeNotFound] = useState(false);
  const [smartEmployeeOpen, setSmartEmployeeOpen] = useState(false);
  const [regularEmployeeOpen, setRegularEmployeeOpen] = useState(false);

  // Bulk import states
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkPreviews, setBulkPreviews] = useState<BulkPreviewItem[]>([]);
  const [isBulkPreviewLoading, setIsBulkPreviewLoading] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [bulkEditState, setBulkEditState] = useState<Record<string, BulkEditItem>>({});
  const [bulkPreviewErrors, setBulkPreviewErrors] = useState<{ file: string; error: string }[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      employeeId: currentUser?.role === 'EMPLOYEE' ? currentUser.id : '',
      type: 'WORKERS_COMP',
      documentUrl: '',
      issueDate: '',
      expirationDate: '',
      notes: ''
    }
  });

  const { data: documents = [], isLoading: documentsLoading, refetch: refetchDocuments } = useQuery<CoiDocument[]>({
    queryKey: ['/api/coi-documents'],
    staleTime: 0,  // Always fetch fresh data
    gcTime: 0,     // Don't cache responses
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Force cache clear and refresh on mount to ensure we have latest data
  useEffect(() => {
    // Remove any stale cached data first, then refetch fresh data
    queryClient.removeQueries({ queryKey: ['/api/coi-documents'] });
    queryClient.invalidateQueries({ queryKey: ['/api/coi-documents'] });
    refetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Real-time COI updates via Socket.IO
  useEffect(() => {
    const socket = io('/', {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
    });

    socket.on('coi:updated', (data: { action: string; documentId: string; uploadedBy?: string; updatedBy?: string; deletedBy?: string }) => {
      // Refresh the COI documents list when any change occurs
      queryClient.invalidateQueries({ queryKey: ['/api/coi-documents'] });

      // Show toast notification for changes made by other users
      if (data.uploadedBy && data.uploadedBy !== currentUser?.email) {
        toast({
          title: 'COI Document Added',
          description: 'A new COI document was uploaded by another user.',
        });
      } else if (data.deletedBy && data.deletedBy !== currentUser?.email) {
        toast({
          title: 'COI Document Removed',
          description: 'A COI document was deleted by another user.',
        });
      } else if (data.updatedBy && data.updatedBy !== currentUser?.email) {
        toast({
          title: 'COI Document Updated',
          description: 'A COI document was modified by another user.',
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [currentUser?.email, toast]);

  // Filter users based on current user's role
  const { data: allUsers = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: !!currentUser, // Only fetch when currentUser is available
  });

  // For employees, only show their own name; for managers/HR, show all
  const users = currentUser?.role === 'EMPLOYEE'
    ? allUsers.filter((u: User) => u.id === currentUser.id)
    : allUsers;

  // Sort users alphabetically by first name, then last name
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      const nameA = `${a.firstName || ''} ${a.lastName || ''}`.toLowerCase();
      const nameB = `${b.firstName || ''} ${b.lastName || ''}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [users]);

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      if (!selectedFile) {
        throw new Error('Please select a file');
      }
      
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('employeeId', data.employeeId);
      formData.append('type', data.type);
      formData.append('issueDate', data.issueDate);
      formData.append('expirationDate', data.expirationDate);
      if (data.notes) formData.append('notes', data.notes);
      
      const response = await fetch('/api/coi-documents/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload COI document');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coi-documents'] });
      setIsCreateDialogOpen(false);
      form.reset();
      handleRemoveFile(); // Clear selected file
      toast({
        title: 'Success',
        description: 'COI document uploaded successfully to Google Drive',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload COI document',
        variant: 'destructive',
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/coi-documents/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/coi-documents'] });
      toast({
        title: 'Success',
        description: 'COI document deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete COI document',
        variant: 'destructive',
      });
    }
  });

  const sendAlertsMutation = useMutation<{ alertsSent: number }, Error>({
    mutationFn: async () => {
      return apiRequest<{ alertsSent: number }>('/api/coi-documents/send-alerts', {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Alerts Sent',
        description: `${data.alertsSent} expiration alerts have been sent`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send alerts',
        variant: 'destructive',
      });
    }
  });

  // Sync from Google Drive mutation
  const syncFromDriveMutation = useMutation<{ totalDocuments: number }, Error>({
    mutationFn: async () => {
      return apiRequest<{ totalDocuments: number }>('/api/coi-documents/sync-from-drive', {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/coi-documents'] });
      toast({
        title: 'Sync Complete',
        description: `Successfully imported COI documents from Google Drive. Total documents: ${data.totalDocuments}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync from Google Drive',
        variant: 'destructive',
      });
    }
  });

  // Smart Upload mutation - always shows form for user review
  const handleSmartUpload = async (file: File) => {
    setIsSmartUploadLoading(true);
    setSmartUploadResult(null);
    setEmployeeNotFound(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/coi-documents/smart-upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Smart upload failed');
      }

      const result: SmartUploadResponse = await response.json();
      setSmartUploadResult(result);

      // Pre-fill the form with parsed data
      const today = new Date();
      const oneYearFromNow = new Date(today);
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      // Determine document type
      let docType: 'WORKERS_COMP' | 'GENERAL_LIABILITY' = 'GENERAL_LIABILITY';
      if (result.parsedData.documentType === 'WORKERS_COMP') {
        docType = 'WORKERS_COMP';
      } else if (result.parsedData.documentType === 'GENERAL_LIABILITY') {
        docType = 'GENERAL_LIABILITY';
      }

      // Only pre-select employee if confidence is HIGH (80+)
      // This prevents weak matches like "Han D" from being auto-selected
      const hasConfidentMatch =
        result.employeeMatch?.matchedEmployee?.id &&
        result.employeeMatch.confidence >= 80;

      setEmployeeNotFound(!hasConfidentMatch);

      // Get display name - use rawInsuredName which includes company names
      const displayName = result.parsedData.rawInsuredName || result.parsedData.insuredName || '';

      // Pre-fill form data - only pre-select employee if confident match
      // If no confident match, pre-fill the external name with whatever was extracted
      setSmartFormData({
        employeeId: hasConfidentMatch ? result.employeeMatch.matchedEmployee!.id : '',
        externalName: !hasConfidentMatch ? displayName : '',
        useExternalName: !hasConfidentMatch && !!displayName, // Auto-enable external name if no match
        type: docType,
        issueDate: formatDateForInput(result.parsedData.effectiveDate) || today.toISOString().split('T')[0],
        expirationDate: formatDateForInput(result.parsedData.expirationDate) || oneYearFromNow.toISOString().split('T')[0],
        notes: '',
        policyNumber: result.parsedData.policyNumber || '',
        insurerName: result.parsedData.insurerName || '',
      });

      // Better toast message showing what was found
      toast({
        title: displayName ? 'Document Analyzed' : 'Document Uploaded',
        description: hasConfidentMatch
          ? `Matched to ${result.employeeMatch.matchedEmployee?.firstName} ${result.employeeMatch.matchedEmployee?.lastName} (${result.employeeMatch.confidence}% confidence)`
          : displayName
            ? `Found "${displayName}" - select employee or save as external.`
            : 'Could not extract name from document. Please enter details manually.',
      });

    } catch (error: any) {
      toast({
        title: 'Smart Upload Failed',
        description: error.message || 'Failed to process document',
        variant: 'destructive',
      });
    } finally {
      setIsSmartUploadLoading(false);
    }
  };

  // Confirm assignment mutation
  const confirmAssignmentMutation = useMutation({
    mutationFn: async (data: {
      file: File;
      employeeId?: string;
      externalName?: string;
      parsedInsuredName?: string;
      type: string;
      issueDate: string;
      expirationDate: string;
      notes?: string;
      policyNumber?: string;
      insurerName?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      if (data.employeeId) formData.append('employeeId', data.employeeId);
      if (data.externalName) formData.append('externalName', data.externalName);
      if (data.parsedInsuredName) formData.append('parsedInsuredName', data.parsedInsuredName);
      formData.append('type', data.type);
      formData.append('issueDate', data.issueDate);
      formData.append('expirationDate', data.expirationDate);
      if (data.notes) formData.append('notes', data.notes);
      if (data.policyNumber) formData.append('policyNumber', data.policyNumber);
      if (data.insurerName) formData.append('insurerName', data.insurerName);

      const response = await fetch('/api/coi-documents/confirm-assignment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to confirm assignment');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/coi-documents'] });
      toast({
        title: 'Document Saved',
        description: data.message || 'COI document has been saved successfully',
      });
      resetSmartUpload();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save document',
        variant: 'destructive',
      });
    }
  });

  const resetSmartUpload = () => {
    setIsSmartUploadOpen(false);
    setSmartUploadFile(null);
    setSmartUploadResult(null);
    setEmployeeNotFound(false);
    setSmartFormData({
      employeeId: '',
      externalName: '',
      useExternalName: false,
      type: 'GENERAL_LIABILITY',
      issueDate: '',
      expirationDate: '',
      notes: '',
      policyNumber: '',
      insurerName: '',
    });
    if (smartFileInputRef.current) {
      smartFileInputRef.current.value = '';
    }
  };

  const handleSmartFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.includes('pdf') && !file.type.includes('image')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a PDF or image file',
          variant: 'destructive',
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'File size must be less than 10MB',
          variant: 'destructive',
        });
        return;
      }

      setSmartUploadFile(file);
      handleSmartUpload(file);
    }
  };

  const handleSmartFormSave = () => {
    if (!smartUploadFile) {
      toast({
        title: 'No File',
        description: 'Please upload a file first',
        variant: 'destructive',
      });
      return;
    }

    // Must have either employeeId OR externalName
    if (!smartFormData.employeeId && !smartFormData.externalName) {
      toast({
        title: 'Name Required',
        description: 'Please select an employee or enter an external name',
        variant: 'destructive',
      });
      setEmployeeNotFound(true);
      return;
    }

    if (!smartFormData.issueDate || !smartFormData.expirationDate) {
      toast({
        title: 'Dates Required',
        description: 'Please enter issue and expiration dates',
        variant: 'destructive',
      });
      return;
    }

    // Get the raw insured name from parsed result for storage
    const parsedInsuredName = smartUploadResult?.parsedData?.rawInsuredName ||
                              smartUploadResult?.parsedData?.insuredName || undefined;

    confirmAssignmentMutation.mutate({
      file: smartUploadFile,
      employeeId: smartFormData.useExternalName ? undefined : smartFormData.employeeId || undefined,
      externalName: smartFormData.useExternalName ? smartFormData.externalName : undefined,
      parsedInsuredName,
      type: smartFormData.type,
      issueDate: smartFormData.issueDate,
      expirationDate: smartFormData.expirationDate,
      notes: smartFormData.notes || undefined,
      policyNumber: smartFormData.policyNumber || undefined,
      insurerName: smartFormData.insurerName || undefined,
    });
  };

  // ============================================
  // BULK IMPORT HANDLERS
  // ============================================

  const resetBulkImport = () => {
    setIsBulkImportOpen(false);
    setBulkPreviews([]);
    setBulkEditState({});
    setBulkPreviewErrors([]);
    setIsBulkPreviewLoading(false);
    setIsBulkImporting(false);
  };

  const handleBulkPreview = async () => {
    setIsBulkPreviewLoading(true);
    setBulkPreviewErrors([]);

    try {
      const response = await apiRequest('POST', '/api/coi-documents/bulk-preview', {});
      const data = response as BulkPreviewResponse;

      if (data.success) {
        setBulkPreviews(data.previews);
        setBulkPreviewErrors(data.errors || []);

        // Initialize edit state for each preview
        const editState: Record<string, BulkEditItem> = {};
        for (const preview of data.previews) {
          editState[preview.googleDriveId] = {
            selected: !preview.alreadyImported, // Auto-select new items
            employeeId: preview.employeeMatch.matchedEmployee?.id || '',
            externalName: '',
            useExternalName: !preview.employeeMatch.matchedEmployee && preview.employeeMatch.confidence < 50,
            type: preview.parsedData.documentType === 'WORKERS_COMP' || preview.parsedData.documentType === 'GENERAL_LIABILITY'
              ? preview.parsedData.documentType
              : 'GENERAL_LIABILITY',
            issueDate: formatDateForInput(preview.parsedData.effectiveDate),
            expirationDate: formatDateForInput(preview.parsedData.expirationDate),
            policyNumber: preview.parsedData.policyNumber || '',
            insurerName: preview.parsedData.insurerName || '',
          };
        }
        setBulkEditState(editState);

        toast({
          title: 'Scan Complete',
          description: `Found ${data.totalFiles} files. ${data.alreadyImported} already imported, ${data.errors?.length || 0} errors.`,
        });
      } else {
        throw new Error('Failed to scan folder');
      }
    } catch (error: any) {
      console.error('Bulk preview error:', error);
      toast({
        title: 'Scan Failed',
        description: error.message || 'Failed to scan Google Drive folder',
        variant: 'destructive',
      });
    } finally {
      setIsBulkPreviewLoading(false);
    }
  };

  const handleBulkEditChange = (googleDriveId: string, updates: Partial<BulkEditItem>) => {
    setBulkEditState(prev => ({
      ...prev,
      [googleDriveId]: { ...prev[googleDriveId], ...updates }
    }));
  };

  const getSelectedBulkCount = () => {
    return Object.values(bulkEditState).filter(item => item.selected).length;
  };

  const handleBulkImport = async () => {
    const selectedItems = bulkPreviews.filter(p => bulkEditState[p.googleDriveId]?.selected && !p.alreadyImported);

    if (selectedItems.length === 0) {
      toast({
        title: 'No Items Selected',
        description: 'Please select at least one document to import',
        variant: 'destructive',
      });
      return;
    }

    // Validate all selected items have either employeeId or externalName
    for (const item of selectedItems) {
      const editItem = bulkEditState[item.googleDriveId];
      if (!editItem.employeeId && !editItem.externalName) {
        toast({
          title: 'Missing Assignment',
          description: `Please assign "${item.fileName}" to an employee or enter an external name`,
          variant: 'destructive',
        });
        return;
      }
    }

    setIsBulkImporting(true);

    try {
      const imports = selectedItems.map(item => {
        const editItem = bulkEditState[item.googleDriveId];
        return {
          googleDriveId: item.googleDriveId,
          fileName: item.fileName,
          webViewLink: item.webViewLink,
          employeeId: editItem.useExternalName ? undefined : editItem.employeeId || undefined,
          externalName: editItem.useExternalName ? editItem.externalName : undefined,
          parsedInsuredName: item.parsedData.rawInsuredName || item.parsedData.insuredName || undefined,
          type: editItem.type,
          issueDate: editItem.issueDate,
          expirationDate: editItem.expirationDate,
          policyNumber: editItem.policyNumber || undefined,
          insurerName: editItem.insurerName || undefined,
        };
      });

      const response = await apiRequest('POST', '/api/coi-documents/bulk-import', { imports });
      const data = response as { success: boolean; imported: number; skipped: number; failed: number };

      if (data.success) {
        toast({
          title: 'Import Complete',
          description: `Imported ${data.imported} documents. Skipped: ${data.skipped}, Failed: ${data.failed}`,
        });
        queryClient.invalidateQueries({ queryKey: ['/api/coi-documents'] });
        resetBulkImport();
      } else {
        throw new Error('Import failed');
      }
    } catch (error: any) {
      console.error('Bulk import error:', error);
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import documents',
        variant: 'destructive',
      });
    } finally {
      setIsBulkImporting(false);
    }
  };


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file type
      if (!file.type.includes('pdf') && !file.type.includes('image')) {
        toast({
          title: 'Invalid file type',
          description: 'Please select a PDF or image file',
          variant: 'destructive',
        });
        return;
      }
      
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'File size must be less than 10MB',
          variant: 'destructive',
        });
        return;
      }
      
      setSelectedFile(file);
      form.setValue('documentUrl', 'file-selected'); // Just a placeholder to pass validation
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    form.setValue('documentUrl', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a COI document file to upload',
        variant: 'destructive',
      });
      return;
    }
    
    createMutation.mutate(data);
  };

  const getStatusBadge = (document: CoiDocument) => {
    const daysUntilExpiration = differenceInDays(new Date(document.expirationDate), new Date());
    
    if (daysUntilExpiration < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    } else if (daysUntilExpiration <= 7) {
      return <Badge variant="destructive">Expires in {daysUntilExpiration} days</Badge>;
    } else if (daysUntilExpiration <= 14) {
      return <Badge variant="outline" className="border-orange-500 text-orange-500">
        Expires in {daysUntilExpiration} days
      </Badge>;
    } else if (daysUntilExpiration <= 30) {
      return <Badge variant="outline" className="border-yellow-500 text-yellow-500">
        Expires in {daysUntilExpiration} days
      </Badge>;
    } else {
      return <Badge variant="default">Active</Badge>;
    }
  };

  const getAlertFrequency = (document: CoiDocument) => {
    const daysUntilExpiration = differenceInDays(new Date(document.expirationDate), new Date());
    
    if (daysUntilExpiration < 0) {
      return { text: 'Daily alerts', icon: '🔴' };
    } else if (daysUntilExpiration <= 7) {
      return { text: 'Daily alerts', icon: '🟠' };
    } else if (daysUntilExpiration <= 14) {
      return { text: '1 week alert', icon: '🟡' };
    } else if (daysUntilExpiration <= 30) {
      return { text: '2 week alert', icon: '🟢' };
    } else {
      return { text: '1 month alert', icon: '🔵' };
    }
  };

  // Filter documents
  let filteredDocuments = documents;
  if (filterType !== 'all') {
    filteredDocuments = filteredDocuments.filter((d: CoiDocument) => d.type === filterType);
  }
  if (filterStatus !== 'all') {
    filteredDocuments = filteredDocuments.filter((d: CoiDocument) => d.status === filterStatus);
  }

  // Group documents by status
  const expiredDocs = documents.filter((d: CoiDocument) => {
    const daysUntilExpiration = differenceInDays(new Date(d.expirationDate), new Date());
    return daysUntilExpiration < 0;
  });

  const expiringSoonDocs = documents.filter((d: CoiDocument) => {
    const daysUntilExpiration = differenceInDays(new Date(d.expirationDate), new Date());
    return daysUntilExpiration >= 0 && daysUntilExpiration <= 30;
  });

  const activeDocs = documents.filter((d: CoiDocument) => {
    const daysUntilExpiration = differenceInDays(new Date(d.expirationDate), new Date());
    return daysUntilExpiration > 30;
  });

  // Ahmed always has manager access via email fallback
  const isManager = currentUser?.email === 'ahmed.mahmoud@theroofdocs.com' ||
    (currentUser?.role && ['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'].includes(currentUser.role));

  if (documentsLoading) {
    return <div className="flex items-center justify-center h-64">Loading COI documents...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">COI Document Management</h1>
          <p className="text-muted-foreground mt-2">Track Workers Compensation and General Liability certificates</p>
        </div>
        {currentUser && (
          <div className="flex gap-2">
            {isManager && (
              <>
                <Button
                  variant="outline"
                  onClick={() => syncFromDriveMutation.mutate()}
                  disabled={syncFromDriveMutation.isPending}
                  title="Import COI documents from Google Drive"
                >
                  <CloudDownload className="h-4 w-4 mr-2" />
                  Import COI from Drive
                </Button>
                <Button
                  variant="outline"
                  onClick={() => sendAlertsMutation.mutate()}
                  disabled={sendAlertsMutation.isPending}
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Send Alerts
                </Button>
              </>
            )}
            {/* Smart Upload Button */}
            <Dialog open={isSmartUploadOpen} onOpenChange={(open) => {
              if (!open) resetSmartUpload();
              setIsSmartUploadOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button variant="default" className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Smart Upload
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    Smart COI Upload
                  </DialogTitle>
                  <DialogDescription>
                    Upload a COI document and we'll extract details automatically. Review and edit before saving.
                  </DialogDescription>
                </DialogHeader>

                {/* Step 1: File Upload Area */}
                {!smartUploadFile && !isSmartUploadLoading && (
                  <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
                    <input
                      ref={smartFileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleSmartFileSelect}
                      className="hidden"
                    />
                    <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg font-medium mb-2">Drop your COI document here</p>
                    <p className="text-sm text-gray-500 mb-4">PDF files work best for automatic data extraction</p>
                    <Button onClick={() => smartFileInputRef.current?.click()}>
                      Select File
                    </Button>
                  </div>
                )}

                {/* Step 2: Loading State */}
                {isSmartUploadLoading && (
                  <div className="py-12 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                    <p className="text-lg font-medium">Analyzing document...</p>
                    <p className="text-sm text-gray-500">Extracting dates, policy info, and matching employee</p>
                  </div>
                )}

                {/* Step 3: Pre-filled Form for Review */}
                {smartUploadResult && !isSmartUploadLoading && (
                  <div className="space-y-4">
                    {/* File Info */}
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2">
                        <File className="h-5 w-5 text-purple-500" />
                        <div>
                          <p className="font-medium text-sm">{smartUploadFile?.name}</p>
                          <p className="text-xs text-gray-500">
                            Parse confidence: {smartUploadResult.parsedData.confidence}%
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSmartUploadFile(null);
                          setSmartUploadResult(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Detected Info Summary */}
                    {(smartUploadResult.parsedData.rawInsuredName || smartUploadResult.parsedData.insuredName) && (
                      <Alert className="border-blue-200 bg-blue-50">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        <AlertDescription className="text-blue-700 text-sm">
                          Detected: <strong>{smartUploadResult.parsedData.rawInsuredName || smartUploadResult.parsedData.insuredName}</strong>
                          {smartUploadResult.parsedData.policyNumber && (
                            <> | Policy: <strong>{smartUploadResult.parsedData.policyNumber}</strong></>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Assignment Type Toggle */}
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <Label className="text-sm font-medium">Assign to:</Label>
                      <div className="flex gap-2">
                        <Badge
                          variant={!smartFormData.useExternalName ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setSmartFormData(prev => ({ ...prev, useExternalName: false }))}
                        >
                          <UserIcon className="w-3 h-3 mr-1" />
                          Employee in System
                        </Badge>
                        <Badge
                          variant={smartFormData.useExternalName ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setSmartFormData(prev => ({ ...prev, useExternalName: true }))}
                        >
                          External Contractor
                        </Badge>
                      </div>
                    </div>

                    {/* Employee Selection - Only shown when NOT using external name */}
                    {!smartFormData.useExternalName && (
                      <div className="space-y-2">
                        <Label className={employeeNotFound && !smartFormData.useExternalName ? 'text-red-600 font-semibold' : ''}>
                          Employee *
                        </Label>

                        {/* Suggested matches */}
                        {smartUploadResult.employeeMatch.suggestedEmployees.length > 0 && (
                          <div className="mb-2">
                            <p className="text-xs text-gray-500 mb-1">Suggested matches:</p>
                            <div className="flex flex-wrap gap-1">
                              {smartUploadResult.employeeMatch.suggestedEmployees.slice(0, 5).map((emp) => (
                                <Badge
                                  key={emp.id}
                                  variant={smartFormData.employeeId === emp.id ? "default" : "outline"}
                                  className="cursor-pointer hover:bg-purple-100 text-xs"
                                  onClick={() => {
                                    setSmartFormData(prev => ({ ...prev, employeeId: emp.id, useExternalName: false }));
                                    setEmployeeNotFound(false);
                                  }}
                                >
                                  {emp.firstName} {emp.lastName} ({emp.score}%)
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <Popover open={smartEmployeeOpen} onOpenChange={setSmartEmployeeOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={smartEmployeeOpen}
                              className={cn(
                                "w-full justify-between",
                                employeeNotFound && !smartFormData.useExternalName && "border-red-500 ring-2 ring-red-200"
                              )}
                            >
                              {smartFormData.employeeId
                                ? sortedUsers.find((user) => user.id === smartFormData.employeeId)
                                  ? `${sortedUsers.find((user) => user.id === smartFormData.employeeId)?.firstName} ${sortedUsers.find((user) => user.id === smartFormData.employeeId)?.lastName}`
                                  : "Select employee..."
                                : "Select employee..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command>
                              <CommandInput placeholder="Search employees..." />
                              <CommandList>
                                <CommandEmpty>No employee found.</CommandEmpty>
                                <CommandGroup>
                                  {sortedUsers.map((user) => (
                                    <CommandItem
                                      key={user.id}
                                      value={`${user.firstName} ${user.lastName} ${user.email}`}
                                      onSelect={() => {
                                        setSmartFormData(prev => ({ ...prev, employeeId: user.id }));
                                        setEmployeeNotFound(false);
                                        setSmartEmployeeOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          smartFormData.employeeId === user.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {user.firstName} {user.lastName}
                                      <span className="ml-2 text-xs text-muted-foreground">{user.email}</span>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    )}

                    {/* External Name Input - Only shown when using external name */}
                    {smartFormData.useExternalName && (
                      <div className="space-y-2">
                        <Label className={employeeNotFound && smartFormData.useExternalName && !smartFormData.externalName ? 'text-red-600 font-semibold' : ''}>
                          Contractor/Company Name *
                        </Label>
                        <Input
                          placeholder="Enter name as shown on COI"
                          value={smartFormData.externalName}
                          onChange={(e) => {
                            setSmartFormData(prev => ({ ...prev, externalName: e.target.value }));
                            if (e.target.value) setEmployeeNotFound(false);
                          }}
                          className={cn(
                            employeeNotFound && smartFormData.useExternalName && !smartFormData.externalName && "border-red-500 ring-2 ring-red-200"
                          )}
                        />
                        <p className="text-xs text-gray-500">
                          For subcontractors or companies not in our employee system
                        </p>
                      </div>
                    )}

                    {/* Document Type */}
                    <div className="space-y-2">
                      <Label>Document Type *</Label>
                      <Select
                        value={smartFormData.type}
                        onValueChange={(value: 'WORKERS_COMP' | 'GENERAL_LIABILITY') =>
                          setSmartFormData(prev => ({ ...prev, type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="WORKERS_COMP">Workers Compensation</SelectItem>
                          <SelectItem value="GENERAL_LIABILITY">General Liability</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Issue Date *</Label>
                        <Input
                          type="date"
                          value={smartFormData.issueDate}
                          onChange={(e) => setSmartFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expiration Date *</Label>
                        <Input
                          type="date"
                          value={smartFormData.expirationDate}
                          onChange={(e) => setSmartFormData(prev => ({ ...prev, expirationDate: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Policy & Insurer Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Policy Number</Label>
                        <Input
                          placeholder="Auto-detected or enter manually"
                          value={smartFormData.policyNumber}
                          onChange={(e) => setSmartFormData(prev => ({ ...prev, policyNumber: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Insurer Name</Label>
                        <Input
                          placeholder="Insurance company"
                          value={smartFormData.insurerName}
                          onChange={(e) => setSmartFormData(prev => ({ ...prev, insurerName: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        placeholder="Additional notes..."
                        value={smartFormData.notes}
                        onChange={(e) => setSmartFormData(prev => ({ ...prev, notes: e.target.value }))}
                        rows={2}
                      />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                      <Button variant="outline" onClick={resetSmartUpload}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSmartFormSave}
                        disabled={confirmAssignmentMutation.isPending}
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
                      >
                        {confirmAssignmentMutation.isPending ? 'Saving...' : 'Save Document'}
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Bulk Import Button */}
            <Dialog open={isBulkImportOpen} onOpenChange={(open) => {
              if (!open) resetBulkImport();
              setIsBulkImportOpen(open);
            }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-blue-400 text-blue-600 hover:bg-blue-50">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Bulk Import
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5 text-blue-500" />
                    Bulk COI Import from Google Drive
                  </DialogTitle>
                  <DialogDescription>
                    Import multiple COI documents from your Google Drive folder. Review and assign each document before importing.
                  </DialogDescription>
                </DialogHeader>

                {/* Phase 1: Initial - Scan Button */}
                {bulkPreviews.length === 0 && !isBulkPreviewLoading && (
                  <div className="py-8 text-center">
                    <FolderOpen className="h-16 w-16 mx-auto text-blue-400 mb-4" />
                    <p className="text-lg font-medium mb-2">Scan Google Drive for COI Documents</p>
                    <p className="text-sm text-gray-500 mb-6">
                      This will scan your configured COI folder and parse all PDF documents for review.
                    </p>
                    <Button onClick={handleBulkPreview} className="bg-blue-500 hover:bg-blue-600">
                      <CloudDownload className="h-4 w-4 mr-2" />
                      Scan Drive Folder
                    </Button>
                  </div>
                )}

                {/* Phase 2: Loading */}
                {isBulkPreviewLoading && (
                  <div className="py-12 text-center">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
                    <p className="text-lg font-medium">Scanning and parsing documents...</p>
                    <p className="text-sm text-gray-500">This may take a few moments depending on file count</p>
                  </div>
                )}

                {/* Phase 3: Preview Table */}
                {bulkPreviews.length > 0 && !isBulkPreviewLoading && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <span className="font-medium">{bulkPreviews.length} documents found</span>
                      </div>
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                        {bulkPreviews.filter(p => !p.alreadyImported).length} new
                      </Badge>
                      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-300">
                        {bulkPreviews.filter(p => p.alreadyImported).length} already imported
                      </Badge>
                      {bulkPreviewErrors.length > 0 && (
                        <Badge variant="destructive">
                          {bulkPreviewErrors.length} errors
                        </Badge>
                      )}
                    </div>

                    {/* Errors */}
                    {bulkPreviewErrors.length > 0 && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Parse Errors</AlertTitle>
                        <AlertDescription>
                          <ul className="mt-2 text-sm">
                            {bulkPreviewErrors.slice(0, 3).map((err, i) => (
                              <li key={i}>{err.file}: {err.error}</li>
                            ))}
                            {bulkPreviewErrors.length > 3 && (
                              <li>...and {bulkPreviewErrors.length - 3} more</li>
                            )}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Preview Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead className="w-12">
                              <Checkbox
                                checked={bulkPreviews.filter(p => !p.alreadyImported).every(p => bulkEditState[p.googleDriveId]?.selected)}
                                onCheckedChange={(checked) => {
                                  const newState = { ...bulkEditState };
                                  bulkPreviews.filter(p => !p.alreadyImported).forEach(p => {
                                    newState[p.googleDriveId] = { ...newState[p.googleDriveId], selected: !!checked };
                                  });
                                  setBulkEditState(newState);
                                }}
                              />
                            </TableHead>
                            <TableHead>File</TableHead>
                            <TableHead>Parsed Name</TableHead>
                            <TableHead className="w-32">Match</TableHead>
                            <TableHead className="w-48">Assign To</TableHead>
                            <TableHead className="w-36">Type</TableHead>
                            <TableHead className="w-36">Expiration</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bulkPreviews.map((preview) => {
                            const editItem = bulkEditState[preview.googleDriveId];
                            if (!editItem) return null;

                            return (
                              <TableRow
                                key={preview.googleDriveId}
                                className={cn(
                                  preview.alreadyImported && "bg-gray-50 opacity-60"
                                )}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={editItem.selected}
                                    disabled={preview.alreadyImported}
                                    onCheckedChange={(checked) => handleBulkEditChange(preview.googleDriveId, { selected: !!checked })}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="max-w-[200px]">
                                    <p className="truncate text-sm font-medium" title={preview.fileName}>
                                      {preview.fileName}
                                    </p>
                                    <a
                                      href={preview.webViewLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                                    >
                                      View <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm" title={preview.parsedData.rawInsuredName || ''}>
                                    {preview.parsedData.rawInsuredName || preview.parsedData.insuredName || '-'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {preview.alreadyImported ? (
                                    <Badge variant="outline" className="bg-gray-100">Imported</Badge>
                                  ) : preview.employeeMatch.confidence >= 80 ? (
                                    <Badge className="bg-green-100 text-green-700 border-green-300">
                                      {preview.employeeMatch.confidence}%
                                    </Badge>
                                  ) : preview.employeeMatch.confidence >= 50 ? (
                                    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
                                      {preview.employeeMatch.confidence}%
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-red-100 text-red-700 border-red-300">
                                      {preview.employeeMatch.confidence}%
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {preview.alreadyImported ? (
                                    <span className="text-sm text-gray-500">Already imported</span>
                                  ) : editItem.useExternalName ? (
                                    <div className="space-y-1">
                                      <Input
                                        placeholder="External name"
                                        value={editItem.externalName}
                                        onChange={(e) => handleBulkEditChange(preview.googleDriveId, { externalName: e.target.value })}
                                        className="h-8 text-sm"
                                      />
                                      <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-xs"
                                        onClick={() => handleBulkEditChange(preview.googleDriveId, { useExternalName: false })}
                                      >
                                        Select employee instead
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <Select
                                        value={editItem.employeeId}
                                        onValueChange={(value) => handleBulkEditChange(preview.googleDriveId, { employeeId: value })}
                                      >
                                        <SelectTrigger className="h-8 text-sm">
                                          <SelectValue placeholder="Select employee" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {sortedUsers.map((user) => (
                                            <SelectItem key={user.id} value={user.id}>
                                              {user.firstName} {user.lastName}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto p-0 text-xs"
                                        onClick={() => handleBulkEditChange(preview.googleDriveId, { useExternalName: true })}
                                      >
                                        Use external name
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {preview.alreadyImported ? (
                                    <span className="text-sm text-gray-500">-</span>
                                  ) : (
                                    <Select
                                      value={editItem.type}
                                      onValueChange={(value: 'WORKERS_COMP' | 'GENERAL_LIABILITY') => handleBulkEditChange(preview.googleDriveId, { type: value })}
                                    >
                                      <SelectTrigger className="h-8 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="WORKERS_COMP">Workers Comp</SelectItem>
                                        <SelectItem value="GENERAL_LIABILITY">General Liability</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {preview.alreadyImported ? (
                                    <span className="text-sm text-gray-500">-</span>
                                  ) : (
                                    <Input
                                      type="date"
                                      value={editItem.expirationDate}
                                      onChange={(e) => handleBulkEditChange(preview.googleDriveId, { expirationDate: e.target.value })}
                                      className="h-8 text-sm"
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <DialogFooter className="flex justify-between items-center">
                      <div className="text-sm text-gray-500">
                        {getSelectedBulkCount()} documents selected for import
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={resetBulkImport}>
                          Cancel
                        </Button>
                        <Button
                          onClick={handleBulkImport}
                          disabled={isBulkImporting || getSelectedBulkCount() === 0}
                          className="bg-blue-500 hover:bg-blue-600"
                        >
                          {isBulkImporting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Import {getSelectedBulkCount()} Documents
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogFooter>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Alert className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>COI Alert Schedule</AlertTitle>
        <AlertDescription>
          Documents are monitored with increasing frequency as they approach expiration:
          <ul className="mt-2 ml-4 list-disc">
            <li>30 days before: Initial alert</li>
            <li>14 days before: Second alert</li>
            <li>7 days before: Third alert</li>
            <li>6 days before expiration: Daily alerts begin (6 alerts total)</li>
            <li>After expiration: Daily alerts continue until renewed</li>
          </ul>
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Documents</CardTitle>
            <FileText className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDocs.length}</div>
            <p className="text-xs text-muted-foreground">Valid for 30+ days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiringSoonDocs.length}</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredDocs.length}</div>
            <p className="text-xs text-muted-foreground">Requires immediate action</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 flex gap-2">
        <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="WORKERS_COMP">Workers Comp</SelectItem>
            <SelectItem value="GENERAL_LIABILITY">General Liability</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="EXPIRING_SOON">Expiring Soon</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>COI Documents</CardTitle>
          <CardDescription>All certificates of insurance</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiration Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Alert Frequency</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((document) => {
                const employee = users.find((u: User) => u.id === document.employeeId);
                const alertInfo = getAlertFrequency(document);
                // Display name: employee name > external name > parsed name > Unknown
                const displayName = employee
                  ? `${employee.firstName} ${employee.lastName}`
                  : document.externalName || document.parsedInsuredName || 'Unknown';
                const isExternal = !employee && (document.externalName || document.parsedInsuredName);

                return (
                  <TableRow key={document.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {displayName}
                        {isExternal && (
                          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                            External
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {document.type === 'WORKERS_COMP' ? 'Workers Comp' : 'General Liability'}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(document.issueDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{format(new Date(document.expirationDate), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{getStatusBadge(document)}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        <span>{alertInfo.icon}</span>
                        <span className="text-sm">{alertInfo.text}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewDocId(document.id)}
                          title="Preview document"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(document.documentUrl, '_blank')}
                          title="View in Google Drive"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/api/coi-documents/${document.id}/download`, '_blank')}
                          title="Download document"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {isManager && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(document.id)}
                            title="Delete document"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewDocId} onOpenChange={(open) => !open && setPreviewDocId(null)}>
        <DialogContent className="sm:max-w-[900px] h-[80vh]">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
            <DialogDescription>
              Viewing COI document
            </DialogDescription>
          </DialogHeader>
          {previewDocId && (
            <div className="flex-1 h-full min-h-[500px]">
              <iframe
                src={documents.find((d: CoiDocument) => d.id === previewDocId)?.documentUrl?.replace('/view', '/preview') || ''}
                className="w-full h-full rounded-lg border"
                title="Document Preview"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDocId(null)}>
              Close
            </Button>
            {previewDocId && (
              <>
                <Button
                  variant="outline"
                  onClick={() => window.open(documents.find((d: CoiDocument) => d.id === previewDocId)?.documentUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Drive
                </Button>
                <Button
                  onClick={() => window.open(`/api/coi-documents/${previewDocId}/download`, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}