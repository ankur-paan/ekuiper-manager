"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Clock,
  Calendar,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  MoreHorizontal,
  Check,
  X,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

export interface RuleSchedule {
  id: string;
  ruleId: string;
  ruleName: string;
  enabled: boolean;
  cronExpression: string;
  cronDescription: string;
  timezone: string;
  nextRun?: string;
  lastRun?: string;
  lastStatus?: "success" | "failure" | "running";
  maxDuration?: number;
  createdAt: string;
  updatedAt: string;
}

// Demo schedules
const DEMO_SCHEDULES: RuleSchedule[] = [
  {
    id: "sched-1",
    ruleId: "rule-1",
    ruleName: "data_processor",
    enabled: true,
    cronExpression: "0 */5 * * * *",
    cronDescription: "Every 5 minutes",
    timezone: "UTC",
    nextRun: new Date(Date.now() + 300000).toISOString(),
    lastRun: new Date(Date.now() - 300000).toISOString(),
    lastStatus: "success",
    maxDuration: 60,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sched-2",
    ruleId: "rule-2",
    ruleName: "hourly_aggregation",
    enabled: true,
    cronExpression: "0 0 * * * *",
    cronDescription: "Every hour",
    timezone: "America/New_York",
    nextRun: new Date(Date.now() + 3600000).toISOString(),
    lastRun: new Date(Date.now() - 3600000).toISOString(),
    lastStatus: "success",
    maxDuration: 300,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sched-3",
    ruleId: "rule-3",
    ruleName: "daily_report",
    enabled: false,
    cronExpression: "0 0 9 * * *",
    cronDescription: "Every day at 9:00 AM",
    timezone: "Europe/London",
    lastRun: new Date(Date.now() - 86400000).toISOString(),
    lastStatus: "failure",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "sched-4",
    ruleId: "rule-4",
    ruleName: "cleanup_job",
    enabled: true,
    cronExpression: "0 0 0 * * 0",
    cronDescription: "Every Sunday at midnight",
    timezone: "UTC",
    nextRun: new Date(Date.now() + 604800000).toISOString(),
    lastRun: new Date(Date.now() - 604800000).toISOString(),
    lastStatus: "success",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function ScheduleManager() {
  const [schedules, setSchedules] = useState<RuleSchedule[]>(DEMO_SCHEDULES);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RuleSchedule | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleToggleEnabled = (scheduleId: string) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === scheduleId
          ? { ...s, enabled: !s.enabled, updatedAt: new Date().toISOString() }
          : s
      )
    );
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Simulate API refresh
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500">Success</Badge>;
      case "failure":
        return <Badge variant="destructive">Failed</Badge>;
      case "running":
        return <Badge className="bg-blue-500">Running</Badge>;
      default:
        return <Badge variant="secondary">Never Run</Badge>;
    }
  };

  const activeCount = schedules.filter((s) => s.enabled).length;
  const failedCount = schedules.filter((s) => s.lastStatus === "failure").length;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Schedules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inactive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-500">
              {schedules.length - activeCount}
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
            <div className="text-2xl font-bold text-red-600">{failedCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Schedule List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Rule Schedules
              </CardTitle>
              <CardDescription>
                Manage cron-based scheduling for your rules
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Schedule</DialogTitle>
                    <DialogDescription>
                      Schedule a rule to run automatically on a cron schedule
                    </DialogDescription>
                  </DialogHeader>
                  <ScheduleForm
                    onSubmit={(schedule) => {
                      setSchedules((prev) => [
                        ...prev,
                        {
                          ...schedule,
                          id: `sched-${Date.now()}`,
                          createdAt: new Date().toISOString(),
                          updatedAt: new Date().toISOString(),
                        },
                      ]);
                      setIsAddDialogOpen(false);
                    }}
                    onCancel={() => setIsAddDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>
                      <div className="font-medium">{schedule.ruleName}</div>
                      <div className="text-xs text-muted-foreground">
                        {schedule.ruleId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{schedule.cronExpression}</div>
                      <div className="text-xs text-muted-foreground">
                        {schedule.cronDescription}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{schedule.timezone}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {schedule.enabled ? formatDate(schedule.nextRun) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(schedule.lastRun)}
                    </TableCell>
                    <TableCell>{getStatusBadge(schedule.lastStatus)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={schedule.enabled}
                        onCheckedChange={() => handleToggleEnabled(schedule.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditingSchedule(schedule)}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Play className="mr-2 h-4 w-4" />
                            Run Now
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingSchedule}
        onOpenChange={(open) => !open && setEditingSchedule(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              Modify the schedule configuration
            </DialogDescription>
          </DialogHeader>
          {editingSchedule && (
            <ScheduleForm
              schedule={editingSchedule}
              onSubmit={(updated) => {
                setSchedules((prev) =>
                  prev.map((s) =>
                    s.id === editingSchedule.id
                      ? { ...s, ...updated, updatedAt: new Date().toISOString() }
                      : s
                  )
                );
                setEditingSchedule(null);
              }}
              onCancel={() => setEditingSchedule(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ScheduleFormProps {
  schedule?: RuleSchedule;
  onSubmit: (schedule: Omit<RuleSchedule, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}

function ScheduleForm({ schedule, onSubmit, onCancel }: ScheduleFormProps) {
  const [formData, setFormData] = useState({
    ruleId: schedule?.ruleId || "",
    ruleName: schedule?.ruleName || "",
    cronExpression: schedule?.cronExpression || "0 */5 * * * *",
    cronDescription: schedule?.cronDescription || "Every 5 minutes",
    timezone: schedule?.timezone || "UTC",
    enabled: schedule?.enabled ?? true,
    maxDuration: schedule?.maxDuration || 60,
  });

  // Demo rules for selection
  const availableRules = [
    { id: "rule-1", name: "data_processor" },
    { id: "rule-2", name: "hourly_aggregation" },
    { id: "rule-3", name: "daily_report" },
    { id: "rule-4", name: "cleanup_job" },
    { id: "rule-5", name: "alert_monitor" },
  ];

  const presetSchedules = [
    { expression: "0 */1 * * * *", description: "Every minute" },
    { expression: "0 */5 * * * *", description: "Every 5 minutes" },
    { expression: "0 */15 * * * *", description: "Every 15 minutes" },
    { expression: "0 0 * * * *", description: "Every hour" },
    { expression: "0 0 */6 * * *", description: "Every 6 hours" },
    { expression: "0 0 0 * * *", description: "Daily at midnight" },
    { expression: "0 0 9 * * *", description: "Daily at 9:00 AM" },
    { expression: "0 0 0 * * 0", description: "Weekly on Sunday" },
    { expression: "0 0 0 1 * *", description: "Monthly on the 1st" },
  ];

  const timezones = [
    "UTC",
    "America/New_York",
    "America/Los_Angeles",
    "America/Chicago",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
  ];

  const handlePresetSelect = (preset: typeof presetSchedules[0]) => {
    setFormData((prev) => ({
      ...prev,
      cronExpression: preset.expression,
      cronDescription: preset.description,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      nextRun: new Date(Date.now() + 300000).toISOString(), // Demo next run
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rule">Rule</Label>
          <Select
            value={formData.ruleId}
            onValueChange={(value) => {
              const rule = availableRules.find((r) => r.id === value);
              setFormData((prev) => ({
                ...prev,
                ruleId: value,
                ruleName: rule?.name || "",
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a rule" />
            </SelectTrigger>
            <SelectContent>
              {availableRules.map((rule) => (
                <SelectItem key={rule.id} value={rule.id}>
                  {rule.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Select
            value={formData.timezone}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, timezone: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timezones.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Quick Schedule Presets</Label>
        <div className="flex flex-wrap gap-2">
          {presetSchedules.map((preset) => (
            <Button
              key={preset.expression}
              type="button"
              variant={
                formData.cronExpression === preset.expression
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => handlePresetSelect(preset)}
            >
              {preset.description}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cronExpression">Cron Expression</Label>
          <Input
            id="cronExpression"
            value={formData.cronExpression}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, cronExpression: e.target.value }))
            }
            placeholder="0 */5 * * * *"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Format: second minute hour day month weekday
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxDuration">Max Duration (minutes)</Label>
          <Input
            id="maxDuration"
            type="number"
            min={1}
            max={1440}
            value={formData.maxDuration}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                maxDuration: parseInt(e.target.value) || 60,
              }))
            }
          />
          <p className="text-xs text-muted-foreground">
            Auto-stop rule after this duration
          </p>
        </div>
      </div>

      <div className="p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">Schedule Preview</span>
        </div>
        <p className="text-sm">{formData.cronDescription}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Cron: <code className="bg-muted px-1 rounded">{formData.cronExpression}</code>
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="enabled"
          checked={formData.enabled}
          onCheckedChange={(checked) =>
            setFormData((prev) => ({ ...prev, enabled: checked }))
          }
        />
        <Label htmlFor="enabled">Enable schedule immediately</Label>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.ruleId}>
          {schedule ? "Update" : "Create"} Schedule
        </Button>
      </DialogFooter>
    </form>
  );
}
