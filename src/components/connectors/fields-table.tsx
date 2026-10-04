'use client';

import * as React from 'react';
import { Plus, Trash2, CornerDownRight, FileJson, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type FieldType =
  | 'bigint'
  | 'float'
  | 'string'
  | 'datetime'
  | 'boolean'
  | 'bytea'
  | 'array'
  | 'struct';

export interface StreamFieldNode {
  id: string;
  name: string;
  type: FieldType;
  arrayType?: FieldType;
  children?: StreamFieldNode[];
}

export interface FieldsTableProps {
  fields: StreamFieldNode[];
  onChange: (fields: StreamFieldNode[]) => void;
  disabled?: boolean;
}

const PRIMITIVE_TYPES: FieldType[] = [
  'bigint',
  'float',
  'string',
  'datetime',
  'boolean',
  'bytea',
];

const ALL_TYPES: FieldType[] = [...PRIMITIVE_TYPES, 'array', 'struct'];

export function formatFieldTypeString(field: StreamFieldNode): string {
  if (field.type === 'array') {
    return `array(${field.arrayType ?? 'string'})`;
  }
  if (field.type === 'struct') {
    if (!field.children || field.children.length === 0) return 'struct()';
    const inner = field.children.map((c) => `${c.name} ${formatFieldTypeString(c)}`).join(', ');
    return `struct(${inner})`;
  }
  return field.type;
}

export function FieldsTable({ fields, onChange, disabled = false }: FieldsTableProps) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [parentId, setParentId] = React.useState<string | null>(null);
  const [editingField, setEditingField] = React.useState<StreamFieldNode | null>(null);

  // Form state for adding/editing field
  const [name, setName] = React.useState('');
  const [type, setType] = React.useState<FieldType>('string');
  const [arrayType, setArrayType] = React.useState<FieldType>('string');

  // JSON Import state
  const [importOpen, setImportOpen] = React.useState(false);
  const [jsonInput, setJsonInput] = React.useState('');
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  const openAdd = (pId: string | null = null) => {
    setEditingField(null);
    setParentId(pId);
    setName('');
    setType('string');
    setArrayType('string');
    setModalOpen(true);
  };

  const openEdit = (field: StreamFieldNode) => {
    setEditingField(field);
    setParentId(null);
    setName(field.name);
    setType(field.type);
    setArrayType(field.arrayType ?? 'string');
    setModalOpen(true);
  };

  const saveField = () => {
    if (!name.trim()) return;
    const trimmedName = name.trim();

    if (editingField) {
      // Update existing field
      const updateInTree = (nodes: StreamFieldNode[]): StreamFieldNode[] =>
        nodes.map((n) => {
          if (n.id === editingField.id) {
            return {
              ...n,
              name: trimmedName,
              type,
              arrayType: type === 'array' ? arrayType : undefined,
              children: type === 'struct' ? n.children ?? [] : undefined,
            };
          }
          if (n.children) {
            return { ...n, children: updateInTree(n.children) };
          }
          return n;
        });

      onChange(updateInTree(fields));
    } else if (parentId) {
      // Add child field to parent struct
      const newField: StreamFieldNode = {
        id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: trimmedName,
        type,
        arrayType: type === 'array' ? arrayType : undefined,
        children: type === 'struct' ? [] : undefined,
      };

      const addChildToTree = (nodes: StreamFieldNode[]): StreamFieldNode[] =>
        nodes.map((n) => {
          if (n.id === parentId) {
            return { ...n, children: [...(n.children ?? []), newField] };
          }
          if (n.children) {
            return { ...n, children: addChildToTree(n.children) };
          }
          return n;
        });

      onChange(addChildToTree(fields));
    } else {
      // Add top-level field
      const newField: StreamFieldNode = {
        id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name: trimmedName,
        type,
        arrayType: type === 'array' ? arrayType : undefined,
        children: type === 'struct' ? [] : undefined,
      };
      onChange([...fields, newField]);
    }

    setModalOpen(false);
  };

  const removeField = (id: string) => {
    const removeFromTree = (nodes: StreamFieldNode[]): StreamFieldNode[] =>
      nodes
        .filter((n) => n.id !== id)
        .map((n) => (n.children ? { ...n, children: removeFromTree(n.children) } : n));

    onChange(removeFromTree(fields));
  };

  const handleImportJson = () => {
    try {
      setJsonError(null);
      const parsed = JSON.parse(jsonInput);
      const target = Array.isArray(parsed) ? parsed[0] : parsed;
      if (!target || typeof target !== 'object') {
        throw new Error('Please provide a valid JSON object or array of objects');
      }

      const inferred = inferFieldsFromJson(target);
      onChange([...fields, ...inferred]);
      setImportOpen(false);
      setJsonInput('');
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Invalid JSON input');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Schema Fields ({countFields(fields)})
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Explicit data types for stream or table columns.
          </p>
        </div>
        {!disabled && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
              className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
            >
              <FileJson className="size-3.5" />
              Infer from JSON
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => openAdd(null)}
              className="h-7 text-xs gap-1"
            >
              <Plus className="size-3.5" />
              Add Field
            </Button>
          </div>
        )}
      </div>

      {fields.length === 0 ? (
        <div className="rounded-lg border border-dashed py-8 text-center bg-muted/5">
          <p className="text-xs text-muted-foreground">No schema fields configured.</p>
          <p className="text-[11px] text-muted-foreground/75 mt-0.5">
            Click &ldquo;Add Field&rdquo; or &ldquo;Infer from JSON&rdquo; to populate typed columns.
          </p>
        </div>
      ) : (
        <div className="rounded-md border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <div className="grid grid-cols-12 gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <div className="col-span-6">Field Name</div>
                <div className="col-span-4">Data Type</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              <div className="divide-y text-xs">
                {renderFieldRows(fields, 0, disabled, openAdd, openEdit, removeField)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Field Dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingField ? 'Edit Field' : parentId ? 'Add Nested Field' : 'Add Schema Field'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure name and eKuiper SQL data type.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3.5 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="field-name" className="text-xs font-medium">
                Field Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="field-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. temperature"
                className="h-9 text-base md:text-xs font-mono"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="field-type" className="text-xs font-medium">
                Data Type
              </Label>
              <Select value={type} onValueChange={(val: FieldType) => setType(val)}>
                <SelectTrigger id="field-type" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ALL_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="text-xs">
                        {t}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {type === 'array' && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="array-element-type" className="text-xs font-medium">
                  Array Element Type
                </Label>
                <Select
                  value={arrayType}
                  onValueChange={(val: FieldType) => setArrayType(val)}
                >
                  <SelectTrigger id="array-element-type" className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PRIMITIVE_TYPES.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setModalOpen(false)}
              className="touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveField}
              disabled={!name.trim()}
              className="touch-manipulation"
            >
              {editingField ? 'Save Changes' : 'Add Field'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Infer from JSON Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-1.5">
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
              Infer Schema from Sample JSON
            </DialogTitle>
            <DialogDescription className="text-xs">
              Paste a sample payload. Field names and data types will be extracted automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-2">
            <Textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{\n  "deviceId": "dev-001",\n  "temperature": 23.5,\n  "humidity": 60,\n  "status": "active"\n}'
              className="min-h-[180px] font-mono text-xs"
              aria-label="Sample JSON to infer fields"
              spellCheck={false}
            />
            {jsonError && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs">{jsonError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(false)}
              className="touch-manipulation"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleImportJson}
              disabled={!jsonInput.trim()}
              className="touch-manipulation"
            >
              Import Fields
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function countFields(nodes: StreamFieldNode[]): number {
  let count = 0;
  for (const n of nodes) {
    count++;
    if (n.children) {
      count += countFields(n.children);
    }
  }
  return count;
}

function renderFieldRows(
  nodes: StreamFieldNode[],
  depth: number,
  disabled: boolean,
  onAddChild: (id: string) => void,
  onEdit: (field: StreamFieldNode) => void,
  onRemove: (id: string) => void
): React.ReactNode {
  return nodes.map((field) => (
    <React.Fragment key={field.id}>
      <div className="grid grid-cols-12 gap-2 items-center px-3 py-2 hover:bg-muted/30 transition-colors">
        <div className="col-span-6 flex items-center gap-1.5 overflow-hidden">
          {depth > 0 && (
            <span
              style={{ marginLeft: `${(depth - 1) * 16}px` }}
              className="text-muted-foreground/50 inline-flex items-center"
            >
              <CornerDownRight className="size-3" aria-hidden="true" />
            </span>
          )}
          <span className="font-mono font-medium truncate" title={field.name}>{field.name}</span>
        </div>

        <div className="col-span-4 flex items-center gap-1.5">
          <Badge
            variant={field.type === 'struct' ? 'default' : 'secondary'}
            className="text-[10px] font-mono py-0 h-5"
          >
            {field.type === 'array'
              ? `array(${field.arrayType ?? 'string'})`
              : field.type}
          </Badge>
        </div>

        <div className="col-span-2 flex items-center justify-end gap-1">
          {field.type === 'struct' && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={() => onAddChild(field.id)}
              title="Add nested child field"
              aria-label="Add nested child field"
            >
              <Plus className="size-3" aria-hidden="true" />
            </Button>
          )}
          {!disabled && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-1.5 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(field)}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(field.id)}
                title="Delete field"
                aria-label={`Delete field ${field.name || ''}`}
              >
                <Trash2 className="size-3" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </div>

      {field.children && field.children.length > 0 && (
        renderFieldRows(field.children, depth + 1, disabled, onAddChild, onEdit, onRemove)
      )}
    </React.Fragment>
  ));
}

function inferFieldsFromJson(obj: Record<string, any>): StreamFieldNode[] {
  const result: StreamFieldNode[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const id = `inferred_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    if (typeof value === 'boolean') {
      result.push({ id, name: key, type: 'boolean' });
    } else if (typeof value === 'number') {
      result.push({
        id,
        name: key,
        type: Number.isInteger(value) ? 'bigint' : 'float',
      });
    } else if (Array.isArray(value)) {
      const first = value[0];
      let elemType: FieldType = 'string';
      if (typeof first === 'number') {
        elemType = Number.isInteger(first) ? 'bigint' : 'float';
      } else if (typeof first === 'boolean') {
        elemType = 'boolean';
      }
      result.push({ id, name: key, type: 'array', arrayType: elemType });
    } else if (typeof value === 'object' && value !== null) {
      result.push({
        id,
        name: key,
        type: 'struct',
        children: inferFieldsFromJson(value),
      });
    } else {
      result.push({ id, name: key, type: 'string' });
    }
  }
  return result;
}
