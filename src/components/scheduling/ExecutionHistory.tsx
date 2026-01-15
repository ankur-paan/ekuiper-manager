"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  History,
  Search,
  Filter,
  Check,
  X,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Play,
} from "lucide-react";

interface ExecutionRecord {
  id: string;
  scheduleId: string;
  ruleId: string;
  ruleName: string;
  scheduledTime: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: "success" | "failure" | "running" | "cancelled";
  recordsProcessed?: number;
  errorMessage?: string;
  triggeredBy: "schedule" | "manual";
}

// Generate demo execution history
const generateDemoHistory = (): ExecutionRecord[] => {
  const records: ExecutionRecord[] = [];
  const rules = [
    { id: "rule-1", name: "data_processor" },
    { id: "rule-2", name: "hourly_aggregation" },
    { id: "rule-3", name: "daily_report" },
    { id: "rule-4", name: "cleanup_job" },
  ];

  for (let i = 0; i < 50; i++) {
    const rule = rules[Math.floor(Math.random() * rules.length)];
    const scheduledTime = new Date(Date.now() - i * 3600000 * Math.random() * 24);
    const startTime = new Date(scheduledTime.getTime() + 1000);
    const duration = Math.floor(Math.random() * 300) + 5;
    const status =
      Math.random() > 0.9
        ? "failure"
        : Math.random() > 0.95
        ? "cancelled"
        : "success";

    records.push({
      id: `exec-${i + 1}`,
      scheduleId: `sched-${(i % 4) + 1}`,
      ruleId: rule.id,
      ruleName: rule.name,
      scheduledTime: scheduledTime.toISOString(),
      startTime: startTime.toISOString(),
      endTime: new Date(startTime.getTime() + duration * 1000).toISOString(),
      duration: duration,
      status,
      recordsProcessed:
        status === "success"
          ? Math.floor(Math.random() * 10000) + 100
          : undefined,
      errorMessage:
        status === "failure"
          ? "Connection timeout: Unable to reach sink endpoint"
          : undefined,
      triggeredBy: Math.random() > 0.8 ? "manual" : "schedule",
    });
  }

  return records.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );
};

const PAGE_SIZE = 10;

export function ExecutionHistory() {
  const [history] = useState<ExecutionRecord[]>(generateDemoHistory);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ruleFilter, setRuleFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredHistory = useMemo(() => {
    return history.filter((record) => {
      if (statusFilter !== "all" && record.status !== statusFilter) return false;
      if (ruleFilter !== "all" && record.ruleId !== ruleFilter) return false;
      if (
        searchQuery &&
        !record.ruleName.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  }, [history, statusFilter, ruleFilter, searchQuery]);

  const totalPages = Math.ceil(filteredHistory.length / PAGE_SIZE);
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const uniqueRules = [...new Set(history.map((r) => r.ruleId))].map((id) => ({
    id,
    name: history.find((r) => r.ruleId === id)?.ruleName || id,
  }));

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "—";
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatTime = (isoString: string): string => {
    return new Date(isoString).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return (
          <Badge className="bg-green-500">
            <Check className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case "failure":
        return (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case "running":
        return (
          <Badge className="bg-blue-500">
            <Play className="h-3 w-3 mr-1" />
            Running
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary">
            <X className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Stats
  const stats = useMemo(() => {
    const total = history.length;
    const success = history.filter((r) => r.status === "success").length;
    const failed = history.filter((r) => r.status === "failure").length;
    const avgDuration =
      history
        .filter((r) => r.duration)
        .reduce((sum, r) => sum + (r.duration || 0), 0) /
      history.filter((r) => r.duration).length;

    return { total, success, failed, avgDuration };
  }, [history]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Successful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.success}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDuration(Math.round(stats.avgDuration))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Execution History
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by rule name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failure">Failed</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={ruleFilter}
              onValueChange={(v) => {
                setRuleFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Rule" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Rules</SelectItem>
                {uniqueRules.map((rule) => (
                  <SelectItem key={rule.id} value={rule.id}>
                    {rule.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedHistory.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="font-medium">{record.ruleName}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTime(record.scheduledTime)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatTime(record.startTime)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {formatDuration(record.duration)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {record.recordsProcessed?.toLocaleString() || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {record.triggeredBy}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(record.status)}
                      {record.errorMessage && (
                        <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate">
                          {record.errorMessage}
                        </p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to{" "}
                {Math.min(currentPage * PAGE_SIZE, filteredHistory.length)} of{" "}
                {filteredHistory.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
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
