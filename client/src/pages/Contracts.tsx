import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Send, Eye, Check, X, PenTool, Plus, Edit, Upload, File, Trash2, Calendar, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import type { User, ContractTemplate, EmployeeContract } from '@/../../shared/schema';

const templateFormSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  type: z.enum(['EMPLOYMENT', 'NDA', 'CONTRACTOR', 'OTHER', 'RETAIL']),
  territory: z.string().optional(),
  content: z.string().min(1, 'Template content is required'),
  variables: z.array(z.string()).default([]),
  fileUrl: z.string().optional()
});

const contractFormSchema = z.object({
  recipientType: z.enum(['EMPLOYEE', 'CANDIDATE']).default('EMPLOYEE'),
  employeeId: z.string().optional(),
  candidateId: z.string().optional(),
  templateId: z.string().optional(),
  title: z.string().min(1, 'Contract title is required'),
  content: z.string().min(1, 'Contract content is required'),
  fieldValues: z.record(z.string()).optional()
}).refine((data) => {
  // Ensure either employeeId or candidateId is provided based on recipientType
  if (data.recipientType === 'EMPLOYEE' && !data.employeeId) {
    return false;
  }
  if (data.recipientType === 'CANDIDATE' && !data.candidateId) {
    return false;
  }
  return true;
}, {
  message: 'Please select a recipient',
  path: ['employeeId']
});

const signatureFormSchema = z.object({
  signature: z.string().min(1, 'Signature is required'),
  signatureAddress: z.string().min(1, 'Mailing address is required'),
  signatureDate: z.string().min(1, 'Date is required'),
  agreeToSign: z.boolean().refine(val => val === true, {
    message: 'You must agree to the electronic signature terms'
  })
});

const editContractSchema = z.object({
  title: z.string().min(1, 'Contract title is required'),
  content: z.string().min(1, 'Contract content is required'),
  contractorName: z.string().min(1, 'Name is required'),
  startDate: z.string().optional(),
  effectiveDate: z.string().optional()
});

