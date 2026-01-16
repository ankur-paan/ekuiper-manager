"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Server,
  Plus,
  ChevronDown,
  Check,
  Trash2,
  RefreshCw,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ServerSelector() {
  const {
    servers,
    activeServerId,
    addServer,
    removeServer,
    setActiveServer,
  } = useServerStore();

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [newServerName, setNewServerName] = React.useState("");
  const [newServerUrl, setNewServerUrl] = React.useState("http://localhost:9081");

  const activeServer = servers.find((s) => s.id === activeServerId);

  const handleAddServer = () => {
    if (newServerName && newServerUrl) {
      addServer({
        name: newServerName,
        url: newServerUrl,
      });
      setNewServerName("");
      setNewServerUrl("http://localhost:9081");
      setIsAddDialogOpen(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-yellow-500";
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Server className="h-4 w-4" />
            <span className="max-w-[150px] truncate">
              {activeServer?.name || "No Server"}
            </span>
            {activeServer && (
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  getStatusColor(activeServer.status)
                )}
              />
            )}
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>eKuiper Servers</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {servers.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No servers configured
            </div>
          ) : (
            servers.map((server) => (
              <DropdownMenuItem
                key={server.id}
                className="flex items-center justify-between"
                onClick={() => setActiveServer(server.id)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      getStatusColor(server.status)
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{server.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {server.url}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {server.id === activeServerId && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeServer(server.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </DropdownMenuItem>
            ))
          )}
          <DropdownMenuSeparator />
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Plus className="mr-2 h-4 w-4" />
                Add Server
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add eKuiper Server</DialogTitle>
                <DialogDescription>
                  Add a new eKuiper server connection. The server must be running
                  and accessible.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="My eKuiper Server"
                    value={newServerName}
                    onChange={(e) => setNewServerName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    placeholder="http://localhost:9081"
                    value={newServerUrl}
                    onChange={(e) => setNewServerUrl(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddServer}>Add Server</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
