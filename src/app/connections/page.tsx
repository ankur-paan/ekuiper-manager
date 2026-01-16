"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { DataTable } from "@/components/common/data-table";
import { EmptyState, ErrorState, ConfirmDialog } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Plus,
  MoreHorizontal,
  Trash2,
  Edit,
  ArrowRight,
  BookTemplate,
  Loader2,
  Activity,
  CheckCircle2,
  XCircle,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { CodeEditor } from "@/components/ui/code-editor";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// --- Types ---
interface ConfKeyItem {
  name: string;
}

interface ConnectionItem {
  id: string;
  typ: string;
  status?: string; // e.g. "running", "disconnected" (from status API)
}

// --- Templates (Phase 8) ---
const CONF_TEMPLATES: Record<string, any> = {
  "MQTT Source": {
    "server": "tcp://localhost:1883",
    "protocolVersion": "3.1.1",
  },
  "MQTT Sink": {
    "server": "tcp://localhost:1883",
    "topic": "result",
    "qos": 1
  },
  // ... other templates
};

export default function ConnectionsPage() {
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  // Main Tabs: "instances" (Phase 9) vs "keys" (Phase 8)
  const [viewTab, setViewTab] = React.useState("instances");

  // --- Phase 9 State (Instances) ---
  const [connections, setConnections] = React.useState<ConnectionItem[]>([]);
  const [loadingConns, setLoadingConns] = React.useState(false);
  const [connDialogOpen, setConnDialogOpen] = React.useState(false);
  const [editingConnId, setEditingConnId] = React.useState<string | null>(null);
  const [connForm, setConnForm] = React.useState({ id: "", typ: "mqtt", props: "{}" });
  const [connSaving, setConnSaving] = React.useState(false);
  const [deleteConnId, setDeleteConnId] = React.useState<string | null>(null);

  // --- Phase 8 State (Conf Keys) ---
  const [activeResTab, setActiveResTab] = React.useState<"sources" | "sinks" | "connections">("sources");
  const [types, setTypes] = React.useState<string[]>([]);
  const [selectedType, setSelectedType] = React.useState<string | null>(null);
  const [keys, setKeys] = React.useState<ConfKeyItem[]>([]);
  const [loadingTypes, setLoadingTypes] = React.useState(false);
  const [loadingKeys, setLoadingKeys] = React.useState(false);

  const [keyDialogOpen, setKeyDialogOpen] = React.useState(false);
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [keyName, setKeyName] = React.useState("");
  const [keyContent, setKeyContent] = React.useState("{}");
  const [keySaving, setKeySaving] = React.useState(false);
  const [deleteKey, setDeleteKey] = React.useState<string | null>(null);


  const activeServerUrl = activeServer?.url;

  const fetchConnections = React.useCallback(async () => {
    if (!activeServerUrl) return;
    setLoadingConns(true);
    ekuiperClient.setBaseUrl(activeServerUrl);
    try {
      const list = await ekuiperClient.listConnections();
      setConnections(Array.isArray(list) ? list : []);
    } catch (err) {
      toast.error("Failed to fetch connections. Check network/server log.");
      setConnections([]);
    } finally {
      setLoadingConns(false);
    }
  }, [activeServerUrl]);

  React.useEffect(() => {
    if (viewTab === "instances") fetchConnections();
  }, [fetchConnections, viewTab]);

  const handleSaveConn = async () => {
    if (!activeServer) return;
    if (!connForm.id) { toast.error("ID is required"); return; }

    let propsParsed;
    try { propsParsed = JSON.parse(connForm.props); } catch { toast.error("Invalid JSON props"); return; }

    setConnSaving(true);
    const payload = { id: connForm.id, typ: connForm.typ, props: propsParsed };
    try {
      if (editingConnId) {
        await ekuiperClient.updateConnection(connForm.id, payload);
        toast.success("Connection updated");
      } else {
        await ekuiperClient.createConnection(payload);
        toast.success("Connection created");
      }
      setConnDialogOpen(false);
      fetchConnections();
    } catch (err) {
      toast.error(`Operation failed: ${err instanceof Error ? err.message : "Error"}`);
    } finally {
      setConnSaving(false);
    }
  };

  const handleDeleteConn = async () => {
    if (!deleteConnId) return;
    try {
      await ekuiperClient.deleteConnection(deleteConnId);
      toast.success("Connection deleted");
      setDeleteConnId(null);
      fetchConnections();
    } catch (err) {
      toast.error("Failed to delete connection");
    }
  };

  const openConnDialog = (conn?: ConnectionItem) => {
    if (conn) {
      setEditingConnId(conn.id);
      setConnForm({
        id: conn.id,
        typ: conn.typ,
        // We need to fetch details or use list item if it contains props
        // Usually list includes props.
        props: JSON.stringify((conn as any).props || {}, null, 2)
      });
    } else {
      setEditingConnId(null);
      setConnForm({ id: "", typ: "mqtt", props: "{}" });
    }
    setConnDialogOpen(true);
  };

  // --- Methods: Phase 8 Keys ---
  // (Copied largely from previous file)

  const fetchTypes = React.useCallback(async () => {
    if (!activeServerUrl) return;
    setLoadingTypes(true);
    setTypes([]);
    setSelectedType(null);
    setKeys([]);
    ekuiperClient.setBaseUrl(activeServerUrl);

    try {
      const meta = await ekuiperClient.listMetadata(activeResTab);
      let typeList: string[] = [];
      if (Array.isArray(meta)) {
        typeList = meta.map((m: any) => m.name || m);
      } else if (typeof meta === 'object') {
        typeList = Object.keys(meta);
      }
      setTypes(typeList);
      if (typeList.length > 0) setSelectedType(typeList[0]);
    } catch (err) {
      toast.error(`Failed to fetch types: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoadingTypes(false);
    }
  }, [activeServerUrl, activeResTab]);

  React.useEffect(() => {
    if (viewTab === "keys") fetchTypes();
  }, [viewTab, activeServerUrl, activeResTab, fetchTypes]);

  const fetchKeys = React.useCallback(async () => {
    if (!activeServerId || !activeServerUrl || !selectedType) return;
    setLoadingKeys(true);
    ekuiperClient.setBaseUrl(activeServerUrl);
    try {
      const list = await ekuiperClient.listConfKeys(activeResTab, selectedType);
      const items = Array.isArray(list) ? list.map(name => ({ name })) : [];
      setKeys(items);
    } catch (err) {
      setKeys([]);
    } finally {
      setLoadingKeys(false);
    }
  }, [activeServerId, activeServerUrl, activeResTab, selectedType]);

  React.useEffect(() => {
    if (viewTab === "keys") fetchKeys();
  }, [viewTab, activeServerId, activeServerUrl, activeResTab, selectedType, fetchKeys]);

  const handleSaveKey = async () => {
    if (!selectedType) return;
    let parsed;
    try { parsed = JSON.parse(keyContent); } catch { toast.error("Invalid JSON"); return; }

    setKeySaving(true);
    try {
      await ekuiperClient.upsertConfKey(activeResTab, selectedType, keyName, parsed);
      toast.success("Saved");
      setKeyDialogOpen(false);
      fetchKeys();
    } catch (err) {
      toast.error("Failed to save config");
    } finally {
      setKeySaving(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!deleteKey || !selectedType) return;
    try {
      await ekuiperClient.deleteConfKey(activeResTab, selectedType, deleteKey);
      toast.success("Deleted");
      setDeleteKey(null);
      fetchKeys();
    } catch (err) {
      toast.error("Delete failed");
    }
  };


  // --- Columns ---
  const connColumns: ColumnDef<ConnectionItem>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => <span className="font-medium">{row.getValue("id")}</span>
    },
    {
      accessorKey: "typ",
      header: "Type",
      cell: ({ row }) => <Badge variant="secondary">{row.getValue("typ")}</Badge>
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => openConnDialog(row.original)}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteConnId(row.original.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )
    }
  ];

  const keyColumns: ColumnDef<ConfKeyItem>[] = [
    {
      accessorKey: "name",
      header: "Key",
      cell: ({ row }) => <Badge variant="outline">{row.getValue("name")}</Badge>
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="icon" onClick={() => {
            setEditingKey(row.original.name);
            setKeyName(row.original.name);
            ekuiperClient.getConfKey(activeResTab, selectedType!, row.original.name).then(d => setKeyContent(JSON.stringify(d.content, null, 2))).catch(() => setKeyContent("{}"));
            setKeyDialogOpen(true);
          }}><Edit className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteKey(row.original.name)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )
    }
  ];

  if (!activeServer) {
    return <AppLayout title="Connections"><EmptyState title="No Server" description="Connect to server." /></AppLayout>;
  }

  return (
    <AppLayout title="Connections">
      <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Connections</h2>
            <p className="text-muted-foreground">Manage IO connections and configurations</p>
          </div>
        </div>

        <Tabs value={viewTab} onValueChange={setViewTab} className="flex-1 flex flex-col min-h-0">
          <TabsList>
            <TabsTrigger value="instances" className="gap-2"><Wifi className="h-4 w-4" /> Active Connections</TabsTrigger>
            <TabsTrigger value="keys" className="gap-2"><BookTemplate className="h-4 w-4" /> Configuration Templates</TabsTrigger>
          </TabsList>

          {/* Tab: Connections Instances (Phase 9) */}
          <TabsContent value="instances" className="flex-1 min-h-0 flex flex-col pt-4">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openConnDialog()}>
                <Plus className="mr-2 h-4 w-4" /> Create Connection
              </Button>
            </div>
            <div className="flex-1 border rounded-lg bg-card">
              <DataTable
                columns={connColumns}
                data={connections}
                loading={loadingConns}
                searchKey="id"
                emptyMessage="No connections found"
              />
            </div>
          </TabsContent>

          {/* Tab: Configuration Keys (Phase 8) */}
          <TabsContent value="keys" className="flex-1 min-h-0 flex flex-col pt-4 h-full">
            <Tabs value={activeResTab} onValueChange={(v) => setActiveResTab(v as any)} className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-fit">
                <TabsTrigger value="sources">Sources</TabsTrigger>
                <TabsTrigger value="sinks">Sinks</TabsTrigger>
                <TabsTrigger value="connections">Connections</TabsTrigger>
              </TabsList>
              <div className="flex-1 flex gap-6 mt-4 min-h-0">
                {/* Left: Types */}
                <div className="w-64 flex flex-col border rounded-lg bg-card">
                  <div className="p-3 border-b bg-muted/50 text-sm font-medium">Types</div>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {types.map(t => (
                        <button
                          key={t}
                          onClick={() => setSelectedType(t)}
                          className={cn("w-full text-left px-3 py-2 rounded-md text-sm", selectedType === t ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                {/* Right: Keys */}
                <div className="flex-1 flex flex-col min-h-0 bg-card border rounded-lg p-4">
                  {selectedType ? (
                    <>
                      <div className="flex justify-between mb-4">
                        <h3 className="font-semibold">{selectedType} Configs</h3>
                        <Button size="sm" onClick={() => {
                          setEditingKey(null); setKeyName(""); setKeyContent("{}"); setKeyDialogOpen(true);
                        }}><Plus className="mr-2 h-4 w-4" /> Add Config</Button>
                      </div>
                      <div className="flex-1 overflow-auto">
                        <DataTable columns={keyColumns} data={keys} loading={loadingKeys} searchKey="name" emptyMessage="No keys found" />
                      </div>
                    </>
                  ) : <div className="flex items-center justify-center h-full text-muted-foreground">Select a type</div>}
                </div>
              </div>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* Connection Dialog */}
      <Dialog open={connDialogOpen} onOpenChange={setConnDialogOpen}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>{editingConnId ? "Edit Connection" : "New Connection"}</DialogTitle></DialogHeader>
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Connection ID</Label>
                <Input value={connForm.id} onChange={e => setConnForm({ ...connForm, id: e.target.value })} disabled={!!editingConnId} placeholder="my-mqtt-conn" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={connForm.typ} onValueChange={v => setConnForm({ ...connForm, typ: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mqtt">MQTT</SelectItem>
                    <SelectItem value="sql">SQL</SelectItem>
                    <SelectItem value="redis">Redis</SelectItem>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="influx">InfluxDB</SelectItem>
                    <SelectItem value="edgex">EdgeX</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <Label>Properties (JSON)</Label>
              <div className="flex-1 border rounded-md overflow-hidden">
                <CodeEditor value={connForm.props} onChange={v => setConnForm({ ...connForm, props: v })} language="json" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConn} disabled={connSaving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Key Dialog */}
      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
          <DialogHeader><DialogTitle>{editingKey ? "Edit Template" : "New Template"}</DialogTitle></DialogHeader>
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="space-y-2">
              <Label>Key Name</Label>
              <Input value={keyName} onChange={e => setKeyName(e.target.value)} disabled={!!editingKey} />
            </div>
            <div className="space-y-2 flex-1 flex flex-col min-h-0">
              <div className="flex justify-between"><Label>Content (JSON)</Label> <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm">Templates</Button></DropdownMenuTrigger><DropdownMenuContent>{Object.keys(CONF_TEMPLATES).map(t => <DropdownMenuItem key={t} onClick={() => setKeyContent(JSON.stringify(CONF_TEMPLATES[t], null, 2))}>{t}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div>
              <div className="flex-1 border rounded-md overflow-hidden">
                <CodeEditor value={keyContent} onChange={setKeyContent} language="json" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveKey} disabled={keySaving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteConnId} onOpenChange={o => !o && setDeleteConnId(null)} title="Delete Connection" description="Are you sure?" onConfirm={handleDeleteConn} variant="danger" />
      <ConfirmDialog open={!!deleteKey} onOpenChange={o => !o && setDeleteKey(null)} title="Delete Template" description="Are you sure?" onConfirm={handleDeleteKey} variant="danger" />

    </AppLayout>
  );
}
