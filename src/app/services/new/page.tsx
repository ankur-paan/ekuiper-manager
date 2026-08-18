"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { ekuiperClient } from "@/lib/ekuiper/client";
import { AppLayout } from "@/components/layout";
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowLeft,
  Loader2,
  Server,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function NewServicePage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const handleCreate = async () => {
    if (!activeServer) return;

    if (!name) {
      toast.error("Service name is required");
      return;
    }

    if (!file) {
      toast.error("Service package URI is required");
      return;
    }

    setCreating(true);

    try {
      await ekuiperClient.createService({ name, file });

      toast.success(`Service "${name}" registered successfully`);
      router.push("/services");
    } catch (err) {
      toast.error(`Failed to register service: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setCreating(false);
    }
  };

  if (!activeServer) {
    return (
      <AppLayout title="Register Service">
        <EmptyState
          title="No Server Connected"
          description="Connect to an eKuiper server to register services."
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Register Service">
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/services")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Server className="h-5 w-5 text-blue-500" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Register External Service
              </h2>
              <p className="text-muted-foreground">
                Register a new external service for use in eKuiper rules
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Service Configuration</CardTitle>
            <CardDescription>
              eKuiper installs services from a zip package containing the service definition and interfaces.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Service Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="myService"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Service Package URI</Label>
                <Input
                  id="file"
                  value={file}
                  onChange={(e) => setFile(e.target.value)}
                  placeholder="https://example.com/my-service.zip"
                />
                <p className="text-sm text-muted-foreground">
                  HTTP(S) or file URI that the eKuiper node can read.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push("/services")}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !name.trim() || !file.trim()}>
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Register Service
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
