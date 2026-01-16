"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { 
  Workflow,
  Search,
  RefreshCw,
  Play,
  Pause,
  Trash2,
  MoreHorizontal,
  CheckSquare,
  Square,
  Eye,
  Settings,
  ChevronRight,
  Zap,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EKuiperManagerClient } from "@/lib/ekuiper/manager-client";
import { RuleTopologyViewer } from "./rule-topology";
import type { Rule, RuleStatus } from "@/lib/ekuiper";

interface BatchRulesManagerProps {
  client: EKuiperManagerClient;
}

export function BatchRulesManager({ client }: BatchRulesManagerProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "stopped">("all");
  const [viewingTopology, setViewingTopology] = useState<string | null>(null);

  // Fetch all rules
  const { data: rules = [], isLoading, refetch } = useQuery({
    queryKey: ["rules-list"],
    queryFn: () => client.listRules(),
  });

  // Batch start mutation
  const startMutation = useMutation({
    mutationFn: (ruleIds: string[]) => client.batchStartRules(ruleIds),
    onSuccess: (results) => {
      const success = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success).length;
      queryClient.invalidateQueries({ queryKey: ["rules-list"] });
      toast({
        title: "Batch start completed",
        description: `${success} started, ${failed} failed`,
        variant: failed > 0 ? "destructive" : "default",
      });
      setSelectedRules(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Batch start failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Batch stop mutation
  const stopMutation = useMutation({
    mutationFn: (ruleIds: string[]) => client.batchStopRules(ruleIds),
    onSuccess: (results) => {
      const success = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success).length;
      queryClient.invalidateQueries({ queryKey: ["rules-list"] });
      toast({
        title: "Batch stop completed",
        description: `${success} stopped, ${failed} failed`,
        variant: failed > 0 ? "destructive" : "default",
      });
      setSelectedRules(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Batch stop failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Batch delete mutation
  const deleteMutation = useMutation({
    mutationFn: (ruleIds: string[]) => client.batchDeleteRules(ruleIds),
    onSuccess: (results) => {
      const success = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success).length;
      queryClient.invalidateQueries({ queryKey: ["rules-list"] });
      toast({
        title: "Batch delete completed",
        description: `${success} deleted, ${failed} failed`,
        variant: failed > 0 ? "destructive" : "default",
      });
      setSelectedRules(new Set());
    },
    onError: (error: Error) => {
      toast({
        title: "Batch delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter rules
  const filteredRules = useMemo(() => {
    return rules.filter((rule: any) => {
      const matchesSearch = rule.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = 
        statusFilter === "all" || 
        (statusFilter === "running" && rule.status === "running") ||
        (statusFilter === "stopped" && rule.status !== "running");
      return matchesSearch && matchesStatus;
    });
  }, [rules, searchTerm, statusFilter]);

  // Selection helpers
  const allSelected = filteredRules.length > 0 && selectedRules.size === filteredRules.length;
  const someSelected = selectedRules.size > 0 && selectedRules.size < filteredRules.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedRules(new Set());
    } else {
      setSelectedRules(new Set(filteredRules.map((r: any) => r.id)));
    }
  };

  const toggleSelect = (ruleId: string) => {
    const newSelected = new Set(selectedRules);
    if (newSelected.has(ruleId)) {
      newSelected.delete(ruleId);
    } else {
      newSelected.add(ruleId);
    }
    setSelectedRules(newSelected);
  };

  // Stats
  const runningCount = rules.filter((r: any) => r.status === "running").length;
  const stoppedCount = rules.length - runningCount;

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Batch Rule Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage multiple rules simultaneously
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card 
          className={cn(
            "cursor-pointer transition-colors",
            statusFilter === "all" && "ring-2 ring-primary"
          )}
          onClick={() => setStatusFilter("all")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{rules.length}</p>
                <p className="text-sm text-muted-foreground">Total Rules</p>
              </div>
              <Workflow className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-colors",
            statusFilter === "running" && "ring-2 ring-green-500"
          )}
          onClick={() => setStatusFilter("running")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-500">{runningCount}</p>
                <p className="text-sm text-muted-foreground">Running</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn(
            "cursor-pointer transition-colors",
            statusFilter === "stopped" && "ring-2 ring-yellow-500"
          )}
          onClick={() => setStatusFilter("stopped")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-yellow-500">{stoppedCount}</p>
                <p className="text-sm text-muted-foreground">Stopped</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Batch Actions */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {selectedRules.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{selectedRules.size} selected</Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => startMutation.mutate(Array.from(selectedRules))}
              disabled={startMutation.isPending}
            >
              <Play className="h-4 w-4 mr-1" />
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => stopMutation.mutate(Array.from(selectedRules))}
              disabled={stopMutation.isPending}
            >
              <Pause className="h-4 w-4 mr-1" />
              Stop
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (confirm(`Delete ${selectedRules.size} rules?`)) {
                  deleteMutation.mutate(Array.from(selectedRules));
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Rules Table */}
      <Card className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Workflow className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No rules found</p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="p-3 text-left w-12">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      className={cn(someSelected && "data-[state=checked]:bg-primary/50")}
                    />
                  </th>
                  <th className="p-3 text-left">Rule ID</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Messages</th>
                  <th className="p-3 text-left">Latency</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule: any) => (
                  <tr
                    key={rule.id}
                    className={cn(
                      "border-b hover:bg-muted/50 transition-colors",
                      selectedRules.has(rule.id) && "bg-primary/5"
                    )}
                  >
                    <td className="p-3">
                      <Checkbox
                        checked={selectedRules.has(rule.id)}
                        onCheckedChange={() => toggleSelect(rule.id)}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{rule.id}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={rule.status === "running" ? "success" : "secondary"}
                        className={cn(
                          rule.status === "running" 
                            ? "bg-green-500/10 text-green-500" 
                            : "bg-yellow-500/10 text-yellow-500"
                        )}
                      >
                        {rule.status || "stopped"}
                      </Badge>
                    </td>
                    <td className="p-3 font-mono text-sm">
                      {rule.in || 0} / {rule.out || 0}
                    </td>
                    <td className="p-3 font-mono text-sm">
                      {rule.latency || "-"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingTopology(rule.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (rule.status === "running") {
                              stopMutation.mutate([rule.id]);
                            } else {
                              startMutation.mutate([rule.id]);
                            }
                          }}
                        >
                          {rule.status === "running" ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Topology Viewer Dialog */}
      <Dialog open={!!viewingTopology} onOpenChange={(open) => !open && setViewingTopology(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Rule Topology</DialogTitle>
            <DialogDescription>
              Visual representation of rule processing flow
            </DialogDescription>
          </DialogHeader>
          {viewingTopology && (
            <div className="flex-1 h-full min-h-0">
              <RuleTopologyViewer client={client} ruleId={viewingTopology} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
