import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  UserPlus, Search, Edit, Trash2, Users, Building, Calendar,
  Phone, Mail, MapPin, Clock, TrendingUp, Award, Filter,
  Download, Upload, MoreVertical, Eye, Key, AlertTriangle, Send,
  ArrowDownAZ, ArrowUpZA
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PasswordResetDialog } from '@/components/password-reset-dialog';
import { SendWelcomeDialog } from '@/components/employees/send-welcome-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DEPARTMENTS } from '@/../../shared/constants/departments';

// Role display names mapping
const roleDisplayNames: Record<string, string> = {
  'TRUE_ADMIN': 'Super Admin',
  'ADMIN': 'Admin',
  'GENERAL_MANAGER': 'General Manager',
  'TERRITORY_SALES_MANAGER': 'Sales Manager',
  'MANAGER': 'Manager',
  'EMPLOYEE': 'Employee',
  'CONTRACTOR': 'Contractor',
  'SALES_REP': 'Sales Rep',
  'FIELD_TECH': 'Field Tech'
};

const employeeSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['TRUE_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'TERRITORY_SALES_MANAGER', 'MANAGER', 'EMPLOYEE', 'CONTRACTOR', 'SALES_REP', 'FIELD_TECH']),
  employmentType: z.enum(['W2', 'CONTRACTOR']),
  department: z.string().min(1),
  position: z.string().min(1),
  hireDate: z.string(),
  terminationDate: z.string().optional().nullable(),
  phone: z.string().optional(),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  shirtSize: z.enum(['S', 'M', 'L', 'XL', 'XXL', '3X']).optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  employmentType: string;
  department: string;
  position: string;
  hireDate: string;
  terminationDate?: string | null;
  isActive: boolean;
  phone?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  shirtSize?: string;
  createdAt: string;
  updatedAt: string;
}

