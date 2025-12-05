import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO, isWithinInterval } from 'date-fns';

interface PtoRequest {
  id: string;
  employeeId: string;
  employee?: {
    firstName: string;
    lastName: string;
    department: string;
  };
  startDate: string;
  endDate: string;
  type: 'VACATION' | 'SICK' | 'PERSONAL' | 'OTHER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason: string;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
}

const typeColors = {
  VACATION: 'bg-blue-100 text-blue-800',
  SICK: 'bg-red-100 text-red-800',
  PERSONAL: 'bg-purple-100 text-purple-800',
  OTHER: 'bg-gray-100 text-gray-800'
};

export function PtoCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch PTO requests
  const { data: ptoRequests = [], isLoading: ptoLoading } = useQuery<PtoRequest[]>({
    queryKey: ['/api/pto']
  });

  // Fetch users to get employee names
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users']
  });

  // Only show approved PTO requests
  const approvedPtos = ptoRequests.filter(pto => pto.status === 'APPROVED');

  // Map employee data to PTO requests
  const ptosWithEmployees = approvedPtos.map(pto => {
    const employee = users.find(user => user.id === pto.employeeId);
    return {
      ...pto,
      employee: employee ? {
        firstName: employee.firstName,
        lastName: employee.lastName,
        department: employee.department
      } : undefined
    };
  });

  // Get PTOs for a specific day
  const getPtosForDay = (day: Date) => {
    return ptosWithEmployees.filter(pto => {
      const startDate = parseISO(pto.startDate);
      const endDate = parseISO(pto.endDate);
      return isWithinInterval(day, { start: startDate, end: endDate });
    });
  };

  // Navigate months
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (ptoLoading || usersLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            PTO Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={previousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={nextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-lg font-medium mt-2">
          {format(currentDate, 'MMMM yyyy')}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {days.map((day, index) => {
            const dayPtos = getPtosForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            
            return (
              <div
                key={index}
                className={`
                  min-h-[100px] p-2 border rounded-lg transition-colors
                  ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
                  ${isTodayDate ? 'border-blue-500 border-2' : 'border-gray-200'}
                  ${dayPtos.length > 0 ? 'hover:bg-gray-50' : ''}
                `}
              >
                <div className="text-sm font-medium mb-1">
                  {format(day, 'd')}
                </div>
                
                {dayPtos.length > 0 && (
                  <ScrollArea className="h-[70px]">
                    <div className="space-y-1">
                      {dayPtos.slice(0, 3).map((pto, ptoIndex) => (
                        <div
                          key={`${pto.id}-${ptoIndex}`}
                          className="text-xs p-1 rounded bg-blue-50 border border-blue-200"
                          title={`${pto.employee?.firstName} ${pto.employee?.lastName} - ${pto.type}`}
                        >
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="truncate">
                              {pto.employee?.firstName} {pto.employee?.lastName?.charAt(0)}.
                            </span>
                          </div>
                        </div>
                      ))}
                      {dayPtos.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{dayPtos.length - 3} more
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-medium mb-3">Time Off Summary</h3>
          <div className="space-y-2">
            {ptosWithEmployees.map(pto => (
              <div key={pto.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {pto.employee?.firstName} {pto.employee?.lastName}
                    </p>
                    <p className="text-xs text-gray-600">
                      {pto.employee?.department}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={typeColors[pto.type]} variant="secondary">
                    {pto.type}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {format(parseISO(pto.startDate), 'MMM d')} - {format(parseISO(pto.endDate), 'MMM d')}
                  </span>
                </div>
              </div>
            ))}
            {ptosWithEmployees.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No approved time off for {format(currentDate, 'MMMM yyyy')}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}