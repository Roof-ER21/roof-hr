import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
import { FileText, Send, Eye, Check, X, PenTool, Plus, Edit, Upload, File, Trash2 } from 'lucide-react';
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
  content: z.string().min(1, 'Contract content is required')
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
  signature: z.string().min(1, 'Signature is required')
});

export default function Contracts() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
  const [isSignDialogOpen, setIsSignDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<EmployeeContract | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [variableInput, setVariableInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      signature: ''
    }
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/contract-templates'],
    queryFn: async () => {
      const response = await fetch('/api/contract-templates', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      console.log('Templates fetched:', data);
      return data;
    }
  });

  const { data: contracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['/api/employee-contracts'],
  });

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
  });

  const { data: candidates = [] } = useQuery({
    queryKey: ['/api/candidates'],
  });

  const { data: territories = [] } = useQuery({
    queryKey: ['/api/territories'],
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

  const updateContractMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<EmployeeContract> }) => 
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
    mutationFn: (data: { id: string; signature: string }) => 
      apiRequest(`/api/employee-contracts/${data.id}/sign`, {
        method: 'POST',
        body: JSON.stringify({ signature: data.signature }),
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

  const onSubmitTemplate = (data: z.infer<typeof templateFormSchema>) => {
    createTemplateMutation.mutate(data);
  };

  const onSubmitContract = (data: z.infer<typeof contractFormSchema>) => {
    createContractMutation.mutate(data);
  };

  const onSubmitSignature = (data: z.infer<typeof signatureFormSchema>) => {
    if (selectedContract) {
      signContractMutation.mutate({
        id: selectedContract.id,
        signature: data.signature
      });
    }
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

  const getStatusBadge = (status: string) => {
    const statusMap: { [key: string]: { variant: any; label: string } } = {
      DRAFT: { variant: 'secondary', label: 'Draft' },
      SENT: { variant: 'outline', label: 'Sent' },
      VIEWED: { variant: 'outline', label: 'Viewed' },
      SIGNED: { variant: 'default', label: 'Signed' },
      REJECTED: { variant: 'destructive', label: 'Rejected' }
    };
    
    const config = statusMap[status] || { variant: 'secondary', label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Debug the current user role  
  console.log('Auth currentUser:', currentUser);
  console.log('Auth currentUser role:', currentUser?.role);
  
  // Check if user has manager permissions - make sure Ahmed (ADMIN) always has access
  const isManager = currentUser?.role && ['ADMIN', 'MANAGER', 'GENERAL_MANAGER', 'TRUE_ADMIN', 'TERRITORY_SALES_MANAGER'].includes(currentUser.role);
  console.log('isManager:', isManager);

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

            <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
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
                              } else {
                                field.onChange(value);
                                const template = templates.find((t: ContractTemplate) => t.id === value);
                                if (template) {
                                  contractForm.setValue('title', template.name);
                                  contractForm.setValue('content', template.content);
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
      {!isManager && myContracts.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>My Contracts</CardTitle>
            <CardDescription>Contracts requiring your review or signature</CardDescription>
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
                {myContracts.map((contract: EmployeeContract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-medium">{contract.title}</TableCell>
                    <TableCell>{getStatusBadge(contract.status)}</TableCell>
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
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                  {contracts.map((contract: EmployeeContract) => {
                    const employee = users.find((u: User) => u.id === contract.employeeId);
                    
                    return (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">
                          {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'}
                        </TableCell>
                        <TableCell>{contract.title}</TableCell>
                        <TableCell>{getStatusBadge(contract.status)}</TableCell>
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedContract(contract)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
                          {template.variables?.length > 0 ? (
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
                                  templateForm.setValue('type', template.type as any);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign Contract</DialogTitle>
            <DialogDescription>
              Please enter your full name as your electronic signature
            </DialogDescription>
          </DialogHeader>
          <Form {...signatureForm}>
            <form onSubmit={signatureForm.handleSubmit(onSubmitSignature)} className="space-y-4">
              <FormField
                control={signatureForm.control}
                name="signature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Electronic Signature</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Type your full name" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      By typing your name, you agree to the terms of the contract
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
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
                  Reject
                </Button>
                <Button type="submit" disabled={signContractMutation.isPending}>
                  {signContractMutation.isPending ? 'Signing...' : 'Sign Contract'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}