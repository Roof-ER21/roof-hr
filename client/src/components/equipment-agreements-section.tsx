import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { MANAGER_ROLES } from '@shared/constants/roles';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Package,
  Plus,
  Send,
  Eye,
  Copy,
  Trash2,
  Check,
  Clock,
  RefreshCw,
  Search,
  Users,
  AlertTriangle,
  CalendarDays
} from 'lucide-react';

interface EquipmentItem {
  name: string;
  quantity: number;
  received?: boolean;
}

interface EquipmentAgreement {
  id: string;
  employeeId?: string;
  employeeName: string;
  employeeEmail: string;
  employeeRole?: string;
  accessToken: string;
  tokenExpiry?: string;
  items: string;
  signatureData?: string;
  signedAt?: string;
  signatureIp?: string;
  status: 'PENDING' | 'SIGNED';
  sentBy?: string;
  sentAt?: string;
  createdAt: string;
}

interface RoleDefault {
  id: string;
  role: string;
  items: string;
  createdAt: string;
  updatedAt?: string;
}

const AVAILABLE_ROLES = [
  'SALES_REP',
  'FIELD_TECH',
  'EMPLOYEE',
  'MANAGER',
  'ADMIN'
];

const DEFAULT_EQUIPMENT_BY_ROLE: Record<string, EquipmentItem[]> = {
  'SALES_REP': [
    { name: 'iPad', quantity: 1 },
    { name: 'Keyboard', quantity: 1 },
    { name: 'Gray Polo', quantity: 2 },
    { name: 'Black Polo', quantity: 2 },
    { name: 'Gray Quarter Zip', quantity: 1 },
    { name: 'Black Quarter Zip', quantity: 1 },
  ],
  'FIELD_TECH': [
    { name: 'iPad', quantity: 1 },
    { name: 'Keyboard', quantity: 1 },
    { name: 'Ladder', quantity: 1 },
    { name: 'Flashlight Set', quantity: 1 },
    { name: 'Gray Polo', quantity: 2 },
    { name: 'Black Polo', quantity: 2 },
  ],
  'EMPLOYEE': [
    { name: 'Laptop/iPad', quantity: 1 },
    { name: 'Gray Polo', quantity: 1 },
    { name: 'Black Polo', quantity: 1 },
  ],
  'MANAGER': [
    { name: 'Laptop', quantity: 1 },
    { name: 'Gray Polo', quantity: 2 },
    { name: 'Black Polo', quantity: 2 },
  ],
  'ADMIN': [
    { name: 'Laptop', quantity: 1 },
  ],
};

