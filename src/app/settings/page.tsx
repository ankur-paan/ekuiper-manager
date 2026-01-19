"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { LoadingSpinner, EmptyState, ConfirmDialog } from "@/components/common";
import { Power, Save, Settings as SettingsIcon, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface Configs {
    debug: boolean;
    consoleLog: boolean;
    fileLog: boolean;
    rotateTime: number;
    maxAge: number;
    timezone: string;
}

export default function SettingsPage() {
    const { servers, activeServerId, storageMode, setStorageMode } = useServerStore();
    const activeServer = servers.find((s) => s.id === activeServerId);

    const [configs, setConfigs] = React.useState<Configs>({
        debug: false,
        consoleLog: true,
        fileLog: true,
        rotateTime: 1,
        maxAge: 72,
        timezone: "UTC",
    });
    const [loading, setLoading] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [shutdownOpen, setShutdownOpen] = React.useState(false);

    const fetchConfigs = React.useCallback(async () => {
        if (!activeServer) return;
        setLoading(true);
        ekuiperClient.setBaseUrl(activeServer.url);
        try {
            // Emulated fetch or placeholder
        } finally {
            setLoading(false);
        }
    }, [activeServer]);

    React.useEffect(() => {
        if (activeServer) {
            fetchConfigs();
        }
    }, [fetchConfigs, activeServer]);

    const handleSave = async () => {
        if (!activeServer) return;
        setSaving(true);
        ekuiperClient.setBaseUrl(activeServer.url);
        try {
            await ekuiperClient.reloadConfigs(configs);
            toast.success("Configuration updated successfully");
        } catch (err) {
            toast.error("Failed to update options");
        } finally {
            setSaving(false);
        }
    };

    const handleShutdown = async () => {
        if (!activeServer) return;
        try {
            ekuiperClient.setBaseUrl(activeServer.url);
            await ekuiperClient.shutdown();
            toast.success("Server shutting down...");
            setShutdownOpen(false);
        } catch (err) {
            toast.error("Failed to stop server");
        }
    };

    return (
        <AppLayout title="Settings">
            <div className="space-y-6 max-w-4xl mx-auto">
                <div className="flex items-center gap-4">
                    <SettingsIcon className="h-8 w-8 text-muted-foreground" />
                    <div>
                        <h1 className="text-2xl font-bold">Configuration</h1>
                        <p className="text-muted-foreground">Manage storage and server settings</p>
                    </div>
                </div>

                {/* Storage Mode - Always Visible */}
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="h-5 w-5" />
                            Persistence Mode
                        </CardTitle>
                        <CardDescription>
                            Choose where to store your connection configurations.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label>Storage Backend</Label>
                                <p className="text-sm text-muted-foreground">
                                    {storageMode === 'database'
                                        ? "Using local SQLite database (server-side). Configs are shared."
                                        : "Using Browser LocalStorage (client-side only). Configs are private to this browser."}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={cn("text-xs uppercase font-mono cursor-pointer", storageMode === 'browser' ? "text-primary font-bold" : "text-muted-foreground")} onClick={() => setStorageMode('browser')}>Browser</span>
                                <Switch
                                    checked={storageMode === 'database'}
                                    onCheckedChange={(checked) => setStorageMode(checked ? 'database' : 'browser')}
                                />
                                <span className={cn("text-xs uppercase font-mono cursor-pointer", storageMode === 'database' ? "text-primary font-bold" : "text-muted-foreground")} onClick={() => setStorageMode('database')}>Database</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {activeServer ? (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>Logging & Debugging</CardTitle>
                                <CardDescription>Control server verbosity and output ({activeServer.name})</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Debug Mode</Label>
                                        <p className="text-sm text-muted-foreground">Enable verbose debug logging</p>
                                    </div>
                                    <Switch checked={configs.debug} onCheckedChange={c => setConfigs({ ...configs, debug: c })} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Console Logging</Label>
                                        <p className="text-sm text-muted-foreground">Output logs to stdout</p>
                                    </div>
                                    <Switch checked={configs.consoleLog} onCheckedChange={c => setConfigs({ ...configs, consoleLog: c })} />
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>File Logging</Label>
                                        <p className="text-sm text-muted-foreground">Write logs to file system</p>
                                    </div>
                                    <Switch checked={configs.fileLog} onCheckedChange={c => setConfigs({ ...configs, fileLog: c })} />
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>System Settings</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-2">
                                    <Label>Timezone</Label>
                                    <Input value={configs.timezone} onChange={e => setConfigs({ ...configs, timezone: e.target.value })} />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving && <LoadingSpinner size="sm" className="mr-2" />}
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </Button>
                            </CardFooter>
                        </Card>

                        <Card className="border-destructive/20 bg-destructive/5">
                            <CardHeader>
                                <CardTitle className="text-destructive">Danger Zone</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label>Shutdown Server</Label>
                                        <p className="text-sm text-muted-foreground">Stop the eKuiper instance immediately</p>
                                    </div>
                                    <Button variant="destructive" onClick={() => setShutdownOpen(true)}>
                                        <Power className="mr-2 h-4 w-4" />
                                        Shutdown
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <ConfirmDialog
                            open={shutdownOpen}
                            onOpenChange={setShutdownOpen}
                            title="Shutdown Server?"
                            description="Are you sure you want to stop the eKuiper server? This will stop all running rules."
                            onConfirm={handleShutdown}
                            confirmLabel="Shutdown"
                            variant="danger"
                        />
                    </>
                ) : (
                    <EmptyState title="No Active Server" description="Connect to a server in the sidebar to configure node settings, or manage persistence above." />
                )}
            </div>
        </AppLayout>
    );
}
