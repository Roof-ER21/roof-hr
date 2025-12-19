import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Video,
  Phone,
  MapPin,
  Clock,
  User,
  ExternalLink,
  Filter
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  parseISO,
  isWithinInterval,
  isSameDay
} from 'date-fns';

interface CalendarEvent {
  id: string;
  type: 'MEETING' | 'INTERVIEW' | 'PTO' | 'TEAM_PTO';
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
  meetingLink?: string;
  source: string;
  color: string;
  ptoType?: string;
  interviewType?: string;
  employeeName?: string;
  department?: string;
}

const eventTypeColors: Record<string, { bg: string; text: string; border: string }> = {
  MEETING: { bg: 'bg-green-100 dark:bg-green-900/50', text: 'text-green-700 dark:text-green-200', border: 'border-green-300 dark:border-green-700' },
  INTERVIEW: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-700' },
  PTO: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-700 dark:text-red-200', border: 'border-red-300 dark:border-red-700' },
  TEAM_PTO: { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-700 dark:text-purple-200', border: 'border-purple-300 dark:border-purple-700' }
};

export default function MyCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filters, setFilters] = useState({
    interviews: true,
    pto: true,
    meetings: true,
    teamPto: true
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Fetch my calendar events
  const { data: myEvents = [], isLoading: myEventsLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/google/calendar/my-events', {
      timeMin: monthStart.toISOString(),
      timeMax: monthEnd.toISOString()
    }]
  });

  // Fetch team PTO (for managers)
  const { data: teamPto = [], isLoading: teamPtoLoading } = useQuery<CalendarEvent[]>({
    queryKey: ['/api/google/calendar/team-pto', {
      timeMin: monthStart.toISOString(),
      timeMax: monthEnd.toISOString()
    }]
  });

  // Combine and filter events
  const allEvents = useMemo(() => {
    const combined = [...myEvents, ...teamPto];
    return combined.filter(event => {
      if (event.type === 'INTERVIEW' && !filters.interviews) return false;
      if (event.type === 'PTO' && !filters.pto) return false;
      if (event.type === 'MEETING' && !filters.meetings) return false;
      if (event.type === 'TEAM_PTO' && !filters.teamPto) return false;
      return true;
    });
  }, [myEvents, teamPto, filters]);

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return allEvents.filter(event => {
      const startDate = parseISO(event.startDate);
      const endDate = parseISO(event.endDate);
      return isWithinInterval(day, { start: startDate, end: endDate }) || isSameDay(day, startDate);
    });
  };

  // Get events for selected date details panel
  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  // Navigate months
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Count events by type for summary
  const eventCounts = useMemo(() => {
    return {
      meetings: allEvents.filter(e => e.type === 'MEETING').length,
      interviews: allEvents.filter(e => e.type === 'INTERVIEW').length,
      pto: allEvents.filter(e => e.type === 'PTO').length,
      teamPto: allEvents.filter(e => e.type === 'TEAM_PTO').length
    };
  }, [allEvents]);

  const isLoading = myEventsLoading || teamPtoLoading;

  if (isLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading calendar...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarIcon className="h-6 w-6" />
            My Calendar
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View your meetings, interviews, and time off
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={previousMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter Toggles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2">
              <Switch
                id="filter-meetings"
                checked={filters.meetings}
                onCheckedChange={(checked) => setFilters(f => ({ ...f, meetings: checked }))}
              />
              <Label htmlFor="filter-meetings" className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                Meetings ({eventCounts.meetings})
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="filter-interviews"
                checked={filters.interviews}
                onCheckedChange={(checked) => setFilters(f => ({ ...f, interviews: checked }))}
              />
              <Label htmlFor="filter-interviews" className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                Interviews ({eventCounts.interviews})
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="filter-pto"
                checked={filters.pto}
                onCheckedChange={(checked) => setFilters(f => ({ ...f, pto: checked }))}
              />
              <Label htmlFor="filter-pto" className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                My PTO ({eventCounts.pto})
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="filter-team-pto"
                checked={filters.teamPto}
                onCheckedChange={(checked) => setFilters(f => ({ ...f, teamPto: checked }))}
              />
              <Label htmlFor="filter-team-pto" className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-500"></span>
                Team PTO ({eventCounts.teamPto})
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">
              {format(currentDate, 'MMMM yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-gray-600 dark:text-gray-400 py-2">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {days.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isTodayDate = isToday(day);
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <div
                    key={index}
                    className={`
                      min-h-[90px] p-1 border rounded-lg cursor-pointer transition-all
                      ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600' : 'bg-white dark:bg-gray-800'}
                      ${isTodayDate ? 'border-blue-500 border-2' : 'border-gray-200 dark:border-gray-700'}
                      ${isSelected ? 'ring-2 ring-blue-400' : ''}
                      ${dayEvents.length > 0 ? 'hover:bg-gray-50 dark:hover:bg-gray-700' : 'hover:bg-gray-25 dark:hover:bg-gray-750'}
                    `}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className={`text-sm font-medium mb-1 ${isTodayDate ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                      {format(day, 'd')}
                    </div>

                    {dayEvents.length > 0 && (
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((event, eventIndex) => {
                          const colors = eventTypeColors[event.type] || eventTypeColors.MEETING;
                          return (
                            <div
                              key={`${event.id}-${eventIndex}`}
                              className={`text-[10px] px-1 py-0.5 rounded truncate ${colors.bg} ${colors.text}`}
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Event Details Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedDate ? format(selectedDate, 'EEEE, MMM d') : 'Select a Date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDate ? (
              selectedDateEvents.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {selectedDateEvents.map((event, index) => {
                      const colors = eventTypeColors[event.type] || eventTypeColors.MEETING;
                      return (
                        <div
                          key={`${event.id}-${index}`}
                          className={`p-3 rounded-lg border ${colors.border} ${colors.bg}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <Badge variant="outline" className={`${colors.text} ${colors.border} mb-2`}>
                                {event.type.replace('_', ' ')}
                              </Badge>
                              <h4 className={`font-medium ${colors.text}`}>{event.title}</h4>
                            </div>
                          </div>

                          {event.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                              {event.description}
                            </p>
                          )}

                          <div className="mt-3 space-y-1 text-sm">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              <Clock className="h-3 w-3" />
                              {format(parseISO(event.startDate), 'h:mm a')} - {format(parseISO(event.endDate), 'h:mm a')}
                            </div>

                            {event.location && (
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </div>
                            )}

                            {event.meetingLink && (
                              <a
                                href={event.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <Video className="h-3 w-3" />
                                Join Meeting
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}

                            {event.employeeName && (
                              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                <User className="h-3 w-3" />
                                {event.employeeName}
                                {event.department && ` (${event.department})`}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No events scheduled</p>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Click on a date to see events</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allEvents
              .filter(event => new Date(event.startDate) >= new Date())
              .slice(0, 5)
              .map((event, index) => {
                const colors = eventTypeColors[event.type] || eventTypeColors.MEETING;
                return (
                  <div
                    key={`${event.id}-${index}`}
                    className={`flex items-center justify-between p-3 rounded-lg border ${colors.border} ${colors.bg}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colors.bg}`}>
                        {event.type === 'INTERVIEW' && <Video className={`h-5 w-5 ${colors.text}`} />}
                        {event.type === 'MEETING' && <CalendarIcon className={`h-5 w-5 ${colors.text}`} />}
                        {(event.type === 'PTO' || event.type === 'TEAM_PTO') && <User className={`h-5 w-5 ${colors.text}`} />}
                      </div>
                      <div>
                        <p className={`font-medium ${colors.text}`}>{event.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {format(parseISO(event.startDate), 'EEE, MMM d')} at {format(parseISO(event.startDate), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                    {event.meetingLink && (
                      <a
                        href={event.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline text-sm flex items-center gap-1"
                      >
                        Join <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            {allEvents.filter(event => new Date(event.startDate) >= new Date()).length === 0 && (
              <p className="text-center py-4 text-gray-500 dark:text-gray-400">
                No upcoming events
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
