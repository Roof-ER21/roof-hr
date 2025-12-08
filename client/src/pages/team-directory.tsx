import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Breadcrumbs } from '@/components/layout/breadcrumbs';
import { ListItemSkeleton } from '@/components/ui/skeleton-patterns';
import { NoEmployeesState } from '@/components/ui/empty-state';
import {
  Search,
  Mail,
  Phone,
  Building,
  Briefcase,
  Users,
  Filter
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position?: string;
  department?: string;
  avatar?: string;
  isSameDepartment: boolean;
}

function TeamDirectory() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Fetch team directory
  const { data: teamMembers = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/employee-portal/team'],
    queryFn: async () => {
      const response = await fetch('/api/employee-portal/team', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = new Set(teamMembers.map(m => m.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [teamMembers]);

  // Filter team members
  const filteredMembers = useMemo(() => {
    return teamMembers.filter(member => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        member.firstName.toLowerCase().includes(searchLower) ||
        member.lastName.toLowerCase().includes(searchLower) ||
        member.email.toLowerCase().includes(searchLower) ||
        (member.position?.toLowerCase().includes(searchLower)) ||
        (member.department?.toLowerCase().includes(searchLower));

      // Department filter
      const matchesDepartment =
        departmentFilter === 'all' ||
        member.department === departmentFilter;

      return matchesSearch && matchesDepartment;
    });
  }, [teamMembers, searchQuery, departmentFilter]);

  // Group by department
  const groupedMembers = useMemo(() => {
    const groups: Record<string, TeamMember[]> = {};

    filteredMembers.forEach(member => {
      const dept = member.department || 'No Department';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(member);
    });

    // Sort departments, putting user's department first
    const sortedDepts = Object.keys(groups).sort((a, b) => {
      if (a === user?.department) return -1;
      if (b === user?.department) return 1;
      if (a === 'No Department') return 1;
      if (b === 'No Department') return -1;
      return a.localeCompare(b);
    });

    return { groups, sortedDepts };
  }, [filteredMembers, user?.department]);

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Breadcrumbs />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <ListItemSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Directory</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Find and connect with your colleagues
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          <Users className="w-4 h-4 mr-1" />
          {teamMembers.length} Team Members
        </Badge>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by name, email, position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Departments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(dept => (
              <SelectItem key={dept} value={dept || ''}>
                {dept}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Team Members */}
      {filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <NoEmployeesState />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedMembers.sortedDepts.map(dept => (
            <Card key={dept}>
              <CardHeader className="py-3 px-4 bg-gray-50 dark:bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-gray-500" />
                  <CardTitle className="text-base">{dept}</CardTitle>
                  <Badge variant="outline" className="ml-auto">
                    {groupedMembers.groups[dept].length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y dark:divide-gray-700">
                  {groupedMembers.groups[dept].map(member => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.avatar} alt={`${member.firstName} ${member.lastName}`} />
                          <AvatarFallback className="bg-primary text-white">
                            {getInitials(member.firstName, member.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {member.firstName} {member.lastName}
                            {member.isSameDepartment && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Your Team
                              </Badge>
                            )}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            {member.position && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="w-3 h-3" />
                                {member.position}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {member.phone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                          >
                            <a href={`tel:${member.phone}`} aria-label={`Call ${member.firstName}`}>
                              <Phone className="w-4 h-4" />
                            </a>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                        >
                          <a href={`mailto:${member.email}`} aria-label={`Email ${member.firstName}`}>
                            <Mail className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats Footer */}
      {filteredMembers.length > 0 && (
        <div className="flex items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400 pt-4">
          <span>{groupedMembers.sortedDepts.length} Departments</span>
          <span>•</span>
          <span>{filteredMembers.length} People</span>
          {searchQuery && (
            <>
              <span>•</span>
              <Button
                variant="link"
                className="p-0 h-auto text-sm"
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default TeamDirectory;