export function EquipmentAgreementsSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState<EquipmentAgreement | null>(null);

  // Create agreement form state
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeEmail, setNewEmployeeEmail] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('EMPLOYEE');
  const [newEmployeeStartDate, setNewEmployeeStartDate] = useState('');
  const [newItems, setNewItems] = useState<EquipmentItem[]>(DEFAULT_EQUIPMENT_BY_ROLE['EMPLOYEE']);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);

  // Fetch agreements
  const { data: agreements = [], isLoading } = useQuery<EquipmentAgreement[]>({
    queryKey: ['/api/equipment-agreements'],
    queryFn: async () => {
      return apiRequest<EquipmentAgreement[]>('/api/equipment-agreements', { method: 'GET' });
    }
  });

  // Create agreement mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/equipment-agreements', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    onSuccess: (data: any) => {
      toast({
        title: 'Agreement Created',
        description: `Form link sent to ${newEmployeeEmail}`,
      });
      setShowCreateDialog(false);
      resetCreateForm();
      queryClient.invalidateQueries({ queryKey: ['/api/equipment-agreements'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create agreement',
        variant: 'destructive',
      });
    },
  });

  // Resend mutation
  const resendMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/equipment-agreements/${id}/resend`, {
      method: 'POST'
    }),
    onSuccess: () => {
      toast({
        title: 'Link Resent',
        description: 'A new agreement link has been sent',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment-agreements'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resend link',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/equipment-agreements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast({
        title: 'Agreement Deleted',
        description: 'The agreement has been removed',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/equipment-agreements'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete agreement',
        variant: 'destructive',
      });
    },
  });

  const resetCreateForm = () => {
    setNewEmployeeName('');
    setNewEmployeeEmail('');
    setNewEmployeeRole('EMPLOYEE');
    setNewEmployeeStartDate('');
    setNewItems(DEFAULT_EQUIPMENT_BY_ROLE['EMPLOYEE']);
    setNewItemName('');
    setNewItemQuantity(1);
  };

  const handleRoleChange = (role: string) => {
    setNewEmployeeRole(role);
    setNewItems(DEFAULT_EQUIPMENT_BY_ROLE[role] || []);
  };

  const handleAddItem = () => {
    if (newItemName.trim()) {
      setNewItems([...newItems, { name: newItemName.trim(), quantity: newItemQuantity }]);
      setNewItemName('');
      setNewItemQuantity(1);
    }
  };

  const handleRemoveItem = (index: number) => {
    setNewItems(newItems.filter((_, i) => i !== index));
  };

  const handleCreateAgreement = () => {
    if (!newEmployeeName.trim() || !newEmployeeEmail.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please provide employee name and email',
        variant: 'destructive',
      });
      return;
    }

    if (newItems.length === 0) {
      toast({
        title: 'No Items',
        description: 'Please add at least one equipment item',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate({
      employeeName: newEmployeeName,
      employeeEmail: newEmployeeEmail,
      employeeRole: newEmployeeRole,
      employeeStartDate: newEmployeeStartDate || null,
      items: newItems,
    });
  };

  const copyFormLink = (token: string) => {
    const link = `${window.location.origin}/equipment-agreement/${token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: 'Link Copied',
      description: 'The form link has been copied to clipboard',
    });
  };

  const parseItems = (itemsJson: string): EquipmentItem[] => {
    try {
      return JSON.parse(itemsJson);
    } catch {
      return [];
    }
  };

  // Get summary of received items (e.g., "3/5 received" or "5 items" for pending)
  const getReceivedSummary = (itemsJson: string | null): string => {
    if (!itemsJson) return '0 items';
    try {
      const parsedItems = JSON.parse(itemsJson);
      const total = parsedItems.length;
      const received = parsedItems.filter((item: EquipmentItem) => item.received === true).length;
      // Only show received count if agreement has been signed (has received data)
      if (parsedItems.some((item: EquipmentItem) => item.received !== undefined)) {
        return `${received}/${total} received`;
      }
      return `${total} items`;
    } catch {
      return '0 items';
    }
  };

  // Check if user is non-manager (restricted access)
  const isNonManager = !user?.role || !MANAGER_ROLES.includes(user.role);

  const filteredAgreements = agreements.filter(agreement => {
    // Non-managers only see their own agreements
    if (isNonManager) {
      const isOwnAgreement = agreement.employeeId === user?.id ||
                            agreement.employeeEmail?.toLowerCase() === user?.email?.toLowerCase();
      if (!isOwnAgreement) return false;
    }

    const matchesSearch = !searchTerm ||
      agreement.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agreement.employeeEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || agreement.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Use filtered agreements for stats so non-managers only see their own counts
  const statsAgreements = isNonManager ? filteredAgreements : agreements;
  const pendingCount = statsAgreements.filter(a => a.status === 'PENDING').length;
  const signedCount = statsAgreements.filter(a => a.status === 'SIGNED').length;

  const role = user?.role as string | undefined;
  const canManage = role === 'ADMIN' || role === 'MANAGER' || role === 'TRUE_ADMIN';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading agreements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{isNonManager ? 'My Agreements' : 'Total Agreements'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsAgreements.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Signature</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Signed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{signedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Equipment Agreements
            </CardTitle>
            {canManage && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Agreement
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="SIGNED">Signed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Agreements List */}
          {filteredAgreements.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No equipment agreements found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAgreements.map(agreement => {
                const items = parseItems(agreement.items);
                const isExpired = agreement.tokenExpiry && new Date(agreement.tokenExpiry) < new Date();

                return (
                  <Card key={agreement.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-full ${
                            agreement.status === 'SIGNED' ? 'bg-green-100' : 'bg-yellow-100'
                          }`}>
                            {agreement.status === 'SIGNED' ? (
                              <Check className="h-5 w-5 text-green-600" />
                            ) : (
                              <Clock className="h-5 w-5 text-yellow-600" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium">{agreement.employeeName}</h3>
                              {agreement.employeeRole && (
                                <Badge variant="outline">{agreement.employeeRole}</Badge>
                              )}
                              <Badge className={
                                agreement.status === 'SIGNED'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }>
                                {agreement.status}
                              </Badge>
                              {isExpired && agreement.status === 'PENDING' && (
                                <Badge variant="destructive">Expired</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{agreement.employeeEmail}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {getReceivedSummary(agreement.items)} • Created {new Date(agreement.createdAt).toLocaleDateString()}
                              {agreement.signedAt && ` • Signed ${new Date(agreement.signedAt).toLocaleDateString()}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowViewDialog(agreement)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>

                          {agreement.status === 'PENDING' && canManage && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyFormLink(agreement.accessToken)}
                              >
                                <Copy className="h-4 w-4 mr-1" />
                                Copy Link
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => resendMutation.mutate(agreement.id)}
                                disabled={resendMutation.isPending}
                              >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Resend
                              </Button>
                            </>
                          )}

                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this agreement?')) {
                                  deleteMutation.mutate(agreement.id);
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Agreement Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Equipment Agreement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Employee Name *</Label>
                <Input
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div className="space-y-2">
                <Label>Employee Email *</Label>
                <Input
                  type="email"
                  value={newEmployeeEmail}
                  onChange={(e) => setNewEmployeeEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newEmployeeRole} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_ROLES.map(role => (
                    <SelectItem key={role} value={role}>{role.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Role determines default equipment items</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Employee Start Date
              </Label>
              <Input
                type="date"
                value={newEmployeeStartDate}
                onChange={(e) => setNewEmployeeStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-gray-500">
                Agreement will be viewable but locked until this date. Employee will review equipment with their manager on their start date.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Equipment Items</Label>
              <div className="border dark:border-gray-600 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto bg-white dark:bg-gray-800">
                {newItems.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">No items added</p>
                ) : (
                  newItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-2 rounded">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {item.name} {item.quantity > 1 && `(x${item.quantity})`}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Add new item..."
                className="flex-1 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                onKeyPress={(e) => e.key === 'Enter' && handleAddItem()}
              />
              <Input
                type="number"
                min={1}
                value={newItemQuantity}
                onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)}
                className="w-20 dark:bg-gray-700 dark:text-white dark:border-gray-600"
              />
              <Button variant="outline" onClick={handleAddItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateAgreement}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Agreement Dialog */}
      <Dialog open={!!showViewDialog} onOpenChange={() => setShowViewDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Equipment Agreement Details</DialogTitle>
          </DialogHeader>
          {showViewDialog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Employee Name</Label>
                  <p className="font-medium">{showViewDialog.employeeName}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Email</Label>
                  <p className="font-medium">{showViewDialog.employeeEmail}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Role</Label>
                  <p className="font-medium">{showViewDialog.employeeRole || 'Not specified'}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Status</Label>
                  <Badge className={
                    showViewDialog.status === 'SIGNED'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }>
                    {showViewDialog.status}
                  </Badge>
                </div>
                {showViewDialog.signedAt && (
                  <>
                    <div>
                      <Label className="text-gray-500">Signed At</Label>
                      <p className="font-medium">
                        {new Date(showViewDialog.signedAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-gray-500">IP Address</Label>
                      <p className="font-medium">{showViewDialog.signatureIp || 'Unknown'}</p>
                    </div>
                  </>
                )}
              </div>

              <div>
                <Label className="text-gray-500">Equipment Items</Label>
                <div className="border rounded-lg p-3 mt-2 space-y-2">
                  {parseItems(showViewDialog.items).map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <span>{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          Qty: {item.quantity}
                        </span>
                        {item.received !== undefined && (
                          <Badge variant={item.received ? 'default' : 'destructive'}>
                            {item.received ? 'Received' : 'Not Received'}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {showViewDialog.signatureData && (
                <div>
                  <Label className="text-gray-500">Signature</Label>
                  <div className="border rounded-lg p-2 mt-2 bg-white">
                    <img
                      src={showViewDialog.signatureData}
                      alt="Signature"
                      className="max-h-24 mx-auto"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowViewDialog(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
