'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Code2,
  Database,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  Trash2,
  Workflow,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { PropertyForm, i18nLabel } from '@/components/connectors/property-form';
import { SinkBaseForm, type SinkBaseOptions } from '@/components/connectors/sink-base-form';
import { ConfKeyModal } from '@/components/connectors/conf-key-modal';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ekuiperClient } from '@/lib/ekuiper/client';
import {
  BUILTIN_SINKS,
  buildSql,
  coerceFieldValue,
  decodeActions,
  displayFieldValue,
  encodeActions,
  parseSimpleSql,
  redactSensitive,
  sinkFields,
  type ActionDraft,
  type JsonObject,
  type QueryDraft,
  type SinkFieldDefinition,
} from '@/lib/ekuiper/rule-designer';
import type { MetadataDetail, MetadataItem, Rule, RuleOptions, Sink } from '@/lib/ekuiper/types';
import { useServerStore } from '@/stores/server-store';

type DesignerStep = 'query' | 'actions' | 'options';
type QueryMode = 'visual' | 'sql';
type Resource = { name: string; kind: 'stream' | 'table' };

const EMPTY_QUERY: QueryDraft = {
  fields: '*',
  source: '',
  where: '',
  groupBy: '',
  having: '',
  orderBy: '',
  limit: '',
};

const STEP_ITEMS: Array<{ id: DesignerStep; label: string; description: string; icon: typeof Database }> = [
  { id: 'query', label: 'Source & query', description: 'Choose data and shape it', icon: Database },
  { id: 'actions', label: 'Outputs', description: 'Choose where results go', icon: Send },
  { id: 'options', label: 'Runtime', description: 'Review processing options', icon: Settings2 },
];

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionNumber(value: unknown): string {
  return typeof value === 'number' ? String(value) : '';
}

function actionLabel(type: string): string {
  return BUILTIN_SINKS.find((sink) => sink.type === type)?.label
    ?? type.replace(/(^|[-_])([a-z])/g, (_, prefix: string, letter: string) => `${prefix ? ' ' : ''}${letter.toUpperCase()}`);
}

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: SinkFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.kind === 'boolean') {
    return (
      <label className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
        <span>
          <span className="block text-sm font-medium">{field.label}</span>
          {field.hint && <span className="mt-1 block text-xs text-muted-foreground">{field.hint}</span>}
        </span>
        <Switch
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked)}
          aria-label={field.label}
        />
      </label>
    );
  }

  const displayed = displayFieldValue(field.kind, value);
  const update = (raw: string) => {
    try {
      onChange(coerceFieldValue(field.kind, raw));
    } catch {
      onChange(raw);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`sink-field-${field.key}`}>
        {field.label}{field.required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {field.options?.length ? (
        <Select value={displayed || undefined} onValueChange={update}>
          <SelectTrigger id={`sink-field-${field.key}`}><SelectValue placeholder="Select a value" /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {field.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      ) : field.kind === 'json' || field.kind === 'string-list' ? (
        <Textarea
          id={`sink-field-${field.key}`}
          value={displayed}
          onChange={(event) => update(event.target.value)}
          className="min-h-24 font-mono text-sm"
          placeholder={field.placeholder ?? (field.kind === 'string-list' ? 'one value per line' : '{}')}
          spellCheck={false}
        />
      ) : (
        <Input
          id={`sink-field-${field.key}`}
          type={field.kind === 'secret' ? 'password' : field.kind === 'number' ? 'number' : 'text'}
          value={displayed}
          onChange={(event) => update(event.target.value)}
          placeholder={field.placeholder}
          autoComplete={field.kind === 'secret' ? 'new-password' : undefined}
        />
      )}
      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
    </div>
  );
}

function JsonObjectEditor({
  value,
  label,
  disabled,
  onApply,
}: {
  value: JsonObject;
  label: string;
  disabled?: boolean;
  onApply: (value: JsonObject) => void;
}) {
  const [text, setText] = React.useState(() => JSON.stringify(value, null, 2));
  const [dirty, setDirty] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!dirty) setText(JSON.stringify(value, null, 2));
  }, [dirty, value]);

  const apply = () => {
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isObject(parsed)) throw new Error(`${label} must be a JSON object`);
      onApply(parsed);
      setDirty(false);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Invalid ${label}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        aria-label={label}
        value={text}
        disabled={disabled}
        onChange={(event) => { setText(event.target.value); setDirty(true); setError(''); }}
        className="min-h-44 font-mono text-xs"
        spellCheck={false}
      />
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {!disabled && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" disabled={!dirty} onClick={apply}>Apply JSON</Button>
        </div>
      )}
    </div>
  );
}

