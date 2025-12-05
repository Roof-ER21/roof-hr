import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Plus, Edit, Trash2, Brain, Weight, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const criteriaSchema = z.object({
  name: z.string().min(1, 'Criteria name is required'),
  description: z.string().min(1, 'Description is required'),
  criteria: z.string().min(1, 'Criteria details are required'),
  weight: z.number().min(1).max(5),
  isActive: z.boolean(),
});

type CriteriaFormData = z.infer<typeof criteriaSchema>;

interface AICriteria {
  id: string;
  name: string;
  description: string;
  criteria: string[];
  weight: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

interface AICriteriaConfigProps {
  onClose?: () => void;
}

export default function AICriteriaConfig({ onClose }: AICriteriaConfigProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState<AICriteria | null>(null);

  const { data: aiCriteria = [], isLoading } = useQuery<AICriteria[]>({
    queryKey: ['/api/ai-criteria'],
  });

  const form = useForm<CriteriaFormData>({
    resolver: zodResolver(criteriaSchema),
    defaultValues: {
      name: '',
      description: '',
      criteria: '',
      weight: 3,
      isActive: true,
    },
  });

  const createCriteriaMutation = useMutation({
    mutationFn: async (data: CriteriaFormData) => {
      const criteriaArray = data.criteria.split('\n').filter(c => c.trim());
      const response = await apiRequest('/api/ai-criteria', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          criteria: criteriaArray,
        })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-criteria'] });
      toast({
        title: 'Success',
        description: 'AI criteria created successfully',
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error('Failed to create AI criteria:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to create AI criteria. Please check your input and try again.',
        variant: 'destructive'
      });
    },
  });

  const updateCriteriaMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CriteriaFormData }) => {
      const criteriaArray = data.criteria.split('\n').filter(c => c.trim());
      const response = await apiRequest(`/api/ai-criteria/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...data,
          criteria: criteriaArray,
        })
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-criteria'] });
      toast({
        title: 'Success',
        description: 'AI criteria updated successfully',
      });
      setIsDialogOpen(false);
      setEditingCriteria(null);
      form.reset();
    },
    onError: (error: any) => {
      console.error('Failed to update AI criteria:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to update AI criteria. Please check your input and try again.',
        variant: 'destructive'
      });
    },
  });

  const deleteCriteriaMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(`/api/ai-criteria/${id}`, {
        method: 'DELETE',
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-criteria'] });
      toast({
        title: 'Success',
        description: 'AI criteria deleted successfully',
      });
    },
    onError: (error: any) => {
      console.error('Failed to delete AI criteria:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete AI criteria. Please try again.',
        variant: 'destructive'
      });
    },
  });

  const handleEditCriteria = (criteria: AICriteria) => {
    setEditingCriteria(criteria);
    // Handle both array and string formats for backward compatibility
    const criteriaList = Array.isArray(criteria.criteria) 
      ? criteria.criteria 
      : (typeof criteria.criteria === 'string' ? JSON.parse(criteria.criteria) : []);
    form.reset({
      name: criteria.name,
      description: criteria.description,
      criteria: criteriaList.join('\n'),
      weight: criteria.weight,
      isActive: criteria.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: CriteriaFormData) => {
    if (editingCriteria) {
      updateCriteriaMutation.mutate({ id: editingCriteria.id, data });
    } else {
      createCriteriaMutation.mutate(data);
    }
  };

  const getWeightColor = (weight: number) => {
    switch (weight) {
      case 1: return 'bg-gray-100 text-gray-800';
      case 2: return 'bg-blue-100 text-blue-800';
      case 3: return 'bg-yellow-100 text-yellow-800';
      case 4: return 'bg-orange-100 text-orange-800';
      case 5: return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6" />
            Custom AI Criteria
          </h2>
          <p className="text-gray-600 mt-1">
            Configure custom evaluation criteria for AI candidate analysis beyond standard job requirements
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Criteria
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCriteria ? 'Edit AI Criteria' : 'Create AI Criteria'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Criteria Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Leadership Potential" {...field} />
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
                          placeholder="Describe what this criteria evaluates..."
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="criteria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Evaluation Points</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter evaluation points (one per line)&#10;e.g.,&#10;Shows initiative in problem solving&#10;Demonstrates mentoring capabilities&#10;Takes ownership of decisions"
                          rows={6}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="weight"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Weight (1-5)</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select weight" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="1">1 - Low Priority</SelectItem>
                            <SelectItem value="2">2 - Below Average</SelectItem>
                            <SelectItem value="3">3 - Average</SelectItem>
                            <SelectItem value="4">4 - High Priority</SelectItem>
                            <SelectItem value="5">5 - Critical</SelectItem>
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
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Active</FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Include in AI analysis
                          </div>
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
                </div>

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsDialogOpen(false);
                      setEditingCriteria(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createCriteriaMutation.isPending || updateCriteriaMutation.isPending}>
                    {editingCriteria ? 'Update' : 'Create'} Criteria
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading AI criteria...</p>
            </div>
          </CardContent>
        </Card>
      ) : aiCriteria.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center p-8">
            <div className="text-center">
              <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Custom Criteria</h3>
              <p className="text-gray-600 mb-4">
                Create custom evaluation criteria to enhance AI candidate analysis beyond standard job requirements.
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Criteria
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {aiCriteria.map((criteria) => (
            <Card key={criteria.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{criteria.name}</h3>
                      <Badge className={getWeightColor(criteria.weight)}>
                        <Weight className="w-3 h-3 mr-1" />
                        Weight: {criteria.weight}
                      </Badge>
                      <Badge variant={criteria.isActive ? 'default' : 'secondary'}>
                        {criteria.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-3">{criteria.description}</p>
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-gray-700">Evaluation Points:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {(Array.isArray(criteria.criteria) 
                          ? criteria.criteria 
                          : (typeof criteria.criteria === 'string' ? JSON.parse(criteria.criteria) : [])
                        ).map((point: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <Target className="w-3 h-3 mt-0.5 text-blue-500" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditCriteria(criteria)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteCriteriaMutation.mutate(criteria.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}