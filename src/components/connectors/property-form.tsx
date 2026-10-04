'use client';

import * as React from 'react';
import { Eye, EyeOff, HelpCircle, Plus, Trash2, Code2, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Badge } from '@/components/ui/badge';
import type { MetadataProperty, I18nString } from '@/lib/ekuiper/types';
import { getBuiltinConnectorProperties } from '@/lib/ekuiper/connector-catalog';

export function i18nLabel(val: I18nString | undefined | null, lang: 'en' | 'zh' = 'en'): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    const obj = val as Record<string, string>;
    return obj[lang] ?? obj.en ?? obj.en_US ?? obj.zh ?? obj.zh_CN ?? Object.values(obj)[0] ?? '';
  }
  return String(val);
}

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface IndexField {
  name: number;
  dateTimeFormat: string;
  indexField: string;
  indexFieldType: 'DATETIME' | 'INT' | '';
  indexValue: string | number;
}

export interface PropertyFormProps {
  properties: MetadataProperty[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
  category?: 'sources' | 'sinks' | 'connections';
  type?: string;
  disabled?: boolean;
  connectionSelected?: boolean;
  showRawToggle?: boolean;
}

export function PropertyForm({
  properties,
  values,
  onChange,
  category = 'sources',
  type = '',
  disabled = false,
  connectionSelected = false,
  showRawToggle = true,
}: PropertyFormProps) {
  const [showPasswords, setShowPasswords] = React.useState<Record<string, boolean>>({});
  const [jsonModes, setJsonModes] = React.useState<Record<string, boolean>>({});
  const [rawMode, setRawMode] = React.useState(false);
  const [rawJson, setRawJson] = React.useState('');
  const [rawError, setRawError] = React.useState<string | null>(null);

  // Initialize raw JSON when values change externally or raw mode toggles
  React.useEffect(() => {
    if (!rawMode) {
      setRawJson(JSON.stringify(values ?? {}, null, 2));
    }
  }, [values, rawMode]);

  const togglePasswordVisibility = (fieldName: string) => {
    setShowPasswords((prev) => ({ ...prev, [fieldName]: !prev[fieldName] }));
  };

  const setFieldValue = (name: string, value: any) => {
    const next = { ...values, [name]: value };
    if (value === undefined || value === '') {
      delete next[name];
    }
    onChange(next);
  };

  const handleRawChange = (text: string) => {
    setRawJson(text);
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        setRawError(null);
        onChange(parsed);
      } else {
        setRawError('JSON must be an object');
      }
    } catch (e) {
      setRawError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const isSqlSource = category === 'sources' && type.toLowerCase() === 'sql';

  // Normalize properties array: can be passed as array or { default: array }
  const propertyList: MetadataProperty[] = React.useMemo(() => {
    let list: MetadataProperty[] = [];
    if (Array.isArray(properties) && properties.length > 0) {
      list = properties;
    } else if (
      properties &&
      typeof properties === 'object' &&
      Array.isArray((properties as any).default) &&
      (properties as any).default.length > 0
    ) {
      list = (properties as any).default;
    } else if (type) {
      list = getBuiltinConnectorProperties(category, type);
    }
    return list;
  }, [properties, type, category]);

  if (showRawToggle && rawMode) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Configuration (Raw JSON)
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setRawMode(false)}
          >
            Switch to Visual Form
          </Button>
        </div>
        <Textarea
          value={rawJson}
          onChange={(e) => handleRawChange(e.target.value)}
          disabled={disabled}
          className="min-h-[260px] font-mono text-xs leading-relaxed"
          spellCheck={false}
        />
        {rawError && (
          <p className="text-xs font-medium text-destructive">{rawError}</p>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-4">
        {showRawToggle && propertyList.length > 0 && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setRawJson(JSON.stringify(values ?? {}, null, 2));
                setRawMode(true);
              }}
            >
              <Code2 className="size-3.5" />
              JSON Mode
            </Button>
          </div>
        )}

        {propertyList.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-xs text-muted-foreground">
            No configurable properties reported for this connector. You can use JSON Mode to add custom parameters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {propertyList.map((prop) => {
              const isInherited = Boolean(prop.connection_related && connectionSelected);
              const isFieldDisabled = Boolean(disabled || isInherited);
              const val = values?.[prop.name];
              const labelText = i18nLabel(prop.label) || prop.name;
              const hintText = i18nLabel(prop.hint);
              const isFullWidth =
                prop.control === 'textarea' ||
                prop.control === 'list' ||
                prop.name.toLowerCase() === 'headers' ||
                prop.name.toLowerCase() === 'oauth' ||
                prop.type === 'list_object' ||
                prop.type === 'object';

              return (
                <div
                  key={prop.name}
                  className={`flex flex-col gap-1.5 ${isFullWidth ? 'sm:col-span-2' : ''}`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label
                        htmlFor={`prop-${prop.name}`}
                        className="text-xs font-medium text-foreground"
                      >
                        {labelText}
                        {!prop.optional && !isInherited && (
                          <span className="ml-1 text-destructive font-bold">*</span>
                        )}
                      </Label>
                      {hintText && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help text-muted-foreground/70 hover:text-muted-foreground">
                              <HelpCircle className="size-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs text-xs">
                            {hintText}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    {isInherited && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                        From connection
                      </Badge>
                    )}
                  </div>

                  {/* Render based on control type */}
                  {renderControl({
                    prop,
                    value: val,
                    disabled: isFieldDisabled,
                    onChange: (newVal) => setFieldValue(prop.name, newVal),
                    showPassword: Boolean(showPasswords[prop.name]),
                    onTogglePassword: () => togglePasswordVisibility(prop.name),
                    jsonMode: Boolean(jsonModes[prop.name]),
                    onToggleJsonMode: () =>
                      setJsonModes((prev) => ({ ...prev, [prop.name]: !prev[prop.name] })),
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* Multi-Index Fields for SQL Source */}
        {isSqlSource && (
          <MultiIndexFieldsEditor
            values={values?.templateSqlQueryCfg}
            onChange={(next) => setFieldValue('templateSqlQueryCfg', next)}
            disabled={disabled}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

interface ControlProps {
  prop: MetadataProperty;
  value: any;
  disabled: boolean;
  onChange: (val: any) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  jsonMode: boolean;
  onToggleJsonMode: () => void;
}

function renderControl({
  prop,
  value,
  disabled,
  onChange,
  showPassword,
  onTogglePassword,
  jsonMode,
  onToggleJsonMode,
}: ControlProps) {
  const isPassword =
    prop.name.toLowerCase().includes('password') ||
    prop.name.toLowerCase().includes('secret') ||
    prop.name.toLowerCase().includes('token');

  // 1. Boolean / Switch
  if (prop.control === 'radio' && prop.type === 'bool') {
    const isChecked = typeof value === 'boolean' ? value : Boolean(prop.default);
    return (
      <div className="flex h-9 items-center gap-2">
        <Switch
          id={`prop-${prop.name}`}
          checked={isChecked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
        <span className="text-xs text-muted-foreground">{isChecked ? 'True' : 'False'}</span>
      </div>
    );
  }

  // 2. Select Dropdown
  if (prop.control === 'select' && Array.isArray(prop.values)) {
    const currentValue = value !== undefined && value !== null ? String(value) : '';
    return (
      <Select
        value={currentValue}
        onValueChange={(val) => onChange(val === '__CLEAR__' ? undefined : val)}
        disabled={disabled}
      >
        <SelectTrigger id={`prop-${prop.name}`} className="h-9 text-base md:text-xs">
          <SelectValue placeholder={prop.default ? String(prop.default) : 'Select option'} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="__CLEAR__" className="text-xs italic text-muted-foreground">
              None (Default)
            </SelectItem>
            {prop.values.map((opt) => {
              const optVal = String(opt);
              return (
                <SelectItem key={optVal} value={optVal} className="text-xs">
                  {optVal}
                </SelectItem>
              );
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }

  // 3. Textarea
  if (prop.control === 'textarea') {
    return (
      <Textarea
        id={`prop-${prop.name}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={prop.default ? String(prop.default) : ''}
        disabled={disabled}
        className="min-h-[72px] text-base md:text-xs font-mono"
        rows={3}
      />
    );
  }

  // 4. Headers & Key-Value Editor
  if (
    prop.name.toLowerCase() === 'headers' ||
    prop.type === 'list_object' ||
    prop.type === 'object'
  ) {
    return (
      <KeyValueFieldEditor
        name={prop.name}
        value={value}
        defaultVal={prop.default}
        disabled={disabled}
        onChange={onChange}
        jsonMode={jsonMode}
        onToggleJsonMode={onToggleJsonMode}
      />
    );
  }

  // 5. String List (Tokens / Tags)
  if (prop.control === 'list') {
    return (
      <StringListEditor
        name={prop.name}
        values={Array.isArray(value) ? value : []}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  // 6. Number input
  if (prop.type === 'int' || prop.type === 'float') {
    return (
      <Input
        id={`prop-${prop.name}`}
        type="number"
        value={value !== undefined && value !== null ? value : ''}
        onChange={(e) => {
          const val = e.target.value;
          if (val === '') {
            onChange(undefined);
          } else {
            onChange(prop.type === 'int' ? parseInt(val, 10) : parseFloat(val));
          }
        }}
        placeholder={prop.default !== undefined ? String(prop.default) : ''}
        disabled={disabled}
        className="h-9 text-base md:text-xs"
      />
    );
  }

  // 7. Password / Secret
  if (isPassword) {
    return (
      <div className="relative">
        <Input
          id={`prop-${prop.name}`}
          type={showPassword ? 'text' : 'password'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={prop.default ? String(prop.default) : '••••••••'}
          disabled={disabled}
          className="h-9 pr-8 text-base md:text-xs font-mono"
        />
        <button
          type="button"
          onClick={onTogglePassword}
          disabled={disabled}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 -translate-y-1/2 size-8 sm:size-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
        >
          {showPassword ? <EyeOff className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}
        </button>
      </div>
    );
  }

  // 8. Standard Text string
  return (
    <Input
      id={`prop-${prop.name}`}
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={prop.default ? String(prop.default) : ''}
      disabled={disabled}
      className="h-9 text-base md:text-xs"
    />
  );
}

// -----------------------------------------------------------------------------
// Sub-component: String List / Tag Tokens Editor
// -----------------------------------------------------------------------------
function StringListEditor({
  name,
  values,
  disabled,
  onChange,
}: {
  name: string;
  values: string[];
  disabled: boolean;
  onChange: (vals: string[]) => void;
}) {
  const [inputVal, setInputVal] = React.useState('');

  const addTag = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInputVal('');
    }
  };

  const removeTag = (index: number) => {
    onChange(values.filter((_, idx) => idx !== index));
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2 bg-muted/20">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {values.length === 0 ? (
          <span className="text-[11px] text-muted-foreground italic py-0.5">No items added</span>
        ) : (
          values.map((tag, idx) => (
            <Badge
              key={`${tag}-${idx}`}
              variant="secondary"
              className="gap-1 pl-2 pr-1 text-xs py-0.5 font-mono"
            >
              {tag}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(idx)}
                  className="rounded-full hover:bg-muted p-0.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label={`Remove ${tag}`}
                >
                  <Trash2 className="size-2.5" aria-hidden="true" />
                </button>
              )}
            </Badge>
          ))
        )}
      </div>
      {!disabled && (
        <div className="flex gap-1.5">
          <Input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder={`Add ${name} item and press Enter…`}
            className="h-9 text-base md:text-xs font-mono"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addTag}
            className="h-9 px-3"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-component: Key-Value Table / JSON Editor (Headers, Options)
// -----------------------------------------------------------------------------
function KeyValueFieldEditor({
  name,
  value,
  defaultVal,
  disabled,
  onChange,
  jsonMode,
  onToggleJsonMode,
}: {
  name: string;
  value: any;
  defaultVal: any;
  disabled: boolean;
  onChange: (val: any) => void;
  jsonMode: boolean;
  onToggleJsonMode: () => void;
}) {
  const [jsonText, setJsonText] = React.useState('');
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  // Normalize initial value to pairs
  const pairs: KeyValuePair[] = React.useMemo(() => {
    const target = value ?? defaultVal ?? {};
    if (typeof target === 'object' && target !== null && !Array.isArray(target)) {
      return Object.entries(target).map(([k, v]) => ({ key: k, value: String(v) }));
    }
    return [];
  }, [value, defaultVal]);

  React.useEffect(() => {
    if (jsonMode) {
      setJsonText(JSON.stringify(value ?? defaultVal ?? {}, null, 2));
    }
  }, [jsonMode, value, defaultVal]);

  const updatePair = (index: number, updated: Partial<KeyValuePair>) => {
    const nextPairs = [...pairs];
    nextPairs[index] = { ...nextPairs[index], ...updated };
    const nextObj: Record<string, string> = {};
    for (const p of nextPairs) {
      if (p.key.trim()) {
        nextObj[p.key.trim()] = p.value;
      }
    }
    onChange(nextObj);
  };

  const addPair = () => {
    const nextPairs = [...pairs, { key: '', value: '' }];
    const nextObj: Record<string, string> = {};
    for (const p of nextPairs) {
      if (p.key.trim()) {
        nextObj[p.key.trim()] = p.value;
      }
    }
    onChange(nextObj);
  };

  const removePair = (index: number) => {
    const nextPairs = pairs.filter((_, idx) => idx !== index);
    const nextObj: Record<string, string> = {};
    for (const p of nextPairs) {
      if (p.key.trim()) {
        nextObj[p.key.trim()] = p.value;
      }
    }
    onChange(nextObj);
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        setJsonError(null);
        onChange(parsed);
      } else {
        setJsonError('Must be a JSON object');
      }
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-2.5 bg-muted/20">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {name} Entries
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggleJsonMode}
          className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {jsonMode ? 'Switch to Table' : 'Switch to Raw JSON'}
        </Button>
      </div>

      {jsonMode ? (
        <div className="flex flex-col gap-1">
          <Textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            disabled={disabled}
            placeholder='{"key": "value"}'
            className="min-h-[100px] font-mono text-xs"
          />
          {jsonError && <p className="text-[11px] text-destructive">{jsonError}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pairs.length === 0 ? (
            <p className="text-[11px] italic text-muted-foreground">No entries configured</p>
          ) : (
            pairs.map((pair, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={pair.key}
                  onChange={(e) => updatePair(idx, { key: e.target.value })}
                  placeholder="Key"
                  disabled={disabled}
                  className="h-9 flex-1 font-mono text-base md:text-xs"
                />
                <Input
                  value={pair.value}
                  onChange={(e) => updatePair(idx, { value: e.target.value })}
                  placeholder="Value"
                  disabled={disabled}
                  className="h-9 flex-1 font-mono text-base md:text-xs"
                />
                {!disabled && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePair(idx)}
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove entry ${idx + 1}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))
          )}
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPair}
              className="h-7 gap-1 text-xs"
            >
              <Plus className="size-3" />
              Add Key-Value
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-component: Multi-Index Fields for SQL Source
// -----------------------------------------------------------------------------
function MultiIndexFieldsEditor({
  values,
  onChange,
  disabled,
}: {
  values?: { TemplateSql?: string; indexFields?: IndexField[] };
  onChange: (val: any) => void;
  disabled: boolean;
}) {
  const fields: IndexField[] = values?.indexFields ?? [
    {
      name: 1,
      dateTimeFormat: '',
      indexField: '',
      indexFieldType: '',
      indexValue: '',
    },
  ];

  const updateField = (index: number, updated: Partial<IndexField>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...updated };
    onChange({
      TemplateSql: values?.TemplateSql ?? '',
      indexFields: next,
    });
  };

  const addField = () => {
    const next = [
      ...fields,
      {
        name: fields.length + 1,
        dateTimeFormat: '',
        indexField: '',
        indexFieldType: '' as const,
        indexValue: '',
      },
    ];
    onChange({
      TemplateSql: values?.TemplateSql ?? '',
      indexFields: next,
    });
  };

  const removeField = (index: number) => {
    const next = fields
      .filter((_, idx) => idx !== index)
      .map((item, idx) => ({ ...item, name: idx + 1 }));
    onChange({
      TemplateSql: values?.TemplateSql ?? '',
      indexFields: next,
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 bg-muted/10 sm:col-span-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Multi-Index Query Fields
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="size-3.5 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Supports configuring multiple index fields for incremental SQL queries
            </TooltipContent>
          </Tooltip>
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addField}
            className="h-7 text-xs gap-1"
          >
            <ListPlus className="size-3" />
            Add Index Field
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {fields.map((field, idx) => (
          <div key={idx} className="rounded-md border p-3 bg-background flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">
                Index Field #{field.name}
              </span>
              {fields.length > 1 && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeField(idx)}
                  className="size-6 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove index field ${field.name || idx + 1}`}
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">Field Name</Label>
                <Input
                  value={field.indexField}
                  onChange={(e) => updateField(idx, { indexField: e.target.value })}
                  placeholder="e.g. created_at"
                  disabled={disabled}
                  className="h-9 text-base md:text-xs font-mono"
                />
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">Field Type</Label>
                <Select
                  value={field.indexFieldType}
                  onValueChange={(val: 'DATETIME' | 'INT') =>
                    updateField(idx, { indexFieldType: val, indexValue: '' })
                  }
                  disabled={disabled}
                >
                  <SelectTrigger className="h-9 text-base md:text-xs">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="DATETIME" className="text-xs">
                        DATETIME
                      </SelectItem>
                      <SelectItem value="INT" className="text-xs">
                        INT
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              {field.indexFieldType === 'DATETIME' && (
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground">Date Time Format</Label>
                  <Input
                    value={field.dateTimeFormat}
                    onChange={(e) => updateField(idx, { dateTimeFormat: e.target.value })}
                    placeholder="YYYY-MM-DD HH:mm:ss"
                    disabled={disabled}
                    className="h-9 text-base md:text-xs font-mono"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1">
                <Label className="text-[11px] text-muted-foreground">Initial Value</Label>
                <Input
                  type={field.indexFieldType === 'INT' ? 'number' : 'text'}
                  value={field.indexValue}
                  onChange={(e) => updateField(idx, { indexValue: e.target.value })}
                  placeholder="Initial checkpoint value"
                  disabled={disabled}
                  className="h-9 text-base md:text-xs font-mono"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
