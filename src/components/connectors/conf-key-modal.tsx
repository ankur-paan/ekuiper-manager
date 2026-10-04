'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Network, RefreshCw, Send, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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
import { SinkBaseForm, type SinkBaseOptions } from '@/components/connectors/sink-base-form';
import { ConnectorIcon } from '@/components/connectors/connector-icon';
import { ekuiperClient } from '@/lib/ekuiper/client';
import type { MetadataItem, MetadataProperty, MetadataDetail } from '@/lib/ekuiper/types';

export interface ConfKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: 'sources' | 'sinks' | 'connections';
  initialType?: string;
  initialName?: string;
  isEdit?: boolean;
  onSaved?: (name: string, type: string) => void;
}

export function ConfKeyModal({
  open,
  onOpenChange,
  category,
  initialType = '',
  initialName = '',
  isEdit = false,
  onSaved,
}: ConfKeyModalProps) {
  const [name, setName] = React.useState(initialName);
  const [type, setType] = React.useState(initialType);
  const [availableTypes, setAvailableTypes] = React.useState<MetadataItem[]>([]);
  const [properties, setProperties] = React.useState<MetadataProperty[]>([]);
  const [propertyValues, setPropertyValues] = React.useState<Record<string, any>>({});
  const [sinkOptions, setSinkOptions] = React.useState<SinkBaseOptions>({});
  const [availableConnections, setAvailableConnections] = React.useState<string[]>([]);
  const [availableSchemas, setAvailableSchemas] = React.useState<string[]>([]);

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message?: string } | null>(null);

  // Sync state when opened
  React.useEffect(() => {
    if (open) {
      setName(initialName);
      setType(initialType);
      setPropertyValues({});
      setSinkOptions({});
      setTestResult(null);

      // Load available types if needed
      void loadTypes();
      void loadSharedConnections();
      void loadSchemas();
    }
  }, [open, initialName, initialType]);

  // Load properties metadata when type changes
  React.useEffect(() => {
    if (!type || !open) return;
    void loadMetadata(type);
  }, [type, open, category]);

  // If editing, load current configuration
  React.useEffect(() => {
    if (open && isEdit && type && initialName) {
      void loadCurrentConfKey(type, initialName);
    }
  }, [open, isEdit, type, initialName]);

  const loadTypes = async () => {
    try {
      let items: MetadataItem[] = [];
      if (category === 'sources') {
        items = await ekuiperClient.listSourceMetadata();
      } else if (category === 'sinks') {
        items = await ekuiperClient.listSinkMetadata();
      } else {
        items = await ekuiperClient.listConnectionMetadata();
      }
      const rawList = Array.isArray(items) ? items : [];
      const normalized = rawList
        .map((t) => ({
          ...t,
          name: t.name || (t as any).id || '',
        }))
        .filter((t) => Boolean(t.name));
      const unique = Array.from(new Map(normalized.map((item) => [item.name, item])).values());
      setAvailableTypes(unique);
    } catch {
      // Graceful fallback: non-blocking
    }
  };

  const loadSharedConnections = async () => {
    try {
      const conns = await ekuiperClient.listConnections();
      setAvailableConnections(
        Array.isArray(conns) ? conns.map((c: any) => c.id || c.name).filter(Boolean) : []
      );
    } catch {
      setAvailableConnections([]);
    }
  };

  const loadSchemas = async () => {
    try {
      const schemas = await ekuiperClient.listSchemas('protobuf');
      setAvailableSchemas(
        Array.isArray(schemas) ? schemas.map((s: any) => s.name || s).filter(Boolean) : []
      );
    } catch {
      setAvailableSchemas([]);
    }
  };

  const loadMetadata = async (connectorType: string) => {
    setLoading(true);
    try {
      let detail: MetadataDetail | null = null;
      if (category === 'sources') {
        detail = await ekuiperClient.getSourceMetadata(connectorType);
      } else if (category === 'sinks') {
        detail = await ekuiperClient.getSinkMetadata(connectorType);
      } else {
        detail = await ekuiperClient.getConnectionMetadata(connectorType);
      }

      let pList: MetadataProperty[] = [];
      if (detail && detail.properties) {
        pList = Array.isArray(detail.properties)
          ? detail.properties
          : (detail.properties as any).default ?? [];
      }

      // Secondary fallback if metadata has no properties
      if (pList.length === 0) {
        try {
          const srcDetail = await ekuiperClient.getSourceMetadata(connectorType);
          if (srcDetail && srcDetail.properties) {
            pList = Array.isArray(srcDetail.properties)
              ? srcDetail.properties
              : (srcDetail.properties as any).default ?? [];
          }
        } catch {
          // ignore
        }
      }

      // Filter out connectionSelector from the PropertyForm body if it can have a separate connection selector
      const canHaveConn = ['mqtt', 'edgex'].includes(connectorType);
      const filteredProps = canHaveConn && category === 'sources'
        ? pList.filter((p) => p.name !== 'connectionSelector')
        : pList;

      setProperties(filteredProps);

      // Pre-fill defaults if creating new configuration
      if (!isEdit) {
        setPropertyValues((prev: Record<string, any>) => {
          if (Object.keys(prev).length > 0) return prev;
          const initial: Record<string, any> = {};
          filteredProps.forEach((p) => {
            if (p.default !== undefined && p.default !== '') {
              initial[p.name] = p.default;
            }
          });
          return initial;
        });
      }
    } catch (e) {
      console.warn('Could not load metadata properties', e);
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentConfKey = async (connectorType: string, confName: string) => {
    try {
      let configData: Record<string, any> = {};
      if (category === 'sources') {
        configData = await ekuiperClient.getSourceConfig(connectorType);
      } else if (category === 'sinks') {
        configData = await ekuiperClient.getSinkConfig(connectorType);
      } else {
        configData = await ekuiperClient.getConnectionConfig(connectorType);
      }

      const current = configData?.[confName];
      if (current && typeof current === 'object') {
        if (category === 'sinks') {
          // Extract sink delivery base options
          const {
            omitIfEmpty,
            sendSingle,
            format,
            schemaName,
            schemaMessage,
            delimiter,
            dataTemplate,
            concurrency,
            bufferLength,
            enableCache,
            memoryCacheThreshold,
            maxDiskCache,
            cleanCacheAtStop,
            bufferPageSize,
            resendInterval,
            connectionSelector,
            ...restProps
          } = current;

          setSinkOptions({
            omitIfEmpty,
            sendSingle,
            format,
            schemaName,
            schemaMessage,
            delimited: delimiter,
            dataTemplate,
            concurrency,
            bufferLength,
            enableCache,
            memoryCacheThreshold,
            maxDiskCache,
            cleanCacheAtStop,
            bufferPageSize,
            resendInterval,
            connectionSelector,
          });
          setPropertyValues(restProps);
        } else {
          setPropertyValues(current);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load configuration details');
    }
  };

  const handleTestConnection = async () => {
    if (!type) {
      toast.error('Select a connector type first');
      return;
    }
    setTesting(true);
    setTestResult(null);

    const payload = category === 'sinks'
      ? { ...propertyValues, ...sinkOptions }
      : { ...propertyValues };

    try {
      const res = await ekuiperClient.testConnection(category, type, payload);
      if (res.success) {
        setTestResult({ success: true, message: 'Connection successful!' });
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

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Configuration name is required');
      return;
    }
    if (!type) {
      toast.error('Connector type is required');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = { ...propertyValues };

      if (category === 'sinks') {
        if (sinkOptions.omitIfEmpty !== undefined) payload.omitIfEmpty = sinkOptions.omitIfEmpty;
        if (sinkOptions.sendSingle !== undefined) payload.sendSingle = sinkOptions.sendSingle;
        if (sinkOptions.format) payload.format = sinkOptions.format;
        if (sinkOptions.schemaName) payload.schemaName = sinkOptions.schemaName;
        if (sinkOptions.schemaMessage) payload.schemaMessage = sinkOptions.schemaMessage;
        if (sinkOptions.delimited) payload.delimiter = sinkOptions.delimited;
        if (sinkOptions.dataTemplate) payload.dataTemplate = sinkOptions.dataTemplate;
        if (sinkOptions.concurrency) payload.concurrency = sinkOptions.concurrency;
        if (sinkOptions.bufferLength) payload.bufferLength = sinkOptions.bufferLength;
        if (sinkOptions.enableCache !== undefined) payload.enableCache = sinkOptions.enableCache;
        if (sinkOptions.memoryCacheThreshold) payload.memoryCacheThreshold = sinkOptions.memoryCacheThreshold;
        if (sinkOptions.maxDiskCache) payload.maxDiskCache = sinkOptions.maxDiskCache;
        if (sinkOptions.cleanCacheAtStop !== undefined) payload.cleanCacheAtStop = sinkOptions.cleanCacheAtStop;
        if (sinkOptions.bufferPageSize) payload.bufferPageSize = sinkOptions.bufferPageSize;
        if (sinkOptions.resendInterval) payload.resendInterval = sinkOptions.resendInterval;
        if (sinkOptions.connectionSelector) payload.connectionSelector = sinkOptions.connectionSelector;
      }

      await ekuiperClient.upsertConfKey(category, type, name.trim(), payload);
      toast.success(`${category === 'sinks' ? 'Sink template' : 'Configuration'} ${isEdit ? 'updated' : 'created'}`);
      onOpenChange(false);
      onSaved?.(name.trim(), type);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const titlePrefix = isEdit ? 'Edit' : 'Create';
  const categoryTitle =
    category === 'sources'
      ? 'Source Configuration Key'
      : category === 'sinks'
      ? 'Sink Template'
      : 'Connection Configuration';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 py-4 border-b border-border/80 bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pr-8 sm:pr-0">
            <div>
              <DialogTitle className="text-base font-semibold">
                {titlePrefix} {categoryTitle}
              </DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Parameters are validated and saved directly to the active eKuiper node.
              </DialogDescription>
            </div>
            {type && (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted border border-border/50">
                <ConnectorIcon type={type} className="size-3.5" />
                {type}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
          {/* Header Identifiers: Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="conf-name" className="text-xs font-medium">
                Configuration Name <span className="text-destructive">*</span>
              </Label>
              <Input
                 id="conf-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. factory_mqtt_conf"
                disabled={isEdit || saving}
                className="h-9 text-base md:text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="conf-type" className="text-xs font-medium">
                Connector Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={type}
                onValueChange={(val) => setType(val)}
                disabled={isEdit || saving || Boolean(initialType)}
              >
                <SelectTrigger id="conf-type" className="h-9 text-xs font-mono">
                  <SelectValue placeholder="Select connector type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {availableTypes.map((t, idx) => {
                      const typeName = t.name || (t as any).id || `conf-type-${idx}`;
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

          {/* Test Result Indicator */}
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

          {/* Dynamic Properties Form */}
          {type && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between border-b pb-1">
                <span className="text-xs font-semibold text-muted-foreground">
                  Connector Parameters
                </span>
                {loading && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <RefreshCw className="size-3 animate-spin" aria-hidden="true" /> Loading properties…
                  </span>
                )}
              </div>

              <PropertyForm
                properties={properties}
                values={propertyValues}
                onChange={setPropertyValues}
                category={category}
                type={type}
                disabled={saving}
              />
            </div>
          )}

          {/* Sink Delivery Options (for Sinks) */}
          {category === 'sinks' && type && (
            <SinkBaseForm
              type={type}
              values={sinkOptions}
              onChange={setSinkOptions}
              disabled={saving}
              availableConnections={availableConnections}
              availableSchemas={availableSchemas}
            />
          )}
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
              disabled={saving || !name.trim() || !type}
              className="text-xs touch-manipulation"
            >
              {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden="true" />}
              {saving ? 'Saving…' : `${titlePrefix} Configuration`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
