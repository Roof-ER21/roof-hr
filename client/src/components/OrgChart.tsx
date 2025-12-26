import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import {
  ZoomIn,
  ZoomOut,
  Users,
  Building2,
  Mail,
  Crown,
} from 'lucide-react';

// Executive and admin emails
const OLIVER_EMAIL = 'oliver.brown@theroofdocs.com';
const REESE_EMAIL = 'reese.samala@theroofdocs.com';
const FORD_EMAIL = 'ford.barsi@theroofdocs.com';
const AHMED_EMAIL = 'ahmed.mahmoud@theroofdocs.com';

// Users who can edit the org chart
const EDIT_EMAILS = [AHMED_EMAIL, OLIVER_EMAIL, REESE_EMAIL, FORD_EMAIL];

type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  position?: string;
  department?: string;
  avatarUrl?: string;
};

// Helper to get full name
const getFullName = (user: User) => `${user.firstName} ${user.lastName}`;

// Helper to get initials
const getInitials = (user: User) => {
  const first = user.firstName?.[0] || '';
  const last = user.lastName?.[0] || '';
  return (first + last).toUpperCase();
};

// Check if user is a sales rep
const isSalesRep = (user: User) => {
  return (
    user.position?.toLowerCase().includes('sales') ||
    user.department?.toLowerCase() === 'sales' ||
    user.role?.toLowerCase().includes('sales')
  );
};

// Check if user is executive
const isExecutive = (email?: string) => {
  const e = email?.toLowerCase();
  return e === OLIVER_EMAIL || e === REESE_EMAIL || e === FORD_EMAIL;
};

