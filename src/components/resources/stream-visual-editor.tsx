'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Code2,
  Database,
  Edit3,
  ExternalLink,
  Eye,
  FileCode,
  HelpCircle,
  Plus,
  RefreshCw,
  Sparkles,
  Table2,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FieldsTable, type StreamFieldNode, formatFieldTypeString } from '@/components/connectors/fields-table';
import { ConfKeyModal } from '@/components/connectors/conf-key-modal';
import { i18nLabel } from '@/components/connectors/property-form';
import { ekuiperClient } from '@/lib/ekuiper/client';
import type { MetadataItem, MetadataDetail, MetadataDataSource } from '@/lib/ekuiper/types';
import { useServerStore } from '@/stores/server-store';

export type ResourceKind = 'stream' | 'table';

export interface StreamVisualEditorProps {
  kind: ResourceKind;
  name?: string;
}

export function StreamVisualEditor({ kind, name }: StreamVisualEditorProps) {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);

  // Editor mode: Visual Builder vs SQL Statement
  const [mode, setMode] = React.useState<'visual' | 'sql'>('visual');

  // Form fields
  const [resourceName, setResourceName] = React.useState(name ?? '');
  const [isSchema, setIsSchema] = React.useState(false);
  const [fields, setFields] = React.useState<StreamFieldNode[]>([]);
  const [connectorType, setConnectorType] = React.useState('mqtt');
  const [dataSource, setDataSource] = React.useState('');
  const [confKey, setConfKey] = React.useState('');
  const [format, setFormat] = React.useState('json');
  const [schemaName, setSchemaName] = React.useState('');
  const [schemaMessage, setSchemaMessage] = React.useState('');
  const [delimiter, setDelimiter] = React.useState(',');
  const [timestamp, setTimestamp] = React.useState('');
  const [timestampFormat, setTimestampFormat] = React.useState('');
  const [isShared, setIsShared] = React.useState(false);
  const [tableKind, setTableKind] = React.useState<'stream' | 'lookup'>('stream');

  // Raw SQL
  const [sql, setSql] = React.useState('');

  // Metadata & Catalogs
  const [sources, setSources] = React.useState<MetadataItem[]>([]);
  const [sourceDetail, setSourceDetail] = React.useState<MetadataDetail | null>(null);
  const [confKeys, setConfKeys] = React.useState<string[]>([]);
  const [schemas, setSchemas] = React.useState<string[]>([]);

  // Dialogs
  const [confModalOpen, setConfModalOpen] = React.useState(false);
  const [isEditConfKey, setIsEditConfKey] = React.useState(false);
  const [loading, setLoading] = React.useState(Boolean(name));
  const [saving, setSaving] = React.useState(false);

  // Load catalogs on mount
  React.useEffect(() => {
    if (!active) return;
    void loadCatalogs();
  }, [active]);

  // Load existing stream/table details if editing
  React.useEffect(() => {
    if (!active || !name) return;
    setLoading(true);

    const loader = kind === 'stream' ? ekuiperClient.getStream(name) : ekuiperClient.getTable(name);
    loader
      .then((data: any) => {
        if (!data) return;
        const statement = data.Statement || data.statement || data.sql || '';
        setSql(statement);

        const resName = data.Name || data.name || name;
        setResourceName(resName);

        // Parse options
        const opts = data.Options || data.options || {};
        if (opts.TYPE || opts.type) setConnectorType(String(opts.TYPE || opts.type).toLowerCase());
        if (opts.DATASOURCE || opts.datasource) setDataSource(String(opts.DATASOURCE || opts.datasource));
        if (opts.CONF_KEY || opts.confKey) setConfKey(String(opts.CONF_KEY || opts.confKey));
        if (opts.FORMAT || opts.format) setFormat(String(opts.FORMAT || opts.format).toLowerCase());
        if (opts.DELIMITER || opts.delimiter) setDelimiter(String(opts.DELIMITER || opts.delimiter));
        if (opts.TIMESTAMP || opts.timestamp) setTimestamp(String(opts.TIMESTAMP || opts.timestamp));
        if (opts.TIMESTAMP_FORMAT || opts.timestampFormat) setTimestampFormat(String(opts.TIMESTAMP_FORMAT || opts.timestampFormat));
        if (opts.SHARED !== undefined || opts.shared !== undefined) {
          setIsShared(Boolean(opts.SHARED ?? opts.shared));
        }
        if (opts.KIND || opts.kind) {
          setTableKind(String(opts.KIND || opts.kind).toLowerCase() === 'lookup' ? 'lookup' : 'stream');
        }

        const schemaId = opts.SCHEMAID || opts.schemaid || '';
        if (schemaId) {
          const parts = schemaId.split('.');
          setSchemaName(parts[0] || '');
          setSchemaMessage(parts[1] || '');
        }

        // Parse schema fields
        const rawFields = data.StreamFields || data.streamFields;
        if (Array.isArray(rawFields) && rawFields.length > 0) {
          setIsSchema(true);
          setFields(parseFieldsFromEkuiper(rawFields));
        } else {
          setIsSchema(false);
          setFields([]);
        }
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : `Failed to load ${kind}`);
      })
      .finally(() => setLoading(false));
  }, [active, kind, name]);

  // Load source metadata detail when connector type changes
  React.useEffect(() => {
    if (!active || !connectorType) return;
    void loadConnectorDetail(connectorType);
    void loadConfKeysForType(connectorType);
  }, [active, connectorType]);

  const loadCatalogs = async () => {
    try {
      const [srcList, schemaList] = await Promise.all([
        ekuiperClient.listSourceMetadata(),
        ekuiperClient.listSchemas('protobuf').catch(() => []),
      ]);
      setSources(Array.isArray(srcList) ? srcList : []);
      setSchemas(Array.isArray(schemaList) ? schemaList.map((s: any) => s.name || s).filter(Boolean) : []);
    } catch {
      // Non-blocking
    }
  };

  const loadConnectorDetail = async (cType: string) => {
    try {
      const detail = await ekuiperClient.getSourceMetadata(cType);
      setSourceDetail(detail);

      // If creating new and dataSource not manually entered, use default
      if (!name && detail.dataSource?.default && !dataSource) {
        setDataSource(detail.dataSource.default);
      }
    } catch {
      setSourceDetail(null);
    }
  };

  const loadConfKeysForType = async (cType: string) => {
    try {
      const config = await ekuiperClient.getSourceConfig(cType);
      setConfKeys(config ? Object.keys(config) : []);
    } catch {
      setConfKeys([]);
    }
  };

  // Generate real-time SQL from visual builder
  const generatedSql = React.useMemo(() => {
    const keyword = kind === 'stream' ? 'STREAM' : 'TABLE';
    const targetName = resourceName.trim() || `my_${kind}`;

    // Schema fields SQL
    let fieldsSql = ' ()';
    if (isSchema && fields.length > 0) {
      const fieldDefs = fields.map((f) => `${f.name} ${formatFieldTypeString(f)}`);
      fieldsSql = ` (\n  ${fieldDefs.join(',\n  ')}\n)`;
    }

    // WITH options SQL
    const withOptions: string[] = [];
    if (connectorType) withOptions.push(`TYPE="${connectorType}"`);
    if (dataSource.trim()) withOptions.push(`DATASOURCE="${dataSource.trim()}"`);
    if (confKey) withOptions.push(`CONF_KEY="${confKey}"`);
    if (format) withOptions.push(`FORMAT="${format}"`);
    if (format === 'delimited' && delimiter) withOptions.push(`DELIMITER="${delimiter}"`);
    if ((format === 'protobuf' || format === 'custom') && schemaName && schemaMessage) {
      withOptions.push(`SCHEMAID="${schemaName}.${schemaMessage}"`);
    }
    if (timestamp.trim()) withOptions.push(`TIMESTAMP="${timestamp.trim()}"`);
    if (timestampFormat.trim()) withOptions.push(`TIMESTAMP_FORMAT="${timestampFormat.trim()}"`);
    if (isShared) withOptions.push(`SHARED="true"`);
    if (kind === 'table' && tableKind === 'lookup') withOptions.push(`KIND="lookup"`);

    const withSql = withOptions.length > 0 ? ` WITH (\n  ${withOptions.join(',\n  ')}\n)` : '';

    return `CREATE ${keyword} ${targetName}${fieldsSql}${withSql};`;
  }, [
    kind,
    resourceName,
    isSchema,
    fields,
    connectorType,
    dataSource,
    confKey,
    format,
    delimiter,
    schemaName,
    schemaMessage,
    timestamp,
    timestampFormat,
    isShared,
    tableKind,
  ]);

  // Keep raw SQL in sync when switching to SQL mode
  const handleModeChange = (newMode: 'visual' | 'sql') => {
    if (newMode === 'sql' && !sql.trim()) {
      setSql(generatedSql);
    }
    setMode(newMode);
  };

  const save = async () => {
    const finalSql = mode === 'sql' ? sql.trim() : generatedSql.trim();
    if (!finalSql) {
      toast.error('SQL definition cannot be empty');
      return;
    }

    setSaving(true);
    try {
      if (kind === 'stream') {
        if (name) await ekuiperClient.updateStream(name, finalSql);
        else await ekuiperClient.createStream(finalSql);
      } else {
        if (name) await ekuiperClient.updateTable(name, finalSql);
        else await ekuiperClient.createTable(finalSql);
      }

      toast.success(`${kind === 'stream' ? 'Stream' : 'Table'} ${name ? 'updated' : 'created'}`);
      router.push(`/${kind}s`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to save ${kind}`);
    } finally {
      setSaving(false);
    }
  };

  const selectedSource = sources.find((s) => s.name.toLowerCase() === connectorType.toLowerCase());
  const dsLabel = connectorType.toLowerCase() === 'mqtt'
    ? 'Data Source (MQTT Topic)'
    : connectorType.toLowerCase() === 'file'
    ? 'Data Source (File or directory relative path)'
    : i18nLabel(sourceDetail?.dataSource?.label) || 'Data Source / Topic';
  const dsHint = i18nLabel(sourceDetail?.dataSource?.hint) || 'The subscription topic, URL endpoint, or file path.';

  return (
    <TooltipProvider delayDuration={200}>
      <AppLayout title={`${name ? 'Edit' : 'Create'} ${kind === 'stream' ? 'Stream' : 'Table'}`}>
        <div className="mx-auto max-w-5xl flex flex-col gap-6 pb-12">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back">
                <ArrowLeft className="size-5" aria-hidden="true" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {name ? `Edit ${name}` : `Create ${kind === 'stream' ? 'Stream' : 'Table'}`}
                  </h2>
                  <Badge variant="outline" className="text-xs uppercase">
                    {kind}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Connect incoming edge data to eKuiper streaming SQL queries.
                </p>
              </div>
            </div>

            {/* Mode Switcher: Visual Form vs SQL Statement */}
            <div className="flex items-center rounded-lg border bg-muted/30 p-1" role="tablist" aria-label="Editor mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'visual'}
                onClick={() => handleModeChange('visual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === 'visual'
                    ? 'bg-background text-foreground shadow-beautiful-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                Visual Builder
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'sql'}
                onClick={() => handleModeChange('sql')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === 'sql'
                    ? 'bg-background text-foreground shadow-beautiful-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileCode className="size-3.5" aria-hidden="true" />
                SQL Statement
              </button>
            </div>
          </div>

          {/* VISUAL BUILDER MODE */}
          {mode === 'visual' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Form Side */}
              <div id="stream-form-container" className="lg:col-span-8 flex flex-col gap-6">
                {/* Identification & Connector */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Identification & Connector</CardTitle>
                    <CardDescription className="text-xs">
                      Define the name and choose which source connector provides the data.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="res-name" className="text-xs font-medium">
                          {kind === 'stream' ? 'Stream Name' : 'Table Name'} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="res-name"
                          value={resourceName}
                          onChange={(e) => setResourceName(e.target.value)}
                          placeholder={kind === 'stream' ? 'sensor_stream' : 'lookup_devices'}
                          disabled={Boolean(name)}
                          className="h-9 text-xs font-mono"
                        />
                      </div>

                      {/* Connector Type */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="res-type" className="text-xs font-medium">
                            Connector Type
                          </Label>
                          {selectedSource?.about?.helpUrl && (
                            <a
                              href={i18nLabel(selectedSource.about.helpUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-primary hover:underline flex items-center gap-1"
                            >
                              Documentation <ExternalLink className="size-2.5" />
                            </a>
                          )}
                        </div>
                        <Select
                          value={connectorType}
                          onValueChange={(val) => {
                            setConnectorType(val);
                            setConfKey('');
                          }}
                        >
                          <SelectTrigger id="res-type" className="h-9 text-xs font-mono">
                            <SelectValue placeholder="Select connector type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {sources.length > 0 ? (
                                sources.map((s) => (
                                  <SelectItem key={s.name} value={s.name} className="text-xs font-mono">
                                    {s.name} {s.about?.label ? `(${i18nLabel(s.about.label)})` : ''}
                                  </SelectItem>
                                ))
                              ) : (
                                <>
                                  <SelectItem value="mqtt" className="text-xs font-mono">mqtt</SelectItem>
                                  <SelectItem value="neuron" className="text-xs font-mono">neuron</SelectItem>
                                  <SelectItem value="edgex" className="text-xs font-mono">edgex</SelectItem>
                                  <SelectItem value="httppull" className="text-xs font-mono">httppull</SelectItem>
                                  <SelectItem value="file" className="text-xs font-mono">file</SelectItem>
                                  <SelectItem value="memory" className="text-xs font-mono">memory</SelectItem>
                                </>
                              )}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Table Kind (if kind === 'table') */}
                    {kind === 'table' && (
                      <div className="flex items-center justify-between rounded-md border p-3 bg-muted/10">
                        <div className="flex flex-col gap-0.5">
                          <Label htmlFor="table-kind" className="text-xs font-medium cursor-pointer">
                            Lookup Table Mode
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            When enabled, this table acts as a static or periodically reloaded lookup dimension for JOINs.
                          </p>
                        </div>
                        <Switch
                          id="table-kind"
                          checked={tableKind === 'lookup'}
                          onCheckedChange={(checked) => setTableKind(checked ? 'lookup' : 'stream')}
                        />
                      </div>
                    )}

                    {/* DataSource Topic / Path */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor="res-datasource" className="text-xs font-medium">
                          {dsLabel}
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="size-3.5 cursor-help text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs">{dsHint}</TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="res-datasource"
                        value={dataSource}
                        onChange={(e) => setDataSource(e.target.value)}
                        placeholder="e.g. factory/sensors or /tmp/data.csv"
                        className="h-9 text-xs font-mono"
                      />
                    </div>

                    {/* Configuration Key */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="res-confkey" className="text-xs font-medium">
                          Configuration key
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditConfKey(false);
                              setConfModalOpen(true);
                            }}
                            className="h-6 text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-600/30 hover:bg-emerald-500/10 gap-1 px-2"
                          >
                            <Plus className="size-3" />
                            Add configuration key
                          </Button>
                          {confKey && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsEditConfKey(true);
                                setConfModalOpen(true);
                              }}
                              className="h-6 text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-600/30 hover:bg-emerald-500/10 gap-1 px-2"
                            >
                              <Edit3 className="size-3" />
                              Edit configuration key
                            </Button>
                          )}
                        </div>
                      </div>
                      <Select
                        value={confKey || '__DEFAULT__'}
                        onValueChange={(val) => setConfKey(val === '__DEFAULT__' ? '' : val)}
                      >
                        <SelectTrigger id="res-confkey" className="h-9 text-xs font-mono">
                          <SelectValue placeholder="Default configuration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="__DEFAULT__" className="text-xs italic text-muted-foreground">
                              Default configuration
                            </SelectItem>
                            {confKeys.map((ck) => (
                              <SelectItem key={ck} value={ck} className="text-xs font-mono">
                                {ck}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Serialization & Timing */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Serialization & Timing</CardTitle>
                    <CardDescription className="text-xs">
                      Configure payload formatting, schemas, timestamps, and connection sharing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Format */}
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="res-format" className="text-xs font-medium">
                          Data Format
                        </Label>
                        <Select value={format} onValueChange={(val) => setFormat(val)}>
                          <SelectTrigger id="res-format" className="h-9 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="json" className="text-xs">JSON</SelectItem>
                              <SelectItem value="binary" className="text-xs">Binary</SelectItem>
                              <SelectItem value="delimited" className="text-xs">Delimited (CSV/TSV)</SelectItem>
                              <SelectItem value="protobuf" className="text-xs">Protobuf</SelectItem>
                              <SelectItem value="custom" className="text-xs">Custom</SelectItem>
                              <SelectItem value="can" className="text-xs">CAN bus</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Delimiter (when delimited) */}
                      {format === 'delimited' && (
                        <div className="flex flex-col gap-1.5">
                          <Label htmlFor="res-delimiter" className="text-xs font-medium">
                            Delimiter
                          </Label>
                          <Input
                            id="res-delimiter"
                            value={delimiter}
                            onChange={(e) => setDelimiter(e.target.value)}
                            placeholder=","
                            className="h-9 text-xs font-mono"
                          />
                        </div>
                      )}

                      {/* Schema Name (when protobuf/custom) */}
                      {(format === 'protobuf' || format === 'custom') && (
                        <>
                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="res-schema-name" className="text-xs font-medium">
                              Schema Name
                            </Label>
                            {schemas.length > 0 ? (
                              <Select value={schemaName} onValueChange={setSchemaName}>
                                <SelectTrigger id="res-schema-name" className="h-9 text-xs">
                                  <SelectValue placeholder="Select schema" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    {schemas.map((s) => (
                                      <SelectItem key={s} value={s} className="text-xs">
                                        {s}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                id="res-schema-name"
                                value={schemaName}
                                onChange={(e) => setSchemaName(e.target.value)}
                                placeholder="sensor.proto"
                                className="h-9 text-xs"
                              />
                            )}
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <Label htmlFor="res-schema-msg" className="text-xs font-medium">
                              Schema Message
                            </Label>
                            <Input
                              id="res-schema-msg"
                              value={schemaMessage}
                              onChange={(e) => setSchemaMessage(e.target.value)}
                              placeholder="SensorMessage"
                              className="h-9 text-xs"
                            />
                          </div>
                        </>
                      )}

                      {/* Timestamp Field */}
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="res-timestamp" className="text-xs font-medium">
                          Timestamp Column
                        </Label>
                        <Input
                          id="res-timestamp"
                          value={timestamp}
                          onChange={(e) => setTimestamp(e.target.value)}
                          placeholder="e.g. ts or recorded_at"
                          className="h-9 text-xs font-mono"
                        />
                      </div>

                      {/* Timestamp Format */}
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="res-ts-format" className="text-xs font-medium">
                          Timestamp Format
                        </Label>
                        <Input
                          id="res-ts-format"
                          value={timestampFormat}
                          onChange={(e) => setTimestampFormat(e.target.value)}
                          placeholder="YYYY-MM-DD HH:mm:ss"
                          className="h-9 text-xs font-mono"
                        />
                      </div>
                    </div>

                    {/* Shared Stream Switch */}
                    {kind === 'stream' && (
                      <div className="flex items-center justify-between rounded-md border p-3 bg-muted/10">
                        <div className="flex flex-col gap-0.5">
                          <Label htmlFor="res-shared" className="text-xs font-medium cursor-pointer">
                            Shared Stream Instance
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Share one source instance across multiple rules to prevent redundant subscriptions.
                          </p>
                        </div>
                        <Switch
                          id="res-shared"
                          checked={isShared}
                          onCheckedChange={setIsShared}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Schema Fields */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">Schema Columns</CardTitle>
                        <CardDescription className="text-xs">
                          {isSchema
                            ? 'Fields are strongly typed and validated against incoming data.'
                            : 'Schemaless stream (all JSON keys are accessible via wildcard *).'}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="schema-toggle" className="text-xs text-muted-foreground cursor-pointer">
                          {isSchema ? 'Typed Schema' : 'Schemaless'}
                        </Label>
                        <Switch
                          id="schema-toggle"
                          checked={isSchema}
                          onCheckedChange={setIsSchema}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  {isSchema && (
                    <CardContent className="pt-0">
                      <FieldsTable fields={fields} onChange={setFields} />
                    </CardContent>
                  )}
                </Card>

                {/* Form Action Buttons */}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving || !resourceName.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-6"
                  >
                    {saving ? 'Submitting…' : 'Submit'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.back()}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              {/* Live Preview Side (4 columns) */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                <div className="sticky top-6 flex flex-col gap-4">
                  <Card className="border-primary/20 shadow-beautiful-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-semibold text-primary flex items-center gap-1.5">
                          <Code2 className="size-3.5" />
                          Generated eKuiper SQL
                        </CardTitle>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          Live
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      <pre className="p-3 rounded-md bg-muted/60 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap text-foreground max-h-80 leading-relaxed border">
                        {generatedSql}
                      </pre>
                      <Button
                        type="button"
                        onClick={() => void save()}
                        disabled={saving || !resourceName.trim()}
                        className="w-full text-xs"
                      >
                        {saving ? 'Submitting…' : `Submit ${kind === 'stream' ? 'Stream' : 'Table'}`}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* SQL STATEMENT RAW MODE */}
          {mode === 'sql' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">eKuiper SQL Statement</CardTitle>
                <CardDescription className="text-xs">
                  Submit a complete CREATE STREAM or CREATE TABLE statement directly.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Textarea
                  value={sql}
                  onChange={(e) => setSql(e.target.value)}
                  placeholder={`CREATE ${kind.toUpperCase()} sensor (id STRING, val FLOAT) WITH (TYPE="mqtt", DATASOURCE="sensor/data");`}
                  className="min-h-[300px] font-mono text-xs leading-relaxed"
                  spellCheck={false}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => router.back()} className="text-xs">
                    Cancel
                  </Button>
                  <Button onClick={() => void save()} disabled={saving || !sql.trim()} className="text-xs">
                    {saving ? 'Saving…' : `Execute & Save ${kind}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Inline Add/Edit ConfKey Modal */}
          <ConfKeyModal
            open={confModalOpen}
            onOpenChange={setConfModalOpen}
            category="sources"
            initialType={connectorType}
            initialName={isEditConfKey ? confKey : ''}
            isEdit={isEditConfKey}
            onSaved={(newConf) => {
              void loadConfKeysForType(connectorType);
              setConfKey(newConf);
            }}
          />
        </div>
      </AppLayout>
    </TooltipProvider>
  );
}

export function parseFieldsFromEkuiper(rawFields: any[]): StreamFieldNode[] {
  const result: StreamFieldNode[] = [];
  for (const f of rawFields) {
    const id = `f_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fName = String(f.Name || f.name || '');
    const fType = f.FieldType || f.fieldType;

    if (typeof fType === 'string') {
      result.push({ id, name: fName, type: fType as any });
    } else if (fType && typeof fType === 'object') {
      const typeStr = String(fType.Type || fType.type || '').toLowerCase();
      if (typeStr === 'struct') {
        const innerFields = Array.isArray(fType.Fields) ? parseFieldsFromEkuiper(fType.Fields) : [];
        result.push({ id, name: fName, type: 'struct', children: innerFields });
      } else if (typeStr === 'array') {
        const elem = String(fType.ElementType || fType.elementType || 'string').toLowerCase();
        result.push({ id, name: fName, type: 'array', arrayType: elem as any });
      } else {
        result.push({ id, name: fName, type: (typeStr as any) || 'string' });
      }
    } else {
      result.push({ id, name: fName, type: 'string' });
    }
  }
  return result;
}
