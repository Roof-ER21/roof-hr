import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  ChevronDown,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  User,
  Users,
  GripVertical,
  Building2,
  Mail,
  Crown
} from 'lucide-react';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  position?: string;
  department?: string;
  managerId?: string | null;
  avatarUrl?: string;
};

type TreeNode = User & {
  directReports: TreeNode[];
};

type DragState = {
  draggedEmployeeId: string | null;
  dragOverNodeId: string | null;
};

export default function OrgChart() {
  const { toast } = useToast();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [dragState, setDragState] = useState<DragState>({
    draggedEmployeeId: null,
    dragOverNodeId: null,
  });

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, managerId }: { userId: string; managerId: string | null }) => {
      return apiRequest(`/api/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ managerId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Success',
        description: 'Reporting structure updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update reporting structure',
        variant: 'destructive',
      });
    },
  });

  // Build organizational tree
  const orgTree = useMemo(() => {
    if (!users.length) return [];

    const userMap = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];

    // Initialize all nodes
    users.forEach((user) => {
      userMap.set(user.id, { ...user, directReports: [] });
    });

    // Build hierarchy
    users.forEach((user) => {
      const node = userMap.get(user.id)!;
      if (user.managerId && userMap.has(user.managerId)) {
        const manager = userMap.get(user.managerId)!;
        manager.directReports.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [users]);

  // Toggle node expansion
  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Expand all nodes
  const expandAll = useCallback(() => {
    const allIds = new Set(users.map((u) => u.id));
    setExpandedNodes(allIds);
  }, [users]);

  // Collapse all nodes
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // Zoom controls
  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.1, 2));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.1, 0.5));
  const resetZoom = () => setZoomLevel(1);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, employeeId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', employeeId);
    setDragState((prev) => ({ ...prev, draggedEmployeeId: employeeId }));
  };

  const handleDragOver = (e: React.DragEvent, nodeId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const draggedId = dragState.draggedEmployeeId;
    if (!draggedId || draggedId === nodeId) {
      return;
    }

    // Check if dropping on a descendant (prevent circular references)
    const isDescendant = (checkId: string, ancestorId: string): boolean => {
      const user = users.find((u) => u.id === checkId);
      if (!user || !user.managerId) return false;
      if (user.managerId === ancestorId) return true;
      return isDescendant(user.managerId, ancestorId);
    };

    if (isDescendant(nodeId, draggedId)) {
      e.dataTransfer.dropEffect = 'none';
      return;
    }

    setDragState((prev) => ({ ...prev, dragOverNodeId: nodeId }));
  };

  const handleDragLeave = () => {
    setDragState((prev) => ({ ...prev, dragOverNodeId: null }));
  };

  const handleDrop = (e: React.DragEvent, newManagerId: string | null) => {
    e.preventDefault();
    const employeeId = e.dataTransfer.getData('text/plain');

    if (!employeeId || employeeId === newManagerId) {
      setDragState({ draggedEmployeeId: null, dragOverNodeId: null });
      return;
    }

    // Prevent dropping on descendants
    const isDescendant = (checkId: string, ancestorId: string): boolean => {
      const user = users.find((u) => u.id === checkId);
      if (!user || !user.managerId) return false;
      if (user.managerId === ancestorId) return true;
      return isDescendant(user.managerId, ancestorId);
    };

    if (newManagerId && isDescendant(newManagerId, employeeId)) {
      toast({
        title: 'Invalid Operation',
        description: 'Cannot assign an employee to report to their subordinate',
        variant: 'destructive',
      });
      setDragState({ draggedEmployeeId: null, dragOverNodeId: null });
      return;
    }

    updateUserMutation.mutate({ userId: employeeId, managerId: newManagerId });
    setDragState({ draggedEmployeeId: null, dragOverNodeId: null });
  };

  const handleDragEnd = () => {
    setDragState({ draggedEmployeeId: null, dragOverNodeId: null });
  };

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Render individual node
  const renderNode = (node: TreeNode, level: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.directReports.length > 0;
    const isSelected = selectedNode === node.id;
    const isDragging = dragState.draggedEmployeeId === node.id;
    const isDragOver = dragState.dragOverNodeId === node.id;
    const isRoot = level === 0;

    return (
      <div key={node.id} className="relative">
        {/* Connector line to parent */}
        {level > 0 && (
          <div className="absolute -top-8 left-1/2 w-0.5 h-8 bg-border" />
        )}

        {/* Node card */}
        <div className="flex flex-col items-center">
          <Card
            draggable
            onDragStart={(e) => handleDragStart(e, node.id)}
            onDragOver={(e) => handleDragOver(e, node.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, node.id)}
            onDragEnd={handleDragEnd}
            onClick={() => setSelectedNode(node.id)}
            className={`
              relative w-72 transition-all cursor-pointer hover:shadow-lg
              ${isSelected ? 'ring-2 ring-primary shadow-lg' : ''}
              ${isDragging ? 'opacity-50 scale-95' : ''}
              ${isDragOver ? 'ring-2 ring-blue-400 scale-105' : ''}
              ${isRoot ? 'border-2 border-primary' : ''}
            `}
          >
            {/* Drag handle */}
            <div className="absolute top-2 left-2 text-muted-foreground opacity-0 hover:opacity-100 transition-opacity">
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Root indicator */}
            {isRoot && (
              <div className="absolute top-2 right-2">
                <Crown className="h-4 w-4 text-primary" />
              </div>
            )}

            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <Avatar className="h-12 w-12">
                  <AvatarImage src={node.avatarUrl} alt={node.name} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(node.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm truncate">{node.name}</h3>
                  {node.position && (
                    <p className="text-xs text-muted-foreground truncate">
                      {node.position}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-1 mt-2">
                    {node.role && (
                      <Badge variant="secondary" className="text-xs">
                        <User className="h-3 w-3 mr-1" />
                        {node.role}
                      </Badge>
                    )}
                    {node.department && (
                      <Badge variant="outline" className="text-xs">
                        <Building2 className="h-3 w-3 mr-1" />
                        {node.department}
                      </Badge>
                    )}
                  </div>

                  {/* Direct reports count */}
                  {hasChildren && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{node.directReports.length} direct report{node.directReports.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}

                  {/* Contact */}
                  {isSelected && (
                    <div className="mt-2 pt-2 border-t">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{node.email}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expand/collapse button */}
                {hasChildren && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(node.id);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Children */}
          {hasChildren && isExpanded && (
            <div className="relative mt-8">
              {/* Horizontal connector line */}
              {node.directReports.length > 1 && (
                <div
                  className="absolute top-0 h-0.5 bg-border"
                  style={{
                    left: `calc(50% - ${(node.directReports.length - 1) * 160}px)`,
                    right: `calc(50% - ${(node.directReports.length - 1) * 160}px)`,
                  }}
                />
              )}

              {/* Child nodes */}
              <div className="flex gap-8 justify-center items-start">
                {node.directReports.map((child) => renderNode(child, level + 1))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading organization chart...</p>
        </div>
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No employees found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {users.length} employee{users.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={zoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={resetZoom}>
                {Math.round(zoomLevel * 100)}%
              </Button>
              <Button variant="outline" size="icon" onClick={zoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="mt-4 p-3 bg-muted/50 rounded-md">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> Drag and drop employees to reassign reporting relationships.
              Click on a card to see contact details. Use zoom controls to navigate large organizations.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Organization tree */}
      <div className="relative overflow-auto border rounded-lg bg-background">
        {/* Drop zone for making root-level employees */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(e) => handleDrop(e, null)}
          className="min-h-[600px] p-8"
        >
          <div
            className="transition-transform origin-top"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <div className="flex gap-12 justify-center items-start">
              {orgTree.map((root) => renderNode(root, 0))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
