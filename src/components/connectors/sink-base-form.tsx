'use client';

import * as React from 'react';
import { ChevronDown, ChevronRight, HelpCircle, Layers, Send } from 'lucide-react';
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
import { Button } from '@/components/ui/button';

export interface SinkBaseOptions {
  omitIfEmpty?: boolean;
  sendSingle?: boolean;
  format?: 'json' | 'binary' | 'delimited' | 'protobuf' | 'custom' | string;
  schemaName?: string;
  schemaMessage?: string;
  delimited?: string;
  dataTemplate?: string;
  concurrency?: number;
  bufferLength?: number;
  enableCache?: boolean;
  memoryCacheThreshold?: number;
  maxDiskCache?: number;
  cleanCacheAtStop?: boolean;
  bufferPageSize?: number;
  resendInterval?: number;
  connectionSelector?: string;
}

export interface SinkBaseFormProps {
  type?: string;
  values: SinkBaseOptions;
  onChange: (values: SinkBaseOptions) => void;
  disabled?: boolean;
  availableConnections?: string[];
  availableSchemas?: string[];
}

export function SinkBaseForm({
  type = '',
  values,
  onChange,
  disabled = false,
  availableConnections = [],
  availableSchemas = [],
}: SinkBaseFormProps) {
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  const updateField = <K extends keyof SinkBaseOptions>(field: K, val: SinkBaseOptions[K]) => {
    const next = { ...values, [field]: val };
    if (val === undefined || val === '') {
      delete next[field];
    }
    onChange(next);
  };

  const isSharedConnectionSupported = ['mqtt', 'edgex'].includes(type.toLowerCase());
  const format = values.format ?? 'json';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 text-card-foreground">
        <div className="flex items-center gap-2 border-b pb-2">
          <Send className="size-4 text-primary" />
          <h4 className="text-xs font-semibold text-muted-foreground">
            Delivery & Buffering Options
          </h4>
        </div>

        {/* Primary Delivery Controls */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* omitIfEmpty */}
          <div className="flex items-center justify-between rounded-md border p-3 bg-muted/10">
            <div className="flex flex-col gap-0.5 pr-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="omit-empty" className="text-xs font-medium cursor-pointer">
                  Omit If Empty
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 cursor-help text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    If set to true, when query output is empty, no action message is emitted
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-[11px] text-muted-foreground">Skip sending when result set is empty</p>
            </div>
            <Switch
              id="omit-empty"
              checked={Boolean(values.omitIfEmpty)}
              onCheckedChange={(checked) => updateField('omitIfEmpty', checked)}
              disabled={disabled}
            />
          </div>

          {/* sendSingle */}
          <div className="flex items-center justify-between rounded-md border p-3 bg-muted/10">
            <div className="flex flex-col gap-0.5 pr-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="send-single" className="text-xs font-medium cursor-pointer">
                  Send Single
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 cursor-help text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    If true, emit one sink message per result row rather than an array of rows
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-[11px] text-muted-foreground">Emit each row as an individual message</p>
            </div>
            <Switch
              id="send-single"
              checked={Boolean(values.sendSingle)}
              onCheckedChange={(checked) => updateField('sendSingle', checked)}
              disabled={disabled}
            />
          </div>

          {/* format */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="sink-format" className="text-xs font-medium">
                Output Format
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 cursor-help text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  Format of payload emitted to the sink (JSON, binary, delimited, or protobuf)
                </TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={format}
              onValueChange={(val) => {
                updateField('format', val);
                if (val === 'delimited' && !values.delimited) {
                  updateField('delimited', ',');
                }
              }}
              disabled={disabled}
            >
              <SelectTrigger id="sink-format" className="h-9 text-xs">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="json" className="text-xs">JSON</SelectItem>
                  <SelectItem value="binary" className="text-xs">Binary</SelectItem>
                  <SelectItem value="delimited" className="text-xs">Delimited (CSV/TSV)</SelectItem>
                  <SelectItem value="protobuf" className="text-xs">Protobuf</SelectItem>
                  <SelectItem value="custom" className="text-xs">Custom Schema</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Delimiter (when delimited) */}
          {format === 'delimited' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sink-delimited" className="text-xs font-medium">
                Delimiter
              </Label>
              <Input
                id="sink-delimited"
                value={values.delimited ?? ','}
                onChange={(e) => updateField('delimited', e.target.value)}
                placeholder=","
                disabled={disabled}
                className="h-9 text-xs font-mono"
              />
            </div>
          )}

          {/* Schema Name & Message (when protobuf/custom) */}
          {(format === 'protobuf' || format === 'custom') && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sink-schema-name" className="text-xs font-medium">
                  Schema Name
                </Label>
                {availableSchemas.length > 0 ? (
                  <Select
                    value={values.schemaName ?? ''}
                    onValueChange={(val) => updateField('schemaName', val)}
                    disabled={disabled}
                  >
                    <SelectTrigger id="sink-schema-name" className="h-9 text-xs">
                      <SelectValue placeholder="Select schema" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {availableSchemas.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="sink-schema-name"
                    value={values.schemaName ?? ''}
                    onChange={(e) => updateField('schemaName', e.target.value)}
                    placeholder="e.g. sensor.proto"
                    disabled={disabled}
                    className="h-9 text-xs"
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sink-schema-message" className="text-xs font-medium">
                  Schema Message
                </Label>
                <Input
                  id="sink-schema-message"
                  value={values.schemaMessage ?? ''}
                  onChange={(e) => updateField('schemaMessage', e.target.value)}
                  placeholder="e.g. SensorData"
                  disabled={disabled}
                  className="h-9 text-xs"
                />
              </div>
            </>
          )}

          {/* Shared Connection Selector (for mqtt / edgex) */}
          {isSharedConnectionSupported && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="sink-connection" className="text-xs font-medium">
                  Shared Connection ID
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 cursor-help text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Reuse connection credentials and broker pool defined in Shared Connections
                  </TooltipContent>
                </Tooltip>
              </div>
              {availableConnections.length > 0 ? (
                <Select
                  value={values.connectionSelector ?? '__NONE__'}
                  onValueChange={(val) =>
                    updateField('connectionSelector', val === '__NONE__' ? undefined : val)
                  }
                  disabled={disabled}
                >
                  <SelectTrigger id="sink-connection" className="h-9 text-xs font-mono">
                    <SelectValue placeholder="None (standalone connection)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="__NONE__" className="text-xs italic text-muted-foreground">
                        None (standalone connection)
                      </SelectItem>
                      {availableConnections.map((conn) => (
                        <SelectItem key={conn} value={conn} className="text-xs font-mono">
                          {conn}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="sink-connection"
                  value={values.connectionSelector ?? ''}
                  onChange={(e) => updateField('connectionSelector', e.target.value)}
                  placeholder="e.g. shared-mqtt-conn"
                  disabled={disabled}
                  className="h-9 text-xs font-mono"
                />
              )}
            </div>
          )}

          {/* dataTemplate */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="sink-data-template" className="text-xs font-medium">
                  Data Template (Golang Template)
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 cursor-help text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Transform output using Go template syntax. Example: &#123;&#123;json .&#125;&#125; or &#123;&#123;.temperature&#125;&#125;
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">e.g. &#123;&#123;json .&#125;&#125;</span>
            </div>
            <Textarea
              id="sink-data-template"
              value={values.dataTemplate ?? ''}
              onChange={(e) => updateField('dataTemplate', e.target.value)}
              placeholder="e.g. {{json .}}"
              disabled={disabled}
              className="min-h-[72px] font-mono text-xs"
              rows={2}
            />
          </div>
        </div>

        {/* Collapsible Advanced Buffering & Cache Options */}
        <div className="border-t pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground p-0 h-7"
          >
            {showAdvanced ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            <Layers className="size-3.5" />
            Advanced Buffering & Cache Settings
          </Button>

          {showAdvanced && (
            <div className="mt-3 grid grid-cols-1 gap-3 rounded-md border p-3 bg-muted/15 sm:grid-cols-2">
              {/* Concurrency */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="adv-concurrency" className="text-[11px] text-muted-foreground">
                  Concurrency (Threads)
                </Label>
                <Input
                  id="adv-concurrency"
                  type="number"
                  value={values.concurrency ?? ''}
                  onChange={(e) =>
                    updateField(
                      'concurrency',
                      e.target.value ? parseInt(e.target.value, 10) : undefined
                    )
                  }
                  placeholder="1"
                  disabled={disabled}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Buffer Length */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="adv-buffer-length" className="text-[11px] text-muted-foreground">
                  Buffer Length
                </Label>
                <Input
                  id="adv-buffer-length"
                  type="number"
                  value={values.bufferLength ?? ''}
                  onChange={(e) =>
                    updateField(
                      'bufferLength',
                      e.target.value ? parseInt(e.target.value, 10) : undefined
                    )
                  }
                  placeholder="1024"
                  disabled={disabled}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Resend Interval */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="adv-resend-interval" className="text-[11px] text-muted-foreground">
                  Resend Interval (ms)
                </Label>
                <Input
                  id="adv-resend-interval"
                  type="number"
                  value={values.resendInterval ?? ''}
                  onChange={(e) =>
                    updateField(
                      'resendInterval',
                      e.target.value ? parseInt(e.target.value, 10) : undefined
                    )
                  }
                  placeholder="0"
                  disabled={disabled}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Buffer Page Size */}
              <div className="flex flex-col gap-1">
                <Label htmlFor="adv-page-size" className="text-[11px] text-muted-foreground">
                  Buffer Page Size
                </Label>
                <Input
                  id="adv-page-size"
                  type="number"
                  value={values.bufferPageSize ?? ''}
                  onChange={(e) =>
                    updateField(
                      'bufferPageSize',
                      e.target.value ? parseInt(e.target.value, 10) : undefined
                    )
                  }
                  placeholder="256"
                  disabled={disabled}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {/* Enable Cache */}
              <div className="flex items-center justify-between sm:col-span-2 rounded border p-2 bg-background">
                <div className="flex flex-col gap-0.5">
                  <Label htmlFor="adv-enable-cache" className="text-xs font-medium cursor-pointer">
                    Enable Sink Cache
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    Store messages locally when the downstream target is temporarily disconnected
                  </p>
                </div>
                <Switch
                  id="adv-enable-cache"
                  checked={Boolean(values.enableCache)}
                  onCheckedChange={(checked) => updateField('enableCache', checked)}
                  disabled={disabled}
                />
              </div>

              {values.enableCache && (
                <>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="adv-mem-thresh" className="text-[11px] text-muted-foreground">
                      Memory Cache Threshold
                    </Label>
                    <Input
                      id="adv-mem-thresh"
                      type="number"
                      value={values.memoryCacheThreshold ?? ''}
                      onChange={(e) =>
                        updateField(
                          'memoryCacheThreshold',
                          e.target.value ? parseInt(e.target.value, 10) : undefined
                        )
                      }
                      placeholder="100"
                      disabled={disabled}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="adv-max-disk" className="text-[11px] text-muted-foreground">
                      Max Disk Cache (bytes)
                    </Label>
                    <Input
                      id="adv-max-disk"
                      type="number"
                      value={values.maxDiskCache ?? ''}
                      onChange={(e) =>
                        updateField(
                          'maxDiskCache',
                          e.target.value ? parseInt(e.target.value, 10) : undefined
                        )
                      }
                      placeholder="1048576"
                      disabled={disabled}
                      className="h-8 text-xs font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between sm:col-span-2 rounded border p-2 bg-background">
                    <Label htmlFor="adv-clean-stop" className="text-xs font-medium cursor-pointer">
                      Clean Cache At Rule Stop
                    </Label>
                    <Switch
                      id="adv-clean-stop"
                      checked={Boolean(values.cleanCacheAtStop)}
                      onCheckedChange={(checked) => updateField('cleanCacheAtStop', checked)}
                      disabled={disabled}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