function ActionCard({
  action,
  index,
  sinkTypes,
  metadata,
  availableConnections = [],
  availableSchemas = [],
  revealSensitive,
  onChange,
  onRemove,
  onMove,
}: {
  action: ActionDraft;
  index: number;
  sinkTypes: string[];
  metadata?: MetadataDetail;
  availableConnections?: string[];
  availableSchemas?: string[];
  revealSensitive: boolean;
  onChange: (action: ActionDraft) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const [activeTab, setActiveTab] = React.useState<'properties' | 'delivery' | 'json'>('properties');
  const [testing, setTesting] = React.useState(false);
  const [sinkConfModalOpen, setSinkConfModalOpen] = React.useState(false);
  const [sinkTemplates, setSinkTemplates] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!action.type) return;
    ekuiperClient
      .getSinkConfig(action.type)
      .then((cfg: any) => {
        if (cfg && typeof cfg === 'object') {
          setSinkTemplates(Object.keys(cfg));
        } else {
          setSinkTemplates([]);
        }
      })
      .catch(() => setSinkTemplates([]));
  }, [action.type]);

  const propList = Array.isArray(metadata?.properties)
    ? metadata.properties
    : (metadata?.properties as any)?.default ?? [];
  const fields = sinkFields(action.type, propList);

  const sinkDesc =
    BUILTIN_SINKS.find((sink) => sink.type === action.type)?.description ??
    (metadata?.about?.description
      ? i18nLabel(metadata.about.description)
      : 'Installed eKuiper sink.');

  const sinkBaseOptions: SinkBaseOptions = {
    omitIfEmpty: typeof action.config.omitIfEmpty === 'boolean' ? action.config.omitIfEmpty : undefined,
    sendSingle: typeof action.config.sendSingle === 'boolean' ? action.config.sendSingle : undefined,
    format: typeof action.config.format === 'string' ? action.config.format : undefined,
    schemaName: typeof action.config.schemaName === 'string' ? action.config.schemaName : undefined,
    schemaMessage: typeof action.config.schemaMessage === 'string' ? action.config.schemaMessage : undefined,
    delimited:
      typeof action.config.delimiter === 'string'
        ? action.config.delimiter
        : typeof action.config.delimited === 'string'
        ? action.config.delimited
        : undefined,
    dataTemplate: typeof action.config.dataTemplate === 'string' ? action.config.dataTemplate : undefined,
    concurrency: typeof action.config.concurrency === 'number' ? action.config.concurrency : undefined,
    bufferLength: typeof action.config.bufferLength === 'number' ? action.config.bufferLength : undefined,
    enableCache: typeof action.config.enableCache === 'boolean' ? action.config.enableCache : undefined,
    memoryCacheThreshold:
      typeof action.config.memoryCacheThreshold === 'number' ? action.config.memoryCacheThreshold : undefined,
    maxDiskCache: typeof action.config.maxDiskCache === 'number' ? action.config.maxDiskCache : undefined,
    cleanCacheAtStop:
      typeof action.config.cleanCacheAtStop === 'boolean' ? action.config.cleanCacheAtStop : undefined,
    bufferPageSize: typeof action.config.bufferPageSize === 'number' ? action.config.bufferPageSize : undefined,
    resendInterval: typeof action.config.resendInterval === 'number' ? action.config.resendInterval : undefined,
    connectionSelector:
      typeof action.config.connectionSelector === 'string' ? action.config.connectionSelector : undefined,
  };

  const handleBaseOptionsChange = (nextBase: SinkBaseOptions) => {
    const nextConfig = { ...action.config };

    if (nextBase.omitIfEmpty !== undefined) nextConfig.omitIfEmpty = nextBase.omitIfEmpty;
    else delete nextConfig.omitIfEmpty;

    if (nextBase.sendSingle !== undefined) nextConfig.sendSingle = nextBase.sendSingle;
    else delete nextConfig.sendSingle;

    if (nextBase.format) nextConfig.format = nextBase.format;
    else delete nextConfig.format;

    if (nextBase.schemaName) nextConfig.schemaName = nextBase.schemaName;
    else delete nextConfig.schemaName;

    if (nextBase.schemaMessage) nextConfig.schemaMessage = nextBase.schemaMessage;
    else delete nextConfig.schemaMessage;

    if (nextBase.delimited) nextConfig.delimiter = nextBase.delimited;
    else delete nextConfig.delimiter;

    if (nextBase.dataTemplate) nextConfig.dataTemplate = nextBase.dataTemplate;
    else delete nextConfig.dataTemplate;

    if (nextBase.concurrency) nextConfig.concurrency = nextBase.concurrency;
    else delete nextConfig.concurrency;

    if (nextBase.bufferLength) nextConfig.bufferLength = nextBase.bufferLength;
    else delete nextConfig.bufferLength;

    if (nextBase.enableCache !== undefined) nextConfig.enableCache = nextBase.enableCache;
    else delete nextConfig.enableCache;

    if (nextBase.memoryCacheThreshold) nextConfig.memoryCacheThreshold = nextBase.memoryCacheThreshold;
    else delete nextConfig.memoryCacheThreshold;

    if (nextBase.maxDiskCache) nextConfig.maxDiskCache = nextBase.maxDiskCache;
    else delete nextConfig.maxDiskCache;

    if (nextBase.cleanCacheAtStop !== undefined) nextConfig.cleanCacheAtStop = nextBase.cleanCacheAtStop;
    else delete nextConfig.cleanCacheAtStop;

    if (nextBase.bufferPageSize) nextConfig.bufferPageSize = nextBase.bufferPageSize;
    else delete nextConfig.bufferPageSize;

    if (nextBase.resendInterval) nextConfig.resendInterval = nextBase.resendInterval;
    else delete nextConfig.resendInterval;

    if (nextBase.connectionSelector) nextConfig.connectionSelector = nextBase.connectionSelector;
    else delete nextConfig.connectionSelector;

    onChange({ ...action, config: nextConfig });
  };

  const handlePropertyFormChange = (values: Record<string, any>) => {
    onChange({
      ...action,
      config: {
        ...action.config,
        ...values,
      },
    });
  };

  const updateField = (field: SinkFieldDefinition, nextValue: unknown) => {
    const config = { ...action.config };
    if (nextValue === undefined || nextValue === '') delete config[field.key];
    else config[field.key] = nextValue;
    onChange({ ...action, config });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await ekuiperClient.testConnection('sinks', action.type, action.config);
      if (res.success) {
        toast.success(`Connection to "${action.type}" sink test succeeded`);
      } else {
        toast.error(`Sink connection test failed: ${res.error || res.message || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sink connection test request failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card id={`action-card-${index}`} className="overflow-hidden border-border shadow-none">
      <CardHeader className="flex-row items-start justify-between gap-3 bg-muted/20 p-4 border-b">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <Select
              value={action.type}
              onValueChange={(type) =>
                onChange({ ...action, type, config: {}, key: `${action.key}-${type}` })
              }
            >
              <SelectTrigger className="w-56 h-8 font-mono text-xs font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {sinkTypes.map((type) => (
                    <SelectItem key={type} value={type} className="font-mono text-xs">
                      {actionLabel(type)} ({type})
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {metadata?.about?.helpUrl && (
              <a
                href={i18nLabel(metadata.about.helpUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 ml-2"
              >
                Documentation <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            )}
            {metadata?.about?.installed === false && (
              <Badge variant="outline" className="text-[10px]">
                Not installed
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{sinkDesc}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={testing}
            onClick={() => void handleTestConnection()}
          >
            <Play className={`size-3 ${testing ? 'animate-spin' : ''}`} aria-hidden="true" />
            Test
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onMove(-1)}
            aria-label={`Move output ${index + 1} up`}
          >
            <ChevronUp className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => onMove(1)}
            aria-label={`Move output ${index + 1} down`}
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            onClick={onRemove}
            aria-label={`Remove output ${index + 1}`}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 flex flex-col gap-4">
        {/* Navigation tabs inside the action card */}
        <div className="inline-flex items-center p-1 rounded-lg bg-muted/60 border border-border/40 gap-1 text-xs select-none" role="tablist" aria-label="Output configuration tabs">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'properties'}
            onClick={() => setActiveTab('properties')}
            className={`px-3 py-1.5 rounded-md font-medium transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] ${
              activeTab === 'properties'
                ? 'bg-background text-foreground shadow-beautiful-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            Sink Properties
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'delivery'}
            onClick={() => setActiveTab('delivery')}
            className={`px-3 py-1.5 rounded-md font-medium transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] ${
              activeTab === 'delivery'
                ? 'bg-background text-foreground shadow-beautiful-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            Delivery & Buffer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'json'}
            onClick={() => setActiveTab('json')}
            className={`px-3 py-1.5 rounded-md font-medium transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] ${
              activeTab === 'json'
                ? 'bg-background text-foreground shadow-beautiful-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            Raw JSON
          </button>
        </div>

        {activeTab === 'properties' && (
          <div className="flex flex-col gap-6">
            {/* Resource ID (Sink Template) matching legacy teardown */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor={`sink-resource-id-${index}`} className="text-xs font-medium">
                  Resource ID
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSinkConfModalOpen(true)}
                  className="h-6 text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-600/30 hover:bg-emerald-500/10 gap-1 px-2"
                >
                  <Plus className="size-3" />
                  Add sink template
                </Button>
              </div>
              <Select
                value={typeof action.config.resourceId === 'string' && action.config.resourceId ? action.config.resourceId : '__NONE__'}
                onValueChange={(val) => {
                  const next = { ...action.config };
                  if (val === '__NONE__') delete next.resourceId;
                  else next.resourceId = val;
                  onChange({ ...action, config: next });
                }}
              >
                <SelectTrigger id={`sink-resource-id-${index}`} className="h-9 text-xs font-mono">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="__NONE__" className="text-xs italic text-muted-foreground">
                      Select
                    </SelectItem>
                    {sinkTemplates.map((st) => (
                      <SelectItem key={st} value={st} className="text-xs font-mono">
                        {st}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {propList.length > 0 ? (
              <PropertyForm
                properties={propList}
                values={action.config}
                onChange={handlePropertyFormChange}
                category="sinks"
                type={action.type}
                connectionSelected={Boolean(action.config.connectionSelector)}
              />
            ) : fields.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {fields.map((field) => (
                  <FieldEditor
                    key={field.key}
                    field={field}
                    value={action.config[field.key]}
                    onChange={(value) => updateField(field, value)}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                This sink requires no specific connection properties. Configure delivery parameters below or specify raw options in JSON.
              </p>
            )}

            {/* Delivery & Buffering Options integrated directly */}
            <SinkBaseForm
              type={action.type}
              values={sinkBaseOptions}
              onChange={handleBaseOptionsChange}
              availableConnections={availableConnections}
              availableSchemas={availableSchemas}
            />
          </div>
        )}

        {activeTab === 'delivery' && (
          <SinkBaseForm
            type={action.type}
            values={sinkBaseOptions}
            onChange={handleBaseOptionsChange}
            availableConnections={availableConnections}
            availableSchemas={availableSchemas}
          />
        )}

        {activeTab === 'json' && (
          <div className="flex flex-col gap-2">
            {!revealSensitive && (
              <p className="text-xs text-muted-foreground">
                Sensitive values are masked. Use the eye control in the definition pane to edit the full object.
              </p>
            )}
            <JsonObjectEditor
              value={(revealSensitive ? action.config : redactSensitive(action.config)) as JsonObject}
              label={`${actionLabel(action.type)} configuration JSON`}
              disabled={!revealSensitive}
              onApply={(config) => onChange({ ...action, config })}
            />
          </div>
        )}
      </CardContent>
      <ConfKeyModal
        open={sinkConfModalOpen}
        onOpenChange={setSinkConfModalOpen}
        category="sinks"
        initialType={action.type}
        onSaved={(templateName) => {
          setSinkTemplates((prev) => Array.from(new Set([...prev, templateName])));
          const next = { ...action.config, resourceId: templateName };
          onChange({ ...action, config: next });
        }}
      />
    </Card>
  );
}

export function RuleDesigner({ id }: { id?: string }) {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);
  const [step, setStep] = React.useState<DesignerStep>('query');
  const [queryMode, setQueryMode] = React.useState<QueryMode>('visual');
  const [ruleId, setRuleId] = React.useState(id ?? '');
  const [ruleName, setRuleName] = React.useState('');
  const [query, setQuery] = React.useState<QueryDraft>(EMPTY_QUERY);
  const [sql, setSql] = React.useState('');
  const [graph, setGraph] = React.useState<JsonObject | undefined>();
  const [actions, setActions] = React.useState<ActionDraft[]>([
    { key: 'action-new-log', type: 'log', config: {}, outer: {} },
  ]);
  const [options, setOptions] = React.useState<JsonObject>({});
  const [tags, setTags] = React.useState('');
  const [triggered, setTriggered] = React.useState(false);
  const [resources, setResources] = React.useState<Resource[]>([]);
  const [resourceFilter, setResourceFilter] = React.useState('');
  const [sinkCatalog, setSinkCatalog] = React.useState<MetadataItem[]>([]);
  const [sinkMetadata, setSinkMetadata] = React.useState<Record<string, MetadataDetail>>({});
  const [availableConnections, setAvailableConnections] = React.useState<string[]>([]);
  const [availableSchemas, setAvailableSchemas] = React.useState<string[]>([]);
  const [sinkFilter, setSinkFilter] = React.useState('');
  const [loading, setLoading] = React.useState(Boolean(id));
  const [saving, setSaving] = React.useState(false);
  const [validating, setValidating] = React.useState(false);
  const [validation, setValidation] = React.useState<{ kind: 'ok' | 'error'; message: string } | null>(null);
  const [revealSensitive, setRevealSensitive] = React.useState(false);
  const [definitionText, setDefinitionText] = React.useState('');
  const [definitionDirty, setDefinitionDirty] = React.useState(false);
  const [definitionError, setDefinitionError] = React.useState('');

  const effectiveSql = queryMode === 'visual' ? buildSql(query) : sql.trim();
  const payload = React.useMemo<Rule>(() => {
    const rule: Rule = {
      id: ruleId,
      name: ruleName.trim() || undefined,
      triggered,
      actions: encodeActions(actions),
      options: options as RuleOptions,
      tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
    };
    if (graph) rule.graph = graph;
    else rule.sql = effectiveSql;
    return rule;
  }, [actions, effectiveSql, graph, options, ruleId, ruleName, tags, triggered]);

  React.useEffect(() => {
    if (!definitionDirty) {
      const visible = revealSensitive ? payload : redactSensitive(payload);
      setDefinitionText(JSON.stringify(visible, null, 2));
    }
  }, [definitionDirty, payload, revealSensitive]);

  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    Promise.all([
      ekuiperClient.listStreams().catch(() => []),
      ekuiperClient.listTables().catch(() => []),
      ekuiperClient.listSinkMetadata().catch(() => []),
      ekuiperClient.listConnections().catch(() => []),
      ekuiperClient.listSchemas('protobuf').catch(() => []),
    ]).then(([streams, tables, sinks, conns, schemas]) => {
      if (cancelled) return;
      setResources([
        ...streams.map((item) => ({ name: item.name, kind: 'stream' as const })),
        ...tables.map((item) => ({ name: item.name, kind: 'table' as const })),
      ]);
      setSinkCatalog(sinks);
      setAvailableConnections(
        Array.isArray(conns) ? conns.map((c: any) => c.id || c.name).filter(Boolean) : []
      );
      setAvailableSchemas(
        Array.isArray(schemas) ? schemas.map((s: any) => s.name || s).filter(Boolean) : []
      );
    });
    return () => { cancelled = true; };
  }, [active]);

  React.useEffect(() => {
    if (!active) return;
    const types = [...new Set(actions.map((action) => action.type))].filter((type) => !sinkMetadata[type]);
    for (const type of types) {
      ekuiperClient.getSinkMetadata(type).then((detail) => {
        setSinkMetadata((current) => ({ ...current, [type]: detail }));
      }).catch(() => undefined);
    }
  }, [actions, active, sinkMetadata]);

  React.useEffect(() => {
    if (!id || !active) return;
    setLoading(true);
    ekuiperClient.getRule(id).then((rule) => {
      setRuleId(rule.id || id);
      setRuleName(rule.name || '');
      setActions(rule.actions?.length ? decodeActions(rule.actions) : [{ key: 'action-edit-log', type: 'log', config: {}, outer: {} }]);
      setOptions(isObject(rule.options) ? rule.options : {});
      setTags((rule.tags ?? []).join(', '));
      setTriggered(Boolean(rule.triggered));
      if (rule.graph && isObject(rule.graph)) {
        setGraph(rule.graph);
        setQueryMode('sql');
        setSql('');
      } else {
        const parsed = parseSimpleSql(rule.sql ?? '');
        setSql(rule.sql ?? '');
        if (parsed) { setQuery(parsed); setQueryMode('visual'); }
        else setQueryMode('sql');
      }
    }).catch((reason) => toast.error(reason instanceof Error ? reason.message : 'Failed to load rule'))
      .finally(() => setLoading(false));
  }, [active, id]);

  const sinkTypes = React.useMemo(() => [...new Set([
    ...BUILTIN_SINKS.map((sink) => sink.type),
    ...sinkCatalog.map((sink) => sink.name),
    ...actions.map((action) => action.type),
  ])].sort(), [actions, sinkCatalog]);

  const filteredResources = resources.filter((resource) => resource.name.toLowerCase().includes(resourceFilter.toLowerCase()));
  const filteredSinks = sinkTypes.filter((type) => `${type} ${actionLabel(type)}`.toLowerCase().includes(sinkFilter.toLowerCase()));

  const changeQuery = (key: keyof QueryDraft, value: string) => {
    setGraph(undefined);
    setQuery((current) => ({ ...current, [key]: value }));
    setValidation(null);
  };

  const changeAction = (index: number, action: ActionDraft) => {
    setActions((current) => current.map((item, itemIndex) => itemIndex === index ? action : item));
    setValidation(null);
  };

  const moveAction = (index: number, direction: -1 | 1) => {
    setActions((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addAction = (type: string) => {
    setActions((current) => [...current, { key: `action-${Date.now()}-${type}`, type, config: {}, outer: {} }]);
    setSinkFilter('');
  };

  const assertReady = (): Rule => {
    if (definitionDirty) throw new Error('Apply or discard the Rule JSON changes before validating');
    if (!/^[A-Za-z0-9_-]+$/.test(ruleId)) throw new Error('Rule ID may contain letters, numbers, hyphen, and underscore');
    if (!payload.sql?.trim() && !payload.graph) throw new Error('Build a query or provide a graph definition');
    if (!actions.length) throw new Error('Add at least one output');
    return payload;
  };

  const validate = async () => {
    setValidating(true);
    try {
      const result = await ekuiperClient.validateRule(assertReady());
      const next = result.valid
        ? { kind: 'ok' as const, message: 'eKuiper accepted this rule definition.' }
        : { kind: 'error' as const, message: result.error ?? 'eKuiper rejected this rule definition.' };
      setValidation(next);
      if (result.valid) toast.success('Rule is valid'); else toast.error(next.message);
    } catch (reason) {
      setValidation({ kind: 'error', message: reason instanceof Error ? reason.message : 'Validation failed' });
    } finally {
      setValidating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const rule = assertReady();
      const result = await ekuiperClient.validateRule(rule);
      if (!result.valid) throw new Error(result.error ?? 'Rule validation failed');
      if (id) {
        const { id: _pathId, ...body } = rule;
        await ekuiperClient.updateRule(id, body);
      } else {
        await ekuiperClient.createRule(rule);
      }
      toast.success(`Rule ${id ? 'updated' : 'created'}`);
      router.push(`/rules/${encodeURIComponent(rule.id)}`);
      router.refresh();
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const applyDefinition = () => {
    try {
      if (!revealSensitive) throw new Error('Reveal sensitive values before applying raw JSON');
      const parsed: unknown = JSON.parse(definitionText);
      if (!isObject(parsed)) throw new Error('Rule JSON must be an object');
      if (typeof parsed.id !== 'string') throw new Error('Rule JSON requires a string id');
      if (!Array.isArray(parsed.actions)) throw new Error('Rule JSON requires an actions array');
      if (id && parsed.id !== id) throw new Error('The rule ID cannot be changed while editing');
      setRuleId(parsed.id);
      setActions(decodeActions(parsed.actions as Sink[]));
      setOptions(isObject(parsed.options) ? parsed.options : {});
      setTags(Array.isArray(parsed.tags) ? parsed.tags.map(String).join(', ') : '');
      setTriggered(Boolean(parsed.triggered));
      if (isObject(parsed.graph)) {
        setGraph(parsed.graph);
        setSql('');
        setQueryMode('sql');
      } else if (typeof parsed.sql === 'string') {
        setGraph(undefined);
        setSql(parsed.sql);
        const simple = parseSimpleSql(parsed.sql);
        if (simple) setQuery(simple);
        setQueryMode(simple ? 'visual' : 'sql');
      } else throw new Error('Rule JSON requires either sql or graph');
      setDefinitionDirty(false);
      setDefinitionError('');
      setValidation(null);
    } catch (reason) {
      setDefinitionError(reason instanceof Error ? reason.message : 'Invalid rule JSON');
    }
  };

  const option = (key: string, value: unknown) => {
    setOptions((current) => {
      const next = { ...current };
      if (value === undefined || value === '' || value === false) delete next[key];
      else next[key] = value;
      return next;
    });
    setValidation(null);
  };

  return (
    <AppLayout title={id ? 'Edit rule' : 'Rule designer'}>
      <div className="mx-auto max-w-[1500px] flex flex-col gap-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild><Link href={id ? `/rules/${encodeURIComponent(id)}` : '/rules'} aria-label="Back to rules"><ArrowLeft className="size-5" /></Link></Button>
            <div>
              <div className="flex items-center gap-2"><Workflow className="size-6 text-primary" /><h2 className="text-2xl font-semibold tracking-tight">{id ? `Edit ${id}` : 'Rule designer'}</h2></div>
              <p className="mt-1 text-sm text-muted-foreground">Build visually, inspect the generated rule, and validate it on {active?.name ?? 'the selected node'}.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void validate()} disabled={loading || !active}>Validate with eKuiper</Button>
            <Button onClick={() => void save()} disabled={saving || loading || !active}>{saving ? 'Saving…' : id ? 'Save changes' : 'Create rule'}</Button>
          </div>
        </div>

        {!active && (
          <Alert variant="destructive">
            <AlertDescription>Select an eKuiper node before designing a rule.</AlertDescription>
          </Alert>
        )}
        {graph && (
          <Alert variant="warning">
            <CircleAlert className="size-4" aria-hidden="true" />
            <AlertTitle>Graph rule in raw-definition mode</AlertTitle>
            <AlertDescription>The visual SQL builder cannot represent graph rules. The graph is preserved exactly in the Rule JSON pane.</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.72fr)]">
          <div className="flex flex-col gap-5">
            <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Rule designer steps">
              {STEP_ITEMS.map((item, index) => {
                const Icon = item.icon;
                const selected = step === item.id;
                return (
                  <button
                    key={item.id}
                    role="tab"
                    aria-selected={selected}
                    aria-current={selected ? 'step' : undefined}
                    onClick={() => setStep(item.id)}
                    className={`rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out active:scale-[0.98] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      selected ? 'border-primary bg-primary/5 shadow-beautiful-sm' : 'border-border/60 hover:bg-muted/50 hover:border-border'
                    }`}
                  >
                    <span className="flex items-center gap-2"><span className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{index + 1}</span><Icon className="size-4" aria-hidden="true" /><span className="font-medium">{item.label}</span></span>
                    <span className="mt-1 block pl-9 text-xs text-muted-foreground">{item.description}</span>
                  </button>
                );
              })}
            </div>

            {step === 'query' && (
              <div id="rule-editor-card" className="flex flex-col gap-5">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Identity</CardTitle>
                    <CardDescription>Configure unique identifier and descriptive label.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="rule-id">Rule ID <span className="text-destructive">*</span></Label>
                      <Input
                        id="rule-id"
                        value={ruleId}
                        onChange={(event) => setRuleId(event.target.value)}
                        disabled={Boolean(id) || loading}
                        placeholder="ruleRecordToFile"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="rule-name">Name</Label>
                      <Input
                        id="rule-name"
                        value={ruleName}
                        onChange={(event) => setRuleName(event.target.value)}
                        placeholder="Record data to a file and use File source for data playback"
                      />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><CardTitle className="text-lg">Query</CardTitle><CardDescription>Choose the structured builder or edit eKuiper SQL directly.</CardDescription></div><Tabs value={queryMode} onValueChange={(value) => { setQueryMode(value as QueryMode); if (value === 'sql' && !sql) setSql(buildSql(query)); }}><TabsList><TabsTrigger value="visual">Visual</TabsTrigger><TabsTrigger value="sql">SQL</TabsTrigger></TabsList></Tabs></div></CardHeader>
                  <CardContent>
                    {queryMode === 'visual' ? (
                      <div className="flex flex-col gap-5">
                        <div className="flex flex-col gap-3">
                          <Label htmlFor="rule-designer-data-source">Data source</Label>
                          <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" /><Input id="rule-designer-data-source" value={resourceFilter} onChange={(event) => setResourceFilter(event.target.value)} className="pl-9" placeholder="Find a stream or table" aria-label="Find a stream or table" /></div>
                          <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                            {filteredResources.map((resource) => (
                              <button key={`${resource.kind}-${resource.name}`} type="button" onClick={() => changeQuery('source', resource.name)} aria-pressed={query.source === resource.name} className={`flex items-center justify-between rounded-lg border p-3 text-left transition-colors ${query.source === resource.name ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                                <span className="min-w-0"><span className="block truncate text-sm font-medium" title={resource.name}>{resource.name}</span><span className="text-xs capitalize text-muted-foreground">{resource.kind}</span></span>
                                {query.source === resource.name && <Check className="size-4 text-primary" aria-hidden="true" />}
                              </button>
                            ))}
                            {!filteredResources.length && <p className="col-span-full rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No matching streams or tables on this node. You can still enter a name below.</p>}
                          </div>
                          <Input aria-label="Source name" value={query.source} onChange={(event) => changeQuery('source', event.target.value)} placeholder="Or enter a source name" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="query-fields">Select fields</Label><Textarea id="query-fields" value={query.fields} onChange={(event) => changeQuery('fields', event.target.value)} className="min-h-20 font-mono text-sm" placeholder="*, temperature, avg(power) AS mean_power" /></div>
                          <div className="flex flex-col gap-2 sm:col-span-2"><Label htmlFor="query-where">Filter (WHERE)</Label><Input id="query-where" value={query.where} onChange={(event) => changeQuery('where', event.target.value)} placeholder="temperature > 80" /></div>
                          <div className="flex flex-col gap-2"><Label htmlFor="query-group">Group by</Label><Input id="query-group" value={query.groupBy} onChange={(event) => changeQuery('groupBy', event.target.value)} placeholder="deviceId, TUMBLINGWINDOW(ss, 10)" /></div>
                          <div className="flex flex-col gap-2"><Label htmlFor="query-having">Having</Label><Input id="query-having" value={query.having} onChange={(event) => changeQuery('having', event.target.value)} placeholder="count(*) > 2" /></div>
                          <div className="flex flex-col gap-2"><Label htmlFor="query-order">Order by</Label><Input id="query-order" value={query.orderBy} onChange={(event) => changeQuery('orderBy', event.target.value)} placeholder="temperature DESC" /></div>
                          <div className="flex flex-col gap-2"><Label htmlFor="query-limit">Limit</Label><Input id="query-limit" type="number" min="1" value={query.limit} onChange={(event) => changeQuery('limit', event.target.value)} placeholder="100" /></div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2"><Label htmlFor="rule-sql">eKuiper SQL</Label><Textarea id="rule-sql" value={sql} onChange={(event) => { setGraph(undefined); setSql(event.target.value); setValidation(null); }} className="min-h-72 font-mono text-sm" spellCheck={false} placeholder="SELECT * FROM sensor WHERE temperature > 80" /><p className="text-xs text-muted-foreground">Switching to Visual is safe only when the query can be represented by the fields above.</p></div>
                    )}
                  </CardContent>
                </Card>
                <div className="flex justify-end"><Button onClick={() => setStep('actions')}>Continue to outputs<ArrowRight className="ml-2 size-4" aria-hidden="true" /></Button></div>
              </div>
            )}

            {step === 'actions' && (
              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Add an output</CardTitle><CardDescription>Available types combine eKuiper&apos;s installed metadata with supported built-in editors.</CardDescription></CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden="true" /><Input value={sinkFilter} onChange={(event) => setSinkFilter(event.target.value)} className="pl-9" placeholder="Find a sink" aria-label="Find a sink" /></div>
                    <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {filteredSinks.map((type) => {
                        const known = BUILTIN_SINKS.find((sink) => sink.type === type);
                        const detected = sinkCatalog.some((sink) => sink.name === type);
                        return <button key={type} type="button" onClick={() => addAction(type)} className="group rounded-lg border p-3 text-left transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.99] hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><span className="flex items-center justify-between gap-2"><span className="font-medium">{actionLabel(type)}</span><Plus className="size-4 text-muted-foreground group-hover:text-primary" aria-hidden="true" /></span><span className="mt-1 block text-xs text-muted-foreground">{known?.description ?? 'Installed eKuiper sink.'}</span><Badge variant="outline" className="mt-2 text-[10px]">{detected ? 'Reported by node' : 'Built-in editor'}</Badge></button>;
                      })}
                    </div>
                  </CardContent>
                </Card>
                <div className="flex flex-col gap-4">
                  {actions.map((action, index) => (
                    <ActionCard
                      key={action.key}
                      action={action}
                      index={index}
                      sinkTypes={sinkTypes}
                      metadata={sinkMetadata[action.type]}
                      availableConnections={availableConnections}
                      availableSchemas={availableSchemas}
                      revealSensitive={revealSensitive}
                      onChange={(next) => changeAction(index, next)}
                      onRemove={() => setActions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      onMove={(direction) => moveAction(index, direction)}
                    />
                  ))}
                  {!actions.length && <div className="rounded-xl border border-dashed p-10 text-center"><Send className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" /><p className="font-medium">No outputs yet</p><p className="mt-1 text-sm text-muted-foreground">Select a sink from the catalog above.</p></div>}
                </div>
                <div className="flex justify-between"><Button variant="outline" onClick={() => setStep('query')}><ArrowLeft className="mr-2 size-4" aria-hidden="true" />Back</Button><Button onClick={() => setStep('options')}>Continue to runtime<ArrowRight className="ml-2 size-4" aria-hidden="true" /></Button></div>
              </div>
            )}

            {step === 'options' && (
              <div className="flex flex-col gap-5">
                <Card>
                  <CardHeader><CardTitle className="text-lg">Runtime behavior</CardTitle><CardDescription>Only non-default options are sent. Unknown official options are retained in Advanced JSON.</CardDescription></CardHeader>
                  <CardContent className="flex flex-col gap-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[['isEventTime', 'Use event time', 'Use event timestamps for windowing.'], ['sendMetaToSink', 'Send metadata to sinks', 'Include source metadata in result output.'], ['sendError', 'Send errors to sinks', 'Forward processing errors to configured sinks.']].map(([key, label, description]) => <label key={key} className="flex items-start justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors cursor-pointer"><span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs text-muted-foreground">{description}</span></span><Switch checked={options[key] === true} onCheckedChange={(checked) => option(key, checked)} aria-label={label} /></label>)}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[['concurrency', 'Concurrency'], ['bufferLength', 'Buffer length'], ['checkpointInterval', 'Checkpoint interval (ms)'], ['lateTolerance', 'Late tolerance (ms)']].map(([key, label]) => <div key={key} className="flex flex-col gap-2"><Label htmlFor={`option-${key}`}>{label}</Label><Input id={`option-${key}`} type="number" min="0" value={optionNumber(options[key])} onChange={(event) => option(key, event.target.value ? Number(event.target.value) : undefined)} /></div>)}
                      <div className="flex flex-col gap-2"><Label htmlFor="option-qos">QoS</Label><Select value={options.qos == null ? 'unset' : String(options.qos)} onValueChange={(value) => option('qos', value === 'unset' ? undefined : Number(value))}><SelectTrigger id="option-qos"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="unset">Engine default</SelectItem><SelectItem value="0">At most once (0)</SelectItem><SelectItem value="1">At least once (1)</SelectItem><SelectItem value="2">Exactly once (2)</SelectItem></SelectGroup></SelectContent></Select></div>
                    </div>
                    <div className="flex flex-col gap-2"><Label htmlFor="rule-tags">Tags</Label><Input id="rule-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="production, temperature" /><p className="text-xs text-muted-foreground">Comma-separated; useful for match and bulk operations.</p></div>
                    {!id && <label className="flex items-start gap-3 rounded-lg border p-4 hover:bg-muted/30 transition-colors cursor-pointer"><Checkbox checked={triggered} onCheckedChange={(checked) => setTriggered(Boolean(checked))} aria-label="Start after creation" /><span><span className="block text-sm font-medium">Start after creation</span><span className="mt-1 block text-xs text-muted-foreground">Off by default so you can review the saved rule before it processes data.</span></span></label>}
                    <div className="border-t pt-4"><p className="mb-2 text-sm font-medium">Advanced options JSON</p><JsonObjectEditor value={options} label="Rule options JSON" onApply={setOptions} /></div>
                  </CardContent>
                </Card>
                <div className="flex justify-between"><Button variant="outline" onClick={() => setStep('actions')} className="touch-manipulation"><ArrowLeft className="mr-2 size-4" aria-hidden="true" />Back</Button><Button onClick={() => void validate()} disabled={validating || loading} className="touch-manipulation">{validating && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}Validate with eKuiper</Button></div>
              </div>
            )}
          </div>

          <div className="xl:sticky xl:top-4 xl:self-start">
            <Card className="overflow-hidden shadow-beautiful-md">
              <CardHeader className="border-b bg-muted/20 pb-4">
                <div className="flex items-start justify-between gap-3"><div><CardTitle className="flex items-center gap-2 text-lg"><Code2 className="size-5" aria-hidden="true" />Generated definition</CardTitle><CardDescription className="mt-1">The exact payload sent to eKuiper.</CardDescription></div><Button type="button" variant="ghost" size="icon" onClick={() => { setRevealSensitive((value) => !value); setDefinitionDirty(false); }} aria-label={revealSensitive ? 'Mask sensitive values' : 'Reveal sensitive values'} className="touch-manipulation">{revealSensitive ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}</Button></div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><Badge variant="outline">{query.source || 'source'}</Badge><ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" /><Badge variant="secondary">SQL</Badge><ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />{actions.length ? actions.map((action) => <Badge key={action.key} variant="outline">{actionLabel(action.type)}</Badge>) : <Badge variant="outline">no output</Badge>}</div>
              </CardHeader>
              <CardContent className="p-4 flex flex-col gap-4">
                <Tabs defaultValue="definition">
                  <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="definition">Rule JSON</TabsTrigger><TabsTrigger value="sql">SQL</TabsTrigger></TabsList>
                  <TabsContent value="definition" className="flex flex-col gap-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-150">
                    {!revealSensitive && <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">Sensitive fields are masked and raw editing is locked. Reveal them to edit the full definition.</p>}
                    <Textarea aria-label="Rule JSON" value={definitionText} disabled={!revealSensitive} onChange={(event) => { setDefinitionText(event.target.value); setDefinitionDirty(true); setDefinitionError(''); }} className="min-h-[32rem] resize-y font-mono text-xs leading-5" spellCheck={false} />
                    {definitionError && (
                      <Alert variant="destructive">
                        <AlertDescription>{definitionError}</AlertDescription>
                      </Alert>
                    )}
                    {revealSensitive && <div className="flex justify-end gap-2"><Button type="button" variant="outline" size="sm" disabled={!definitionDirty} onClick={() => { setDefinitionDirty(false); setDefinitionError(''); }} className="touch-manipulation">Discard</Button><Button type="button" size="sm" disabled={!definitionDirty} onClick={applyDefinition} className="touch-manipulation">Apply definition</Button></div>}
                  </TabsContent>
                  <TabsContent value="sql" className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-150"><pre className="min-h-64 whitespace-pre-wrap rounded-lg bg-muted p-4 font-mono text-sm">{graph ? 'Graph rule — inspect Rule JSON' : effectiveSql || 'Choose a source to generate SQL'}</pre></TabsContent>
                </Tabs>
                {validation && <div role="status" className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${validation.kind === 'ok' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-destructive/30 bg-destructive/10 text-destructive'}`}>{validation.kind === 'ok' ? <Check className="mt-0.5 size-4" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4" aria-hidden="true" />}<span>{validation.message}</span></div>}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => void validate()} disabled={validating || loading || !active} className="touch-manipulation">
                    {validating && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
                    Validate
                  </Button>
                  <Button onClick={() => void save()} disabled={saving || validating || loading || !active} className="touch-manipulation">
                    {saving && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
                    {saving ? 'Saving…' : id ? 'Save changes' : 'Create rule'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
