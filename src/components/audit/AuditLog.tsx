"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Download, 
  Filter, 
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Info,
  Check,
  X,
  Eye,
  Calendar,
  MoreHorizontal,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import { useAudit, type AuditEntry, type AuditFilter, type AuditAction, type AuditResource, type AuditSeverity } from "./AuditProvider";

const PAGE_SIZE = 15;

export function AuditLog() {
  const { getEntries, exportEntries } = useAudit();
  
  const [filter, setFilter] = useState<AuditFilter>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Apply filters and search
  const filteredEntries = useMemo(() => {
    return getEntries({
      ...filter,
      searchQuery,
    });
  }, [getEntries, filter, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleExport = (format: "json" | "csv") => {
    const data = exportEntries(filter, format);
    const blob = new Blob([data], { type: format === "json" ? "application/json" : "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().split("T")[0]}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setFilter({});
    setSearchQuery("");
    setCurrentPage(1);
  };

  const getSeverityIcon = (severity: AuditSeverity) => {
    switch (severity) {
      case "critical": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "warning": return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case "critical": return <Badge variant="destructive">Critical</Badge>;
      case "warning": return <Badge className="bg-amber-500">Warning</Badge>;
      default: return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getActionBadge = (action: AuditAction) => {
    const colors: Record<AuditAction, string> = {
      create: "bg-green-500",
      update: "bg-blue-500",
      delete: "bg-red-500",
      read: "bg-gray-500",
      start: "bg-emerald-500",
      stop: "bg-orange-500",
      restart: "bg-yellow-500",
      login: "bg-violet-500",
      logout: "bg-slate-500",
      export: "bg-cyan-500",
      import: "bg-indigo-500",
      execute: "bg-pink-500",
    };
    return <Badge className={colors[action]}>{action}</Badge>;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Audit Log
              </CardTitle>
              <CardDescription>
                Track all system activities and user actions
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport("json")}>
                    <FileJson className="mr-2 h-4 w-4" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("csv")}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="mb-4 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user, resource, action..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8"
                />
              </div>
              <Button
                variant={showFilters ? "secondary" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {Object.keys(filter).length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {Object.keys(filter).length}
                  </Badge>
                )}
              </Button>
              {(Object.keys(filter).length > 0 || searchQuery) && (
                <Button variant="ghost" onClick={resetFilters}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              )}
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-sm font-medium mb-1 block">Action</label>
                  <Select
                    value={filter.action || "all"}
                    onValueChange={(value) => {
                      setFilter((prev) => ({
                        ...prev,
                        action: value === "all" ? undefined : value as AuditAction,
                      }));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                      <SelectItem value="start">Start</SelectItem>
                      <SelectItem value="stop">Stop</SelectItem>
                      <SelectItem value="login">Login</SelectItem>
                      <SelectItem value="logout">Logout</SelectItem>
                      <SelectItem value="export">Export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Resource</label>
                  <Select
                    value={filter.resource || "all"}
                    onValueChange={(value) => {
                      setFilter((prev) => ({
                        ...prev,
                        resource: value === "all" ? undefined : value as AuditResource,
                      }));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All resources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Resources</SelectItem>
                      <SelectItem value="stream">Stream</SelectItem>
                      <SelectItem value="rule">Rule</SelectItem>
                      <SelectItem value="table">Table</SelectItem>
                      <SelectItem value="plugin">Plugin</SelectItem>
                      <SelectItem value="service">Service</SelectItem>
                      <SelectItem value="config">Config</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="session">Session</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Severity</label>
                  <Select
                    value={filter.severity || "all"}
                    onValueChange={(value) => {
                      setFilter((prev) => ({
                        ...prev,
                        severity: value === "all" ? undefined : value as AuditSeverity,
                      }));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All severities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select
                    value={filter.success === undefined ? "all" : filter.success ? "success" : "failed"}
                    onValueChange={(value) => {
                      setFilter((prev) => ({
                        ...prev,
                        success: value === "all" ? undefined : value === "success",
                      }));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Date Range</label>
                  <Input
                    type="date"
                    value={filter.startDate || ""}
                    onChange={(e) => {
                      setFilter((prev) => ({ ...prev, startDate: e.target.value || undefined }));
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Results Summary */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {paginatedEntries.length} of {filteredEntries.length} entries
            </p>
          </div>

          {/* Audit Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{getSeverityIcon(entry.severity)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {formatTimestamp(entry.timestamp)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{entry.username}</p>
                        <p className="text-xs text-muted-foreground">{entry.userRole}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(entry.action)}</TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="outline">{entry.resource}</Badge>
                        {entry.resourceName && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {entry.resourceName}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {entry.success ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <Check className="h-4 w-4" />
                          <span className="text-sm">Success</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <X className="h-4 w-4" />
                          <span className="text-sm">Failed</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEntry(entry)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Audit Entry Details</DialogTitle>
                            <DialogDescription>
                              Full details of the audit log entry
                            </DialogDescription>
                          </DialogHeader>
                          {selectedEntry && <AuditEntryDetails entry={selectedEntry} />}
                        </DialogContent>
                      </Dialog>
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
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
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

function AuditEntryDetails({ entry }: { entry: AuditEntry }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Entry ID</label>
          <p className="font-mono text-sm">{entry.id}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
          <p className="font-mono text-sm">{new Date(entry.timestamp).toLocaleString()}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">User</label>
          <p>{entry.username} ({entry.userRole})</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">User ID</label>
          <p className="font-mono text-sm">{entry.userId}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Action</label>
          <Badge className="mt-1">{entry.action}</Badge>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Resource</label>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline">{entry.resource}</Badge>
            {entry.resourceName && <span>({entry.resourceName})</span>}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Severity</label>
          <div className="mt-1">
            <Badge
              variant={
                entry.severity === "critical"
                  ? "destructive"
                  : entry.severity === "warning"
                  ? "default"
                  : "secondary"
              }
            >
              {entry.severity}
            </Badge>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Status</label>
          <p className={entry.success ? "text-green-600" : "text-red-600"}>
            {entry.success ? "Success" : "Failed"}
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">IP Address</label>
          <p className="font-mono text-sm">{entry.ipAddress || "N/A"}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Resource ID</label>
          <p className="font-mono text-sm">{entry.resourceId || "N/A"}</p>
        </div>
      </div>

      {entry.errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <label className="text-sm font-medium text-red-600">Error Message</label>
          <p className="text-sm text-red-700">{entry.errorMessage}</p>
        </div>
      )}

      {entry.details && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">Additional Details</label>
          <pre className="mt-1 p-3 bg-muted rounded-lg text-sm overflow-auto max-h-[200px]">
            {JSON.stringify(entry.details, null, 2)}
          </pre>
        </div>
      )}

      {(entry.previousValue !== undefined || entry.newValue !== undefined) && (
        <div className="grid grid-cols-2 gap-4">
          {entry.previousValue !== undefined && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Previous Value</label>
              <pre className="mt-1 p-3 bg-red-50 rounded-lg text-sm overflow-auto max-h-[150px]">
                {JSON.stringify(entry.previousValue, null, 2)}
              </pre>
            </div>
          )}
          {entry.newValue !== undefined && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">New Value</label>
              <pre className="mt-1 p-3 bg-green-50 rounded-lg text-sm overflow-auto max-h-[150px]">
                {JSON.stringify(entry.newValue, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {entry.userAgent && (
        <div>
          <label className="text-sm font-medium text-muted-foreground">User Agent</label>
          <p className="text-xs text-muted-foreground break-all">{entry.userAgent}</p>
        </div>
      )}
    </div>
  );
}
