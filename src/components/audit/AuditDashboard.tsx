"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Activity, 
  Users, 
  AlertTriangle, 
  TrendingUp,
  Clock,
  Shield,
  FileText,
  Database
} from "lucide-react";
import { useAudit, type AuditAction, type AuditResource } from "./AuditProvider";

export function AuditDashboard() {
  const { entries } = useAudit();

  const stats = useMemo(() => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const last24h = entries.filter((e) => new Date(e.timestamp) > oneDayAgo);
    const lastWeek = entries.filter((e) => new Date(e.timestamp) > oneWeekAgo);

    // Action counts
    const actionCounts = entries.reduce((acc, e) => {
      acc[e.action] = (acc[e.action] || 0) + 1;
      return acc;
    }, {} as Record<AuditAction, number>);

    // Resource counts
    const resourceCounts = entries.reduce((acc, e) => {
      acc[e.resource] = (acc[e.resource] || 0) + 1;
      return acc;
    }, {} as Record<AuditResource, number>);

    // User activity
    const userActivity = entries.reduce((acc, e) => {
      acc[e.username] = (acc[e.username] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Failed operations
    const failedOps = entries.filter((e) => !e.success);
    const failedLast24h = last24h.filter((e) => !e.success);

    // Critical events
    const criticalEvents = entries.filter((e) => e.severity === "critical");
    const criticalLast24h = last24h.filter((e) => e.severity === "critical");

    // Unique users
    const uniqueUsers = new Set(entries.map((e) => e.userId)).size;
    const uniqueUsersLast24h = new Set(last24h.map((e) => e.userId)).size;

    return {
      total: entries.length,
      last24h: last24h.length,
      lastWeek: lastWeek.length,
      actionCounts,
      resourceCounts,
      userActivity,
      failedOps: failedOps.length,
      failedLast24h: failedLast24h.length,
      criticalEvents: criticalEvents.length,
      criticalLast24h: criticalLast24h.length,
      uniqueUsers,
      uniqueUsersLast24h,
      topUsers: Object.entries(userActivity)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
      topResources: Object.entries(resourceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
    };
  }, [entries]);

  const recentActivity = entries.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.last24h} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.uniqueUsersLast24h} active today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.criticalEvents}</div>
            <p className="text-xs text-muted-foreground">
              {stats.criticalLast24h} in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Operations</CardTitle>
            <Shield className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.failedOps}</div>
            <p className="text-xs text-muted-foreground">
              {stats.failedLast24h} in last 24h
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Users */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Most Active Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topUsers.map(([username, count], index) => (
                <div key={username} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      #{index + 1}
                    </span>
                    <span className="font-medium">{username}</span>
                  </div>
                  <Badge variant="secondary">{count} actions</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Most Accessed Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topResources.map(([resource, count], index) => (
                <div key={resource} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      #{index + 1}
                    </span>
                    <Badge variant="outline">{resource}</Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">{count} events</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Action Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.actionCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([action, count]) => (
                <Badge key={action} variant="secondary" className="text-sm">
                  {action}: {count}
                </Badge>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between p-2 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm">
                      <span className="font-medium">{entry.username}</span>{" "}
                      <span className="text-muted-foreground">performed</span>{" "}
                      <Badge variant="outline" className="mx-1">
                        {entry.action}
                      </Badge>{" "}
                      <span className="text-muted-foreground">on</span>{" "}
                      <Badge variant="secondary">{entry.resource}</Badge>
                    </p>
                    {entry.resourceName && (
                      <p className="text-xs text-muted-foreground">
                        {entry.resourceName}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