export default function OrgChart() {
  const { user: currentUser } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(0.85);

  // Check if current user can edit
  const canEdit = EDIT_EMAILS.includes(currentUser?.email?.toLowerCase() || '');

  // Fetch all users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Build the org structure
  const orgData = useMemo(() => {
    if (!users.length) return null;

    // Find executives
    const oliver = users.find(u => u.email?.toLowerCase() === OLIVER_EMAIL);
    const reese = users.find(u => u.email?.toLowerCase() === REESE_EMAIL);
    const ford = users.find(u => u.email?.toLowerCase() === FORD_EMAIL);

    if (!oliver || !reese || !ford) return null;

    // Filter out executives and Ahmed
    const otherEmployees = users.filter(u =>
      !isExecutive(u.email) &&
      u.email?.toLowerCase() !== AHMED_EMAIL
    );

    // Separate into non-sales (top level) and sales reps
    const topLevelEmployees = otherEmployees.filter(u => !isSalesRep(u));
    const salesReps = otherEmployees.filter(u => isSalesRep(u));

    return {
      executives: { oliver, reese, ford },
      topLevelEmployees,
      salesReps,
    };
  }, [users]);

  // Zoom controls
  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.1, 1.5));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.1, 0.4));
  const resetZoom = () => setZoomLevel(0.85);

  // Render employee card
  const renderEmployeeCard = (user: User, isExec: boolean = false, execType?: 'oliver' | 'reese' | 'ford') => {
    const isSelected = selectedUser === user.id;

    let cardStyle = 'bg-white dark:bg-gray-800';
    let avatarStyle = '';
    let badgeContent = null;

    if (execType === 'oliver') {
      cardStyle = 'border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/20';
      avatarStyle = 'ring-2 ring-amber-500';
      badgeContent = <Badge className="bg-amber-500 text-white text-xs">CEO</Badge>;
    } else if (execType === 'reese') {
      cardStyle = 'border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      avatarStyle = 'ring-2 ring-blue-500';
      badgeContent = <Badge className="bg-blue-500 text-white text-xs">Sales</Badge>;
    } else if (execType === 'ford') {
      cardStyle = 'border-2 border-green-500 bg-green-50 dark:bg-green-900/20';
      avatarStyle = 'ring-2 ring-green-500';
      badgeContent = <Badge className="bg-green-500 text-white text-xs">Operations</Badge>;
    } else if (isSalesRep(user)) {
      cardStyle = 'border-l-4 border-l-blue-400 bg-white dark:bg-gray-800';
    } else {
      cardStyle = 'border-l-4 border-l-green-400 bg-white dark:bg-gray-800';
    }

    return (
      <Card
        key={user.id}
        onClick={() => setSelectedUser(user.id === selectedUser ? null : user.id)}
        className={`
          w-48 transition-all cursor-pointer hover:shadow-lg
          ${isSelected ? 'ring-2 ring-primary shadow-lg' : ''}
          ${cardStyle}
        `}
      >
        <CardContent className="p-3">
          <div className="flex flex-col items-center text-center">
            <Avatar className={`h-12 w-12 mb-2 ${avatarStyle}`}>
              <AvatarImage src={user.avatarUrl} alt={getFullName(user)} />
              <AvatarFallback className={isExec ? 'bg-primary text-primary-foreground' : 'bg-gray-200'}>
                {getInitials(user)}
              </AvatarFallback>
            </Avatar>

            <h3 className="font-semibold text-sm truncate w-full">{getFullName(user)}</h3>

            {user.position && (
              <p className="text-xs text-muted-foreground truncate w-full">
                {user.position}
              </p>
            )}

            {badgeContent && <div className="mt-1">{badgeContent}</div>}

            {!isExec && (
              <div className="flex flex-wrap justify-center gap-1 mt-1">
                {user.department && (
                  <Badge variant="outline" className="text-xs">
                    <Building2 className="h-3 w-3 mr-1" />
                    {user.department}
                  </Badge>
                )}
              </div>
            )}

            {isSelected && (
              <div className="mt-2 pt-2 border-t w-full">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
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

  if (!users.length || !orgData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Unable to build organization chart.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Looking for: Oliver Brown, Reese Samala, Ford Barsi
          </p>
        </div>
      </div>
    );
  }

  const { executives, topLevelEmployees, salesReps } = orgData;
  const totalDisplayed = 3 + topLevelEmployees.length + salesReps.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Organization Chart</h1>
          <p className="text-muted-foreground">Company structure and reporting relationships</p>
        </div>
        {canEdit && (
          <Badge variant="outline" className="text-green-600 border-green-600">
            Edit Access
          </Badge>
        )}
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-amber-500" />
                <span>Leadership (3)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span>Operations ({topLevelEmployees.length})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span>Sales ({salesReps.length})</span>
              </div>
              <span className="text-muted-foreground">
                {totalDisplayed} displayed
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
              <strong>Structure:</strong> Oliver Brown (CEO), Reese Samala (Sales), and Ford Barsi (Operations) lead the company together.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Organization chart */}
      <div className="relative overflow-auto border rounded-lg bg-gray-50 dark:bg-gray-900">
        <div className="min-h-[700px] p-8">
          <div
            className="transition-transform origin-top"
            style={{ transform: `scale(${zoomLevel})` }}
          >
            <div className="flex flex-col items-center">
              {/* Leadership Row - Oliver slightly elevated */}
              <div className="flex flex-col items-center mb-4">
                {/* Oliver at top */}
                <div className="mb-4 relative">
                  {renderEmployeeCard(executives.oliver, true, 'oliver')}
                  {/* Vertical line down from Oliver */}
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full w-0.5 h-8 bg-gray-400" />
                </div>

                {/* Reese and Ford side by side */}
                <div className="flex items-start gap-16 relative">
                  {/* Horizontal connector line */}
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4 w-48 h-0.5 bg-gray-400" />

                  {/* Vertical lines down to Reese and Ford */}
                  <div className="absolute top-0 left-[calc(50%-96px)] transform -translate-y-4 w-0.5 h-4 bg-gray-400" />
                  <div className="absolute top-0 left-[calc(50%+96px)] transform -translate-x-full -translate-y-4 w-0.5 h-4 bg-gray-400" />

                  <div className="relative">
                    {renderEmployeeCard(executives.reese, true, 'reese')}
                  </div>
                  <div className="relative">
                    {renderEmployeeCard(executives.ford, true, 'ford')}
                  </div>
                </div>
              </div>

              {/* Joint 3-way connector line */}
              <div className="relative w-full flex justify-center my-6">
                <div className="w-0.5 h-12 bg-gray-400" />
              </div>

              {/* Horizontal spread line */}
              <div className="relative w-full max-w-6xl mb-4">
                <div className="absolute top-0 left-8 right-8 h-0.5 bg-gray-400" />
              </div>

              {/* Top Level Employees (Non-Sales) */}
              {topLevelEmployees.length > 0 && (
                <div className="mb-8">
                  <div className="text-center mb-4">
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                      <Building2 className="h-3 w-3 mr-1" />
                      Operations & Departments ({topLevelEmployees.length})
                    </Badge>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 max-w-6xl">
                    {topLevelEmployees.map(emp => (
                      <div key={emp.id} className="relative">
                        {/* Vertical connector */}
                        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-4 w-0.5 h-4 bg-gray-300" />
                        {renderEmployeeCard(emp)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Divider line */}
              {salesReps.length > 0 && topLevelEmployees.length > 0 && (
                <div className="w-full max-w-4xl border-t border-dashed border-gray-300 my-6" />
              )}

              {/* Sales Reps */}
              {salesReps.length > 0 && (
                <div>
                  <div className="text-center mb-4">
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                      <Users className="h-3 w-3 mr-1" />
                      Sales Team ({salesReps.length})
                    </Badge>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4 max-w-6xl">
                    {salesReps.map(emp => (
                      <div key={emp.id} className="relative">
                        {renderEmployeeCard(emp)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
