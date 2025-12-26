import { useState, useMemo } from 'react';
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
  Crown,
  Briefcase,
  Settings
} from 'lucide-react';

// Executive emails for the fixed structure
const OLIVER_EMAIL = 'oliver.brown@theroofdocs.com';
const REESE_EMAIL = 'reese.samala@theroofdocs.com';
const FORD_EMAIL = 'ford.barsi@theroofdocs.com';

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

export default function OrgChart() {
  const { toast } = useToast();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['oliver', 'reese', 'ford']));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Update user mutation (for drag-drop reassignment)
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

  // Build the org chart with fixed structure
  const orgTree = useMemo(() => {
    if (!users.length) return null;

    // Find the executives
    const oliver = users.find(u => u.email?.toLowerCase() === OLIVER_EMAIL);
    const reese = users.find(u => u.email?.toLowerCase() === REESE_EMAIL);
    const ford = users.find(u => u.email?.toLowerCase() === FORD_EMAIL);

    // Get all other employees (excluding executives)
    const otherEmployees = users.filter(u =>
      u.email?.toLowerCase() !== OLIVER_EMAIL &&
      u.email?.toLowerCase() !== REESE_EMAIL &&
      u.email?.toLowerCase() !== FORD_EMAIL
    );

    // Categorize employees: Sales Reps go under Reese, everyone else under Ford
    const salesReps = otherEmployees.filter(u =>
      u.position?.toLowerCase().includes('sales') ||
      u.department?.toLowerCase() === 'sales' ||
      u.role?.toLowerCase().includes('sales')
    );

    const othersUnderFord = otherEmployees.filter(u =>
      !u.position?.toLowerCase().includes('sales') &&
      u.department?.toLowerCase() !== 'sales' &&
      !u.role?.toLowerCase().includes('sales')
    );

    // Build tree nodes
    const buildNode = (user: User | undefined, reports: User[]): TreeNode | null => {
      if (!user) return null;
      return {
        ...user,
        directReports: reports.map(r => ({ ...r, directReports: [] }))
      };
    };

    const reeseNode = buildNode(reese, salesReps);
    const fordNode = buildNode(ford, othersUnderFord);

    const oliverNode: TreeNode | null = oliver ? {
      ...oliver,
      directReports: [reeseNode, fordNode].filter((n): n is TreeNode => n !== null)
    } : null;

    return oliverNode;
  }, [users]);

  // Toggle node expansion
  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  // Expand all nodes
  const expandAll = () => {
    const allIds = new Set(users.map((u) => u.id));
    allIds.add('oliver');
    allIds.add('reese');
    allIds.add('ford');
    setExpandedNodes(allIds);
  };

  // Collapse all nodes
  const collapseAll = () => {
    setExpandedNodes(new Set(['oliver', 'reese', 'ford']));
  };

  // Zoom controls
  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.1, 2));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.1, 0.5));
  const resetZoom = () => setZoomLevel(1);

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Check if node is an executive
  const isExecutive = (email?: string) => {
    const e = email?.toLowerCase();
    return e === OLIVER_EMAIL || e === REESE_EMAIL || e === FORD_EMAIL;
  };

  // Get branch info
  const getBranchInfo = (email?: string) => {
    const e = email?.toLowerCase();
    if (e === OLIVER_EMAIL) return { icon: Crown, label: 'CEO', color: 'text-amber-500' };
    if (e === REESE_EMAIL) return { icon: Briefcase, label: 'Sales Division', color: 'text-blue-500' };
    if (e === FORD_EMAIL) return { icon: Settings, label: 'Operations Division', color: 'text-green-500' };
    return null;
  };

  // Render individual node
  const renderNode = (node: TreeNode, level: number = 0, branchType?: 'sales' | 'operations') => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.directReports.length > 0;
    const isSelected = selectedNode === node.id;
    const isExec = isExecutive(node.email);
    const branchInfo = getBranchInfo(node.email);

    // Determine card style based on role
    let cardStyle = '';
    if (node.email?.toLowerCase() === OLIVER_EMAIL) {
      cardStyle = 'border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/20';
    } else if (node.email?.toLowerCase() === REESE_EMAIL) {
      cardStyle = 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    } else if (node.email?.toLowerCase() === FORD_EMAIL) {
      cardStyle = 'border-2 border-green-500 bg-green-50 dark:bg-green-900/20';
    } else if (branchType === 'sales') {
      cardStyle = 'border-l-4 border-l-blue-400';
    } else if (branchType === 'operations') {
      cardStyle = 'border-l-4 border-l-green-400';
    }

    return (
      <div key={node.id} className="relative flex flex-col items-center">
        {/* Vertical connector to parent */}
        {level > 0 && (
          <div className="absolute -top-8 left-1/2 w-0.5 h-8 bg-gray-300 dark:bg-gray-600" />
        )}

        {/* Node card */}
        <Card
          onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
          className={`
            relative w-64 transition-all cursor-pointer hover:shadow-lg
            ${isSelected ? 'ring-2 ring-primary shadow-lg' : ''}
            ${cardStyle}
          `}
        >
          {/* Branch indicator */}
          {branchInfo && (
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <branchInfo.icon className={`h-4 w-4 ${branchInfo.color}`} />
            </div>
          )}

          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <Avatar className={`h-12 w-12 ${isExec ? 'ring-2 ring-offset-2 ring-primary' : ''}`}>
                <AvatarImage src={node.avatarUrl} alt={node.name} />
                <AvatarFallback className={isExec ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}>
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

                {branchInfo && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {branchInfo.label}
                  </Badge>
                )}

                {!isExec && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {node.role && (
                      <Badge variant="secondary" className="text-xs">
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
                )}

                {/* Direct reports count */}
                {hasChildren && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>{node.directReports.length} report{node.directReports.length !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* Contact (on selection) */}
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
                className="absolute top-0 h-0.5 bg-gray-300 dark:bg-gray-600"
                style={{
                  left: `calc(50% - ${(node.directReports.length - 1) * 140}px)`,
                  right: `calc(50% - ${(node.directReports.length - 1) * 140}px)`,
                }}
              />
            )}

            {/* Child nodes */}
            <div className="flex gap-6 justify-center items-start flex-wrap">
              {node.directReports.map((child) => {
                // Determine branch type for styling
                let childBranchType: 'sales' | 'operations' | undefined;
                if (node.email?.toLowerCase() === REESE_EMAIL) {
                  childBranchType = 'sales';
                } else if (node.email?.toLowerCase() === FORD_EMAIL) {
                  childBranchType = 'operations';
                }
                return renderNode(child, level + 1, childBranchType);
              })}
            </div>
          </div>
        )}
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

  if (!orgTree) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Unable to build organization chart. Executive users not found.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Looking for: Oliver Brown, Reese Samala, Ford Barsi
          </p>
        </div>
      </div>
    );
  }

  // Count employees by branch
  const salesCount = users.filter(u =>
    u.position?.toLowerCase().includes('sales') ||
    u.department?.toLowerCase() === 'sales' ||
    u.role?.toLowerCase().includes('sales')
  ).length;
  const opsCount = users.length - salesCount - 3; // minus executives

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Organization Chart</h1>
          <p className="text-muted-foreground">Company structure and reporting relationships</p>
        </div>
      </div>

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

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span>Sales ({salesCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span>Operations ({opsCount})</span>
              </div>
              <span className="text-muted-foreground">
                {users.length} total employees
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

          {/* Legend */}
          <div className="mt-4 p-3 bg-muted/50 rounded-md">
            <p className="text-xs text-muted-foreground">
              <strong>Structure:</strong> Oliver Brown oversees the company. Reese Samala manages Sales Reps. Ford Barsi manages Operations & all other departments.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Organization tree */}
      <div className="relative overflow-auto border rounded-lg bg-background">
        <div className="min-h-[600px] p-8">
          <div
            className="transition-transform origin-top"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <div className="flex justify-center">
              {renderNode(orgTree, 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
