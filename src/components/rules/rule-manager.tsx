'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BellOff,
  Copy,
  Download,
  FileCode2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Square,
  Tags,
  Trash2,
  Upload,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { ConfirmDialog } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ekuiperClient } from '@/lib/ekuiper/client';
import { duplicateRule as buildDuplicateRule } from '@/lib/ekuiper/rule-designer';
import { useServerStore } from '@/stores/server-store';
import { RuleTopologyViewer } from '@/components/rules/rule-topology-viewer';
import { ImportRuleModal } from '@/components/rules/import-rule-modal';
import { RuleStatusSheet } from '@/components/rules/rule-status-sheet';

interface RuleListRecord {
  id: string;
  name?: string;
  status?: string;
  version?: number;
  tags?: string[];
  trace?: boolean;
}

function running(status?: string): boolean {
  return status?.toLowerCase() === 'running';
}

function stopped(status?: string): boolean {
  return status?.toLowerCase() === 'stopped';
}

export function RuleList() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);
  const [rules, setRules] = React.useState<RuleListRecord[]>([]);
  const [ruleStatuses, setRuleStatuses] = React.useState<Record<string, Record<string, unknown>>>({});
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [deleteRule, setDeleteRule] = React.useState<RuleListRecord | null>(null);
  const [duplicateSource, setDuplicateSource] = React.useState<RuleListRecord | null>(null);
  const [duplicateId, setDuplicateId] = React.useState('');
  const [duplicateError, setDuplicateError] = React.useState('');
  const [duplicating, setDuplicating] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  // Batch selection & tools
  const [selectedRules, setSelectedRules] = React.useState<Set<string>>(new Set());
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [inspectRuleId, setInspectRuleId] = React.useState<string | null>(null);
  const [exporting, setExporting] = React.useState(false);
  const [alarmCutoff, setAlarmCutoff] = React.useState<number>(0);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('ekuiper_rules_alarm_cutoff');
      if (stored) setAlarmCutoff(Number(stored) || 0);
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  const load = React.useCallback(async () => {
    if (!active) return;
    setLoading(true);
    setError('');
    try {
      const [response, statuses] = await Promise.all([
        ekuiperClient.listRules(),
        ekuiperClient.getAllRulesStatus().catch(() => ({})),
      ]);
      setRules(
        (Array.isArray(response) ? response : []).map((item) =>
          typeof item === 'string' ? { id: item } : (item as RuleListRecord),
        ),
      );
      setRuleStatuses((statuses as Record<string, Record<string, unknown>>) || {});
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, [active]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const control = async (rule: RuleListRecord, action: 'start' | 'stop' | 'restart') => {
    setBusy(rule.id);
    try {
      if (action === 'start') await ekuiperClient.startRule(rule.id);
      else if (action === 'stop') await ekuiperClient.stopRule(rule.id);
      else await ekuiperClient.restartRule(rule.id);
      toast.success(`${rule.id} ${action} requested`);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : `Failed to ${action} rule`);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!deleteRule) return;
    try {
      await ekuiperClient.deleteRule(deleteRule.id);
      toast.success('Rule deleted');
      setSelectedRules((prev) => {
        const next = new Set(prev);
        next.delete(deleteRule.id);
        return next;
      });
      setDeleteRule(null);
      await load();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Failed to delete rule');
    }
  };

  const openDuplicate = (rule: RuleListRecord) => {
    setDuplicateSource(rule);
    setDuplicateId(`${rule.id}_copy`);
    setDuplicateError('');
  };

  const duplicate = async () => {
    if (!duplicateSource) return;
    const nextId = duplicateId.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(nextId)) {
      setDuplicateError('Rule ID may contain letters, numbers, hyphen, and underscore');
      return;
    }
    if (rules.some((rule) => rule.id === nextId)) {
      setDuplicateError('A rule with this ID already exists');
      return;
    }
    setDuplicating(true);
    setDuplicateError('');
    try {
      const source = await ekuiperClient.getRule(duplicateSource.id);
      await ekuiperClient.createRule(buildDuplicateRule(source, nextId));
      toast.success(`Created stopped copy ${nextId}`);
      setDuplicateSource(null);
      await load();
      router.push(`/rules/${encodeURIComponent(nextId)}/edit`);
    } catch (reason) {
      setDuplicateError(reason instanceof Error ? reason.message : 'Failed to duplicate rule');
    } finally {
      setDuplicating(false);
    }
  };

  // Export selected rules
  const handleExportSelected = async () => {
    const ids = Array.from(selectedRules);
    if (!ids.length) {
      toast.error('No rules selected');
      return;
    }
    setExporting(true);
    try {
      const blob = await ekuiperClient.exportRuleset(ids);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ekuiper-rules-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${ids.length} rule(s)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export rules');
    } finally {
      setExporting(false);
    }
  };

  // Clear all rule alarms (acknowledge timestamp)
  const handleClearAlarms = () => {
    const now = Date.now();
    try {
      localStorage.setItem('ekuiper_rules_alarm_cutoff', String(now));
    } catch {
      // Ignore localStorage error
    }
    setAlarmCutoff(now);
    toast.success('Rule alarms acknowledged and cleared');
  };

  // Compute alarm info for a rule
  const getRuleAlarm = (ruleId: string) => {
    const statusData = ruleStatuses[ruleId];
    if (!statusData) return { count: 0, lastException: '' };

    const entries = Object.entries(statusData);
    const lastTimeKey = entries.find(([k]) => k.includes('last_exception_time'));
    const totalExceptionsKey = entries.find(([k]) => k.includes('exceptions_total'));
    const lastExceptionKey = entries.find(([k]) => k.includes('last_exception') && !k.includes('time'));

    const lastTime = lastTimeKey?.[1] ? new Date(String(lastTimeKey[1])).getTime() : 0;
    if (alarmCutoff && lastTime > 0 && lastTime <= alarmCutoff) {
      return { count: 0, lastException: '' };
    }

    const count = totalExceptionsKey?.[1] ? Number(totalExceptionsKey[1]) : 0;
    const lastException = lastExceptionKey?.[1] ? String(lastExceptionKey[1]) : '';
    return { count, lastException };
  };

  const visible = rules.filter((rule) =>
    `${rule.id} ${rule.name ?? ''} ${(rule.tags ?? []).join(' ')}`.toLowerCase().includes(search.toLowerCase()),
  );

  const allVisibleSelected = visible.length > 0 && visible.every((r) => selectedRules.has(r.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedRules((prev) => {
        const next = new Set(prev);
        visible.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedRules((prev) => {
        const next = new Set(prev);
        visible.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AppLayout title="Rules">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Rules</h2>
            <p className="mt-1 text-muted-foreground">
              Create and operate rules on {active?.name ?? 'the selected eKuiper node'}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAlarms}
              title="Acknowledge and clear exception alarms"
              className="text-xs"
            >
              <BellOff className="mr-1.5 size-3.5 text-muted-foreground" />
              Clear Alarms
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportModalOpen(true)}
              className="text-xs"
            >
              <Upload className="mr-1.5 size-3.5 text-muted-foreground" />
              Import Rules
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="text-xs"
            >
              <RefreshCw className={`mr-1.5 size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" asChild className="text-xs transition-transform duration-150 active:scale-[0.97]">
              <Link href="/flows">
                <Workflow className="mr-1.5 size-3.5 text-primary" />
                Flows
              </Link>
            </Button>
            <Button size="sm" asChild className="text-xs transition-transform duration-150 active:scale-[0.97]">
              <Link href="/rules/new">
                <Plus className="mr-1.5 size-3.5" />
                Create rule
              </Link>
            </Button>
          </div>
        </div>

        {/* Search & Batch Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rules or tags"
              className="pl-9 h-9 text-xs"
            />
          </div>

          {selectedRules.size > 0 && (
            <div className="flex items-center gap-2 p-1 px-3 rounded-lg border border-primary/20 bg-primary/5 text-xs text-foreground animate-in fade-in">
              <span className="font-medium font-mono">{selectedRules.size} selected</span>
              <div className="h-4 w-px bg-border/60 mx-1" />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => void handleExportSelected()}
                disabled={exporting}
              >
                <Download className="h-3 w-3" />
                {exporting ? 'Exporting…' : 'Export JSON'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedRules(new Set())}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!active ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Select an eKuiper node first.
            </CardContent>
          </Card>
        ) : !loading && !visible.length ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-14 text-center">
              <Workflow className="mb-4 h-10 w-10 text-muted-foreground" />
              <h3 className="font-semibold">{search ? 'No matching rules' : 'No rules yet'}</h3>
              {!search && (
                <Button asChild className="mt-5">
                  <Link href="/rules/new">Create first rule</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border/50 bg-muted/20 text-xs font-medium text-muted-foreground">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleSelectAll}
                aria-label="Select all visible rules"
              />
              <span className="flex-1">Rule Name / ID</span>
              <span className="w-28 text-center">Status</span>
              <span className="w-24 text-center">Alarms</span>
              <span className="w-10"></span>
            </div>
            <CardContent className="divide-y p-0">
              {visible.map((rule) => {
                const isSelected = selectedRules.has(rule.id);
                const alarm = getRuleAlarm(rule.id);

                return (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-4 px-6 py-3.5 transition-colors ${
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelectOne(rule.id)}
                      aria-label={`Select rule ${rule.id}`}
                    />

                    {/* Status Dot with fast inspector trigger */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setInspectRuleId(rule.id)}
                            className="p-1 -m-1 rounded hover:bg-muted transition-colors cursor-pointer"
                            aria-label={`Inspect ${rule.id} status`}
                          >
                            <span
                              aria-hidden="true"
                              className={`block h-2.5 w-2.5 rounded-full ${
                                running(rule.status)
                                  ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                                  : stopped(rule.status)
                                  ? 'bg-slate-400'
                                  : 'bg-amber-500'
                              }`}
                            />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          Click to inspect live metrics
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Rule Link & Metadata */}
                    <Link href={`/rules/${encodeURIComponent(rule.id)}`} className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-sm hover:text-primary" title={rule.name || rule.id}>
                        {rule.name || rule.id}
                      </span>
                      {rule.name && (
                        <span className="block truncate text-xs font-mono text-muted-foreground" title={rule.id}>
                          {rule.id}
                        </span>
                      )}
                      <span className="mt-1 flex flex-wrap gap-1">
                        {(rule.tags ?? []).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    </Link>

                    {/* Status Pill */}
                    <div className="w-28 flex justify-center">
                      <button
                        type="button"
                        onClick={() => setInspectRuleId(rule.id)}
                        className="cursor-pointer"
                        aria-label={`Inspect status for ${rule.name || rule.id}`}
                      >
                        <Badge
                          variant={running(rule.status) ? 'default' : 'secondary'}
                          className="text-[11px] font-mono capitalize"
                        >
                          {rule.status ?? 'unknown'}
                        </Badge>
                      </button>
                    </div>

                    {/* Alarm Column */}
                    <div className="w-24 flex justify-center">
                      {alarm.count > 0 ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="destructive"
                                className="text-[11px] font-mono cursor-pointer gap-1"
                                onClick={() => setInspectRuleId(rule.id)}
                              >
                                <AlertTriangle className="size-3" aria-hidden="true" />
                                {alarm.count}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs font-mono">
                              <p className="font-semibold text-destructive">Last exception:</p>
                              <p className="break-words text-[11px]">{alarm.lastException || 'Runtime exception logged'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground/60 font-mono">—</span>
                      )}
                    </div>

                    {/* Row Dropdown Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={busy === rule.id}
                          aria-label={`Actions for ${rule.id}`}
                          className="size-8"
                        >
                          {busy === rule.id ? (
                            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
                          ) : (
                            <MoreHorizontal className="size-4" aria-hidden="true" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuItem onSelect={() => setInspectRuleId(rule.id)}>
                            <Activity className="mr-2 size-4 text-blue-500" aria-hidden="true" />
                            Inspect Status
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/rules/${encodeURIComponent(rule.id)}?tab=topology`}>
                              <Workflow className="mr-2 size-4 text-purple-500" aria-hidden="true" />
                              View Topology
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          {!running(rule.status) && (
                            <DropdownMenuItem onSelect={() => void control(rule, 'start')}>
                              <Play className="mr-2 size-4 text-emerald-500" />
                              Start
                            </DropdownMenuItem>
                          )}
                          {running(rule.status) && (
                            <DropdownMenuItem onSelect={() => void control(rule, 'stop')}>
                              <Square className="mr-2 size-4 text-amber-500" />
                              Stop
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onSelect={() => void control(rule, 'restart')}>
                            <RotateCw className="mr-2 size-4 text-cyan-500" />
                            Restart
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/rules/${encodeURIComponent(rule.id)}/edit`}>
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/flows">
                              <Workflow className="mr-2 size-4 text-primary" />
                              Flow Studio
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openDuplicate(rule)}>
                            <Copy className="mr-2 size-4" />
                            Duplicate
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem className="text-destructive" onSelect={() => setDeleteRule(rule)}>
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Duplicate Modal */}
      <Dialog
        open={Boolean(duplicateSource)}
        onOpenChange={(open) => {
          if (!open) {
            setDuplicateSource(null);
            setDuplicateError('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate rule</DialogTitle>
            <DialogDescription>
              Create a stopped copy of {duplicateSource?.id}. Runtime state and status are not copied.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="duplicate-rule-id">New rule ID</Label>
            <Input
              id="duplicate-rule-id"
              value={duplicateId}
              onChange={(event) => {
                setDuplicateId(event.target.value);
                setDuplicateError('');
              }}
              autoFocus
            />
            {duplicateError && (
              <Alert variant="destructive" className="py-2 text-xs">
                <AlertDescription>{duplicateError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDuplicateSource(null)} disabled={duplicating} className="touch-manipulation">
              Cancel
            </Button>
            <Button onClick={() => void duplicate()} disabled={duplicating || !duplicateId.trim()} className="touch-manipulation">
              {duplicating && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              {duplicating ? 'Duplicating…' : 'Duplicate stopped'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Modal */}
      <ImportRuleModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => void load()}
      />

      {/* Rule Status Sheet */}
      <RuleStatusSheet
        ruleId={inspectRuleId}
        open={Boolean(inspectRuleId)}
        onOpenChange={(open) => !open && setInspectRuleId(null)}
        onClearAlarm={handleClearAlarms}
      />

      <ConfirmDialog
        open={Boolean(deleteRule)}
        onOpenChange={(open) => !open && setDeleteRule(null)}
        title="Delete rule?"
        description={`Delete ${deleteRule?.id ?? 'this rule'} from eKuiper? This cannot be undone.`}
        confirmLabel="Delete rule"
        variant="danger"
        onConfirm={remove}
      />
    </AppLayout>
  );
}

type RuleTab = 'definition' | 'status' | 'topology' | 'schema' | 'explain' | 'trace';
const tabs: Array<{ id: RuleTab; label: string }> = [
  { id: 'definition', label: 'Definition' }, { id: 'status', label: 'Status' },
  { id: 'topology', label: 'Topology' }, { id: 'schema', label: 'Output schema' },
  { id: 'explain', label: 'Explain' }, { id: 'trace', label: 'Trace' },
];

export function RuleWorkspace({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (tabs.some((item) => item.id === searchParams.get('tab')) ? searchParams.get('tab') : 'definition') as RuleTab;
  const { servers, activeServerId } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);
  const [rule, setRule] = React.useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = React.useState<Record<string, unknown> | null>(null);
  const [tabData, setTabData] = React.useState<unknown>(null);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [duplicateOpen, setDuplicateOpen] = React.useState(false);
  const [duplicateId, setDuplicateId] = React.useState('');
  const [duplicateError, setDuplicateError] = React.useState('');
  const [duplicating, setDuplicating] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!active) return;
    setLoading(true); setError('');
    try {
      const [definition, ruleStatus] = await Promise.all([
        ekuiperClient.getRule(id), ekuiperClient.getRuleStatus(id).catch(() => ({})),
      ]);
      setRule(definition as unknown as Record<string, unknown>);
      setStatus(ruleStatus as unknown as Record<string, unknown>);
      if (tab === 'topology') setTabData(await ekuiperClient.getRuleTopology(id));
      else if (tab === 'schema') setTabData(await ekuiperClient.getRuleSchema(id));
      else if (tab === 'explain') setTabData(await ekuiperClient.getRuleExplain(id));
      else if (tab === 'trace') setTabData(await ekuiperClient.getRuleTraceIds(id));
      else setTabData(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Failed to load rule'); }
    finally { setLoading(false); }
  }, [active, id, tab]);
  React.useEffect(() => { void load(); }, [load]);

  const control = async (action: 'start' | 'stop' | 'restart') => {
    try { if (action === 'start') await ekuiperClient.startRule(id); else if (action === 'stop') await ekuiperClient.stopRule(id); else await ekuiperClient.restartRule(id); toast.success(`${action} requested`); await load(); } catch (reason) { toast.error(reason instanceof Error ? reason.message : 'Rule control failed'); }
  };
  const remove = async () => { await ekuiperClient.deleteRule(id); toast.success('Rule deleted'); router.push('/rules'); };
  const duplicate = async () => {
    const nextId = duplicateId.trim();
    if (!/^[A-Za-z0-9_-]+$/.test(nextId)) {
      setDuplicateError('Rule ID may contain letters, numbers, hyphen, and underscore');
      return;
    }
    setDuplicating(true);
    setDuplicateError('');
    try {
      const source = rule ?? await ekuiperClient.getRule(id);
      await ekuiperClient.createRule(buildDuplicateRule(source as any, nextId));
      toast.success(`Created stopped copy ${nextId}`);
      setDuplicateOpen(false);
      router.push(`/rules/${encodeURIComponent(nextId)}/edit`);
    } catch (reason) {
      setDuplicateError(reason instanceof Error ? reason.message : 'Failed to duplicate rule');
    } finally {
      setDuplicating(false);
    }
  };
  const setTab = (next: RuleTab) => router.replace(`/rules/${encodeURIComponent(id)}?tab=${next}`);
  const trace = async (action: 'start' | 'stop') => { if (action === 'start') await ekuiperClient.startRuleTrace(id, 'always'); else await ekuiperClient.stopRuleTrace(id); toast.success(`Trace ${action} requested`); await load(); };
  const statusValue = String(status?.status ?? 'unknown');

  return (
    <AppLayout title="Rule">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" asChild><Link href="/rules" aria-label="Back to rules"><ArrowLeft className="size-5" /></Link></Button><div><div className="flex items-center gap-2"><h2 className="text-2xl font-semibold tracking-tight">{String(rule?.name ?? id)}</h2><Badge variant={running(statusValue) ? 'default' : 'secondary'}>{statusValue}</Badge></div>{Boolean(rule?.name) && <p className="mt-1 text-sm text-muted-foreground">{id}</p>}</div></div><div className="flex flex-wrap gap-2">{running(statusValue) ? <Button variant="outline" onClick={() => void control('stop')}><Square className="mr-2 size-4" />Stop</Button> : <Button variant="outline" onClick={() => void control('start')}><Play className="mr-2 size-4" />Start</Button>}<Button variant="outline" onClick={() => void control('restart')}><RotateCw className="mr-2 size-4" />Restart</Button><Button variant="outline" onClick={() => { setDuplicateId(`${id}_copy`); setDuplicateError(''); setDuplicateOpen(true); }}><Copy className="mr-2 size-4" />Duplicate</Button><Button asChild><Link href={`/rules/${encodeURIComponent(id)}/edit`}><Pencil className="mr-2 size-4" />Edit</Link></Button><Button variant="destructive" size="icon" onClick={() => setDeleteOpen(true)} aria-label="Delete rule"><Trash2 className="size-4" /></Button></div></div>
        <div className="flex gap-1 overflow-x-auto border-b" role="tablist">{tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === item.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{item.label}</button>)}</div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {loading && !rule ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Loading rule…</CardContent></Card> : tab === 'definition' ? <div className="grid gap-4 lg:grid-cols-2"><Card className="lg:col-span-2"><CardHeader><CardTitle>SQL</CardTitle></CardHeader><CardContent><pre className="whitespace-pre-wrap rounded-md bg-muted p-4 font-mono text-sm">{String(rule?.sql ?? 'Graph rule')}</pre></CardContent></Card><Card><CardHeader><CardTitle>Actions</CardTitle></CardHeader><CardContent><pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(rule?.actions ?? [], null, 2)}</pre></CardContent></Card><Card><CardHeader><CardTitle>Options and tags</CardTitle></CardHeader><CardContent className="flex flex-col gap-4"><pre className="max-h-72 overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(rule?.options ?? {}, null, 2)}</pre><div className="flex flex-wrap gap-1">{((rule?.tags as string[] | undefined) ?? []).map((item) => <Badge key={item} variant="outline"><Tags className="mr-1 size-3" />{item}</Badge>)}</div></CardContent></Card></div> : tab === 'topology' ? (
          <RuleTopologyViewer
            ruleId={id}
            topology={tabData as any}
            status={status}
            isRunning={running(statusValue)}
            onRefresh={() => void load()}
          />
        ) : tab === 'status' ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-5" />Runtime status</CardTitle><CardDescription>Native values from eKuiper&apos;s v2 rule-status endpoint.</CardDescription></CardHeader><CardContent><pre className="max-h-[36rem] overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(status ?? {}, null, 2)}</pre></CardContent></Card> : tab === 'trace' ? <Card><CardHeader><CardTitle>Rule trace</CardTitle><CardDescription>Start or stop always-sampled tracing and inspect trace identifiers.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><div className="flex gap-2"><Button onClick={() => void trace('start')}><Play className="mr-2 size-4" />Start trace</Button><Button variant="outline" onClick={() => void trace('stop')}><Square className="mr-2 size-4" />Stop trace</Button></div><pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs">{JSON.stringify(tabData ?? [], null, 2)}</pre></CardContent></Card> : <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileCode2 className="size-5" />{tabs.find((item) => item.id === tab)?.label}</CardTitle><CardDescription>Authoritative response from the selected eKuiper node.</CardDescription></CardHeader><CardContent><pre className="max-h-[40rem] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-4 text-xs">{typeof tabData === 'string' ? tabData : JSON.stringify(tabData ?? {}, null, 2)}</pre></CardContent></Card>}
      </div>
      <Dialog open={duplicateOpen} onOpenChange={setDuplicateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate rule</DialogTitle>
            <DialogDescription>Create a stopped copy of {id}. Runtime metrics and state are reset.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Label htmlFor="dup-ws-id">New rule ID</Label>
            <Input id="dup-ws-id" value={duplicateId} onChange={(e) => { setDuplicateId(e.target.value); setDuplicateError(''); }} autoFocus />
            {duplicateError && (
              <Alert variant="destructive" className="py-2 text-xs">
                <AlertDescription>{duplicateError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDuplicateOpen(false)} disabled={duplicating} className="touch-manipulation">Cancel</Button>
            <Button onClick={() => void duplicate()} disabled={duplicating || !duplicateId.trim()} className="touch-manipulation">{duplicating && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}{duplicating ? 'Duplicating…' : 'Duplicate stopped'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Delete rule?" description={`Delete ${id} from eKuiper? This cannot be undone.`} confirmLabel="Delete rule" variant="danger" onConfirm={remove} />
    </AppLayout>
  );
}
