import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, User, Star } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, parseISO, isWithinInterval } from 'date-fns';
import { isHoliday, getHolidayName, getHolidaysForYear } from '@shared/constants/holidays';

// Calendar PTO data - minimal info for privacy
interface CalendarPtoEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  // NOTE: type, reason, and department are NOT included for privacy
}

export function PtoCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch company-wide approved PTO (name + dates only for privacy)
  const { data: calendarPtos = [], isLoading } = useQuery<CalendarPtoEntry[]>({
    queryKey: ['/api/pto/calendar']
  });

  // Get PTOs for a specific day
  const getPtosForDay = (day: Date) => {
    return calendarPtos.filter(pto => {
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

  if (isLoading) {
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
            <div key={day} className="text-center text-sm font-medium text-gray-600 dark:text-gray-300 py-2">
              {day}
            </div>
          ))}
          
          {/* Empty cells for days before the first of the month */}
          {Array.from({ length: monthStart.getDay() }).map((_, index) => (
            <div
              key={`empty-${index}`}
              className="min-h-[100px] p-2 border rounded-lg bg-gray-50 dark:bg-gray-900 border-gray-100 dark:border-gray-700"
            />
          ))}

          {/* Calendar days */}
          {days.map((day, index) => {
            const dayPtos = getPtosForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);
            const dateStr = format(day, 'yyyy-MM-dd');
            const holidayName = getHolidayName(dateStr);
            const isHolidayDay = !!holidayName;

            return (
              <div
                key={`day-${index}`}
                className={`
                  min-h-[100px] p-2 border rounded-lg transition-colors
                  ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500' : 'bg-white dark:bg-gray-800'}
                  ${isTodayDate ? 'border-blue-500 border-2' : 'border-gray-200 dark:border-gray-600'}
                  ${isHolidayDay ? 'bg-green-50 dark:bg-green-900/30' : ''}
                  ${dayPtos.length > 0 ? 'hover:bg-gray-50 dark:hover:bg-gray-700' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {format(day, 'd')}
                  </span>
                  {isHolidayDay && (
                    <Star className="h-3 w-3 text-green-600 dark:text-green-400" />
                  )}
                </div>

                {/* Holiday indicator */}
                {isHolidayDay && (
                  <div className="text-[10px] text-green-700 dark:text-green-300 font-medium mb-1 truncate" title={holidayName}>
                    {holidayName}
                  </div>
                )}

                {dayPtos.length > 0 && (
                  <ScrollArea className={isHolidayDay ? "h-[50px]" : "h-[70px]"}>
                    <div className="space-y-1">
                      {dayPtos.slice(0, 3).map((pto, ptoIndex) => {
                        // Extract first name and last initial from employeeName
                        const nameParts = pto.employeeName.split(' ');
                        const displayName = nameParts.length > 1
                          ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`
                          : pto.employeeName;
                        return (
                          <div
                            key={`${pto.id}-${ptoIndex}`}
                            className="text-xs p-1 rounded bg-blue-50 dark:bg-blue-900/50 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200"
                            title={pto.employeeName}
                          >
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              <span className="truncate">
                                {displayName}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                      {dayPtos.length > 3 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
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

        {/* Company Holidays Legend */}
        <div className="mt-6 pt-4 border-t dark:border-gray-700">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
            <Star className="h-4 w-4 text-green-600" />
            Company Holidays ({currentDate.getFullYear()})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
            {getHolidaysForYear(currentDate.getFullYear()).map((holiday) => (
              <div
                key={holiday.date}
                className="text-xs p-2 rounded bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700"
              >
                <div className="font-medium text-green-800 dark:text-green-200">{holiday.name}</div>
                <div className="text-green-600 dark:text-green-400">
                  {format(parseISO(holiday.date), 'MMM d, yyyy')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time Off Summary - Privacy: only shows name and dates, no PTO type */}
        <div className="pt-4 border-t dark:border-gray-700">
          <h3 className="text-sm font-medium mb-3 text-gray-900 dark:text-white">Upcoming Time Off</h3>
          <div className="space-y-2">
            {calendarPtos.map(pto => (
              <div key={pto.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="font-medium text-sm text-gray-900 dark:text-white">
                    {pto.employeeName}
                  </p>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {format(parseISO(pto.startDate), 'MMM d')} - {format(parseISO(pto.endDate), 'MMM d')}
                </span>
              </div>
            ))}
            {calendarPtos.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                No approved time off scheduled
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}