function EnhancedEmployees() {
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'analytics'>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordResetEmployee, setPasswordResetEmployee] = useState<Employee | null>(null);
  const [createdEmployee, setCreatedEmployee] = useState<Employee | null>(null);
  const [showCreatedProfile, setShowCreatedProfile] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [showWelcomeDialog, setShowWelcomeDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
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
      terminationDate: null,
      phone: '',
      address: '',
      emergencyContact: '',
      emergencyPhone: '',
      shirtSize: undefined,
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
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create employee');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      form.reset();
      
      // Show success message with email status
      toast({
        title: "Employee Created Successfully",
        description: data.message || "Employee account has been created."
      });
      
      // Show the created employee profile
      if (data.user) {
        setCreatedEmployee(data.user);
        setShowCreatedProfile(true);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EmployeeFormData> }) => {
      // If termination date is set, mark as inactive
      const updatedData = {
        ...data,
        isActive: data.terminationDate ? false : true
      };
      
      const response = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updatedData)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update employee');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      setSelectedEmployee(null);
      form.reset();
      toast({
        title: "Success",
        description: "Employee updated successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete employee');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
      toast({
        title: "Success",
        description: "Employee deleted successfully"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const onSubmit = (data: EmployeeFormData) => {
    if (selectedEmployee) {
      // Update existing employee
      updateEmployeeMutation.mutate({ id: selectedEmployee.id, data });
    } else {
      // Create new employee with generated password
      // Generate a more secure temporary password
      const randomNumbers = Math.floor(Math.random() * 9000) + 1000;
      const defaultPassword = `${data.firstName.charAt(0).toUpperCase()}${data.lastName.toLowerCase()}${randomNumbers}!`;
      createEmployeeMutation.mutate({ ...data, password: defaultPassword });
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    form.reset({
      email: employee.email,
      firstName: employee.firstName,
      lastName: employee.lastName,
      role: employee.role as any,
      employmentType: employee.employmentType as any,
      department: employee.department,
      position: employee.position,
      hireDate: employee.hireDate.split('T')[0], // Format for date input
      terminationDate: employee.terminationDate ? employee.terminationDate.split('T')[0] : null,
      phone: employee.phone || '',
      address: employee.address || '',
      emergencyContact: employee.emergencyContact || '',
      emergencyPhone: employee.emergencyPhone || '',
      shirtSize: employee.shirtSize as any || undefined,
    });
    setIsDialogOpen(true);
  };

  const handleAddEmployee = () => {
    setSelectedEmployee(null);
    form.reset();
    setIsDialogOpen(true);
  };

  const handleDeleteEmployee = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (employeeToDelete) {
      deleteEmployeeMutation.mutate(employeeToDelete.id);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/users/export', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Success",
        description: "Employees exported successfully"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export employees",
        variant: "destructive"
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      
      const data = lines.slice(1).filter(line => line.trim()).map(line => {
        const values = line.match(/(".*?"|[^,]+)/g) || [];
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.replace(/"/g, '').trim() || '';
        });
        return row;
      });
      
      const response = await fetch('/api/users/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ data })
      });
      
      if (!response.ok) throw new Error('Import failed');
      
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      
      toast({
        title: "Import Complete",
        description: `Successfully imported ${result.success} employees. ${result.failed > 0 ? `Failed: ${result.failed}` : ''}`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to import employees",
        variant: "destructive"
      });
    }
    
    // Reset the file input
    event.target.value = '';
  };

  // Filter and sort employees
  const filteredEmployees = employees
    .filter((employee: Employee) => {
      const matchesSearch =
        employee.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.position.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDepartment = departmentFilter === 'ALL' || employee.department === departmentFilter;
      const matchesRole = roleFilter === 'ALL' || employee.role === roleFilter;

      return matchesSearch && matchesDepartment && matchesRole;
    })
    .sort((a: Employee, b: Employee) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

  // Get unique departments and calculate analytics
  const departments = Array.from(new Set(employees.map((emp: Employee) => emp.department)));
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((emp: Employee) => emp.isActive).length;
  const departmentStats = departments.map(dept => ({
    name: dept,
    count: employees.filter((emp: Employee) => emp.department === dept).length,
    percentage: Math.round((employees.filter((emp: Employee) => emp.department === dept).length / totalEmployees) * 100)
  }));

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const getRoleColor = (role: string) => {
    const colors = {
      'ADMIN': 'bg-purple-100 text-purple-800',
      'MANAGER': 'bg-blue-100 text-blue-800',
      'EMPLOYEE': 'bg-gray-100 text-gray-800',
      'CONTRACTOR': 'bg-yellow-100 text-yellow-800'
    };
    return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return <div className="p-8">Loading employees...</div>;
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Employee Management</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Comprehensive employee directory with {totalEmployees} total employees
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <label htmlFor="import-file" className="inline-flex">
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </span>
            </Button>
            <input
              id="import-file"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImport}
            />
          </label>
          <Button variant="outline" onClick={() => setShowWelcomeDialog(true)}>
            <Send className="w-4 h-4 mr-2" />
            Send Welcome Emails
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) {
              setSelectedEmployee(null);
              form.reset();
            }
            setIsDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button onClick={handleAddEmployee}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedEmployee ? 'Edit Employee' : 'Add New Employee'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      {...form.register('firstName')}
                      placeholder="Enter first name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      {...form.register('lastName')}
                      placeholder="Enter last name"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register('email')}
                    placeholder="employee@roof-er.com"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="role">Role *</Label>
                    <Select 
                      value={form.watch('role')} 
                      onValueChange={(value) => form.setValue('role', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EMPLOYEE">Employee</SelectItem>
                        <SelectItem value="SALES_REP">Sales Rep</SelectItem>
                        <SelectItem value="FIELD_TECH">Field Tech</SelectItem>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="TERRITORY_SALES_MANAGER">Sales Manager</SelectItem>
                        <SelectItem value="GENERAL_MANAGER">General Manager</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="TRUE_ADMIN">Super Admin</SelectItem>
                        <SelectItem value="CONTRACTOR">Contractor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="employmentType">Employment Type *</Label>
                    <Select 
                      value={form.watch('employmentType')} 
                      onValueChange={(value) => form.setValue('employmentType', value as any)}
                    >
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
                    <Label htmlFor="department">Department *</Label>
                    <Select
                      value={form.watch('department')}
                      onValueChange={(value) => form.setValue('department', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="position">Position *</Label>
                    <Input
                      id="position"
                      {...form.register('position')}
                      placeholder="Enter job position"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hireDate">Hire Date *</Label>
                    <Input
                      id="hireDate"
                      type="date"
                      {...form.register('hireDate')}
                    />
                  </div>
                  <div>
                    <Label htmlFor="terminationDate">
                      Termination Date 
                      {form.watch('terminationDate') && (
                        <span className="ml-2 text-xs text-red-600">(Will mark as inactive)</span>
                      )}
                    </Label>
                    <Input
                      id="terminationDate"
                      type="date"
                      {...form.register('terminationDate')}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      {...form.register('phone')}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      {...form.register('address')}
                      placeholder="Enter full address"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="shirtSize">Shirt Size</Label>
                    <Select 
                      value={form.watch('shirtSize') || ''} 
                      onValueChange={(value) => form.setValue('shirtSize', value as any)}
                    >
                      <SelectTrigger>
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
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      {...form.register('address')}
                      placeholder="Enter full address"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergencyContact">Emergency Contact</Label>
                    <Input
                      id="emergencyContact"
                      {...form.register('emergencyContact')}
                      placeholder="Contact name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergencyPhone">Emergency Phone</Label>
                    <Input
                      id="emergencyPhone"
                      {...form.register('emergencyPhone')}
                      placeholder="Emergency contact number"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsDialogOpen(false);
                    setSelectedEmployee(null);
                    form.reset();
                  }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}>
                    {selectedEmployee 
                      ? (updateEmployeeMutation.isPending ? 'Updating...' : 'Update Employee')
                      : (createEmployeeMutation.isPending ? 'Creating...' : 'Create Employee')
                    }
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Employees</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Active</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Building className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Departments</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{departments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center">
              <Award className="h-8 w-8 text-yellow-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">New This Month</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">3</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Employee Directory ({filteredEmployees.length})</CardTitle>
            <div className="flex gap-2">
              <Button 
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </Button>
              <Button 
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                List
              </Button>
              <Button 
                variant={viewMode === 'analytics' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('analytics')}
              >
                Analytics
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search employees by name, email, or position..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {departments.map((dept: string) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="SALES_REP">Sales Rep</SelectItem>
                <SelectItem value="FIELD_TECH">Field Tech</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="TERRITORY_SALES_MANAGER">Sales Manager</SelectItem>
                <SelectItem value="GENERAL_MANAGER">General Manager</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="TRUE_ADMIN">Super Admin</SelectItem>
                <SelectItem value="CONTRACTOR">Contractor</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="whitespace-nowrap"
            >
              {sortOrder === 'asc' ? (
                <>
                  <ArrowDownAZ className="w-4 h-4 mr-2" />
                  A-Z
                </>
              ) : (
                <>
                  <ArrowUpZA className="w-4 h-4 mr-2" />
                  Z-A
                </>
              )}
            </Button>
          </div>

          {viewMode === 'analytics' ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Department Distribution</h3>
                <div className="space-y-3">
                  {departmentStats.map((dept) => (
                    <div key={dept.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-24 text-sm font-medium">{dept.name}</div>
                        <div className="flex-1 min-w-[200px]">
                          <Progress value={dept.percentage} className="h-2" />
                        </div>
                      </div>
                      <div className="text-sm text-gray-600">
                        {dept.count} employees ({dept.percentage}%)
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEmployees.map((employee: Employee) => (
                <Card key={employee.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                            {getInitials(employee.firstName, employee.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {employee.firstName} {employee.lastName}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{employee.position}</p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Employee
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setPasswordResetEmployee(employee);
                            setShowPasswordReset(true);
                          }}>
                            <Key className="h-4 w-4 mr-2" />
                            Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteEmployee(employee)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Employee
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="h-4 w-4" />
                        {employee.email}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Building className="h-4 w-4" />
                        {employee.department}
                      </div>
                      {employee.phone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4" />
                          {employee.phone}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        Hired: {new Date(employee.hireDate).toLocaleDateString()}
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <Badge className={getRoleColor(employee.role)} variant="secondary">
                          {employee.role}
                        </Badge>
                        <Badge className={getStatusColor(employee.isActive)} variant="secondary">
                          {employee.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedEmployee(employee);
                            setShowProfile(true);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Employee
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setPasswordResetEmployee(employee);
                              setShowPasswordReset(true);
                            }}>
                              <Key className="h-4 w-4 mr-2" />
                              Reset Password
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteEmployee(employee)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Employee
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredEmployees.map((employee: Employee) => (
                <div key={employee.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                        {getInitials(employee.firstName, employee.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-sm text-gray-600">{employee.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">{employee.position}</div>
                    <div className="text-sm text-gray-600">{employee.department}</div>
                    <Badge className={getRoleColor(employee.role)} variant="secondary">
                      {employee.role}
                    </Badge>
                    <Badge className={getStatusColor(employee.isActive)} variant="secondary">
                      {employee.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setSelectedEmployee(employee);
                          setShowProfile(true);
                        }}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditEmployee(employee)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Employee
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setPasswordResetEmployee(employee);
                          setShowPasswordReset(true);
                        }}>
                          <Key className="h-4 w-4 mr-2" />
                          Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDeleteEmployee(employee)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Employee
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Profile Modal */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Profile</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              <div className="flex items-start gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-xl">
                    {getInitials(selectedEmployee.firstName, selectedEmployee.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </h2>
                  <p className="text-lg text-gray-600 dark:text-gray-300">{selectedEmployee.position}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge className={getRoleColor(selectedEmployee.role)} variant="secondary">
                      {selectedEmployee.role}
                    </Badge>
                    <Badge className={getStatusColor(selectedEmployee.isActive)} variant="secondary">
                      {selectedEmployee.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </div>

              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="contact">Contact</TabsTrigger>
                  <TabsTrigger value="employment">Employment</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</Label>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedEmployee.email}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Department</Label>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedEmployee.department}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Hire Date</Label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {new Date(selectedEmployee.hireDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Employment Type</Label>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedEmployee.employmentType}</p>
                    </div>
                    {selectedEmployee.shirtSize && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Shirt Size</Label>
                        <p className="text-sm text-gray-900 dark:text-white">{selectedEmployee.shirtSize}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="contact" className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {selectedEmployee.phone && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</Label>
                        <p className="text-sm text-gray-900 dark:text-white">{selectedEmployee.phone}</p>
                      </div>
                    )}
                    {selectedEmployee.address && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</Label>
                        <p className="text-sm text-gray-900 dark:text-white">{selectedEmployee.address}</p>
                      </div>
                    )}
                    {selectedEmployee.emergencyContact && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Emergency Contact</Label>
                        <p className="text-sm text-gray-900 dark:text-white">{selectedEmployee.emergencyContact}</p>
                      </div>
                    )}
                    {selectedEmployee.emergencyPhone && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Emergency Phone</Label>
                        <p className="text-sm text-gray-900 dark:text-white">{selectedEmployee.emergencyPhone}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="employment" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Employee ID</Label>
                      <p className="text-sm text-gray-900 dark:text-white font-mono">{selectedEmployee.id}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Account Created</Label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {new Date(selectedEmployee.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</Label>
                      <p className="text-sm text-gray-900 dark:text-white">
                        {new Date(selectedEmployee.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</Label>
                      <Badge className={getStatusColor(selectedEmployee.isActive)} variant="secondary">
                        {selectedEmployee.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Created Employee Profile Dialog */}
      <Dialog open={showCreatedProfile} onOpenChange={setShowCreatedProfile}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-green-600" />
              Employee Created Successfully
            </DialogTitle>
          </DialogHeader>
          {createdEmployee && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-medium mb-2">Welcome Email Sent!</p>
                <p className="text-green-700 text-sm">
                  A welcome email with login credentials has been sent to <strong>{createdEmployee.email}</strong>
                </p>
                <p className="text-green-600 text-xs mt-2">
                  The employee can now login using their email address and the temporary password provided in the email.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Full Name</Label>
                  <p className="text-sm text-gray-900 font-medium">
                    {createdEmployee.firstName} {createdEmployee.lastName}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Email (Login)</Label>
                  <p className="text-sm text-gray-900">{createdEmployee.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Department</Label>
                  <p className="text-sm text-gray-900">{createdEmployee.department}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Position</Label>
                  <p className="text-sm text-gray-900">{createdEmployee.position}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Role</Label>
                  <Badge className={getRoleColor(createdEmployee.role)}>
                    {createdEmployee.role}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Employment Type</Label>
                  <Badge variant="outline">{createdEmployee.employmentType}</Badge>
                </div>
                {createdEmployee.hireDate && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Start Date</Label>
                    <p className="text-sm text-gray-900">
                      {new Date(createdEmployee.hireDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {createdEmployee.shirtSize && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Shirt Size</Label>
                    <p className="text-sm text-gray-900">{createdEmployee.shirtSize}</p>
                  </div>
                )}
              </div>

              {(createdEmployee.phone || createdEmployee.address) && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {createdEmployee.phone && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Phone</Label>
                        <p className="text-sm text-gray-900">{createdEmployee.phone}</p>
                      </div>
                    )}
                    {createdEmployee.address && (
                      <div>
                        <Label className="text-sm font-medium text-gray-500">Address</Label>
                        <p className="text-sm text-gray-900">{createdEmployee.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t pt-4 flex justify-end">
                <Button
                  onClick={() => {
                    setShowCreatedProfile(false);
                    setCreatedEmployee(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      {passwordResetEmployee && (
        <PasswordResetDialog
          isOpen={showPasswordReset}
          onClose={() => {
            setShowPasswordReset(false);
            setPasswordResetEmployee(null);
          }}
          employee={passwordResetEmployee}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
            <AlertDialogDescription>
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <p>Are you sure you want to permanently delete this employee?</p>
                  {employeeToDelete && (
                    <div className="mt-3 p-3 bg-gray-50 rounded">
                      <p className="font-semibold">
                        {employeeToDelete.firstName} {employeeToDelete.lastName}
                      </p>
                      <p className="text-sm text-gray-600">{employeeToDelete.email}</p>
                      <p className="text-sm text-gray-600">{employeeToDelete.position}</p>
                    </div>
                  )}
                  <p className="mt-3 text-sm text-red-600">
                    This action cannot be undone. All employee data will be permanently removed.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEmployeeToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Employee
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Welcome Email Dialog */}
      <SendWelcomeDialog
        open={showWelcomeDialog}
        onOpenChange={setShowWelcomeDialog}
        employees={employees.map((emp: Employee) => ({
          id: emp.id,
          email: emp.email,
          firstName: emp.firstName,
          lastName: emp.lastName,
          position: emp.position,
          department: emp.department
        }))}
      />
    </div>
  );
}

export default EnhancedEmployees;