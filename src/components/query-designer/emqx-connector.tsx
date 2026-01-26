"use client";

import * as React from "react";
import { useEmqxStore } from "@/stores/emqx-store";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, Loader2, PowerOff, Database, Radio, Globe } from "lucide-react";
import { toast } from "sonner";

export function EmqxConnector() {
    const { connection, isConnecting, login, disconnect, configure } = useEmqxStore();
    const [isOpen, setIsOpen] = React.useState(false);
    const [password, setPassword] = React.useState("");

    // Derived overall status (simplified)
    const isFullyConnected = connection.isAuthenticated && connection.wsConnected;
    const triggerColor = isFullyConnected ? "bg-green-500" : (connection.isAuthenticated ? "bg-amber-500" : "bg-red-500");

    const handleConnect = async () => {
        if (!password) {
            toast.error("Password is required");
            return;
        }
        const success = await login(password);
        if (success) {
            // setIsOpen(false); // Keep open to show status
            setPassword("");
        }
    };

    const StatusRow = ({ label, connected, icon: Icon, detail }: { label: string, connected: boolean, icon: any, detail?: string }) => (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="flex flex-col">
                    <span className="font-medium text-sm">{label}</span>
                    {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
                </div>
            </div>
            <Badge variant={connected ? "default" : "destructive"} className={connected ? "bg-green-600 hover:bg-green-700" : ""}>
                {connected ? "Connected" : "Disconnected"}
            </Badge>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9 px-3">
                    <div className="flex gap-1">
                        <div title="API" className={`h-2 w-2 rounded-full ${connection.isAuthenticated ? "bg-green-500" : "bg-red-500"}`} />
                        <div title="WS" className={`h-2 w-2 rounded-full ${connection.wsConnected ? "bg-green-500" : "bg-zinc-300"}`} />
                        <div title="DB" className={`h-2 w-2 rounded-full ${connection.supabaseConnected ? "bg-green-500" : "bg-zinc-300"}`} />
                    </div>
                    <span className="hidden sm:inline">Connections</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>System Connections</DialogTitle>
                    <DialogDescription>
                        Status of external services required for full functionality.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-2">
                    {/* 1. EMQX Management API */}
                    <StatusRow
                        label="EMQX Management API"
                        connected={connection.isAuthenticated}
                        icon={Globe}
                        detail={connection.isAuthenticated ? connection.url : "Required for Topic Discovery"}
                    />

                    {/* 2. EMQX WebSocket */}
                    <StatusRow
                        label="MQTT WebSocket"
                        connected={connection.wsConnected}
                        icon={Radio}
                        detail={connection.wsConnected ? "Receiving Live Data" : "Connects automatically when previewing data"}
                    />

                    {/* 3. Supabase */}
                    <StatusRow
                        label="Supabase Database"
                        connected={connection.supabaseConnected}
                        icon={Database}
                        detail={connection.supabaseConnected ? "Ready" : "Required for Query History"}
                    />
                </div>

                <div className="border-t pt-4 mt-2">
                    <h4 className="text-sm font-semibold mb-3">Connection Settings</h4>
                    {connection.isAuthenticated ? (
                        <Button variant="destructive" onClick={disconnect} className="w-full">
                            <PowerOff className="mr-2 h-4 w-4" /> Disconnect EMQX API
                        </Button>
                    ) : (
                        <div className="grid gap-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">API Username</Label>
                                    <Input
                                        value={connection.username}
                                        onChange={e => configure({ username: e.target.value })}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">API Password</Label>
                                    <Input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="h-8 text-xs font-mono"
                                        placeholder="Enter password..."
                                    />
                                </div>
                            </div>
                            <Button onClick={handleConnect} disabled={isConnecting} size="sm">
                                {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Connect Management API
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
