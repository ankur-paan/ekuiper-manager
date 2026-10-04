'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Network, RefreshCw, CheckCircle2, XCircle, Code2, FormInput, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PropertyForm, i18nLabel } from '@/components/connectors/property-form';
import { ConnectorIcon } from '@/components/connectors/connector-icon';
import { ekuiperClient } from '@/lib/ekuiper/client';
import type { MetadataItem, MetadataProperty, MetadataDetail } from '@/lib/ekuiper/types';

export interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingConnection?: { id: string; typ: string; props: Record<string, any> } | null;
  onSaved?: () => void;
}

export function ConnectionModal({
  open,
  onOpenChange,
  editingConnection = null,
  onSaved,
}: ConnectionModalProps) {
  const isEdit = Boolean(editingConnection);
  const [id, setId] = React.useState('');
  const [type, setType] = React.useState('mqtt');
  const [props, setProps] = React.useState<Record<string, any>>({});
  const [rawJson, setRawJson] = React.useState('{}');
  const [isJsonMode, setIsJsonMode] = React.useState(false);

  const [availableTypes, setAvailableTypes] = React.useState<MetadataItem[]>([]);
  const [properties, setProperties] = React.useState<MetadataProperty[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message?: string } | null>(null);

  // Sync state when dialog opens
  React.useEffect(() => {
    if (open) {
      if (editingConnection) {
        setId(editingConnection.id);
        setType(editingConnection.typ || 'mqtt');
        setProps(editingConnection.props ?? {});
        setRawJson(JSON.stringify(editingConnection.props ?? {}, null, 2));
      } else {
        setId('');
        setType('mqtt');
        setProps({});
        setRawJson('{}');
      }
      setIsJsonMode(false);
      setTestResult(null);

      void loadConnectionTypes();
    }
  }, [open, editingConnection]);

  // Load properties when connection type changes
  React.useEffect(() => {
    if (open && type) {
      void loadMetadata(type);
    }
  }, [open, type]);

  const loadConnectionTypes = async () => {
    try {
      const items = await ekuiperClient.listConnectionMetadata();
      if (Array.isArray(items) && items.length > 0) {
        const normalized = items
          .map((t) => ({
            ...t,
            name: t.name || (t as any).id || '',
          }))
          .filter((t) => Boolean(t.name));
        const unique = Array.from(new Map(normalized.map((item) => [item.name, item])).values());
        setAvailableTypes(
          unique.length > 0
            ? unique
            : [
                { name: 'mqtt', about: { trial: false, installed: true, label: 'MQTT Connection' }, type: 'internal' },
                { name: 'edgex', about: { trial: false, installed: true, label: 'EdgeX Connection' }, type: 'internal' },
              ]
        );
      } else {
        // Builtin fallback if metadata endpoint is empty
        setAvailableTypes([
          { name: 'mqtt', about: { trial: false, installed: true, label: 'MQTT Connection' }, type: 'internal' },
          { name: 'edgex', about: { trial: false, installed: true, label: 'EdgeX Connection' }, type: 'internal' },
        ]);
      }
    } catch {
      setAvailableTypes([
        { name: 'mqtt', about: { trial: false, installed: true, label: 'MQTT Connection' }, type: 'internal' },
        { name: 'edgex', about: { trial: false, installed: true, label: 'EdgeX Connection' }, type: 'internal' },
      ]);
    }
  };

  const loadMetadata = async (connType: string) => {
    setLoading(true);
    try {
      const detail: MetadataDetail = await ekuiperClient.getConnectionMetadata(connType);
      let pList: MetadataProperty[] = [];
      if (detail && detail.properties) {
        pList = Array.isArray(detail.properties)
          ? detail.properties
          : (detail.properties as any).default ?? [];
      }

      // Direct fallback to source metadata if connection metadata has no properties
      if (pList.length === 0) {
        try {
          const srcMeta = await ekuiperClient.getSourceMetadata(connType);
          if (srcMeta && srcMeta.properties) {
            pList = Array.isArray(srcMeta.properties)
              ? srcMeta.properties
              : (srcMeta.properties as any).default ?? [];
          }
        } catch {
          // ignore
        }
      }

      // Filter out connectionSelector since this modal configures the shared connection itself
      const validProps = pList.filter((p) => p.name !== 'connectionSelector');
      setProperties(validProps);

      // Pre-fill defaults if creating new connection
      if (!isEdit) {
        setProps((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          const initial: Record<string, any> = {};
          validProps.forEach((p) => {
            if (p.default !== undefined && p.default !== '') {
              initial[p.name] = p.default;
            }
          });
          return initial;
        });
      }
    } catch {
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!type) {
      toast.error('Select a connector type first');
      return;
    }
    setTesting(true);
    setTestResult(null);

    const payload = isJsonMode ? getParsedJson() : props;

    try {
      const res = await ekuiperClient.testConnection('connections', type, payload);
      if (res.success) {
        setTestResult({ success: true, message: 'Connection test succeeded!' });
        toast.success('Connection test succeeded');
      } else {
        const msg = res.error || res.message || 'Connection test failed';
        setTestResult({ success: false, message: msg });
        toast.error(`Connection failed: ${msg}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connection test request failed';
      setTestResult({ success: false, message: msg });
      toast.error(`Connection test error: ${msg}`);
    } finally {
      setTesting(false);
    }
  };

  const getParsedJson = (): Record<string, any> => {
    try {
      const parsed = JSON.parse(rawJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('Properties must be a JSON object');
      }
      return parsed;
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const handleSave = async () => {
    if (!id.trim()) {
      toast.error('Connection ID is required');
      return;
    }
    if (!type.trim()) {
      toast.error('Connector type is required');
      return;
    }

    let finalProps: Record<string, any>;
    try {
      finalProps = isJsonMode ? getParsedJson() : props;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Invalid JSON properties');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: id.trim(),
        typ: type.trim(),
        props: finalProps,
      };

      if (isEdit && editingConnection) {
        await ekuiperClient.updateConnection(editingConnection.id, payload);
        toast.success('Shared connection updated');
      } else {
        await ekuiperClient.createConnection(payload);
        toast.success('Shared connection created');
      }

      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save connection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b border-border/80 bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pr-8 sm:pr-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Network className="size-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {isEdit ? 'Edit Shared Connection' : 'Create Shared Connection'}
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Connections are shared across rules, streams, and sinks to pool credentials and client pools.
                </DialogDescription>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!isJsonMode) {
                  setRawJson(JSON.stringify(props, null, 2));
                } else {
                  try {
                    const parsed = JSON.parse(rawJson);
                    if (typeof parsed === 'object' && parsed !== null) {
                      setProps(parsed);
                    }
                  } catch {
                    // Ignore
                  }
                }
                setIsJsonMode(!isJsonMode);
              }}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              {isJsonMode ? <FormInput className="size-3.5" aria-hidden="true" /> : <Code2 className="size-3.5" aria-hidden="true" />}
              {isJsonMode ? 'Visual Form' : 'JSON Mode'}
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="conn-id" className="text-xs font-medium">
                Connection ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="conn-id"
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. factory_mqtt_shared"
                disabled={isEdit || saving}
                className="h-9 text-base md:text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="conn-type" className="text-xs font-medium">
                Connector Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={type}
                onValueChange={(val) => setType(val)}
                disabled={isEdit || saving}
              >
                <SelectTrigger id="conn-type" className="h-9 text-base md:text-xs font-mono">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {availableTypes.map((t, idx) => {
                      const typeName = t.name || (t as any).id || `conn-type-${idx}`;
                      return (
                        <SelectItem key={typeName} value={typeName} className="text-xs font-mono">
                          <div className="flex items-center gap-2">
                            <ConnectorIcon type={typeName} className="size-3.5" />
                            <span>{typeName}</span>
                            {t.about?.label && (
                              <span className="text-muted-foreground text-[11px]">
                                ({i18nLabel(t.about.label)})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Test Connection Result */}
          {testResult && (
            <Alert variant={testResult.success ? 'default' : 'destructive'} className="py-2.5">
              {testResult.success ? (
                <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-hidden="true" />
              ) : (
                <XCircle className="size-4 shrink-0" aria-hidden="true" />
              )}
              <AlertDescription className="text-xs font-medium">
                {testResult.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Properties Area */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between border-b pb-1">
              <Label className="text-xs font-semibold text-muted-foreground">
                Connection Parameters
              </Label>
              {loading && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="size-3 animate-spin" aria-hidden="true" /> Loading properties…
                </span>
              )}
            </div>

            {isJsonMode ? (
              <div className="flex flex-col gap-1">
                <Textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  disabled={saving}
                  aria-label="Raw JSON connection properties"
                  placeholder='{\n  "server": "tcp://127.0.0.1:1883",\n  "clientid": "shared_client"\n}'
                  className="min-h-[240px] font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
                <p className="text-[11px] text-muted-foreground">
                  Provide valid JSON properties for this connector.
                </p>
              </div>
            ) : (
              <PropertyForm
                properties={properties}
                values={props}
                onChange={setProps}
                category="connections"
                type={type}
                disabled={saving}
                showRawToggle={false}
              />
            )}
          </div>
        </div>

        <DialogFooter className="px-6 py-3 border-t border-border/80 bg-muted/40 backdrop-blur-sm flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2.5 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing || saving || !type}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${testing ? 'animate-spin' : ''}`} aria-hidden="true" />
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || !id.trim() || !type.trim()}
              className="text-xs touch-manipulation"
            >
              {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : isEdit ? 'Update Connection' : 'Create Connection'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