export default function Contracts() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [searchParams] = useSearchParams();

  // Check if user has manager permissions - needed early for queries
  const isManager = currentUser?.email === 'ahmed.mahmoud@theroofdocs.com' ||
    (currentUser?.role && ['SYSTEM_ADMIN', 'HR_ADMIN', 'GENERAL_MANAGER', 'TERRITORY_MANAGER', 'MANAGER', 'TRUE_ADMIN', 'ADMIN', 'TERRITORY_SALES_MANAGER'].includes(currentUser.role));
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<EmployeeContract | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [editContract, setEditContract] = useState<EmployeeContract | null>(null);
  const [contractStatusFilter, setContractStatusFilter] = useState<'all' | 'pending' | 'signed' | 'rejected' | 'rescinded'>('all');
  const [contractSearch, setContractSearch] = useState('');
  const [variableInput, setVariableInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [templateFields, setTemplateFields] = useState<string[]>([]);
  const [autoTemplateFields, setAutoTemplateFields] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [recipientSearch, setRecipientSearch] = useState('');

  const todayInput = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  };

  const applyRecipientAutoFill = (fullName: string) => {
    const defaultDate = todayInput();
    setFieldValues((prev) => ({
      contractorName: fullName,
      name: fullName,
      employeeName: fullName,
      startDate: prev.startDate || defaultDate,
      effectiveDate: prev.effectiveDate || defaultDate,
      ...prev,
    }));
    if (!contractForm.getValues('title')) {
      contractForm.setValue('title', selectedTemplate?.name || 'Contract');
    }
    if (!contractForm.getValues('content') && selectedTemplate?.content) {
      contractForm.setValue('content', selectedTemplate.content);
    }
  };

  useEffect(() => {
    if (!recipientSearch.trim()) return;
    const search = recipientSearch.toLowerCase();
    const recipientType = contractForm.watch('recipientType');
    if (recipientType === 'EMPLOYEE') {
      const match = users.find((u) =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(search) ||
        (u.email || '').toLowerCase().includes(search)
      );
      if (match) {
        contractForm.setValue('employeeId', match.id);
        contractForm.setValue('candidateId', '');
        applyRecipientAutoFill(`${match.firstName} ${match.lastName}`);
      }
    } else {
      const match = candidates.find((c: any) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(search) ||
        (c.email || '').toLowerCase().includes(search)
      );
      if (match) {
        contractForm.setValue('candidateId', match.id);
        contractForm.setValue('employeeId', '');
        applyRecipientAutoFill(`${match.firstName} ${match.lastName}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientSearch]);

  const templateForm = useForm<z.infer<typeof templateFormSchema>>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: '',
      type: 'EMPLOYMENT',
      territory: '',
      content: '',
      variables: [],
      fileUrl: ''
    }
  });

  const contractForm = useForm<z.infer<typeof contractFormSchema>>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      recipientType: 'EMPLOYEE',
      employeeId: '',
      candidateId: '',
      templateId: '',
      title: '',
      content: ''
    }
  });

  const signatureForm = useForm<z.infer<typeof signatureFormSchema>>({
    resolver: zodResolver(signatureFormSchema),
    defaultValues: {
      signature: '',
      signatureAddress: '',
      signatureDate: new Date().toISOString().split('T')[0],
      agreeToSign: false
    }
  });

  const editForm = useForm<z.infer<typeof editContractSchema>>({
    resolver: zodResolver(editContractSchema),
    defaultValues: {
      title: '',
      content: '',
      contractorName: '',
      startDate: '',
      effectiveDate: ''
    }
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/contract-templates'],
    queryFn: async (): Promise<ContractTemplate[]> => {
      const response = await fetch('/api/contract-templates', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      console.log('Templates fetched:', data);
      return data;
    },
    enabled: isManager
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['/api/employee-contracts', isManager, currentUser?.id],
    queryFn: async (): Promise<EmployeeContract[]> => {
      // Managers see all contracts, employees see only their own
      const endpoint = isManager
        ? '/api/employee-contracts'
        : `/api/employee-contracts/employee/${currentUser?.id}`;
      const response = await fetch(endpoint, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch contracts');
      }
      return response.json();
    },
    enabled: !!currentUser?.id // Only run query when user is loaded
  });

  useEffect(() => {
    const contractId = searchParams.get('contractId');
    if (!contractId || contractsLoading) return;
    if (selectedContract?.id === contractId) return;
    const match = contracts.find((contract) => contract.id === contractId);
    if (!match) return;
    setSelectedContract(match);
    if (match.status === 'SENT' && match.employeeId === currentUser?.id) {
      setIsSignDialogOpen(true);
    }
  }, [searchParams, contracts, contractsLoading, currentUser?.id, selectedContract?.id]);

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async (): Promise<User[]> => {
      const response = await fetch('/api/users', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    },
    enabled: isManager
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ['/api/candidates'],
    queryFn: async (): Promise<Array<{ id: string; firstName: string; lastName: string; email: string; status: string; position: string }>> => {
      const response = await fetch('/api/candidates', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch candidates');
      }
      return response.json();
    },
    enabled: isManager
  });

  const { data: territories = [] } = useQuery({
    queryKey: ['/api/territories'],
    queryFn: async (): Promise<Array<{ id: string; name: string; code: string }>> => {
      const response = await fetch('/api/territories', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch territories');
      }
      return response.json();
    },
    enabled: isManager
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof templateFormSchema>) => {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('type', data.type);
      if (data.territory) formData.append('territory', data.territory);
      if (data.variables && data.variables.length > 0) {
        formData.append('variables', JSON.stringify(data.variables));
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      
      const response = await fetch('/api/contract-templates/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to upload template');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contract-templates'] });
      setIsTemplateDialogOpen(false);
      templateForm.reset();
      handleRemoveFile(); // Clear the file selection
      toast({
        title: 'Success',
        description: 'Master contract template uploaded successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload template',
        variant: 'destructive',
      });
    }
  });

  const createContractMutation = useMutation({
    mutationFn: (data: z.infer<typeof contractFormSchema>) => 
      apiRequest('/api/employee-contracts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-contracts'] });
      setIsContractDialogOpen(false);
      contractForm.reset();
      toast({
        title: 'Success',
        description: 'Contract created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create contract',
        variant: 'destructive',
      });
    }
  });

  type ContractUpdate = Partial<EmployeeContract> & { regeneratePdf?: boolean; fieldValues?: Record<string, string> };

  const updateContractMutation = useMutation({
    mutationFn: (data: { id: string; updates: ContractUpdate }) => 
      apiRequest(`/api/employee-contracts/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data.updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-contracts'] });
      toast({
        title: 'Success',
        description: 'Contract updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update contract',
        variant: 'destructive',
      });
    }
  });

  const signContractMutation = useMutation({
    mutationFn: (data: { id: string; signature: string; signatureAddress: string; signatureDate: string }) =>
      apiRequest(`/api/employee-contracts/${data.id}/sign`, {
        method: 'POST',
        body: JSON.stringify({ signature: data.signature, signatureAddress: data.signatureAddress, signatureDate: data.signatureDate }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-contracts'] });
      setIsSignDialogOpen(false);
      signatureForm.reset();
      toast({
        title: 'Success',
        description: 'Contract signed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sign contract',
        variant: 'destructive',
      });
    }
  });

  const rejectContractMutation = useMutation({
    mutationFn: (data: { id: string; reason: string }) => 
      apiRequest(`/api/employee-contracts/${data.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason: data.reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-contracts'] });
      toast({
        title: 'Success',
        description: 'Contract rejected',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject contract',
        variant: 'destructive',
      });
    }
  });

  const rescindContractMutation = useMutation({
    mutationFn: (data: { id: string; reason: string }) =>
      apiRequest(`/api/employee-contracts/${data.id}/rescind`, {
        method: 'POST',
        body: JSON.stringify({ reason: data.reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-contracts'] });
      toast({
        title: 'Success',
        description: 'Contract rescinded',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to rescind contract',
        variant: 'destructive',
      });
    }
  });

  const onSubmitTemplate = (data: z.infer<typeof templateFormSchema>) => {
    createTemplateMutation.mutate(data);
  };

  const onSubmitContract = (data: z.infer<typeof contractFormSchema>) => {
    const cleanedFieldValues = Object.fromEntries(
      Object.entries(fieldValues).filter(([, value]) => value !== '')
    );
    createContractMutation.mutate({ ...data, fieldValues: cleanedFieldValues });
  };

  const onSubmitSignature = (data: z.infer<typeof signatureFormSchema>) => {
    if (selectedContract) {
      signContractMutation.mutate({
        id: selectedContract.id,
        signature: data.signature,
        signatureAddress: data.signatureAddress,
        signatureDate: data.signatureDate
      });
    }
  };

  const parseDateForInput = (value?: string) => {
    if (!value) return '';
    if (value.includes('-')) return value;
    const parts = value.split('/');
    if (parts.length !== 3) return value;
    const [month, day, year] = parts;
    const paddedMonth = month.padStart(2, '0');
    const paddedDay = day.padStart(2, '0');
    return `${year}-${paddedMonth}-${paddedDay}`;
  };

  const formatDateForContract = (value?: string) => {
    if (!value) return undefined;
    if (!value.includes('-')) return value;
    const [year, month, day] = value.split('-');
    return `${Number(month)}/${Number(day)}/${year}`;
  };

  const openEditContract = (contract: EmployeeContract) => {
    const fieldValues = (contract.fieldValues || {}) as Record<string, string>;
    editForm.reset({
      title: contract.title || '',
      content: contract.content || '',
      contractorName: fieldValues.contractorName || contract.recipientName || '',
      startDate: parseDateForInput(fieldValues.startDate),
      effectiveDate: parseDateForInput(fieldValues.effectiveDate)
    });
    setEditContract(contract);
    setIsEditDialogOpen(true);
  };

  const onSubmitEditContract = (data: z.infer<typeof editContractSchema>) => {
    if (!editContract) return;
    const fieldValues = {
      contractorName: data.contractorName,
      startDate: formatDateForContract(data.startDate),
      effectiveDate: formatDateForContract(data.effectiveDate)
    };
    const cleanedFieldValues = Object.fromEntries(
      Object.entries(fieldValues).filter(([, value]) => value !== undefined && value !== '')
    ) as Record<string, string>;

    updateContractMutation.mutate({
      id: editContract.id,
      updates: {
        title: data.title,
        content: data.content,
        fieldValues: cleanedFieldValues,
        regeneratePdf: true
      }
    });
    setIsEditDialogOpen(false);
    setEditContract(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // You can upload the file to a server here and get a URL
      // For now, we'll just store it locally
      const reader = new FileReader();
      reader.onloadend = () => {
        templateForm.setValue('fileUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    templateForm.setValue('fileUrl', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const normalizeVariableName = (value: string) => value.replace(/[{}]/g, '').trim();

  const resetTemplateFields = () => {
    setTemplateFields([]);
    setAutoTemplateFields([]);
    setFieldValues({});
  };

  const loadTemplateFields = async (template: ContractTemplate) => {
    try {
      const response = await fetch(`/api/contract-templates/${template.id}/variables`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        const autoFields = (data.autoFilled || []).map(normalizeVariableName).filter(Boolean);
        const userFields = (data.userProvided || []).length > 0
          ? data.userProvided
          : (template.variables || []);
        const normalizedUserFields = userFields.map(normalizeVariableName).filter(Boolean);
        const filteredUserFields = normalizedUserFields.filter((field: string) => !autoFields.includes(field));

        setAutoTemplateFields(Array.from(new Set(autoFields)));
        setTemplateFields(Array.from(new Set(filteredUserFields)));
        setFieldValues({});
        return;
      }
    } catch (error) {
      // Fall through to template-defined variables
    }

    const fallbackFields = (template.variables || []).map(normalizeVariableName).filter(Boolean);
    setAutoTemplateFields([]);
    setTemplateFields(Array.from(new Set(fallbackFields)));
    setFieldValues({});
  };

  const addVariable = () => {
    if (variableInput.trim()) {
      const current = templateForm.getValues('variables');
      templateForm.setValue('variables', [...current, `{{${variableInput.trim()}}}`]);
      setVariableInput('');
    }
  };

  const removeVariable = (index: number) => {
    const current = templateForm.getValues('variables');
    templateForm.setValue('variables', current.filter((_, i) => i !== index));
  };

  const sendContract = (contractId: string) => {
    updateContractMutation.mutate({
      id: contractId,
      updates: { status: 'SENT' }
    });
  };

  const getStatusBadge = (contract: EmployeeContract) => {
    const status = contract.status;
    const statusLabels: Record<string, string> = {
      DRAFT: 'Draft',
      SENT: 'Sent',
      VIEWED: 'Viewed',
      SIGNED: 'Signed',
      REJECTED: 'Rejected',
      RESCINDED: 'Rescinded'
    };

    const label = statusLabels[status] || status;
    const sentDate = contract.sentDate ? new Date(contract.sentDate) : null;
    const daysSinceSent = sentDate
      ? Math.floor((Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    if (status === 'SIGNED') {
      return (
        <Badge variant="secondary" className="border border-emerald-200 bg-emerald-100 text-emerald-800">
          {label}
        </Badge>
      );
    }

    if (status === 'SENT' || status === 'VIEWED') {
      let className = 'border border-sky-200 bg-sky-100 text-sky-800';
      if (daysSinceSent !== null && daysSinceSent >= 5) {
        className = 'border border-red-200 bg-red-100 text-red-800';
      } else if (daysSinceSent !== null && daysSinceSent >= 2) {
        className = 'border border-amber-200 bg-amber-100 text-amber-800';
      }
      return (
        <Badge variant="secondary" className={className}>
          {label}
        </Badge>
      );
    }

    if (status === 'REJECTED' || status === 'RESCINDED') {
      return (
        <Badge variant="destructive">
          {label}
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        {label}
      </Badge>
    );
  };

  const normalizedSearch = contractSearch.trim().toLowerCase();
  const filteredContracts = contracts.filter((contract: EmployeeContract) => {
    const matchesStatus = (() => {
      if (contractStatusFilter === 'all') return true;
      if (contractStatusFilter === 'pending') {
        return contract.status === 'SENT' || contract.status === 'VIEWED';
      }
      if (contractStatusFilter === 'signed') return contract.status === 'SIGNED';
      if (contractStatusFilter === 'rescinded') return contract.status === 'RESCINDED';
      return contract.status === 'REJECTED';
    })();

    const matchesSearch = !normalizedSearch ||
      (contract.recipientName || '').toLowerCase().includes(normalizedSearch) ||
      (contract.recipientEmail || '').toLowerCase().includes(normalizedSearch) ||
      (contract.title || '').toLowerCase().includes(normalizedSearch);

    return matchesStatus && matchesSearch;
  });

  // My contracts (for current user)
  const myContracts = contracts.filter((c: EmployeeContract) => c.employeeId === currentUser?.id);

  // Contracts by status
  const draftContracts = contracts.filter((c: EmployeeContract) => c.status === 'DRAFT');
  const pendingContracts = contracts.filter((c: EmployeeContract) => 
    c.status === 'SENT' || c.status === 'VIEWED'
  );
  const signedContracts = contracts.filter((c: EmployeeContract) => c.status === 'SIGNED');

  if (contractsLoading || templatesLoading) {
    return <div className="flex items-center justify-center h-64">Loading contracts...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Contract Management</h1>
          <p className="text-muted-foreground mt-2">Manage contract templates and employee agreements</p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Master Contract
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                  <DialogTitle>Upload Master Contract Template</DialogTitle>
                  <DialogDescription>
                    Upload a PDF contract that will serve as a master template for generating contracts
                  </DialogDescription>
                </DialogHeader>
                <Form {...templateForm}>
                  <form onSubmit={templateForm.handleSubmit(onSubmitTemplate)} className="space-y-4">
                    <FormField
                      control={templateForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Standard Employment Agreement" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={templateForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contract Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="EMPLOYMENT">Employment</SelectItem>
                                <SelectItem value="NDA">NDA</SelectItem>
                                <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                                <SelectItem value="RETAIL">Retail</SelectItem>
                                <SelectItem value="OTHER">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={templateForm.control}
                        name="territory"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Territory (Optional)</FormLabel>
                            <Select onValueChange={(value) => field.onChange(value === 'all' ? '' : value)} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="All territories" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">All territories</SelectItem>
                                {territories.map((territory: any) => (
                                  <SelectItem key={territory.id} value={territory.id}>
                                    {territory.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={templateForm.control}
                      name="variables"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template Variables</FormLabel>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Input
                                value={variableInput}
                                onChange={(e) => setVariableInput(e.target.value)}
                                placeholder="e.g., salary, startDate"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addVariable();
                                  }
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={addVariable}
                              >
                                Add
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {field.value.map((variable, index) => (
                                <Badge key={index} variant="secondary">
                                  {variable}
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="ml-2 h-4 w-4 p-0"
                                    onClick={() => removeVariable(index)}
                                  >
                                    ×
                                  </Button>
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <FormDescription>
                            Common variables: name, position, department, salary, startDate
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={templateForm.control}
                      name="fileUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Master Contract PDF *</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept=".pdf"
                                  onChange={handleFileSelect}
                                  className="hidden"
                                  required
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="w-full"
                                >
                                  <Upload className="h-4 w-4 mr-2" />
                                  Select PDF File
                                </Button>
                              </div>
                              
                              {selectedFile && (
                                <div className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
                                  <div className="flex items-center gap-2">
                                    <File className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm">{selectedFile.name}</span>
                                    <span className="text-xs text-gray-500">
                                      ({(selectedFile.size / 1024).toFixed(2)} KB)
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleRemoveFile}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </FormControl>
                          <FormDescription>
                            Upload a PDF contract template. Common fields like name, date, and phone will be fillable.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createTemplateMutation.isPending || !selectedFile}>
                        {createTemplateMutation.isPending ? 'Uploading...' : 'Upload Template'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            <Dialog open={isContractDialogOpen} onOpenChange={(open) => {
              setIsContractDialogOpen(open);
              if (!open) {
                contractForm.reset();
                setRecipientSearch('');
                setFieldValues({});
                setSelectedTemplate(null);
                resetTemplateFields();
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <FileText className="h-4 w-4 mr-2" />
                  New Contract
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                  <DialogTitle>Generate Contract from Template</DialogTitle>
                  <DialogDescription>
                    Select a master template and fill in the required fields
              </DialogDescription>
            </DialogHeader>
            <Form {...contractForm}>
              <form onSubmit={contractForm.handleSubmit(onSubmitContract)} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Type a name or email to auto-fill recipient"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                  />
                  <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <FormField
                  control={contractForm.control}
                  name="recipientType"
                  render={({ field }) => (
                    <FormItem>
                          <FormLabel>Recipient Type</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              // Clear the selection when switching types
                              contractForm.setValue('employeeId', '');
                              contractForm.setValue('candidateId', '');
                            }} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="EMPLOYEE">Current Employee</SelectItem>
                              <SelectItem value="CANDIDATE">New Hire (from Recruiting)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Choose whether this contract is for a current employee or a new hire from recruiting
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {contractForm.watch('recipientType') === 'EMPLOYEE' && (
                      <FormField
                        control={contractForm.control}
                        name="employeeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select Employee</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select current employee" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {users.map((user: User) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.firstName} {user.lastName} - {user.position}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    {contractForm.watch('recipientType') === 'CANDIDATE' && (
                      <FormField
                        control={contractForm.control}
                        name="candidateId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Select New Hire</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select candidate from recruiting" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {candidates.filter((c: any) => ['OFFER', 'INTERVIEW', 'SCREENING'].includes(c.status)).map((candidate: any) => (
                                  <SelectItem key={candidate.id} value={candidate.id}>
                                    {candidate.firstName} {candidate.lastName} - {candidate.position} ({candidate.status})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Shows candidates in OFFER, INTERVIEW, or SCREENING stages from the recruiting pipeline
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                    <FormField
                      control={contractForm.control}
                      name="templateId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Template (Optional)</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              if (value === 'custom') {
                                field.onChange('');
                                contractForm.setValue('title', '');
                                contractForm.setValue('content', '');
                                setSelectedTemplate(null);
                                resetTemplateFields();
                              } else {
                                field.onChange(value);
                                const template = templates.find((t: ContractTemplate) => t.id === value);
                                if (template) {
                                  contractForm.setValue('title', template.name);
                                  contractForm.setValue('content', template.content);
                                  setSelectedTemplate(template);
                                  loadTemplateFields(template);
                                } else {
                                  setSelectedTemplate(null);
                                  resetTemplateFields();
                                }
                              }
                            }} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select template or create custom" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="custom">Custom Contract</SelectItem>
                              {templates.filter((t: ContractTemplate) => t.isActive).map((template: ContractTemplate) => (
                                <SelectItem key={template.id} value={template.id}>
                                  {template.name} ({template.type})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {(templateFields.length > 0 || autoTemplateFields.length > 0) && (
                      <div className="rounded-lg border p-4 space-y-3">
                        <div>
                          <Label className="text-sm font-medium">Template Fields</Label>
                          {autoTemplateFields.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {autoTemplateFields.map((field) => (
                                <Badge key={field} variant="secondary" className="text-xs">
                                  {field} (auto)
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        {templateFields.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {templateFields.map((field) => (
                              <div key={field} className="space-y-1">
                                <Label htmlFor={`field-${field}`}>{field}</Label>
                                <Input
                                  id={`field-${field}`}
                                  value={fieldValues[field] || ''}
                                  onChange={(event) =>
                                    setFieldValues((prev) => ({
                                      ...prev,
                                      [field]: event.target.value
                                    }))
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <FormField
                      control={contractForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract Title</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Employment Agreement" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={contractForm.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contract Content</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Contract terms and conditions..." 
                              className="min-h-[200px]"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="submit" disabled={createContractMutation.isPending}>
                        {createContractMutation.isPending ? 'Creating...' : 'Create Contract'}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* My Contracts (for employees) */}
      {!isManager && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>My Contracts</CardTitle>
            <CardDescription>Contracts assigned to you</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No contracts assigned to you
                    </TableCell>
                  </TableRow>
                ) : (
                  myContracts.map((contract: EmployeeContract) => (
                    <TableRow key={contract.id}>
                      <TableCell className="font-medium">{contract.title}</TableCell>
                      <TableCell>{getStatusBadge(contract)}</TableCell>
                      <TableCell>
                        {contract.sentDate ?
                          format(new Date(contract.sentDate), 'MMM dd, yyyy') :
                          '-'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedContract(contract)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {['SENT', 'VIEWED'].includes(contract.status) && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedContract(contract);
                                setIsSignDialogOpen(true);
                              }}
                            >
                              <PenTool className="h-4 w-4 mr-1" />
                              Sign
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Stats cards - managers only */}
      {isManager && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft Contracts</CardTitle>
              <Edit className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{draftContracts.length}</div>
              <p className="text-xs text-muted-foreground">Ready to send</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Signature</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingContracts.length}</div>
              <p className="text-xs text-muted-foreground">Awaiting response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Signed Contracts</CardTitle>
              <Check className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{signedContracts.length}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* All Contracts and Templates tabs - managers only */}
      {isManager && (
      <Tabs defaultValue="contracts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="contracts">All Contracts</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <CardTitle>Employee Contracts</CardTitle>
              <CardDescription>All contracts in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by name, email, or contract title"
                    value={contractSearch}
                    onChange={(event) => setContractSearch(event.target.value)}
                  />
                </div>
                <div className="w-full md:w-56">
                  <Select
                    value={contractStatusFilter}
                    onValueChange={(value) => setContractStatusFilter(value as typeof contractStatusFilter)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="signed">Signed</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="rescinded">Rescinded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Contract</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Signed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract: EmployeeContract) => {
                    return (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">
                          {contract.recipientName || 'Unknown'}
                        </TableCell>
                        <TableCell>{contract.title}</TableCell>
                        <TableCell>{getStatusBadge(contract)}</TableCell>
                        <TableCell>
                          {format(new Date(contract.createdAt), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          {contract.signedDate ? 
                            format(new Date(contract.signedDate), 'MMM dd, yyyy') : 
                            '-'
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {contract.status === 'DRAFT' && isManager && (
                              <Button
                                size="sm"
                                onClick={() => sendContract(contract.id)}
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            {['DRAFT', 'SENT', 'VIEWED'].includes(contract.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditContract(contract)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedContract(contract)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {['SENT', 'VIEWED'].includes(contract.status) && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  const reason = prompt('Reason for rescinding this offer?');
                                  if (reason) {
                                    rescindContractMutation.mutate({ id: contract.id, reason });
                                  }
                                }}
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
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>Contract Templates</CardTitle>
              <CardDescription>Reusable contract templates</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Template Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Territory</TableHead>
                    <TableHead>Variables</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!templatesLoading && templates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No templates found
                      </TableCell>
                    </TableRow>
                  ) : (
                    templates.map((template: ContractTemplate) => {
                      const territory = territories.find((t: any) => t.id === template.territory);
                    
                    return (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{template.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {territory ? territory.name : 'All territories'}
                        </TableCell>
                        <TableCell>
                          {template.variables && template.variables.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {template.variables.slice(0, 3).map((v, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {v}
                                </Badge>
                              ))}
                              {template.variables.length > 3 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{template.variables.length - 3}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {template.fileUrl ? (
                            <a 
                              href={template.fileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center hover:underline"
                            >
                              <Badge variant="outline" className="cursor-pointer">
                                <File className="h-3 w-3 mr-1" />
                                {template.fileName || 'PDF'}
                              </Badge>
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={template.isActive ? 'default' : 'secondary'}>
                            {template.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(template.createdAt), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedTemplate(template)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {isManager && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  // Pre-fill form with template data for editing
                                  templateForm.setValue('name', template.name);
                                  templateForm.setValue('type', template.type as 'EMPLOYMENT' | 'NDA' | 'CONTRACTOR' | 'OTHER' | 'RETAIL');
                                  templateForm.setValue('territory', template.territory || '');
                                  templateForm.setValue('content', template.content);
                                  templateForm.setValue('variables', template.variables || []);
                                  setIsTemplateDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      )}

      {/* View Template Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              Template Type: {selectedTemplate?.type}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Content:</h4>
              <pre className="whitespace-pre-wrap bg-muted p-4 rounded">{selectedTemplate?.content}</pre>
            </div>
            {selectedTemplate?.fileName || selectedTemplate?.fileUrl ? (
              <div className="space-y-2">
                <h4 className="font-medium">PDF Preview:</h4>
                <iframe
                  title="Template PDF"
                  src={selectedTemplate?.fileUrl || `/attached_assets/contract_templates/${selectedTemplate?.fileName}`}
                  className="w-full h-[480px] border rounded"
                />
                <div>
                  <a
                    href={selectedTemplate?.fileUrl || `/attached_assets/contract_templates/${selectedTemplate?.fileName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 hover:underline"
                  >
                    <File className="h-4 w-4 mr-2" />
                    Download Template PDF
                  </a>
                </div>
              </div>
            ) : null}
            {selectedTemplate?.variables && selectedTemplate.variables.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Variables:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedTemplate.variables.map((variable, idx) => (
                    <Badge key={idx} variant="secondary">{variable}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Contract Dialog */}
      <Dialog open={!!selectedContract} onOpenChange={(open) => !open && setSelectedContract(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedContract?.title}</DialogTitle>
            <DialogDescription>
              Status: {selectedContract?.status}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Content:</h4>
              <pre className="whitespace-pre-wrap bg-muted p-4 rounded">{selectedContract?.content}</pre>
              {selectedContract?.fileUrl && (
                <div className="mt-4">
                  <a
                    href={selectedContract.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-blue-600 hover:underline"
                  >
                    <File className="h-4 w-4 mr-2" />
                    Download Contract PDF
                  </a>
                </div>
              )}
            </div>
            {selectedContract?.status === 'SENT' && selectedContract?.employeeId === currentUser?.id && (
              <DialogFooter>
                <Button onClick={() => {
                  setIsSignDialogOpen(true);
                }}>
                  Sign Contract
                </Button>
              </DialogFooter>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign Contract Dialog */}
      <Dialog open={isSignDialogOpen} onOpenChange={setIsSignDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              Sign Contract
            </DialogTitle>
            <DialogDescription>
              Please type your full legal name and confirm the date to electronically sign this contract
            </DialogDescription>
          </DialogHeader>
          {selectedContract?.fileUrl && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <a
                href={selectedContract.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-blue-600 hover:underline"
              >
                <File className="h-4 w-4 mr-2" />
                View contract PDF
              </a>
            </div>
          )}
          <Form {...signatureForm}>
            <form onSubmit={signatureForm.handleSubmit(onSubmitSignature)} className="space-y-4">
              <FormField
                control={signatureForm.control}
                name="signature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type your full legal name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., John Michael Smith"
                        className="text-lg"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={signatureForm.control}
                name="signatureAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mailing address</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Street address, city, state, ZIP"
                        className="min-h-[90px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={signatureForm.control}
                name="signatureDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Date
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={signatureForm.control}
                name="agreeToSign"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/50">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="cursor-pointer">
                        I agree that typing my name constitutes a legal electronic signature
                      </FormLabel>
                      <FormDescription>
                        This signature will be legally binding
                      </FormDescription>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (selectedContract) {
                      const reason = prompt('Please provide a reason for rejection:');
                      if (reason) {
                        rejectContractMutation.mutate({
                          id: selectedContract.id,
                          reason
                        });
                        setIsSignDialogOpen(false);
                      }
                    }
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button type="submit" disabled={signContractMutation.isPending || !signatureForm.watch('agreeToSign')}>
                  <Check className="h-4 w-4 mr-2" />
                  {signContractMutation.isPending ? 'Signing...' : 'Sign Contract'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Contract Dialog (Manager) */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) {
          setEditContract(null);
        }
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Contract</DialogTitle>
            <DialogDescription>
              Update dates or details and regenerate the PDF if needed.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSubmitEditContract)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="contractorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recipient Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="effectiveDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Effective Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contract Content</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-[200px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateContractMutation.isPending}>
                  {updateContractMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
