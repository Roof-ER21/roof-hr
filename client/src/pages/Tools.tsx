import { useState, useMemo, Fragment, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import {
  Laptop, Package, Car, HardHat, Shirt, Wrench, Plus,
  Send, Edit, Trash2, CheckCircle, XCircle, Clock,
  AlertCircle, AlertTriangle, Mail, FileSignature, ArrowLeft, Search,
  Upload, Download, RefreshCw, ChevronDown, ChevronRight, User, PenTool, Bell,
  ClipboardList, Copy, ExternalLink, History
} from 'lucide-react';
import { format } from 'date-fns';

interface Tool {
  id: string;
  name: string;
  category: string;
  description: string;
  serialNumber: string;
  model: string;
  quantity: number;
  availableQuantity: number;
  condition: string;
  purchaseDate: string;
  purchasePrice: number;
  location: string;
  notes: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  creatorName: string;
}

interface Assignment {
  id: string;
  toolId: string;
  employeeId: string;
  assignedBy: string;
  assignedDate: string;
  returnDate: string | null;
  status: string;
  condition: string;
  notes: string;
  signatureRequired: boolean;
  signatureReceived: boolean;
  signatureDate: string | null;
  emailSent: boolean;
  toolName: string;
  toolCategory: string;
  toolSerialNumber: string;
  employeeName: string;
  employeeEmail: string;
  assignerName: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  position: string;
}

const categoryIcons = {
  LAPTOP: <Laptop className="h-4 w-4" />,
  CAR: <Car className="h-4 w-4" />,
  BOOTS: <HardHat className="h-4 w-4" />,
  POLO: <Shirt className="h-4 w-4" />,
  LADDER: <Wrench className="h-4 w-4" />,
  IPAD: <Laptop className="h-4 w-4" />,
  OFFICE: <PenTool className="h-4 w-4" />,
  OTHER: <Shirt className="h-4 w-4" />
};

// Friendly display names for categories
const categoryDisplayNames: Record<string, string> = {
  LAPTOP: 'Tech',
  IPAD: 'Tech',
  CAR: 'Equipment',
  BOOTS: 'Equipment',
  LADDER: 'Equipment',
  POLO: 'Clothing',
  OTHER: 'Clothing',
  OFFICE: 'Office'
};

const conditionColors = {
  NEW: 'bg-green-100 text-green-800',
  GOOD: 'bg-blue-100 text-blue-800',
  FAIR: 'bg-yellow-100 text-yellow-800',
  POOR: 'bg-red-100 text-red-800'
};

const statusColors = {
  ASSIGNED: 'bg-blue-100 text-blue-800',
  RETURNED: 'bg-green-100 text-green-800',
  LOST: 'bg-red-100 text-red-800',
  DAMAGED: 'bg-orange-100 text-orange-800'
};

const SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'XXL', '3X', '4X'] as const;
const CLOTHING_CATEGORIES = ['POLO', 'OTHER', 'BOOTS'];

