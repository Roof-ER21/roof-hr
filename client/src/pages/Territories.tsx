import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
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
import { MapPin, Users, Plus, Edit2, Trash2, UserPlus } from 'lucide-react';
import { insertTerritorySchema } from '@/../../shared/schema';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import type { User, Territory } from '@/../../shared/schema';

const formSchema = insertTerritorySchema.extend({
  name: z.string().min(1, 'Territory name is required'),
  region: z.string().min(1, 'Region is required'),
  description: z.string().optional(),
  salesManagerId: z.string().optional(),
  isActive: z.boolean().default(true)
});

export default function Territories() {
  const { toast } = useToast();
  const [selectedTerritory, setSelectedTerritory] = useState<Territory | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      region: '',
      description: '',
      salesManagerId: '',
      isActive: true
    }
  });



  const { data: territories = [], isLoading: territoriesLoading, error: territoriesError } = useQuery({
    queryKey: ['/api/territories'],
    retry: 1,
    queryFn: async () => {
      const response = await fetch('/api/territories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch territories');
      }
      const data = await response.json();
      return data;
    }
  });

  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      return response.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) => 
      apiRequest('/api/territories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/territories'] });
      await queryClient.refetchQueries({ queryKey: ['/api/territories'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Territory created successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create territory',
        variant: 'destructive',
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<Territory> }) => 
      apiRequest(`/api/territories/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify(data.updates),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/territories'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/users'] })
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/territories'] }),
        queryClient.refetchQueries({ queryKey: ['/api/users'] })
      ]);
      setIsEditDialogOpen(false);
      setSelectedTerritory(null);
      form.reset();
      toast({
        title: 'Success',
        description: 'Territory updated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update territory',
        variant: 'destructive',
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest(`/api/territories/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/territories'] });
      toast({
        title: 'Success',
        description: 'Territory deleted successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete territory',
        variant: 'destructive',
      });
    }
  });

  const assignUserMutation = useMutation({
    mutationFn: (data: { territoryId: string; userId: string }) => 
      apiRequest(`/api/territories/${data.territoryId}/assign-user`, {
        method: 'POST',
        body: JSON.stringify({ userId: data.userId }),
      }),
    onSuccess: async () => {
      // Invalidate and refetch both queries to ensure UI updates
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['/api/territories'] }),
        queryClient.invalidateQueries({ queryKey: ['/api/users'] })
      ]);
      // Force refetch to ensure fresh data
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['/api/territories'] }),
        queryClient.refetchQueries({ queryKey: ['/api/users'] })
      ]);
      setIsAssignDialogOpen(false);
      setSelectedUserId('');
      toast({
        title: 'Success',
        description: 'User assigned to territory successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to assign user',
        variant: 'destructive',
      });
    }
  });

  const onSubmitCreate = (data: z.infer<typeof formSchema>) => {
    // Convert "none" to null for salesManagerId
    const submitData = {
      ...data,
      salesManagerId: data.salesManagerId === 'none' ? null : data.salesManagerId
    };
    createMutation.mutate(submitData);
  };

  const onSubmitEdit = (data: z.infer<typeof formSchema>) => {
    if (selectedTerritory) {
      // Convert "none" to null for salesManagerId
      const submitData = {
        ...data,
        salesManagerId: data.salesManagerId === 'none' ? null : data.salesManagerId
      };
      updateMutation.mutate({
        id: selectedTerritory.id,
        updates: submitData
      });
    }
  };

  const openEditDialog = (territory: Territory) => {
    setSelectedTerritory(territory);
    form.reset({
      name: territory.name,
      region: territory.region,
      description: territory.description || '',
      salesManagerId: territory.salesManagerId || '',
      isActive: territory.isActive
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this territory?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAssignUser = () => {
    if (selectedTerritory && selectedUserId) {
      assignUserMutation.mutate({
        territoryId: selectedTerritory.id,
        userId: selectedUserId
      });
    }
  };

  const salesManagers = users.filter((user: User) => 
    user.role === 'TERRITORY_SALES_MANAGER' || 
    user.role === 'MANAGER' || 
    user.role === 'ADMIN' ||
    user.role === 'GENERAL_MANAGER'
  );

  const unassignedUsers = users.filter((user: User) => !user.territoryId);

  if (territoriesLoading) {
    return <div className="flex items-center justify-center h-64">Loading territories...</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Territory Management</h1>
          <p className="text-muted-foreground mt-2">Manage sales territories and assignments</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Territory
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Create New Territory</DialogTitle>
              <DialogDescription>
                Add a new sales territory to the system
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Territory Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., DMV Territory" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Mid-Atlantic" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Territory description..." 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salesManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sales Manager</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a sales manager" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {salesManagers.map((user: User) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.firstName} {user.lastName} ({user.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Is this territory currently active?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Territory'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {territories && territories.length > 0 ? (
          territories.map((territory: Territory) => {
            const manager = users.find((u: User) => u.id === territory.salesManagerId);
            const territoryUsers = users.filter((u: User) => u.territoryId === territory.id);
          
          return (
            <Card key={territory.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      {territory.name}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {territory.region}
                    </CardDescription>
                  </div>
                  <Badge variant={territory.isActive ? 'default' : 'secondary'}>
                    {territory.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {territory.description && (
                    <p className="text-sm text-muted-foreground">{territory.description}</p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Sales Manager:</span>{' '}
                      {manager ? (
                        <span>{manager.firstName} {manager.lastName}</span>
                      ) : (
                        <span className="text-muted-foreground">Not assigned</span>
                      )}
                    </div>
                    
                    <div className="text-sm">
                      <span className="font-medium">Employees:</span>{' '}
                      <Badge variant="outline" className="ml-1">
                        <Users className="h-3 w-3 mr-1" />
                        {territoryUsers.length}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(territory)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedTerritory(territory);
                        setIsAssignDialogOpen(true);
                      }}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(territory.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      ) : (
        <div className="text-center text-muted-foreground">No territories found</div>
      )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Territory</DialogTitle>
            <DialogDescription>
              Update territory information
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEdit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Territory Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salesManagerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sales Manager</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {salesManagers.map((user: User) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active</FormLabel>
                      <FormDescription>
                        Is this territory currently active?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Updating...' : 'Update Territory'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User to Territory</DialogTitle>
            <DialogDescription>
              Select a user to assign to {selectedTerritory?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="user">Select User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedUsers.map((user: User) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} - {user.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAssignUser}
              disabled={!selectedUserId || assignUserMutation.isPending}
            >
              {assignUserMutation.isPending ? 'Assigning...' : 'Assign User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}