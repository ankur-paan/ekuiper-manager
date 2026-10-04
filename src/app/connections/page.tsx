'use client';

import * as React from 'react';
import {
  Network,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  ExternalLink,
  Search,
  AlertTriangle,
  Play,
  Layers,
  Sliders,
  Send,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout';
import { ConfirmDialog } from '@/components/common';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectionModal } from '@/components/connectors/connection-modal';
import { ConfKeyModal } from '@/components/connectors/conf-key-modal';
import { ConnectorIcon } from '@/components/connectors/connector-icon';
import { i18nLabel } from '@/components/connectors/property-form';
import { ekuiperClient } from '@/lib/ekuiper/client';
import type { MetadataItem } from '@/lib/ekuiper/types';
import { useServerStore } from '@/stores/server-store';

interface SharedConnection {
  id: string;
  typ: string;
  props: Record<string, unknown>;
  status?: string;
  err?: string;
  refCount?: number;
}

interface ConfKeyItem {
  id: string;
  name: string;
  type: string;
  category: 'sources' | 'sinks';
}

function formatAuthor(author: unknown): string | null {
  if (!author) return null;
  if (typeof author === 'string') return author;
  if (typeof author === 'object' && author !== null && 'name' in (author as Record<string, unknown>)) {
    return String((author as Record<string, unknown>).name || '');
  }
  return null;
}

function parseConfKeyResources(data: any): { sources: ConfKeyItem[]; sinks: ConfKeyItem[] } {
  const result: { sources: ConfKeyItem[]; sinks: ConfKeyItem[] } = {
    sources: [],
    sinks: [],
  };

  if (!data || typeof data !== 'object') return result;

  const processCategory = (categoryData: any, category: 'sources' | 'sinks') => {
    if (!categoryData) return;
    if (Array.isArray(categoryData)) {
      categoryData.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;
        if ('name' in item && 'type' in item) {
          result[category].push({
            id: `${category}-${item.type}-${item.name}-${index}`,
            name: String(item.name),
            type: String(item.type),
            category,
          });
        } else {
          // Format: { confKeyName: "connectorType" }
          Object.entries(item).forEach(([confKey, connType]) => {
            result[category].push({
              id: `${category}-${connType}-${confKey}-${index}`,
              name: confKey,
              type: String(connType),
              category,
            });
          });
        }
      });
    } else if (typeof categoryData === 'object') {
      // Format: { connectorType: ["conf1", "conf2"] }
      Object.entries(categoryData).forEach(([connType, keys]) => {
        if (Array.isArray(keys)) {
          keys.forEach((k, idx) => {
            result[category].push({
              id: `${category}-${connType}-${k}-${idx}`,
              name: String(k),
              type: connType,
              category,
            });
          });
        }
      });
    }
  };

  processCategory(data.sources, 'sources');
  processCategory(data.sinks, 'sinks');

  return result;
}