export function Tools() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState('assignments');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showAddToolDialog, setShowAddToolDialog] = useState(false);
  const [showEditToolDialog, setShowEditToolDialog] = useState(false);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  // Debounce search to prevent excessive API calls/re-renders
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 200; // Items per page
  const [showAdjustQuantityDialog, setShowAdjustQuantityDialog] = useState(false);
  const [quantityAdjustment, setQuantityAdjustment] = useState<{
    toolId: string;
    toolName: string;
    currentQuantity: number;
    currentAvailable: number;
    adjustment: number;
    notes: string;
  } | null>(null);

  // State for expanded clothing groups in inventory
  const [expandedClothingGroups, setExpandedClothingGroups] = useState<Set<string>>(new Set());

  // State for clothing filter selections (style, size, color)
  const [clothingFilters, setClothingFilters] = useState<{
    style: string;
    size: string;
    color: string;
  }>({ style: '', size: '', color: '' });

  // New tool form state
  const [newTool, setNewTool] = useState({
    name: '',
    category: 'LAPTOP',
    description: '',
    serialNumber: '',
    model: '',
    quantity: 1,
    condition: 'GOOD',
    purchasePrice: '',
    location: '',
    notes: '',
    size: ''
  });

  // Deduplication dialog state
  const [showDeduplicateDialog, setShowDeduplicateDialog] = useState(false);
  const [deduplicateResult, setDeduplicateResult] = useState<{
    success: boolean;
    message: string;
    stats: {
      totalTools: number;
      uniqueNames: number;
      duplicatesToDelete: number;
      willKeep: number;
      dryRun: boolean;
    };
    kept: Array<{ name: string; id: string; count: number }>;
  } | null>(null);

  // Inventory Alerts dialog state
  const [showAlertsDialog, setShowAlertsDialog] = useState(false);
  const [newAlert, setNewAlert] = useState<{
    toolId: string;
    thresholdQuantity: number;
  } | null>(null);

  // Equipment Checklist dialog state
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  const [checklistForm, setChecklistForm] = useState<{
    employeeId: string;
    type: 'ISSUED' | 'RETURNED';
  }>({ employeeId: '', type: 'ISSUED' });
  const [checklistResult, setChecklistResult] = useState<{
    formUrl: string;
    employeeName: string;
  } | null>(null);

  // Enhanced Return dialog state
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnAssignment, setReturnAssignment] = useState<{
    id: string;
    toolName: string;
    employeeName: string;
  } | null>(null);
  const [returnCondition, setReturnCondition] = useState<string>('GOOD');
  const [returnNotes, setReturnNotes] = useState<string>('');

  // Report Issue dialog state (Damaged/Lost)
  const [showReportIssueDialog, setShowReportIssueDialog] = useState(false);
  const [reportIssueAssignment, setReportIssueAssignment] = useState<{
    id: string;
    toolName: string;
    employeeName: string;
  } | null>(null);
  const [issueType, setIssueType] = useState<'DAMAGED' | 'LOST'>('DAMAGED');
  const [issueDescription, setIssueDescription] = useState<string>('');

  // Bulk selection state for inventory
  const [selectedInventoryItems, setSelectedInventoryItems] = useState<Set<string>>(new Set());
  const [showBulkAssignDialog, setShowBulkAssignDialog] = useState(false);
  const [bulkAssignEmployee, setBulkAssignEmployee] = useState<string>('');
  const [bulkAssignNotes, setBulkAssignNotes] = useState<string>('');

  // Bulk selection state for assignments (returns)
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [showBulkReturnDialog, setShowBulkReturnDialog] = useState(false);
  const [bulkReturnCondition, setBulkReturnCondition] = useState<string>('GOOD');
  const [bulkReturnNotes, setBulkReturnNotes] = useState<string>('');

  // Bulk edit state for inventory
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditCondition, setBulkEditCondition] = useState<string>('');
  const [bulkEditLocation, setBulkEditLocation] = useState<string>('');
  const [bulkEditNotes, setBulkEditNotes] = useState<string>('');

  // History dialog state
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [historyToolId, setHistoryToolId] = useState<string | null>(null);
  const [historyToolName, setHistoryToolName] = useState('');

  // Ahmed always has manager access via email fallback
  const isManager = user?.email === 'ahmed.mahmoud@theroofdocs.com' ||
    (user?.role && ['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'].includes(user.role));

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // Fetch tools inventory with pagination and search
  const { data: tools = [], isLoading: toolsLoading, error: toolsError } = useQuery<Tool[]>({
    queryKey: ['/api/tools/inventory', currentPage, debouncedSearchTerm],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Use server-side pagination and search
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: ((currentPage - 1) * pageSize).toString(),
      });
      if (debouncedSearchTerm) {
        params.set('search', debouncedSearchTerm);
      }

      const res = await fetch(`/api/tools/inventory?${params}`, {
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text() || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }

      return await res.json();
    },
    enabled: true,
    staleTime: 30000, // Cache for 30 seconds
  });
  
  // Debug logging
  console.log('Tools data:', tools);
  console.log('Tools loading:', toolsLoading);
  console.log('Tools error:', toolsError);

  // Fetch assignments
  const { data: assignments = [], isLoading: assignmentsLoading, error: assignmentsError } = useQuery<Assignment[]>({
    queryKey: ['/api/tools/assignments'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch('/api/tools/assignments', {
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text() || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }

      return await res.json();
    },
    enabled: true
  });

  // Fetch employees for assignment
  const { data: employees = [], error: employeesError } = useQuery<Employee[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch('/api/users', {
        headers,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text() || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }

      return await res.json();
    },
    enabled: true
  });

  // Fetch inventory alerts
  const { data: alerts = [], isLoading: alertsLoading } = useQuery<any[]>({
    queryKey: ['/api/tools/alerts'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch('/api/tools/alerts', {
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to fetch alerts');
      return res.json();
    },
    enabled: isManager
  });

  // Fetch audit log for selected tool
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['/api/tools/inventory', historyToolId, 'audit-log'],
    queryFn: async () => {
      if (!historyToolId) return [];
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`/api/tools/inventory/${historyToolId}/audit-log`, {
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error('Failed to fetch audit logs');
      return res.json();
    },
    enabled: !!historyToolId
  });

  // Create tool mutation
  const createToolMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/tools/inventory', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      setShowAddToolDialog(false);
      setNewTool({
        name: '',
        category: 'LAPTOP',
        description: '',
        serialNumber: '',
        model: '',
        quantity: 1,
        condition: 'GOOD',
        purchasePrice: '',
        location: '',
        notes: ''
      });
      toast({
        title: 'Success',
        description: 'Tool added successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add tool',
        variant: 'destructive'
      });
    }
  });

  // Update tool mutation
  const updateToolMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/tools/inventory/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      setShowEditToolDialog(false);
      setSelectedTool(null);
      toast({
        title: 'Success',
        description: 'Tool updated successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update tool',
        variant: 'destructive'
      });
    }
  });

  // Delete tool mutation
  const deleteToolMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/tools/inventory/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      toast({
        title: 'Success',
        description: 'Tool deleted successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete tool',
        variant: 'destructive'
      });
    }
  });

  // Create assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/tools/assignments', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tools/assignments'] });
      setShowAssignDialog(false);
      setSelectedEmployee('');
      setSelectedTools([]);
      setAssignmentNotes('');
      toast({
        title: 'Success',
        description: 'Tools assigned successfully. Email notification sent to employee.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign tools',
        variant: 'destructive'
      });
    }
  });

  // Return tool mutation
  const returnToolMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/tools/assignments/${id}/return`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tools/assignments'] });
      toast({
        title: 'Success',
        description: 'Tool returned successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to return tool',
        variant: 'destructive'
      });
    }
  });

  // Adjust quantity mutation
  const adjustQuantityMutation = useMutation({
    mutationFn: async ({ id, adjustment, notes }: { id: string; adjustment: number; notes: string }) => {
      return await apiRequest(`/api/tools/inventory/${id}/adjust-quantity`, 'PATCH', { adjustment, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      setShowAdjustQuantityDialog(false);
      setQuantityAdjustment(null);
      toast({
        title: 'Success',
        description: 'Inventory quantity adjusted successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to adjust quantity',
        variant: 'destructive'
      });
    }
  });

  // Sync with Google Sheets mutation
  const syncSheetsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/tools/sync-sheets', 'POST');
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Tools inventory synced with Google Sheets successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync with Google Sheets',
        variant: 'destructive'
      });
    }
  });

  // Import from Google Sheets mutation
  const importSheetsMutation = useMutation<{ total: number; created: number; updated: number }, Error, string>({
    mutationFn: async (spreadsheetId: string) => {
      return await apiRequest<{ total: number; created: number; updated: number }>('/api/tools/import-sheets', 'POST', { spreadsheetId });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      toast({
        title: 'Success',
        description: `Imported ${data.total} tools from Google Sheets (${data.created} new, ${data.updated} updated)`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import from Google Sheets',
        variant: 'destructive'
      });
    }
  });

  // Deduplicate tools mutation
  const deduplicateMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      return await apiRequest('/api/tools/admin/deduplicate', 'POST', { dryRun });
    },
    onSuccess: (data: any) => {
      setDeduplicateResult(data);
      if (!data.stats.dryRun) {
        queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      }
      toast({
        title: data.stats.dryRun ? 'Dry Run Complete' : 'Deduplication Complete',
        description: data.message
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to deduplicate tools',
        variant: 'destructive'
      });
    }
  });

  // Save inventory alert mutation
  const saveAlertMutation = useMutation({
    mutationFn: async (data: { toolId: string; thresholdQuantity: number }) => {
      return await apiRequest('/api/tools/alerts', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/alerts'] });
      setNewAlert(null);
      toast({
        title: 'Success',
        description: 'Inventory alert saved successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save alert',
        variant: 'destructive'
      });
    }
  });

  // Check alerts mutation
  const checkAlertsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/tools/alerts/check', 'POST');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/alerts'] });
      toast({
        title: 'Alerts Checked',
        description: data.message || 'Alert check complete'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to check alerts',
        variant: 'destructive'
      });
    }
  });

  // Create equipment checklist mutation
  const createChecklistMutation = useMutation({
    mutationFn: async (data: { employeeId: string; employeeName: string; employeeEmail: string; type: 'ISSUED' | 'RETURNED' }) => {
      return await apiRequest('/api/equipment-checklists', 'POST', data);
    },
    onSuccess: (data: any) => {
      const employee = (employees as Employee[]).find(e => e.id === checklistForm.employeeId);
      setChecklistResult({
        formUrl: data.formUrl || `/equipment-checklist/${data.accessToken}`,
        employeeName: employee ? `${employee.firstName} ${employee.lastName}` : 'Employee'
      });
      toast({
        title: 'Checklist Created',
        description: 'Equipment checklist form has been generated'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create equipment checklist',
        variant: 'destructive'
      });
    }
  });

  // Report issue (damaged/lost) mutation
  const reportIssueMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { status: 'DAMAGED' | 'LOST'; notes: string } }) => {
      return await apiRequest(`/api/tools/assignments/${id}/report-issue`, 'POST', data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      setShowReportIssueDialog(false);
      setReportIssueAssignment(null);
      setIssueType('DAMAGED');
      setIssueDescription('');
      toast({
        title: 'Issue Reported',
        description: data.message || 'Equipment issue has been recorded'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to report issue',
        variant: 'destructive'
      });
    }
  });

  // Bulk return mutation
  const bulkReturnMutation = useMutation({
    mutationFn: async (data: { assignmentIds: string[]; condition: string; notes: string }) => {
      return await apiRequest('/api/tools/assignments/bulk-return', 'POST', data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/assignments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      setShowBulkReturnDialog(false);
      setSelectedAssignments(new Set());
      setBulkReturnCondition('GOOD');
      setBulkReturnNotes('');
      toast({
        title: 'Bulk Return Complete',
        description: data.message || 'All selected items have been returned'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process bulk return',
        variant: 'destructive'
      });
    }
  });

  // Bulk edit mutation
  const bulkEditMutation = useMutation({
    mutationFn: async (data: { toolIds: string[]; updates: { condition?: string; location?: string; notesToAppend?: string } }) => {
      return await apiRequest('/api/tools/inventory/bulk-edit', 'PATCH', data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tools/inventory'] });
      setShowBulkEditDialog(false);
      setSelectedInventoryItems(new Set());
      setBulkEditCondition('');
      setBulkEditLocation('');
      setBulkEditNotes('');
      toast({
        title: 'Bulk Edit Complete',
        description: data.message || 'All selected items have been updated'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process bulk edit',
        variant: 'destructive'
      });
    }
  });

  const handleCreateChecklist = () => {
    if (!checklistForm.employeeId) return;

    const employee = (employees as Employee[]).find(e => e.id === checklistForm.employeeId);
    if (!employee) return;

    createChecklistMutation.mutate({
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeEmail: employee.email,
      type: checklistForm.type
    });
  };

  const handleCreateTool = () => {
    createToolMutation.mutate({
      ...newTool,
      purchasePrice: newTool.purchasePrice ? parseInt(newTool.purchasePrice) : null,
      purchaseDate: new Date().toISOString(),
      availableQuantity: newTool.quantity // Set available quantity to match initial quantity
    });
  };

  const handleUpdateTool = () => {
    if (!selectedTool) return;
    
    updateToolMutation.mutate({
      id: selectedTool.id,
      data: selectedTool
    });
  };

  const handleDeleteTool = (id: string) => {
    if (confirm('Are you sure you want to delete this tool?')) {
      deleteToolMutation.mutate(id);
    }
  };

  const handleAssignTools = () => {
    if (!selectedEmployee || selectedTools.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select an employee and at least one tool',
        variant: 'destructive'
      });
      return;
    }

    createAssignmentMutation.mutate({
      employeeId: selectedEmployee,
      toolIds: selectedTools,
      notes: assignmentNotes
    });
  };

  // Open enhanced return dialog
  const handleReturnTool = (assignmentId: string, toolName: string, employeeName: string) => {
    setReturnAssignment({ id: assignmentId, toolName, employeeName });
    setReturnCondition('GOOD');
    setReturnNotes('');
    setShowReturnDialog(true);
  };

  // Process the actual return with condition and notes
  const processReturn = () => {
    if (!returnAssignment) return;

    returnToolMutation.mutate({
      id: returnAssignment.id,
      data: {
        condition: returnCondition,
        notes: returnNotes
      }
    });

    setShowReturnDialog(false);
    setReturnAssignment(null);
    setReturnCondition('GOOD');
    setReturnNotes('');
  };

  // Open report issue dialog (damaged/lost)
  const handleReportIssue = (assignmentId: string, toolName: string, employeeName: string) => {
    setReportIssueAssignment({ id: assignmentId, toolName, employeeName });
    setIssueType('DAMAGED');
    setIssueDescription('');
    setShowReportIssueDialog(true);
  };

  // Process the issue report
  const processIssueReport = () => {
    if (!reportIssueAssignment || !issueDescription.trim()) {
      toast({
        title: 'Required Field',
        description: 'Please provide a description of the issue',
        variant: 'destructive'
      });
      return;
    }

    reportIssueMutation.mutate({
      id: reportIssueAssignment.id,
      data: {
        status: issueType,
        notes: issueDescription.trim()
      }
    });
  };

  // Bulk selection helpers
  const toggleInventorySelection = (toolId: string) => {
    const newSelection = new Set(selectedInventoryItems);
    if (newSelection.has(toolId)) {
      newSelection.delete(toolId);
    } else {
      newSelection.add(toolId);
    }
    setSelectedInventoryItems(newSelection);
  };

  const selectAllInventory = () => {
    const availableTools = tools.filter(t => t.availableQuantity > 0);
    if (selectedInventoryItems.size === availableTools.length) {
      setSelectedInventoryItems(new Set());
    } else {
      setSelectedInventoryItems(new Set(availableTools.map(t => t.id)));
    }
  };

  const clearSelection = () => {
    setSelectedInventoryItems(new Set());
  };

  // Assignment selection helpers
  const toggleAssignmentSelection = (assignmentId: string) => {
    const newSelection = new Set(selectedAssignments);
    if (newSelection.has(assignmentId)) {
      newSelection.delete(assignmentId);
    } else {
      newSelection.add(assignmentId);
    }
    setSelectedAssignments(newSelection);
  };

  const clearAssignmentSelection = () => {
    setSelectedAssignments(new Set());
  };

  // Handle bulk return
  const handleBulkReturn = () => {
    if (selectedAssignments.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one assignment to return',
        variant: 'destructive'
      });
      return;
    }

    bulkReturnMutation.mutate({
      assignmentIds: Array.from(selectedAssignments),
      condition: bulkReturnCondition,
      notes: bulkReturnNotes
    });
  };

  // Handle bulk edit
  const handleBulkEdit = () => {
    if (selectedInventoryItems.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one inventory item to edit',
        variant: 'destructive'
      });
      return;
    }

    if (!bulkEditCondition && !bulkEditLocation && !bulkEditNotes) {
      toast({
        title: 'Error',
        description: 'Please provide at least one field to update',
        variant: 'destructive'
      });
      return;
    }

    bulkEditMutation.mutate({
      toolIds: Array.from(selectedInventoryItems),
      updates: {
        ...(bulkEditCondition && { condition: bulkEditCondition }),
        ...(bulkEditLocation && { location: bulkEditLocation }),
        ...(bulkEditNotes && { notesToAppend: bulkEditNotes })
      }
    });
  };

  // Handle bulk assignment
  const handleBulkAssign = () => {
    if (!bulkAssignEmployee || selectedInventoryItems.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select an employee and at least one tool',
        variant: 'destructive'
      });
      return;
    }

    createAssignmentMutation.mutate({
      employeeId: bulkAssignEmployee,
      toolIds: Array.from(selectedInventoryItems),
      notes: bulkAssignNotes
    }, {
      onSuccess: () => {
        setShowBulkAssignDialog(false);
        setBulkAssignEmployee('');
        setBulkAssignNotes('');
        clearSelection();
      }
    });
  };

  // Define the proper size order
  const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL', '3X', '4X'];
  
  // Helper function to extract size from tool name
  // Handles multiple formats:
  // - "Black Polo (Size 3X)" -> "3X"
  // - "Grey Polo - Size M" -> "M"
  // - "Black Light Quarter Zip (Used Size XXL)" -> "XXL"
  const extractSize = (toolName: string): string | null => {
    // Try (Used Size X) format first
    const usedSizeMatch = toolName.match(/\(Used\s*Size\s*([A-Z0-9]+)\)/i);
    if (usedSizeMatch) return usedSizeMatch[1];

    // Try (Size X) format
    const parenSizeMatch = toolName.match(/\(Size\s*([A-Z0-9]+)\)/i);
    if (parenSizeMatch) return parenSizeMatch[1];

    // Try " - Size X" format
    const dashSizeMatch = toolName.match(/-\s*Size\s*([A-Z0-9]+)\s*$/i);
    if (dashSizeMatch) return dashSizeMatch[1];

    return null;
  };
  
  // Helper function to get size order index
  const getSizeIndex = (size: string | null): number => {
    if (!size) return 999; // Items without sizes go to the end
    const index = sizeOrder.indexOf(size);
    return index === -1 ? 999 : index;
  };
  
  // Sort tools (server already handles search filtering with debouncedSearchTerm)
  const filteredTools = (tools as Tool[])
    .sort((a: Tool, b: Tool) => {
      // First sort by category
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      
      // For clothing items (POLO and OTHER categories), check if they have sizes
      if (a.category === 'POLO' || a.category === 'OTHER') {
        // Extract base names (without size)
        const aBaseName = a.name.replace(/ - Size [A-Z0-9]+$/, '');
        const bBaseName = b.name.replace(/ - Size [A-Z0-9]+$/, '');
        
        // If same base item, sort by size
        if (aBaseName === bBaseName) {
          const aSize = extractSize(a.name);
          const bSize = extractSize(b.name);
          return getSizeIndex(aSize) - getSizeIndex(bSize);
        }
        
        // Different base items, sort alphabetically by base name
        return aBaseName.localeCompare(bBaseName);
      }
      
      // For non-clothing items, sort alphabetically
      return a.name.localeCompare(b.name);
    });

  // Category type definitions for grouping
  const categoryTypes: Record<string, { label: string; icon: keyof typeof categoryIcons; categories: string[] }> = {
    tech: {
      label: 'Tech',
      icon: 'LAPTOP',
      categories: ['LAPTOP', 'IPAD']
    },
    clothing: {
      label: 'Clothing',
      icon: 'POLO',
      categories: ['POLO', 'OTHER']
    },
    equipment: {
      label: 'Equipment & Tools',
      icon: 'LADDER',
      categories: ['LADDER', 'CAR', 'BOOTS']
    },
    office: {
      label: 'Office Supplies',
      icon: 'OFFICE',
      categories: ['OFFICE']
    }
  };

  // Get category type for a tool
  const getCategoryType = (category: string): string => {
    for (const [type, config] of Object.entries(categoryTypes)) {
      if (config.categories.includes(category)) {
        return type;
      }
    }
    return 'other';
  };

  // Helper function to extract base name from clothing item
  // Handles multiple formats:
  // - "Black Polo (Size 3X)" -> "Black Polo"
  // - "Grey Polo - Size M" -> "Grey Polo"
  // - "Black Light Quarter Zip (Used Size XXL)" -> "Black Light Quarter Zip"
  // - "Black Under Armor Zip Up - Shell & Lining (Size L)" -> "Black Under Armor Zip Up - Shell & Lining"
  const extractBaseName = (toolName: string): string => {
    return toolName
      .replace(/\s*\(Used\s*Size\s*[A-Z0-9]+\)\s*$/i, '')  // (Used Size XXL)
      .replace(/\s*\(Size\s*[A-Z0-9]+\)\s*$/i, '')         // (Size 3X)
      .replace(/\s*-\s*Size\s*[A-Z0-9]+\s*$/i, '')         // - Size M
      .trim();
  };

  // Helper function to extract color from clothing item name (e.g., "Grey Polo - Size M" -> "Grey")
  const extractColor = (toolName: string): string => {
    const baseName = extractBaseName(toolName);
    // Common color words to look for
    const colorPatterns = ['Grey', 'Gray', 'Black', 'White', 'Navy', 'Blue', 'Red', 'Green'];
    for (const color of colorPatterns) {
      if (baseName.toLowerCase().includes(color.toLowerCase())) {
        return color;
      }
    }
    return '';
  };

  // Helper function to extract style type from clothing item (e.g., "Grey Polo - Size M" -> "Polo")
  const extractStyleType = (toolName: string): string => {
    const baseName = extractBaseName(toolName);
    // Remove color words to get the style type
    const stylePatterns = ['Polo', 'Quarter Zip', 'T-Shirt', 'Jacket', 'Hoodie', 'Vest'];
    for (const style of stylePatterns) {
      if (baseName.toLowerCase().includes(style.toLowerCase())) {
        return style;
      }
    }
    // Fallback to category or full name
    return baseName;
  };

  // Group items by category type (Tech, Clothing, Equipment, Office)
  const groupedInventory = useMemo(() => {
    const typeGroups: Record<string, Tool[]> = {
      tech: [],
      clothing: [],
      equipment: [],
      office: [],
      other: []
    };

    filteredTools.forEach(tool => {
      const type = getCategoryType(tool.category);
      typeGroups[type].push(tool);
    });

    // Sort items within each group
    Object.values(typeGroups).forEach(group => {
      group.sort((a, b) => {
        // Sort by category first, then by name
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        // For clothing with sizes, sort by base name then size
        const aBase = extractBaseName(a.name);
        const bBase = extractBaseName(b.name);
        if (aBase !== bBase) {
          return aBase.localeCompare(bBase);
        }
        return getSizeIndex(extractSize(a.name)) - getSizeIndex(extractSize(b.name));
      });
    });

    // Build category groups array with totals
    const groups = Object.entries(typeGroups)
      .filter(([_, items]) => items.length > 0)
      .map(([type, items]) => {
        const config = categoryTypes[type] || { label: 'Other', icon: 'OTHER' as keyof typeof categoryIcons };
        const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
        const availableQty = items.reduce((sum, item) => sum + item.availableQuantity, 0);
        return {
          key: type,
          label: config.label,
          icon: config.icon,
          items,
          totalQty,
          availableQty,
          assignedQty: totalQty - availableQty,
          itemCount: items.length
        };
      });

    return groups;
  }, [filteredTools]);

  // Compute unique styles, sizes, and colors for clothing items
  const clothingOptions = useMemo(() => {
    const clothingGroup = groupedInventory.find(g => g.key === 'clothing');
    if (!clothingGroup) {
      return { styles: [], sizes: [], colors: [], items: [] };
    }

    const items = clothingGroup.items;
    const stylesSet = new Set<string>();
    const sizesSet = new Set<string>();
    const colorsSet = new Set<string>();

    items.forEach(item => {
      const baseName = extractBaseName(item.name);
      stylesSet.add(baseName);

      const size = extractSize(item.name);
      if (size) sizesSet.add(size);

      const color = extractColor(item.name);
      if (color) colorsSet.add(color);
    });

    // Sort sizes by size order
    const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL', '2XL', '3X', '3XL', '4X', '4XL'];
    const sortedSizes = Array.from(sizesSet).sort((a, b) => {
      const aIdx = sizeOrder.indexOf(a);
      const bIdx = sizeOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

    return {
      styles: Array.from(stylesSet).sort(),
      sizes: sortedSizes,
      colors: Array.from(colorsSet).sort(),
      items
    };
  }, [groupedInventory]);

  // Filter clothing items based on selected filters
  const filteredClothingItems = useMemo(() => {
    let items = clothingOptions.items;

    if (clothingFilters.style) {
      items = items.filter(item => extractBaseName(item.name) === clothingFilters.style);
    }
    if (clothingFilters.size) {
      items = items.filter(item => extractSize(item.name) === clothingFilters.size);
    }
    if (clothingFilters.color) {
      items = items.filter(item => {
        const color = extractColor(item.name);
        return color.toLowerCase() === clothingFilters.color.toLowerCase();
      });
    }

    return items;
  }, [clothingOptions.items, clothingFilters]);

  // Compute available sizes based on selected style
  const availableSizes = useMemo(() => {
    if (!clothingFilters.style) {
      return clothingOptions.sizes; // Show all sizes if no style selected
    }
    // Get sizes only for the selected style
    const sizes = clothingOptions.items
      .filter(item => extractBaseName(item.name) === clothingFilters.style)
      .map(item => extractSize(item.name))
      .filter((size): size is string => size !== null);

    // Deduplicate and sort by size order
    const sizeOrder = ['S', 'M', 'L', 'XL', 'XXL', '2XL', '3X', '3XL', '4X', '4XL'];
    const uniqueSizes = [...new Set(sizes)];
    return uniqueSizes.sort((a, b) => {
      const aIdx = sizeOrder.indexOf(a);
      const bIdx = sizeOrder.indexOf(b);
      if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });
  }, [clothingFilters.style, clothingOptions.items, clothingOptions.sizes]);

  // Toggle expand/collapse for category groups
  const toggleClothingGroup = (key: string) => {
    setExpandedClothingGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Filter active assignments based on role
  const activeAssignments = (assignments as Assignment[]).filter((a: Assignment) => {
    if (isManager) {
      // Managers see all active assignments
      return a.status === 'ASSIGNED';
    } else {
      // Employees only see their own assignments
      return a.status === 'ASSIGNED' && a.employeeId === user?.id;
    }
  });

  // Group assignments by employee for grouped view
  const groupedAssignments = activeAssignments.reduce((groups, assignment) => {
    const key = assignment.employeeId;
    if (!groups[key]) {
      groups[key] = {
        employeeId: assignment.employeeId,
        employeeName: assignment.employeeName,
        employeeEmail: assignment.employeeEmail,
        assignments: []
      };
    }
    groups[key].assignments.push(assignment);
    return groups;
  }, {} as Record<string, { employeeId: string; employeeName: string; employeeEmail: string; assignments: Assignment[] }>);

  // State for expanded employees in grouped view
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());

  const toggleEmployeeExpand = (employeeId: string) => {
    setExpandedEmployees(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tools & Equipment {isManager ? 'Management' : ''}</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {isManager ? 'Manage company tools and equipment assignments' : 'View your assigned tools and equipment'}
          </p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => importSheetsMutation.mutate('')}
              disabled={importSheetsMutation.isPending}
              title="Import tools inventory from Google Sheets"
            >
              {importSheetsMutation.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Import from Sheets
            </Button>
            <Button
              variant="outline"
              onClick={() => syncSheetsMutation.mutate()}
              disabled={syncSheetsMutation.isPending}
              title="Export tools inventory to Google Sheets"
            >
              {syncSheetsMutation.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Export to Sheets
            </Button>
            {user?.role === 'ADMIN' || user?.role === 'TRUE_ADMIN' || user?.role === 'SYSTEM_ADMIN' ? (
              <Button
                variant="outline"
                onClick={() => {
                  setDeduplicateResult(null);
                  setShowDeduplicateDialog(true);
                }}
                title="Remove duplicate tools from inventory"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Deduplicate
              </Button>
            ) : null}
            <Button
              variant="outline"
              onClick={() => setShowAlertsDialog(true)}
              title="Manage low inventory alerts"
            >
              <Bell className="mr-2 h-4 w-4" />
              Alerts
              {alerts.filter((a: any) => a.tool && a.tool.availableQuantity <= a.alert.thresholdQuantity).length > 0 && (
                <Badge className="ml-2 bg-red-500 text-white" variant="destructive">
                  {alerts.filter((a: any) => a.tool && a.tool.availableQuantity <= a.alert.thresholdQuantity).length}
                </Badge>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setChecklistForm({ employeeId: '', type: 'ISSUED' });
                setChecklistResult(null);
                setShowChecklistDialog(true);
              }}
              title="Create equipment checklist for employee"
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Checklist
            </Button>

            <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Send className="mr-2 h-4 w-4" />
                  Assign Tools
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Assign Tools to Employee</DialogTitle>
                <DialogDescription>
                  Select an employee and the tools to assign. An email will be sent for signature confirmation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Employee</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {(employees as Employee[]).map((emp: Employee) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName} - {emp.position}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Select Tools</Label>
                  <ScrollArea className="h-[200px] border rounded-md p-4">
                    {filteredTools.filter((tool: Tool) => tool.availableQuantity > 0).map((tool: Tool) => (
                      <div key={tool.id} className="flex items-center space-x-2 mb-2">
                        <Checkbox
                          checked={selectedTools.includes(tool.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTools([...selectedTools, tool.id]);
                            } else {
                              setSelectedTools(selectedTools.filter(id => id !== tool.id));
                            }
                          }}
                        />
                        <Label className="flex-1 cursor-pointer">
                          {categoryIcons[tool.category as keyof typeof categoryIcons]}
                          <span className="ml-2">{tool.name}</span>
                          {tool.serialNumber && <span className="text-gray-500 ml-2">({tool.serialNumber})</span>}
                          <Badge className={`ml-2 ${conditionColors[tool.condition as keyof typeof conditionColors]}`}>
                            {tool.condition}
                          </Badge>
                        </Label>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
                
                <div>
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={assignmentNotes}
                    onChange={(e) => setAssignmentNotes(e.target.value)}
                    placeholder="Add any special instructions or notes..."
                  />
                </div>
                
                <Button onClick={handleAssignTools} className="w-full">
                  <Mail className="mr-2 h-4 w-4" />
                  Assign & Send Email
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {isManager && (
            <Dialog open={showAddToolDialog} onOpenChange={setShowAddToolDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Tool
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Tool</DialogTitle>
                  <DialogDescription>
                    Add a new tool or equipment to the inventory.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={newTool.name}
                        onChange={(e) => setNewTool({ ...newTool, name: e.target.value })}
                        placeholder="Tool name"
                      />
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Select 
                        value={newTool.category} 
                        onValueChange={(value) => setNewTool({ ...newTool, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LAPTOP">Laptop</SelectItem>
                          <SelectItem value="LADDER">Ladder</SelectItem>
                          <SelectItem value="IPAD">iPad</SelectItem>
                          <SelectItem value="BOOTS">Boots</SelectItem>
                          <SelectItem value="POLO">Polo</SelectItem>
                          <SelectItem value="CAR">Car</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Serial Number</Label>
                      <Input
                        value={newTool.serialNumber}
                        onChange={(e) => setNewTool({ ...newTool, serialNumber: e.target.value })}
                        placeholder="Serial number"
                      />
                    </div>
                    <div>
                      <Label>Model</Label>
                      <Input
                        value={newTool.model}
                        onChange={(e) => setNewTool({ ...newTool, model: e.target.value })}
                        placeholder="Model"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={newTool.quantity}
                        onChange={(e) => setNewTool({ ...newTool, quantity: parseInt(e.target.value) || 1 })}
                        min="1"
                      />
                    </div>
                    <div>
                      <Label>Condition</Label>
                      <Select
                        value={newTool.condition}
                        onValueChange={(value) => setNewTool({ ...newTool, condition: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW">New</SelectItem>
                          <SelectItem value="GOOD">Good</SelectItem>
                          <SelectItem value="FAIR">Fair</SelectItem>
                          <SelectItem value="POOR">Poor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {CLOTHING_CATEGORIES.includes(newTool.category) && (
                    <div className="space-y-2">
                      <Label>Size</Label>
                      <Select
                        value={newTool.size || ''}
                        onValueChange={(value) => setNewTool({ ...newTool, size: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {SIZE_OPTIONS.map(size => (
                            <SelectItem key={size} value={size}>{size}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Purchase Price</Label>
                      <Input
                        type="number"
                        value={newTool.purchasePrice}
                        onChange={(e) => setNewTool({ ...newTool, purchasePrice: e.target.value })}
                        placeholder="Price"
                      />
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input
                        value={newTool.location}
                        onChange={(e) => setNewTool({ ...newTool, location: e.target.value })}
                        placeholder="Storage location"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newTool.description}
                      onChange={(e) => setNewTool({ ...newTool, description: e.target.value })}
                      placeholder="Tool description"
                    />
                  </div>
                  
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={newTool.notes}
                      onChange={(e) => setNewTool({ ...newTool, notes: e.target.value })}
                      placeholder="Additional notes"
                    />
                  </div>
                  
                  <Button onClick={handleCreateTool} className="w-full">
                    Add Tool
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          </div>
        )}
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tools by name, category, or serial number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className={`grid w-full ${isManager ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <TabsTrigger value="assignments">
            {isManager ? 'Active Assignments' : 'My Assigned Equipment'}
          </TabsTrigger>
          {isManager && <TabsTrigger value="inventory">Inventory</TabsTrigger>}
        </TabsList>

        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{isManager ? 'Active Tool Assignments' : 'My Equipment'}</CardTitle>
              <CardDescription>
                {isManager ? 'Currently assigned tools and equipment to employees' : 'Tools and equipment assigned to you'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Bulk Return Action Bar */}
              {isManager && selectedAssignments.size > 0 && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-700 dark:text-green-300">
                      {selectedAssignments.size} assignment{selectedAssignments.size > 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearAssignmentSelection}
                    >
                      Clear Selection
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowBulkReturnDialog(true)}
                    >
                      <ArrowLeft className="mr-1 h-4 w-4" />
                      Return Selected
                    </Button>
                  </div>
                </div>
              )}

              {assignmentsLoading ? (
                <div className="text-center py-8">Loading assignments...</div>
              ) : activeAssignments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No active assignments
                </div>
              ) : (
                <div className="space-y-2">
                  {Object.values(groupedAssignments).map((group) => (
                    <Collapsible
                      key={group.employeeId}
                      open={expandedEmployees.has(group.employeeId)}
                      onOpenChange={() => toggleEmployeeExpand(group.employeeId)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg cursor-pointer transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900">
                              <User className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">{group.employeeName}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{group.employeeEmail}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="text-sm">
                              {group.assignments.length} {group.assignments.length === 1 ? 'item' : 'items'}
                            </Badge>
                            {expandedEmployees.has(group.employeeId) ? (
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-6 mt-2 border-l-2 border-gray-200 pl-4 space-y-2">
                          {group.assignments.map((assignment: Assignment) => (
                            <div
                              key={assignment.id}
                              className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-center gap-3">
                                {isManager && (
                                  <Checkbox
                                    checked={selectedAssignments.has(assignment.id)}
                                    onCheckedChange={() => toggleAssignmentSelection(assignment.id)}
                                  />
                                )}
                                <div className="flex items-center justify-center w-8 h-8 rounded bg-gray-100 dark:bg-gray-700">
                                  {categoryIcons[assignment.toolCategory as keyof typeof categoryIcons]}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">{assignment.toolName}</div>
                                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    {assignment.toolSerialNumber && (
                                      <span>SN: {assignment.toolSerialNumber}</span>
                                    )}
                                    <span>•</span>
                                    <span>Assigned {format(new Date(assignment.assignedDate), 'MMM d, yyyy')}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge className={conditionColors[assignment.condition as keyof typeof conditionColors]}>
                                  {assignment.condition}
                                </Badge>
                                {assignment.signatureReceived ? (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="text-xs">Signed</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-orange-600">
                                    <Clock className="h-4 w-4" />
                                    <span className="text-xs">Pending</span>
                                  </div>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReturnTool(assignment.id, assignment.toolName, group.employeeName)}
                                >
                                  <ArrowLeft className="mr-1 h-3 w-3" />
                                  Return
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={() => handleReportIssue(assignment.id, assignment.toolName, group.employeeName)}
                                  title="Report damaged or lost"
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tool Inventory</CardTitle>
              <CardDescription>
                All company tools and equipment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Bulk Action Bar */}
              {isManager && selectedInventoryItems.size > 0 && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-700 dark:text-blue-300">
                      {selectedInventoryItems.size} item{selectedInventoryItems.size > 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={clearSelection}
                    >
                      Clear Selection
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowBulkAssignDialog(true)}
                    >
                      <Send className="mr-1 h-4 w-4" />
                      Assign Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowBulkEditDialog(true)}
                    >
                      <Edit className="mr-1 h-4 w-4" />
                      Bulk Edit
                    </Button>
                  </div>
                </div>
              )}

              {toolsLoading ? (
                <div className="text-center py-8">Loading inventory...</div>
              ) : filteredTools.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No tools found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isManager && (
                        <TableHead className="w-[50px]">
                          <Checkbox
                            checked={selectedInventoryItems.size > 0 && selectedInventoryItems.size === tools.filter(t => t.availableQuantity > 0).length}
                            onCheckedChange={() => selectAllInventory()}
                          />
                        </TableHead>
                      )}
                      <TableHead>Tool</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Serial/Model</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Total Inventory</TableHead>
                      <TableHead>Available</TableHead>
                      <TableHead>Assigned</TableHead>
                      <TableHead>Location</TableHead>
                      {isManager && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Category groups: Tech, Clothing, Equipment */}
                    {groupedInventory.map((group) => (
                      <Fragment key={group.key}>
                        {/* Category header row */}
                        <TableRow
                          className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-gray-700 bg-gray-50/80 dark:bg-gray-800"
                          onClick={() => toggleClothingGroup(group.key)}
                        >
                          {isManager && <TableCell></TableCell>}
                          <TableCell className="font-semibold">
                            <div className="flex items-center gap-2">
                              {expandedClothingGroups.has(group.key) ? (
                                <ChevronDown className="h-5 w-5 text-blue-600" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                              )}
                              {categoryIcons[group.icon]}
                              <span className="text-base text-gray-900 dark:text-white">{group.label}</span>
                              <Badge variant="outline" className="text-xs ml-2">
                                {group.itemCount} items
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-500">Various</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-500">-</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-gray-500">-</span>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-lg">{group.totalQty}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {group.availableQty > 0 ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className="font-bold text-lg">{group.availableQty}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-orange-600">{group.assignedQty}</span>
                          </TableCell>
                          <TableCell>-</TableCell>
                          {isManager && <TableCell></TableCell>}
                        </TableRow>

                        {/* Expanded items within category - Clothing with filters */}
                        {expandedClothingGroups.has(group.key) && group.key === 'clothing' && (
                          <>
                            {/* Dropdown filters row for clothing */}
                            <TableRow className="bg-blue-50/30">
                              <TableCell colSpan={isManager ? 10 : 8} className="py-4">
                                <div className="flex flex-wrap items-center gap-4 pl-6">
                                  <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium whitespace-nowrap">Style:</Label>
                                    <Select
                                      value={clothingFilters.style}
                                      onValueChange={(value) => setClothingFilters(prev => ({ ...prev, style: value === 'all' ? '' : value }))}
                                    >
                                      <SelectTrigger className="w-[180px] h-9 bg-white">
                                        <SelectValue placeholder="All styles" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="all">All styles</SelectItem>
                                        {clothingOptions.styles.map(style => (
                                          <SelectItem key={style} value={style}>{style}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <Label className="text-sm font-medium whitespace-nowrap">Size:</Label>
                                    <Select
                                      value={clothingFilters.size}
                                      onValueChange={(value) => setClothingFilters(prev => ({ ...prev, size: value === 'all' ? '' : value }))}
                                    >
                                      <SelectTrigger className="w-[100px] h-9 bg-white">
                                        <SelectValue placeholder="All sizes" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="all">All sizes</SelectItem>
                                        {availableSizes.map(size => (
                                          <SelectItem key={size} value={size}>{size}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {clothingOptions.colors.length > 0 && (
                                    <div className="flex items-center gap-2">
                                      <Label className="text-sm font-medium whitespace-nowrap">Color:</Label>
                                      <Select
                                        value={clothingFilters.color}
                                        onValueChange={(value) => setClothingFilters(prev => ({ ...prev, color: value === 'all' ? '' : value }))}
                                      >
                                        <SelectTrigger className="w-[120px] h-9 bg-white">
                                          <SelectValue placeholder="All colors" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="all">All colors</SelectItem>
                                          {clothingOptions.colors.map(color => (
                                            <SelectItem key={color} value={color}>{color}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}

                                  {(clothingFilters.style || clothingFilters.size || clothingFilters.color) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-9 text-blue-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setClothingFilters({ style: '', size: '', color: '' });
                                      }}
                                    >
                                      Clear filters
                                    </Button>
                                  )}

                                  <Badge variant="secondary" className="ml-auto">
                                    {filteredClothingItems.length} of {clothingOptions.items.length} items
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>

                            {/* Filtered clothing items */}
                            {filteredClothingItems.map((tool) => (
                              <TableRow key={tool.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
                                {isManager && (
                                  <TableCell>
                                    <Checkbox
                                      checked={selectedInventoryItems.has(tool.id)}
                                      onCheckedChange={() => toggleInventorySelection(tool.id)}
                                      disabled={tool.availableQuantity === 0}
                                    />
                                  </TableCell>
                                )}
                                <TableCell className="font-medium pl-10 text-gray-900 dark:text-white">
                                  {tool.name}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {categoryIcons[tool.category as keyof typeof categoryIcons]}
                                    <span className="text-sm">{categoryDisplayNames[tool.category] || tool.category}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-gray-400">-</span>
                                </TableCell>
                                <TableCell>
                                  <Badge className={conditionColors[tool.condition as keyof typeof conditionColors]}>
                                    {tool.condition}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{tool.quantity}</span>
                                    {isManager && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setQuantityAdjustment({
                                            toolId: tool.id,
                                            toolName: tool.name,
                                            currentQuantity: tool.quantity,
                                            currentAvailable: tool.availableQuantity,
                                            adjustment: 0,
                                            notes: ''
                                          });
                                          setShowAdjustQuantityDialog(true);
                                        }}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {tool.availableQuantity > 0 ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-600" />
                                    )}
                                    <span className="font-medium">{tool.availableQuantity}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <span className="text-muted-foreground">
                                    {tool.quantity - tool.availableQuantity}
                                  </span>
                                </TableCell>
                                <TableCell>{tool.location || '-'}</TableCell>
                                {isManager && (
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setHistoryToolId(tool.id);
                                          setHistoryToolName(tool.name);
                                          setShowHistoryDialog(true);
                                        }}
                                      >
                                        <History className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTool(tool);
                                          setShowEditToolDialog(true);
                                        }}
                                      >
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteTool(tool.id);
                                        }}
                                        disabled={tool.availableQuantity < tool.quantity}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                          </>
                        )}

                        {/* Expanded items for non-clothing categories (tech, equipment) */}
                        {expandedClothingGroups.has(group.key) && group.key !== 'clothing' && group.items.map((tool) => (
                          <TableRow key={tool.id} className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800">
                            {isManager && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedInventoryItems.has(tool.id)}
                                  onCheckedChange={() => toggleInventorySelection(tool.id)}
                                  disabled={tool.availableQuantity === 0}
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-medium pl-10 text-gray-900 dark:text-white">
                              {tool.name}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {categoryIcons[tool.category as keyof typeof categoryIcons]}
                                <span className="text-sm">{categoryDisplayNames[tool.category] || tool.category}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                {tool.serialNumber && (
                                  <div className="text-sm">SN: {tool.serialNumber}</div>
                                )}
                                {tool.model && (
                                  <div className="text-sm text-gray-500">{tool.model}</div>
                                )}
                                {!tool.serialNumber && !tool.model && (
                                  <span className="text-sm text-gray-400">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={conditionColors[tool.condition as keyof typeof conditionColors]}>
                                {tool.condition}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{tool.quantity}</span>
                                {isManager && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setQuantityAdjustment({
                                        toolId: tool.id,
                                        toolName: tool.name,
                                        currentQuantity: tool.quantity,
                                        currentAvailable: tool.availableQuantity,
                                        adjustment: 0,
                                        notes: ''
                                      });
                                      setShowAdjustQuantityDialog(true);
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {tool.availableQuantity > 0 ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )}
                                <span className="font-medium">{tool.availableQuantity}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-muted-foreground">
                                {tool.quantity - tool.availableQuantity}
                              </span>
                            </TableCell>
                            <TableCell>{tool.location || '-'}</TableCell>
                            {isManager && (
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedTool(tool);
                                      setShowEditToolDialog(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTool(tool.id);
                                    }}
                                    disabled={tool.availableQuantity < tool.quantity}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Adjust Quantity Dialog */}
      {quantityAdjustment && (
        <Dialog open={showAdjustQuantityDialog} onOpenChange={setShowAdjustQuantityDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Inventory Quantity</DialogTitle>
              <DialogDescription>
                Adjust the total inventory count for {quantityAdjustment.toolName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Current Total</Label>
                  <div className="text-2xl font-bold">{quantityAdjustment.currentQuantity}</div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Currently Available</Label>
                  <div className="text-2xl font-bold text-green-600">{quantityAdjustment.currentAvailable}</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Adjustment Amount</Label>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuantityAdjustment({
                      ...quantityAdjustment,
                      adjustment: quantityAdjustment.adjustment - 1
                    })}
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={quantityAdjustment.adjustment}
                    onChange={(e) => setQuantityAdjustment({
                      ...quantityAdjustment,
                      adjustment: parseInt(e.target.value) || 0
                    })}
                    className="text-center"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQuantityAdjustment({
                      ...quantityAdjustment,
                      adjustment: quantityAdjustment.adjustment + 1
                    })}
                  >
                    +
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  New Total: {quantityAdjustment.currentQuantity + quantityAdjustment.adjustment}
                </div>
              </div>
              
              <div>
                <Label>Notes (Required)</Label>
                <Textarea
                  value={quantityAdjustment.notes}
                  onChange={(e) => setQuantityAdjustment({
                    ...quantityAdjustment,
                    notes: e.target.value
                  })}
                  placeholder="Reason for adjustment (e.g., new purchase, lost item, inventory correction)"
                  rows={3}
                />
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAdjustQuantityDialog(false);
                    setQuantityAdjustment(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!quantityAdjustment.notes.trim()) {
                      toast({
                        title: 'Error',
                        description: 'Please provide notes for the adjustment',
                        variant: 'destructive'
                      });
                      return;
                    }
                    if (quantityAdjustment.currentQuantity + quantityAdjustment.adjustment < 0) {
                      toast({
                        title: 'Error',
                        description: 'Total quantity cannot be negative',
                        variant: 'destructive'
                      });
                      return;
                    }
                    adjustQuantityMutation.mutate({
                      id: quantityAdjustment.toolId,
                      adjustment: quantityAdjustment.adjustment,
                      notes: quantityAdjustment.notes
                    });
                  }}
                  disabled={quantityAdjustment.adjustment === 0 || !quantityAdjustment.notes.trim()}
                  className="flex-1"
                >
                  Apply Adjustment
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Tool Dialog */}
      {selectedTool && (
        <Dialog open={showEditToolDialog} onOpenChange={setShowEditToolDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Tool</DialogTitle>
              <DialogDescription>
                Update tool information. All fields are editable.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={selectedTool.name}
                    onChange={(e) => setSelectedTool({ ...selectedTool, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={selectedTool.category}
                    onValueChange={(value) => setSelectedTool({ ...selectedTool, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LAPTOP">Laptop</SelectItem>
                      <SelectItem value="LADDER">Ladder</SelectItem>
                      <SelectItem value="IPAD">iPad</SelectItem>
                      <SelectItem value="BOOTS">Boots</SelectItem>
                      <SelectItem value="POLO">Polo</SelectItem>
                      <SelectItem value="CAR">Car</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Serial Number</Label>
                  <Input
                    value={selectedTool.serialNumber || ''}
                    onChange={(e) => setSelectedTool({ ...selectedTool, serialNumber: e.target.value })}
                    placeholder="Enter serial number"
                  />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input
                    value={selectedTool.model || ''}
                    onChange={(e) => setSelectedTool({ ...selectedTool, model: e.target.value })}
                    placeholder="Enter model"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Condition</Label>
                  <Select
                    value={selectedTool.condition}
                    onValueChange={(value) => setSelectedTool({ ...selectedTool, condition: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">New</SelectItem>
                      <SelectItem value="GOOD">Good</SelectItem>
                      <SelectItem value="FAIR">Fair</SelectItem>
                      <SelectItem value="POOR">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Location</Label>
                  <Input
                    value={selectedTool.location || ''}
                    onChange={(e) => setSelectedTool({ ...selectedTool, location: e.target.value })}
                    placeholder="Enter location"
                  />
                </div>
              </div>

              {CLOTHING_CATEGORIES.includes(selectedTool.category) && (
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Select
                    value={selectedTool.size || ''}
                    onValueChange={(value) => setSelectedTool({ ...selectedTool, size: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZE_OPTIONS.map(size => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Purchase Date</Label>
                  <Input
                    type="date"
                    value={selectedTool.purchaseDate ? selectedTool.purchaseDate.split('T')[0] : ''}
                    onChange={(e) => setSelectedTool({ ...selectedTool, purchaseDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Purchase Price ($)</Label>
                  <Input
                    type="number"
                    value={selectedTool.purchasePrice ? selectedTool.purchasePrice / 100 : ''}
                    onChange={(e) => setSelectedTool({ ...selectedTool, purchasePrice: e.target.value ? parseFloat(e.target.value) * 100 : 0 })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  value={selectedTool.description || ''}
                  onChange={(e) => setSelectedTool({ ...selectedTool, description: e.target.value })}
                  placeholder="Enter description"
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={selectedTool.notes || ''}
                  onChange={(e) => setSelectedTool({ ...selectedTool, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              <Button onClick={handleUpdateTool} className="w-full" disabled={updateToolMutation.isPending}>
                {updateToolMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                Update Tool
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Deduplicate Tools Dialog */}
      <Dialog open={showDeduplicateDialog} onOpenChange={setShowDeduplicateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Deduplicate Tool Inventory</DialogTitle>
            <DialogDescription>
              Find and remove duplicate tools, keeping the oldest entry for each unique name.
            </DialogDescription>
          </DialogHeader>

          {!deduplicateResult ? (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">Run Dry Run First</p>
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      We recommend running a dry run first to see how many duplicates will be removed.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => deduplicateMutation.mutate(true)}
                  disabled={deduplicateMutation.isPending}
                  className="flex-1"
                >
                  {deduplicateMutation.isPending ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Run Dry Run (Preview)
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Tools</div>
                  <div className="text-2xl font-bold">{deduplicateResult.stats.totalTools}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Unique Names</div>
                  <div className="text-2xl font-bold">{deduplicateResult.stats.uniqueNames}</div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                  <div className="text-sm text-red-600 dark:text-red-400">Duplicates to Remove</div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {deduplicateResult.stats.duplicatesToDelete}
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <div className="text-sm text-green-600 dark:text-green-400">Will Keep</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {deduplicateResult.stats.willKeep}
                  </div>
                </div>
              </div>

              {deduplicateResult.kept && deduplicateResult.kept.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Preview (showing first 20):</Label>
                  <ScrollArea className="h-[150px] border rounded-md p-2 mt-2">
                    {deduplicateResult.kept.slice(0, 20).map((item) => (
                      <div key={item.id} className="text-sm py-1 border-b last:border-0 dark:border-gray-700">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2">({item.count} copies, keeping 1)</span>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
              )}

              <div className="flex gap-2">
                {deduplicateResult.stats.dryRun && deduplicateResult.stats.duplicatesToDelete > 0 && (
                  <Button
                    variant="destructive"
                    onClick={() => deduplicateMutation.mutate(false)}
                    disabled={deduplicateMutation.isPending}
                    className="flex-1"
                  >
                    {deduplicateMutation.isPending ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete {deduplicateResult.stats.duplicatesToDelete} Duplicates
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowDeduplicateDialog(false)}
                  className="flex-1"
                >
                  {deduplicateResult.stats.dryRun ? 'Cancel' : 'Done'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inventory Alerts Dialog */}
      <Dialog open={showAlertsDialog} onOpenChange={setShowAlertsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Inventory Low Stock Alerts</DialogTitle>
            <DialogDescription>
              Configure alerts to notify you when inventory falls below threshold levels.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkAlertsMutation.mutate()}
                disabled={checkAlertsMutation.isPending}
              >
                {checkAlertsMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Check Alerts Now
              </Button>
              <Button
                size="sm"
                onClick={() => setNewAlert({ toolId: '', thresholdQuantity: 5 })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Alert
              </Button>
            </div>

            {/* Add Alert Form */}
            {newAlert && (
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="pt-4 space-y-4">
                  <div>
                    <Label>Select Tool</Label>
                    <Select
                      value={newAlert.toolId}
                      onValueChange={(value) => setNewAlert({ ...newAlert, toolId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a tool..." />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTools.map((tool) => (
                          <SelectItem key={tool.id} value={tool.id}>
                            {tool.name} (Available: {tool.availableQuantity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Alert Threshold</Label>
                    <Input
                      type="number"
                      min="0"
                      value={newAlert.thresholdQuantity}
                      onChange={(e) => setNewAlert({
                        ...newAlert,
                        thresholdQuantity: parseInt(e.target.value) || 0
                      })}
                      placeholder="Alert when quantity falls to or below..."
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Alert triggers when available quantity is at or below this number
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => saveAlertMutation.mutate(newAlert)}
                      disabled={!newAlert.toolId || saveAlertMutation.isPending}
                      className="flex-1"
                    >
                      {saveAlertMutation.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                      Save Alert
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setNewAlert(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Existing Alerts */}
            <ScrollArea className="h-[300px]">
              {alertsLoading ? (
                <div className="text-center py-4">Loading alerts...</div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No alerts configured. Add an alert to get notified when inventory is low.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tool</TableHead>
                      <TableHead>Threshold</TableHead>
                      <TableHead>Current Stock</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map((item: any) => (
                      <TableRow key={item.alert?.id || item.id}>
                        <TableCell>{item.tool?.name || 'Unknown'}</TableCell>
                        <TableCell>{item.alert?.thresholdQuantity ?? item.thresholdQuantity}</TableCell>
                        <TableCell>{item.tool?.availableQuantity ?? '-'}</TableCell>
                        <TableCell>
                          {item.tool && (item.alert?.thresholdQuantity !== undefined
                            ? item.tool.availableQuantity <= item.alert.thresholdQuantity
                            : item.tool.availableQuantity <= item.thresholdQuantity) ? (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Low Stock</Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Equipment Checklist Dialog */}
      <Dialog open={showChecklistDialog} onOpenChange={setShowChecklistDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Equipment Checklist</DialogTitle>
            <DialogDescription>
              Generate an equipment checklist form for an employee to sign.
            </DialogDescription>
          </DialogHeader>

          {!checklistResult ? (
            <div className="space-y-4">
              <div>
                <Label>Employee</Label>
                <Select
                  value={checklistForm.employeeId}
                  onValueChange={(value) => setChecklistForm({ ...checklistForm, employeeId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {(employees as Employee[]).map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} - {emp.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Checklist Type</Label>
                <Select
                  value={checklistForm.type}
                  onValueChange={(value) => setChecklistForm({ ...checklistForm, type: value as 'ISSUED' | 'RETURNED' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ISSUED">Equipment Issued (New Hire)</SelectItem>
                    <SelectItem value="RETURNED">Equipment Return (Termination)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleCreateChecklist}
                disabled={!checklistForm.employeeId || createChecklistMutation.isPending}
                className="w-full"
              >
                {createChecklistMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardList className="mr-2 h-4 w-4" />
                )}
                Generate Checklist
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">Checklist Created</p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Equipment checklist for {checklistResult.employeeName} has been generated.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label>Form URL</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={`${window.location.origin}${checklistResult.formUrl}`} readOnly className="text-sm" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${checklistResult.formUrl}`);
                      toast({ title: 'Copied!', description: 'URL copied to clipboard' });
                    }}
                    title="Copy URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Share this link with the employee to complete the checklist.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open(checklistResult.formUrl, '_blank')}
                  className="flex-1"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Form
                </Button>
                <Button
                  onClick={() => {
                    setChecklistResult(null);
                    setShowChecklistDialog(false);
                  }}
                  className="flex-1"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Enhanced Return Dialog */}
      <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Return Equipment</DialogTitle>
            <DialogDescription>
              Confirm return of equipment and document its condition.
            </DialogDescription>
          </DialogHeader>

          {returnAssignment && (
            <div className="space-y-4">
              {/* Equipment Info */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Returning</div>
                <div className="font-semibold text-gray-900 dark:text-white">{returnAssignment.toolName}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  From: {returnAssignment.employeeName}
                </div>
              </div>

              {/* Condition Selection */}
              <div className="space-y-2">
                <Label htmlFor="returnCondition" className="text-sm font-medium">
                  Return Condition <span className="text-red-500">*</span>
                </Label>
                <Select value={returnCondition} onValueChange={setReturnCondition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New - Like new, unused</SelectItem>
                    <SelectItem value="GOOD">Good - Normal wear</SelectItem>
                    <SelectItem value="FAIR">Fair - Visible wear, functional</SelectItem>
                    <SelectItem value="POOR">Poor - Significant wear/damage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="returnNotes" className="text-sm font-medium">
                  Return Notes
                </Label>
                <Textarea
                  id="returnNotes"
                  placeholder="Any observations about the equipment condition, damages, missing parts, etc."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReturnDialog(false);
                    setReturnAssignment(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={processReturn}
                  disabled={returnToolMutation.isPending}
                  className="flex-1"
                >
                  {returnToolMutation.isPending ? 'Processing...' : 'Confirm Return'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Issue Dialog (Damaged/Lost) */}
      <Dialog open={showReportIssueDialog} onOpenChange={setShowReportIssueDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Report Equipment Issue
            </DialogTitle>
            <DialogDescription>
              Report equipment as damaged or lost. This will update inventory records.
            </DialogDescription>
          </DialogHeader>

          {reportIssueAssignment && (
            <div className="space-y-4">
              {/* Equipment Info */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Equipment</div>
                <div className="font-semibold text-gray-900 dark:text-white">{reportIssueAssignment.toolName}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Assigned to: {reportIssueAssignment.employeeName}
                </div>
              </div>

              {/* Issue Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="issueType" className="text-sm font-medium">
                  Issue Type <span className="text-red-500">*</span>
                </Label>
                <Select value={issueType} onValueChange={(v) => setIssueType(v as 'DAMAGED' | 'LOST')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select issue type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DAMAGED">
                      <span className="flex items-center gap-2">
                        <span>Damaged</span>
                        <span className="text-xs text-gray-500">- Returns to inventory</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="LOST">
                      <span className="flex items-center gap-2">
                        <span>Lost</span>
                        <span className="text-xs text-gray-500">- Removes from inventory</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Warning for LOST */}
              {issueType === 'LOST' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-red-700 dark:text-red-300">
                      <strong>Warning:</strong> Marking equipment as lost will permanently reduce inventory count.
                      This action should only be used when the equipment cannot be recovered.
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="issueDescription" className="text-sm font-medium">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="issueDescription"
                  placeholder={issueType === 'DAMAGED'
                    ? "Describe the damage (e.g., torn fabric, broken zipper, cracked screen...)"
                    : "Describe the circumstances of the loss (e.g., left at job site, stolen from vehicle...)"}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowReportIssueDialog(false);
                    setReportIssueAssignment(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={processIssueReport}
                  disabled={reportIssueMutation.isPending || !issueDescription.trim()}
                  className={issueType === 'LOST' ? 'flex-1 bg-red-600 hover:bg-red-700' : 'flex-1'}
                >
                  {reportIssueMutation.isPending
                    ? 'Reporting...'
                    : issueType === 'LOST'
                      ? 'Mark as Lost'
                      : 'Report Damage'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Dialog */}
      <Dialog open={showBulkAssignDialog} onOpenChange={setShowBulkAssignDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Selected Equipment</DialogTitle>
            <DialogDescription>
              Assign {selectedInventoryItems.size} selected item{selectedInventoryItems.size > 1 ? 's' : ''} to an employee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selected Items Preview */}
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg max-h-32 overflow-y-auto">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Selected Items:</div>
              <div className="space-y-1">
                {Array.from(selectedInventoryItems).map(toolId => {
                  const tool = tools.find(t => t.id === toolId);
                  return tool ? (
                    <div key={toolId} className="text-sm text-gray-700 dark:text-gray-300">
                      • {tool.name}
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* Employee Selection */}
            <div className="space-y-2">
              <Label htmlFor="bulkAssignEmployee" className="text-sm font-medium">
                Assign To <span className="text-red-500">*</span>
              </Label>
              <Select value={bulkAssignEmployee} onValueChange={setBulkAssignEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {(employees as Employee[]).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="bulkAssignNotes" className="text-sm font-medium">
                Notes
              </Label>
              <Textarea
                id="bulkAssignNotes"
                placeholder="Optional notes for this assignment..."
                value={bulkAssignNotes}
                onChange={(e) => setBulkAssignNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkAssignDialog(false);
                  setBulkAssignEmployee('');
                  setBulkAssignNotes('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkAssign}
                disabled={createAssignmentMutation.isPending || !bulkAssignEmployee}
                className="flex-1"
              >
                {createAssignmentMutation.isPending ? 'Assigning...' : 'Assign All'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Return Dialog */}
      <Dialog open={showBulkReturnDialog} onOpenChange={setShowBulkReturnDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Return Equipment</DialogTitle>
            <DialogDescription>
              Return {selectedAssignments.size} selected assignment{selectedAssignments.size > 1 ? 's' : ''} at once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selected Assignments Preview */}
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg max-h-32 overflow-y-auto">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Selected Assignments:</div>
              <div className="space-y-1">
                {Array.from(selectedAssignments).map(assignmentId => {
                  const assignment = activeAssignments.find((a: Assignment) => a.id === assignmentId);
                  return assignment ? (
                    <div key={assignmentId} className="text-sm text-gray-700 dark:text-gray-300">
                      • {assignment.toolName} ({assignment.employeeName})
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* Return Condition */}
            <div className="space-y-2">
              <Label htmlFor="bulkReturnCondition" className="text-sm font-medium">
                Return Condition <span className="text-red-500">*</span>
              </Label>
              <Select value={bulkReturnCondition} onValueChange={setBulkReturnCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Select condition" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New - Like new, unused</SelectItem>
                  <SelectItem value="GOOD">Good - Normal wear</SelectItem>
                  <SelectItem value="FAIR">Fair - Visible wear, functional</SelectItem>
                  <SelectItem value="POOR">Poor - Significant wear/damage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="bulkReturnNotes" className="text-sm font-medium">
                Return Notes
              </Label>
              <Textarea
                id="bulkReturnNotes"
                placeholder="Optional notes for this bulk return..."
                value={bulkReturnNotes}
                onChange={(e) => setBulkReturnNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkReturnDialog(false);
                  setBulkReturnCondition('GOOD');
                  setBulkReturnNotes('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkReturn}
                disabled={bulkReturnMutation.isPending}
                className="flex-1"
              >
                {bulkReturnMutation.isPending ? 'Returning...' : 'Return All'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Edit Inventory</DialogTitle>
            <DialogDescription>
              Update {selectedInventoryItems.size} selected item{selectedInventoryItems.size > 1 ? 's' : ''}. Leave fields empty to keep current values.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selected Items Preview */}
            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg max-h-32 overflow-y-auto">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Selected Items:</div>
              <div className="space-y-1">
                {Array.from(selectedInventoryItems).map(toolId => {
                  const tool = tools.find(t => t.id === toolId);
                  return tool ? (
                    <div key={toolId} className="text-sm text-gray-700 dark:text-gray-300">
                      • {tool.name}
                    </div>
                  ) : null;
                })}
              </div>
            </div>

            {/* Condition */}
            <div className="space-y-2">
              <Label htmlFor="bulkEditCondition" className="text-sm font-medium">
                Condition
              </Label>
              <Select value={bulkEditCondition} onValueChange={setBulkEditCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Leave unchanged" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Leave unchanged</SelectItem>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="GOOD">Good</SelectItem>
                  <SelectItem value="FAIR">Fair</SelectItem>
                  <SelectItem value="POOR">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="bulkEditLocation" className="text-sm font-medium">
                Location
              </Label>
              <Input
                id="bulkEditLocation"
                placeholder="Leave unchanged"
                value={bulkEditLocation}
                onChange={(e) => setBulkEditLocation(e.target.value)}
              />
            </div>

            {/* Notes to Append */}
            <div className="space-y-2">
              <Label htmlFor="bulkEditNotes" className="text-sm font-medium">
                Notes to Append
              </Label>
              <Textarea
                id="bulkEditNotes"
                placeholder="Optional notes to add to all selected items..."
                value={bulkEditNotes}
                onChange={(e) => setBulkEditNotes(e.target.value)}
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowBulkEditDialog(false);
                  setBulkEditCondition('');
                  setBulkEditLocation('');
                  setBulkEditNotes('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkEdit}
                disabled={bulkEditMutation.isPending || (!bulkEditCondition && !bulkEditLocation && !bulkEditNotes)}
                className="flex-1"
              >
                {bulkEditMutation.isPending ? 'Updating...' : 'Update All'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>History: {historyToolName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No history recorded yet</p>
            ) : (
              auditLogs.map((log: any) => (
                <div key={log.id} className="border rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <Badge variant={log.action === 'DELETE' ? 'destructive' : log.action === 'CREATE' ? 'default' : 'secondary'}>
                      {log.action}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  {log.notes && <p className="mt-2 text-sm">{log.notes}</p>}
                  {log.quantityChange && <p className="text-sm">Quantity change: {log.quantityChange > 0 ? '+' : ''}{log.quantityChange}</p>}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}