"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  History,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Bell,
  ExternalLink,
} from "lucide-react";
import type { AlertSeverity } from "./AlertManager";

export type AlertStatus = "triggered" | "acknowledged" | "resolved" | "silenced";

export interface AlertEvent {
  id: string;
  alertRuleId: string;
  alertRuleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  message: string;
  ruleId?: string;
  metricValue: number;
  threshold: number;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  webhooksSent: number;
  webhooksSucceeded: number;
  webhooksFailed: number;
  details?: Record<string, unknown>;
}

// Generate demo alert history
function generateDemoAlerts(): AlertEvent[] {
  const alerts: AlertEvent[] = [];
  const alertNames = [
    "High Latency Alert",
    "Rule Failure Alert",
    "Low Throughput Warning",
    "High Error Rate",
    "Memory Usage Critical",
  ];
  const severities: AlertSeverity[] = ["critical", "warning", "info"];
  const statuses: AlertStatus[] = ["triggered", "acknowledged", "resolved", "silenced"];
  const ruleNames = ["temperature_rule", "humidity_rule", "pressure_rule", "motion_rule"];

  for (let i = 0; i < 50; i++) {
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const alertName = alertNames[Math.floor(Math.random() * alertNames.length)];
    const triggeredAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    
    alerts.push({
      id: `event-${i}`,
      alertRuleId: `alert-${(i % 5) + 1}`,
      alertRuleName: alertName,
      severity,
      status,
      message: `${alertName} triggered: threshold exceeded`,
      ruleId: ruleNames[Math.floor(Math.random() * ruleNames.length)],
      metricValue: Math.round(Math.random() * 1000),
      threshold: Math.round(Math.random() * 500),
      triggeredAt: triggeredAt.toISOString(),
      acknowledgedAt: status !== "triggered" 
        ? new Date(triggeredAt.getTime() + Math.random() * 3600000).toISOString() 
        : undefined,
      resolvedAt: status === "resolved" 
        ? new Date(triggeredAt.getTime() + Math.random() * 7200000).toISOString() 
        : undefined,
      acknowledgedBy: status !== "triggered" ? "admin@example.com" : undefined,
      webhooksSent: Math.floor(Math.random() * 3) + 1,
      webhooksSucceeded: Math.floor(Math.random() * 3),
      webhooksFailed: Math.floor(Math.random() * 2),
    });
  }

  return alerts.sort((a, b) => 
    new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
  );
}

const DEMO_ALERTS = generateDemoAlerts();