export default function ConnectionsPage() {
  const { servers, activeServerId } = useServerStore();
  const active = servers.find((node) => node.id === activeServerId);

  const [activeTab, setActiveTab] = React.useState('connections');
  const [loading, setLoading] = React.useState(false);

  // Shared Connections State
  const [connections, setConnections] = React.useState<SharedConnection[]>([]);
  const [connModalOpen, setConnModalOpen] = React.useState(false);
  const [editingConn, setEditingConn] = React.useState<SharedConnection | null>(null);
  const [deleteConn, setDeleteConn] = React.useState<SharedConnection | null>(null);
  const [testingConnId, setTestingConnId] = React.useState<string | null>(null);

  // ConfKeys State
  const [sourceConfKeys, setSourceConfKeys] = React.useState<ConfKeyItem[]>([]);
  const [sinkConfKeys, setSinkConfKeys] = React.useState<ConfKeyItem[]>([]);
  const [confKeySearch, setConfKeySearch] = React.useState('');
  const [confKeyTypeFilter, setConfKeyTypeFilter] = React.useState('all');

  const [confKeyModalOpen, setConfKeyModalOpen] = React.useState(false);
  const [confKeyModalCategory, setConfKeyModalCategory] = React.useState<'sources' | 'sinks'>('sources');
  const [confKeyModalType, setConfKeyModalType] = React.useState<string | undefined>(undefined);
  const [confKeyModalName, setConfKeyModalName] = React.useState<string | undefined>(undefined);
  const [confKeyModalIsEdit, setConfKeyModalIsEdit] = React.useState(false);
  const [deleteConfKey, setDeleteConfKey] = React.useState<ConfKeyItem | null>(null);

  // Catalog State
  const [sources, setSources] = React.useState<MetadataItem[]>([]);
  const [sinks, setSinks] = React.useState<MetadataItem[]>([]);
  const [catalogSearch, setCatalogSearch] = React.useState('');

  const loadData = React.useCallback(async () => {
    if (!active) return;
    setLoading(true);
    try {
      const [connData, sourceData, sinkData, resData] = await Promise.all([
        ekuiperClient.listConnections().catch(() => []),
        ekuiperClient.listSourceMetadata().catch(() => []),
        ekuiperClient.listSinkMetadata().catch(() => []),
        ekuiperClient.getConfigKeyResources().catch(() => null),
      ]);

      setConnections(Array.isArray(connData) ? connData : []);
      setSources(Array.isArray(sourceData) ? sourceData : []);
      setSinks(Array.isArray(sinkData) ? sinkData : []);

      const parsedConfKeys = parseConfKeyResources(resData);
      setSourceConfKeys(parsedConfKeys.sources);
      setSinkConfKeys(parsedConfKeys.sinks);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load connector resources');
    } finally {
      setLoading(false);
    }
  }, [active]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  // Shared Connection Actions
  const handleOpenCreateConn = () => {
    setEditingConn(null);
    setConnModalOpen(true);
  };

  const handleOpenEditConn = async (conn: SharedConnection) => {
    try {
      const detail = await ekuiperClient.getConnection(conn.id);
      setEditingConn({
        id: conn.id,
        typ: detail.typ || conn.typ,
        props: detail.props || conn.props || {},
      });
      setConnModalOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load connection details');
    }
  };

  const handleTestConnection = async (conn: SharedConnection) => {
    setTestingConnId(conn.id);
    try {
      const res = await ekuiperClient.testConnection('connections', conn.typ, conn.props || {});
      if (res.success) {
        toast.success(`Connection "${conn.id}" is reachable`);
      } else {
        toast.error(`Connection "${conn.id}" test failed: ${res.error || res.message || 'Unknown error'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Connection test request failed');
    } finally {
      setTestingConnId(null);
    }
  };

  const handleDeleteConn = async () => {
    if (!deleteConn) return;
    try {
      await ekuiperClient.deleteConnection(deleteConn.id);
      toast.success(`Shared connection "${deleteConn.id}" deleted`);
      setDeleteConn(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete connection');
    }
  };

  // ConfKey Actions
  const handleOpenAddConfKey = (category: 'sources' | 'sinks', connectorType?: string) => {
    setConfKeyModalCategory(category);
    setConfKeyModalType(connectorType);
    setConfKeyModalName(undefined);
    setConfKeyModalIsEdit(false);
    setConfKeyModalOpen(true);
  };

  const handleOpenEditConfKey = (item: ConfKeyItem) => {
    setConfKeyModalCategory(item.category);
    setConfKeyModalType(item.type);
    setConfKeyModalName(item.name);
    setConfKeyModalIsEdit(true);
    setConfKeyModalOpen(true);
  };

  const handleDeleteConfKey = async () => {
    if (!deleteConfKey) return;
    try {
      await ekuiperClient.deleteConfKey(deleteConfKey.category, deleteConfKey.type, deleteConfKey.name);
      toast.success(
        `${deleteConfKey.category === 'sources' ? 'Configuration key' : 'Sink template'} "${deleteConfKey.name}" deleted`
      );
      setDeleteConfKey(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete configuration');
    }
  };

  // Filtered lists
  const currentConfKeys = activeTab === 'conf-sinks' ? sinkConfKeys : sourceConfKeys;
  const filteredConfKeys = currentConfKeys.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(confKeySearch.toLowerCase()) ||
      item.type.toLowerCase().includes(confKeySearch.toLowerCase());
    const matchesType = confKeyTypeFilter === 'all' || item.type === confKeyTypeFilter;
    return matchesSearch && matchesType;
  });

  const availableConfKeyTypes = Array.from(new Set(currentConfKeys.map((c) => c.type))).sort();

  const filteredSources = sources.filter((s) => {
    const name = String(s.name ?? s.type ?? '');
    const desc = i18nLabel(s.about?.description ?? '');
    return (
      name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      desc.toLowerCase().includes(catalogSearch.toLowerCase())
    );
  });

  const filteredSinks = sinks.filter((s) => {
    const name = String(s.name ?? s.type ?? '');
    const desc = i18nLabel(s.about?.description ?? '');
    return (
      name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
      desc.toLowerCase().includes(catalogSearch.toLowerCase())
    );
  });

  return (
    <AppLayout title="Connections & Connectors">
      <div className="mx-auto max-w-7xl flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Connections & Connectors
              </h1>
              <Badge variant="outline" className="text-xs font-mono">
                {active?.name ?? 'eKuiper'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage shared connections, named configuration keys, sink delivery templates, and connector metadata.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {activeTab === 'connections' && (
              <Button size="sm" onClick={handleOpenCreateConn} className="gap-1.5">
                <Plus className="size-4" />
                New Shared Connection
              </Button>
            )}
            {activeTab === 'conf-sources' && (
              <Button size="sm" onClick={() => handleOpenAddConfKey('sources')} className="gap-1.5">
                <Plus className="size-4" />
                New Source ConfKey
              </Button>
            )}
            {activeTab === 'conf-sinks' && (
              <Button size="sm" onClick={() => handleOpenAddConfKey('sinks')} className="gap-1.5">
                <Plus className="size-4" />
                New Sink Template
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="connections" className="gap-2">
              <Network className="size-4" />
              Shared Connections ({connections.length})
            </TabsTrigger>
            <TabsTrigger value="conf-sources" className="gap-2">
              <Sliders className="size-4" />
              Source ConfKeys ({sourceConfKeys.length})
            </TabsTrigger>
            <TabsTrigger value="conf-sinks" className="gap-2">
              <Send className="size-4" />
              Sink Templates ({sinkConfKeys.length})
            </TabsTrigger>
            <TabsTrigger value="catalog-sources" className="gap-2">
              <Download className="size-4" />
              Source Connectors ({sources.length})
            </TabsTrigger>
            <TabsTrigger value="catalog-sinks" className="gap-2">
              <Layers className="size-4" />
              Sink Connectors ({sinks.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Shared Connections */}
          <TabsContent value="connections" className="mt-6 flex flex-col gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-medium">Configured Shared Connections</CardTitle>
                    <CardDescription className="text-xs">
                      Shared connection instances allow multiple streams, tables, or rules to pool client connections.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {connections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <Network className="size-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium text-foreground">No shared connections defined</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Shared connections decouple authentication and network transport configuration from individual streams and sinks.
                    </p>
                    <Button size="sm" onClick={handleOpenCreateConn} className="mt-4 gap-1.5">
                      <Plus className="size-3.5" />
                      Create First Connection
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y border-t text-sm">
                    {connections.map((conn) => (
                      <div
                        key={conn.id}
                        className="flex flex-col gap-3 p-4 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="mt-0.5 rounded-md border bg-muted/50 p-2">
                            <ConnectorIcon
                              type={conn.typ}
                              className="size-4"
                              fallback={<Network className="size-4 text-foreground" />}
                            />
                          </div>
                          <div className="min-w-0 flex flex-col gap-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-sm font-medium text-foreground">
                                {conn.id}
                              </span>
                              <Badge variant="outline" className="font-mono text-[11px] uppercase gap-1">
                                <ConnectorIcon type={conn.typ} className="size-3" />
                                {conn.typ}
                              </Badge>
                              {conn.status && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span
                                    className={`size-2 rounded-full ${
                                      conn.status === 'connected'
                                        ? 'bg-emerald-500'
                                        : conn.status === 'failed'
                                        ? 'bg-rose-500'
                                        : 'bg-amber-500'
                                    }`}
                                  />
                                  {conn.status}
                                </span>
                              )}
                              {conn.refCount !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                  Ref count: {conn.refCount}
                                </span>
                              )}
                            </div>
                            {conn.err && (
                              <p className="flex items-center gap-1.5 text-xs text-destructive">
                                <AlertTriangle className="size-3.5 shrink-0" />
                                {conn.err}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => void handleTestConnection(conn)}
                            disabled={testingConnId === conn.id}
                          >
                            <Play className={`size-3.5 ${testingConnId === conn.id ? 'animate-spin' : ''}`} />
                            Test
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => void handleOpenEditConn(conn)}
                          >
                            <Edit2 className="size-3.5" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setDeleteConn(conn)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2 & 3: ConfKeys (Sources & Sinks) */}
          {(activeTab === 'conf-sources' || activeTab === 'conf-sinks') && (
            <TabsContent value={activeTab} className="mt-6 flex flex-col gap-4">
              {/* Search & Filter Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-2 max-w-md">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      placeholder={`Search ${activeTab === 'conf-sources' ? 'source configuration' : 'sink template'} name or connector...`}
                      value={confKeySearch}
                      onChange={(e) => setConfKeySearch(e.target.value)}
                      className="pl-9 text-sm"
                    />
                  </div>
                  {availableConfKeyTypes.length > 0 && (
                    <select
                      value={confKeyTypeFilter}
                      onChange={(e) => setConfKeyTypeFilter(e.target.value)}
                      aria-label="Filter by connector type"
                      className="h-9 rounded-md border border-input bg-background px-3 text-xs shadow-beautiful-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="all">All Connectors</option>
                      {availableConfKeyTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-medium">
                    {activeTab === 'conf-sources' ? 'Source Configuration Keys' : 'Sink Delivery Templates'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {activeTab === 'conf-sources'
                      ? 'Named configuration profiles defining connection parameters, endpoints, credentials, and polling rates for streams and tables.'
                      : 'Reusable delivery templates specifying serialization formats, schema validation, batching buffers, and cache fallbacks for rule actions.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {filteredConfKeys.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center">
                      <Sliders className="size-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm font-medium text-foreground">
                        {confKeySearch || confKeyTypeFilter !== 'all'
                          ? 'No configurations match the filter'
                          : `No ${activeTab === 'conf-sources' ? 'source configuration keys' : 'sink templates'} found`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                        {activeTab === 'conf-sources'
                          ? 'Add a named source confKey to reuse broker endpoints and authentication across multiple streams.'
                          : 'Add a sink template to predefine target destinations, data templates, and delivery cache parameters.'}
                      </p>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleOpenAddConfKey(activeTab === 'conf-sources' ? 'sources' : 'sinks')
                        }
                        className="mt-4 gap-1.5"
                      >
                        <Plus className="size-3.5" />
                        Create Configuration
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y border-t text-sm">
                      {filteredConfKeys.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-3 p-4 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="rounded-md border bg-muted/50 p-2">
                              <ConnectorIcon
                                type={item.type}
                                className="size-4"
                                fallback={
                                  item.category === 'sources' ? (
                                    <Sliders className="size-4 text-foreground" />
                                  ) : (
                                    <Send className="size-4 text-foreground" />
                                  )
                                }
                              />
                            </div>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-medium text-foreground">
                                  {item.name}
                                </span>
                                <Badge variant="secondary" className="font-mono text-[11px] uppercase">
                                  {item.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Connector: <span className="font-medium text-foreground">{item.type}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() => handleOpenEditConfKey(item)}
                            >
                              <Edit2 className="size-3.5" />
                              Configure
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDeleteConfKey(item)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* TAB 4: Source Connectors Catalog */}
          <TabsContent value="catalog-sources" className="mt-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search source connectors..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSources.map((source, index) => {
                const name = String(source.name ?? source.type ?? `Source ${index + 1}`);
                const desc = i18nLabel(source.about?.description ?? '');
                const helpUrl = i18nLabel(source.about?.helpUrl ?? '');
                const isInstalled = source.about?.installed !== false;

                return (
                  <Card key={`source-${name}-${index}`} className="flex flex-col justify-between">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base font-mono font-medium flex items-center gap-2">
                            <ConnectorIcon type={name} className="size-4" />
                            {name}
                          </CardTitle>
                          {formatAuthor(source.about?.author) && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              by {formatAuthor(source.about?.author)}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={isInstalled ? 'outline' : 'secondary'}
                          className="text-[10px] uppercase font-mono"
                        >
                          {isInstalled ? 'Installed' : 'Plugin'}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs line-clamp-3 mt-2">
                        {desc || 'Native eKuiper streaming source connector.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 flex items-center justify-between border-t py-3 text-xs">
                      {helpUrl ? (
                        <a
                          href={helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="size-3.5" />
                          Docs
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Internal</span>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleOpenAddConfKey('sources', name)}
                      >
                        <Plus className="size-3" />
                        Configure
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredSources.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  No source connectors found matching &ldquo;{catalogSearch}&rdquo;
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 5: Sink Connectors Catalog */}
          <TabsContent value="catalog-sinks" className="mt-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search sink connectors..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSinks.map((sink, index) => {
                const name = String(sink.name ?? sink.type ?? `Sink ${index + 1}`);
                const desc = i18nLabel(sink.about?.description ?? '');
                const helpUrl = i18nLabel(sink.about?.helpUrl ?? '');
                const isInstalled = sink.about?.installed !== false;

                return (
                  <Card key={`sink-${name}-${index}`} className="flex flex-col justify-between">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-base font-mono font-medium flex items-center gap-2">
                            <ConnectorIcon type={name} className="size-4" />
                            {name}
                          </CardTitle>
                          {formatAuthor(sink.about?.author) && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              by {formatAuthor(sink.about?.author)}
                            </p>
                          )}
                        </div>
                        <Badge
                          variant={isInstalled ? 'outline' : 'secondary'}
                          className="text-[10px] uppercase font-mono"
                        >
                          {isInstalled ? 'Installed' : 'Plugin'}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs line-clamp-3 mt-2">
                        {desc || 'Native eKuiper action sink connector.'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0 flex items-center justify-between border-t py-3 text-xs">
                      {helpUrl ? (
                        <a
                          href={helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink className="size-3.5" />
                          Docs
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Internal</span>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleOpenAddConfKey('sinks', name)}
                      >
                        <Plus className="size-3" />
                        Template
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {filteredSinks.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                  No sink connectors found matching &ldquo;{catalogSearch}&rdquo;
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Shared Connection Modal */}
      <ConnectionModal
        open={connModalOpen}
        onOpenChange={setConnModalOpen}
        editingConnection={editingConn}
        onSaved={() => void loadData()}
      />

      {/* ConfKey Modal for Sources & Sinks */}
      <ConfKeyModal
        open={confKeyModalOpen}
        onOpenChange={setConfKeyModalOpen}
        category={confKeyModalCategory}
        initialType={confKeyModalType}
        initialName={confKeyModalName}
        isEdit={confKeyModalIsEdit}
        onSaved={() => void loadData()}
      />

      {/* Delete Shared Connection Dialog */}
      <ConfirmDialog
        open={Boolean(deleteConn)}
        onOpenChange={(open) => !open && setDeleteConn(null)}
        title="Delete shared connection?"
        description={`Delete shared connection "${deleteConn?.id}" from eKuiper? Streams, tables, and rules referencing this connection may fail.`}
        confirmLabel="Delete Connection"
        variant="danger"
        onConfirm={handleDeleteConn}
      />

      {/* Delete ConfKey Dialog */}
      <ConfirmDialog
        open={Boolean(deleteConfKey)}
        onOpenChange={(open) => !open && setDeleteConfKey(null)}
        title={`Delete ${deleteConfKey?.category === 'sources' ? 'configuration key' : 'sink template'}?`}
        description={`Delete "${deleteConfKey?.name}" (${deleteConfKey?.type}) from eKuiper metadata? Active resources relying on this configuration key will stop working.`}
        confirmLabel="Delete Configuration"
        variant="danger"
        onConfirm={handleDeleteConfKey}
      />
    </AppLayout>
  );
}
