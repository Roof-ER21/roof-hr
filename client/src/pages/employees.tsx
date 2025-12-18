import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Search, Edit, Trash2, RefreshCw, Upload, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const employeeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['ADMIN', 'MANAGER', 'EMPLOYEE', 'CONTRACTOR']),
  employmentType: z.enum(['W2', 'CONTRACTOR']),
  department: z.string().min(1),
  position: z.string().min(1),
  hireDate: z.string(),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

function Employees() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch employees');
      return response.json();
    }
  });

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      email: '',
      firstName: '',
      lastName: '',
      role: 'EMPLOYEE',
      employmentType: 'W2',
      department: '',
      position: '',
      hireDate: '',
      phone: '',
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
    }
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: EmployeeFormData & { password: string }) => {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create employee');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Employee created successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to create employee',
        variant: 'destructive'
      });
    }
  });

  // Sync with Google Sheets mutation
  const syncSheetsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/employees/sync-sheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to sync with Google Sheets');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Employee data synced with Google Sheets successfully'
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to sync with Google Sheets',
        variant: 'destructive'
      });
    }
  });

  // Import from Google Sheets mutation
  const importSheetsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/employees/import-sheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to import from Google Sheets');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Success',
        description: `Imported ${data.total || 0} employees from Google Sheets`
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to import from Google Sheets',
        variant: 'destructive'
      });
    }
  });

  const onSubmit = (data: EmployeeFormData) => {
    createEmployeeMutation.mutate({
      ...data,
      password: 'TempPass123!' // Temporary password
    });
  };

  const filteredEmployees = employees?.filter((employee: any) =>
    employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.position.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'MANAGER': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'EMPLOYEE': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'CONTRACTOR': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };

  if (isLoading) {
    return <div className="p-8">Loading employees...</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="sm:flex sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-secondary-950 dark:text-white">Employees</h1>
          <p className="mt-2 text-sm text-secondary-600 dark:text-white">
            Manage your team members and their information
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <Button
            variant="outline"
            onClick={() => importSheetsMutation.mutate()}
            disabled={importSheetsMutation.isPending}
            title="Import employee data from Google Sheets"
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
            title="Export employee data to Google Sheets"
          >
            {syncSheetsMutation.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Export to Sheets
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      {...form.register('firstName')}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      {...form.register('lastName')}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register('email')}
                    placeholder="Enter email address"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select onValueChange={(value) => form.setValue('role', value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMPLOYEE">Employee</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="employmentType">Employment Type</Label>
                    <Select onValueChange={(value) => form.setValue('employmentType', value as any)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="W2">W2 Employee</SelectItem>
                        <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      {...form.register('department')}
                      placeholder="Enter department"
                    />
                  </div>
                  <div>
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      {...form.register('position')}
                      placeholder="Enter position"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hireDate">Hire Date</Label>
                    <Input
                      id="hireDate"
                      type="date"
                      {...form.register('hireDate')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      {...form.register('phone')}
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    {...form.register('address')}
                    placeholder="Enter address"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergencyContact">Emergency Contact</Label>
                    <Input
                      id="emergencyContact"
                      {...form.register('emergencyContact')}
                      placeholder="Enter emergency contact"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone">Emergency Phone</Label>
                    <Input
                      id="emergencyPhone"
                      {...form.register('emergencyPhone')}
                      placeholder="Enter emergency phone"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createEmployeeMutation.isPending}>
                    {createEmployeeMutation.isPending ? 'Creating...' : 'Create Employee'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <CardTitle>All Employees ({filteredEmployees.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Employee</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-left py-3 px-4">Department</th>
                  <th className="text-left py-3 px-4">Employment Type</th>
                  <th className="text-left py-3 px-4">Hire Date</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee: any) => (
                  <tr key={employee.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-secondary-200 dark:bg-gray-700 rounded-full flex items-center justify-center mr-3">
                          <span className="text-sm font-medium text-secondary-700 dark:text-gray-200">
                            {employee.firstName?.[0]}{employee.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{employee.firstName} {employee.lastName}</div>
                          <div className="text-sm text-secondary-500 dark:text-white">{employee.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getRoleColor(employee.role)}>
                        {employee.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">{employee.department}</td>
                    <td className="py-3 px-4">{employee.employmentType}</td>
                    <td className="py-3 px-4">
                      {new Date(employee.hireDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={getStatusColor(employee.isActive)}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Employees;
