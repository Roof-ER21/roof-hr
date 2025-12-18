import { useState, useMemo, Fragment } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  AlertCircle, Mail, FileSignature, ArrowLeft, Search,
  Upload, Download, RefreshCw, ChevronDown, ChevronRight, User, PenTool
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
    notes: ''
  });

  const isManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  // Fetch tools inventory
  const { data: tools = [], isLoading: toolsLoading, error: toolsError } = useQuery<Tool[]>({
    queryKey: ['/api/tools/inventory'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const headers: HeadersInit = {};

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch('/api/tools/inventory', {
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

  const handleReturnTool = (assignmentId: string, condition: string = 'GOOD') => {
    returnToolMutation.mutate({
      id: assignmentId,
      data: { condition }
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
  
  // Filter and sort tools
  const filteredTools = (tools as Tool[])
    .filter((tool: Tool) =>
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.serialNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    )
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
                                  onClick={() => handleReturnTool(assignment.id)}
                                >
                                  <ArrowLeft className="mr-1 h-3 w-3" />
                                  Return
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
                              <TableCell colSpan={isManager ? 9 : 8} className="py-4">
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Tool</DialogTitle>
              <DialogDescription>
                Update tool information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={selectedTool.name}
                  onChange={(e) => setSelectedTool({ ...selectedTool, name: e.target.value })}
                />
              </div>
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
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={selectedTool.notes || ''}
                  onChange={(e) => setSelectedTool({ ...selectedTool, notes: e.target.value })}
                />
              </div>
              <Button onClick={handleUpdateTool} className="w-full">
                Update Tool
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}