'use client';

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  Network,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { ekuiperClient } from '@/lib/ekuiper/client';

interface RuleStatusSheetProps {
  ruleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClearAlarm?: (ruleId: string) => void;
}

export function RuleStatusSheet({
  ruleId,
  open,
  onOpenChange,
  onClearAlarm,
}: RuleStatusSheetProps) {
  const [status, setStatus] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showRaw, setShowRaw] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    if (!ruleId) return;
    setLoading(true);
    try {
      const data = await ekuiperClient.getRuleStatus(ruleId);
      setStatus(data as unknown as Record<string, unknown>);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [ruleId]);

  React.useEffect(() => {
    if (open && ruleId) {
      void fetchStatus();
    }
  }, [open, ruleId, fetchStatus]);

  if (!ruleId) return null;

  // Extract operator statistics
  const statusEntries = status ? Object.entries(status) : [];
  const statusStr = String(status?.status ?? 'unknown').toLowerCase();
  const isRunning = statusStr === 'running';

  // Find exceptions
  const lastExceptionKeys = statusEntries.filter(([k]) => k.includes('last_exception'));
  const lastExceptionTimeKey = statusEntries.find(([k]) => k.includes('last_exception_time'));
  const exceptionsTotal = statusEntries.find(([k]) => k.includes('exceptions_total'));
  const lastExceptionMsg = lastExceptionKeys.find(([k]) => !k.includes('time'))?.[1];

  // Operator throughput items
  const opKeys = Array.from(
    new Set(
      statusEntries
        .map(([k]) => {
          const match = k.match(/^(source_[^._]+|op_[^._]+|sink_[^._]+)/);
          return match ? match[1] : null;
        })
        .filter(Boolean) as string[],
    ),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between pr-8">
            <Badge
              variant={isRunning ? 'default' : 'secondary'}
              className="text-xs font-mono"
            >
              {String(status?.status ?? 'Unknown')}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground touch-manipulation"
              onClick={() => void fetchStatus()}
              disabled={loading}
              title="Refresh status"
              aria-label="Refresh status"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
          </div>
          <SheetTitle className="text-lg font-mono font-semibold truncate pt-1">{ruleId}</SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Live runtime metrics and execution health for this rule.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 text-sm">
          {/* Alarms / Exception Alert */}
          {Boolean(lastExceptionMsg) && (
            <Alert variant="destructive">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
                  <AlertTitle className="text-xs font-semibold">Rule Exception Detected</AlertTitle>
                </div>
                {onClearAlarm && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/20 touch-manipulation"
                    onClick={() => onClearAlarm(ruleId)}
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
              <AlertDescription className="mt-2 flex flex-col gap-2">
                <p className="font-mono text-xs text-destructive/90 break-words whitespace-pre-wrap bg-background/50 p-2 rounded border border-destructive/20">
                  {String(lastExceptionMsg)}
                </p>
                {Boolean(lastExceptionTimeKey) && (
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="size-3" aria-hidden="true" />
                    <span>{String(lastExceptionTimeKey?.[1])}</span>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
              <span className="text-[11px] text-muted-foreground font-medium block">Exceptions Total</span>
              <span className="text-xl font-mono tabular-nums font-semibold text-foreground">
                {exceptionsTotal ? String(exceptionsTotal[1]) : '0'}
              </span>
            </div>
            <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
              <span className="text-[11px] text-muted-foreground font-medium block">Source Records</span>
              <span className="text-xl font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                {String(
                  statusEntries.find(([k]) => k.includes('source_') && k.endsWith('_records_in_total'))?.[1] ??
                    statusEntries.find(([k]) => k.endsWith('records_in_total'))?.[1] ??
                    '0',
                )}
              </span>
            </div>
          </div>

          {/* Operator Metrics Breakdown */}
          {opKeys.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Pipeline Operators
                </span>
                <span className="text-[11px] text-muted-foreground">{opKeys.length} active node(s)</span>
              </div>
              <div className="divide-y divide-border/60 rounded-lg border border-border/60 bg-card overflow-hidden">
                {opKeys.map((op) => {
                  const recordsIn = status?.[`${op}_records_in_total`];
                  const recordsOut = status?.[`${op}_records_out_total`];
                  const exceptions = status?.[`${op}_exceptions_total`];

                  return (
                    <div key={op} className="p-3 flex flex-col gap-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium text-foreground">{op}</span>
                        {exceptions && Number(exceptions) > 0 ? (
                          <Badge variant="destructive" className="text-[10px] h-5">
                            {String(exceptions)} err
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-5 text-emerald-600">
                            OK
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-mono">
                        {recordsIn !== undefined && (
                          <span>
                            IN: <strong className="text-foreground">{String(recordsIn)}</strong>
                          </span>
                        )}
                        {recordsOut !== undefined && (
                          <span>
                            OUT: <strong className="text-foreground">{String(recordsOut)}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Topology link shortcut */}
          <div className="pt-2">
            <Button asChild variant="outline" className="w-full text-xs gap-2">
              <Link href={`/rules/${encodeURIComponent(ruleId)}?tab=topology`}>
                <Network className="size-4" />
                Open Live Interactive Topology
                <ArrowRight className="size-3.5 ml-auto text-muted-foreground" />
              </Link>
            </Button>
          </div>

          <Separator />

          {/* Raw Metrics JSON Collapsible */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Telemetry Payload</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 text-muted-foreground"
                onClick={() => setShowRaw(!showRaw)}
                aria-expanded={showRaw}
              >
                {showRaw ? 'Hide JSON' : 'View Full JSON'}
              </Button>
            </div>
            {showRaw && (
              <pre className="p-3 rounded-lg border border-border/60 bg-muted/40 font-mono text-[11px] leading-relaxed max-h-[220px] overflow-auto text-foreground whitespace-pre-wrap">
                {JSON.stringify(status, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