export function AlertHistory() {
  const [events] = useState<AlertEvent[]>(DEMO_ALERTS);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<AlertEvent | null>(null);
  const pageSize = 10;

  // Filter events
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesSearch =
        !search ||
        event.alertRuleName.toLowerCase().includes(search.toLowerCase()) ||
        event.message.toLowerCase().includes(search.toLowerCase()) ||
        event.ruleId?.toLowerCase().includes(search.toLowerCase());
      
      const matchesSeverity = severityFilter === "all" || event.severity === severityFilter;
      const matchesStatus = statusFilter === "all" || event.status === statusFilter;

      return matchesSearch && matchesSeverity && matchesStatus;
    });
  }, [events, search, severityFilter, statusFilter]);

  // Paginate
  const totalPages = Math.ceil(filteredEvents.length / pageSize);
  const paginatedEvents = filteredEvents.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last24hEvents = events.filter(
      (e) => new Date(e.triggeredAt) >= last24h
    );

    return {
      total: events.length,
      last24h: last24hEvents.length,
      critical: events.filter((e) => e.severity === "critical").length,
      unresolved: events.filter((e) => e.status === "triggered").length,
    };
  }, [events]);

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "warning":
        return <Badge className="bg-amber-500">Warning</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getStatusBadge = (status: AlertStatus) => {
    switch (status) {
      case "triggered":
        return <Badge variant="destructive">Triggered</Badge>;
      case "acknowledged":
        return <Badge className="bg-blue-500">Acknowledged</Badge>;
      case "resolved":
        return <Badge className="bg-green-500">Resolved</Badge>;
      case "silenced":
        return <Badge variant="secondary">Silenced</Badge>;
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const formatDuration = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diff = endDate.getTime() - startDate.getTime();
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Last 24 Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.last24h}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Critical Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.critical}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unresolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.unresolved}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alert History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Alert History
              </CardTitle>
              <CardDescription>
                View and manage past alert events
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search alerts..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={severityFilter}
              onValueChange={(v: AlertSeverity | "all") => {
                setSeverityFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v: AlertStatus | "all") => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="triggered">Triggered</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="silenced">Silenced</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Alert</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Triggered</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Webhooks</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Bell className="h-8 w-8" />
                        <span>No alert events found</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{getSeverityIcon(event.severity)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{event.alertRuleName}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {event.message}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(event.status)}</TableCell>
                      <TableCell>
                        {event.ruleId && (
                          <Badge variant="outline" className="font-mono text-xs">
                            {event.ruleId}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <span className={event.metricValue > event.threshold ? "text-red-600" : "text-green-600"}>
                            {event.metricValue}
                          </span>
                          <span className="text-muted-foreground">/</span>
                          <span>{event.threshold}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTime(event.triggeredAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {formatDuration(event.triggeredAt, event.resolvedAt)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span>{event.webhooksSucceeded}</span>
                          {event.webhooksFailed > 0 && (
                            <>
                              <XCircle className="h-3 w-3 text-red-600 ml-2" />
                              <span>{event.webhooksFailed}</span>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedEvent(event)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="flex items-center gap-2">
                                {getSeverityIcon(event.severity)}
                                {event.alertRuleName}
                              </DialogTitle>
                              <DialogDescription>
                                Event details and timeline
                              </DialogDescription>
                            </DialogHeader>
                            <EventDetails event={event} />
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-muted-foreground">
                Showing {(page - 1) * pageSize + 1} to{" "}
                {Math.min(page * pageSize, filteredEvents.length)} of{" "}
                {filteredEvents.length} events
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EventDetails({ event }: { event: AlertEvent }) {
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-sm text-muted-foreground">Status</div>
          <div className="font-medium mt-1">
            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
          </div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Severity</div>
          <div className="font-medium mt-1">
            {event.severity.charAt(0).toUpperCase() + event.severity.slice(1)}
          </div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Metric Value</div>
          <div className="font-medium mt-1">{event.metricValue}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Threshold</div>
          <div className="font-medium mt-1">{event.threshold}</div>
        </div>
      </div>

      <div>
        <div className="text-sm text-muted-foreground">Message</div>
        <div className="font-medium mt-1">{event.message}</div>
      </div>

      {event.ruleId && (
        <div>
          <div className="text-sm text-muted-foreground">Related Rule</div>
          <Badge variant="outline" className="mt-1 font-mono">
            {event.ruleId}
          </Badge>
        </div>
      )}

      <div className="border-t pt-4">
        <div className="text-sm font-medium mb-2">Timeline</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-muted-foreground">Triggered:</span>
            <span>{formatTime(event.triggeredAt)}</span>
          </div>
          {event.acknowledgedAt && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">Acknowledged:</span>
              <span>{formatTime(event.acknowledgedAt)}</span>
              {event.acknowledgedBy && (
                <span className="text-muted-foreground">by {event.acknowledgedBy}</span>
              )}
            </div>
          )}
          {event.resolvedAt && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Resolved:</span>
              <span>{formatTime(event.resolvedAt)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="text-sm font-medium mb-2">Webhook Deliveries</div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Sent:</span>
            <span>{event.webhooksSent}</span>
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="h-4 w-4" />
            <span>{event.webhooksSucceeded}</span>
          </div>
          <div className="flex items-center gap-1 text-red-600">
            <XCircle className="h-4 w-4" />
            <span>{event.webhooksFailed}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
