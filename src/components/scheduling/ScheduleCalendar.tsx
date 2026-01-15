"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  Circle,
} from "lucide-react";

interface ScheduleEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  scheduledTime: Date;
  status: "scheduled" | "completed" | "failed" | "running";
}

// Generate demo events for the calendar
const generateDemoEvents = (): ScheduleEvent[] => {
  const events: ScheduleEvent[] = [];
  const now = new Date();
  const rules = [
    { id: "rule-1", name: "data_processor" },
    { id: "rule-2", name: "hourly_aggregation" },
    { id: "rule-3", name: "daily_report" },
    { id: "rule-4", name: "cleanup_job" },
  ];

  // Generate events for the current month
  for (let day = 1; day <= 28; day++) {
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    
    // Add multiple events per day
    rules.forEach((rule, idx) => {
      if (Math.random() > 0.5) {
        const hour = 6 + idx * 4;
        const eventDate = new Date(date);
        eventDate.setHours(hour, 0, 0, 0);

        const isPast = eventDate < now;
        events.push({
          id: `event-${day}-${rule.id}`,
          ruleId: rule.id,
          ruleName: rule.name,
          scheduledTime: eventDate,
          status: isPast
            ? Math.random() > 0.1
              ? "completed"
              : "failed"
            : "scheduled",
        });
      }
    });
  }

  return events;
};

export function ScheduleCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [events] = useState<ScheduleEvent[]>(generateDemoEvents);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days: Date[] = [];
    
    // Add days from previous month to fill the first week
    const startPadding = firstDay.getDay();
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push(new Date(year, month, -i));
    }
    
    // Add all days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  }, [currentDate]);

  const getEventsForDate = (date: Date): ScheduleEvent[] => {
    return events.filter(
      (event) =>
        event.scheduledTime.getFullYear() === date.getFullYear() &&
        event.scheduledTime.getMonth() === date.getMonth() &&
        event.scheduledTime.getDate() === date.getDate()
    );
  };

  const navigateMonth = (direction: number) => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1)
    );
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date): boolean => {
    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "completed": return "bg-green-500";
      case "failed": return "bg-red-500";
      case "running": return "bg-blue-500";
      default: return "bg-gray-400";
    }
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Calendar */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateMonth(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {daysOfWeek.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, idx) => {
              const dayEvents = getEventsForDate(date);
              const isSelected =
                selectedDate?.toDateString() === date.toDateString();

              return (
                <div
                  key={idx}
                  className={`
                    min-h-[80px] p-1 border rounded cursor-pointer
                    transition-colors hover:bg-muted/50
                    ${!isCurrentMonth(date) ? "opacity-40" : ""}
                    ${isToday(date) ? "border-primary bg-primary/5" : ""}
                    ${isSelected ? "ring-2 ring-primary" : ""}
                  `}
                  onClick={() => setSelectedDate(date)}
                >
                  <div
                    className={`
                      text-sm font-medium mb-1
                      ${isToday(date) ? "text-primary" : ""}
                    `}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center gap-1 text-xs truncate"
                      >
                        <Circle
                          className={`h-2 w-2 fill-current ${getStatusColor(event.status)}`}
                        />
                        <span className="truncate">{event.ruleName}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3 fill-current bg-green-500 text-green-500" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3 fill-current bg-red-500 text-red-500" />
              <span>Failed</span>
            </div>
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3 fill-current bg-blue-500 text-blue-500" />
              <span>Running</span>
            </div>
            <div className="flex items-center gap-1">
              <Circle className="h-3 w-3 fill-current bg-gray-400 text-gray-400" />
              <span>Scheduled</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {selectedDate
              ? selectedDate.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : "Select a Date"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedDate ? (
            selectedDateEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{event.ruleName}</span>
                      <Badge
                        variant={
                          event.status === "completed"
                            ? "default"
                            : event.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                        className={
                          event.status === "completed" ? "bg-green-500" : ""
                        }
                      >
                        {event.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {event.scheduledTime.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No scheduled events for this date</p>
              </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Click on a date to view scheduled events</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
