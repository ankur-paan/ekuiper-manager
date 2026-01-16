"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import { EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Server,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type ServiceProtocol = "grpc" | "rest" | "msgpack-rpc";

export default function NewServicePage() {
  const router = useRouter();
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [name, setName] = React.useState("");
  const [protocol, setProtocol] = React.useState<ServiceProtocol>("rest");
  const [address, setAddress] = React.useState("");
  const [schemaType, setSchemaType] = React.useState<"protobuf" | "json">("json");
  const [schemaFile, setSchemaFile] = React.useState("");
  const [interfaceJson, setInterfaceJson] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const handleCreate = async () => {
    if (!activeServer) return;

    if (!name) {
      toast.error("Service name is required");
      return;
    }

    if (!address) {
      toast.error("Service address is required");
      return;
    }

    setCreating(true);

    try {
      const body: Record<string, unknown> = {
        name,
        file: schemaFile || undefined,
      };

      // If interfaceJson is provided, parse and add it
      if (interfaceJson) {
        try {
          const interfaces = JSON.parse(interfaceJson);
          body.interfaces = interfaces;
        } catch {
          toast.error("Invalid JSON in interfaces field");
          setCreating(false);
          return;
        }
      } else {
        // Build default interface structure
        body.interfaces = {
          [name]: {
            address,
            protocol,
            schemaType,
          },
        };
      }

      const response = await fetch(`/api/ekuiper/services`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-EKuiper-URL": activeServer.url,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to register service: ${response.status}`);
      }

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
              Configure the external service connection settings
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
                <Label htmlFor="protocol">Protocol</Label>
                <Select value={protocol} onValueChange={(v) => setProtocol(v as ServiceProtocol)}>
                  <SelectTrigger id="protocol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rest">REST (HTTP)</SelectItem>
                    <SelectItem value="grpc">gRPC</SelectItem>
                    <SelectItem value="msgpack-rpc">msgpack-rpc</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Service Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={protocol === "rest" ? "http://localhost:8080/api" : "localhost:50051"}
                />
                <p className="text-sm text-muted-foreground">
                  {protocol === "rest" 
                    ? "HTTP endpoint URL" 
                    : protocol === "grpc" 
                    ? "gRPC server address (host:port)" 
                    : "msgpack-rpc server address"}
                </p>
              </div>

              {protocol === "grpc" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="schemaType">Schema Type</Label>
                    <Select value={schemaType} onValueChange={(v) => setSchemaType(v as "protobuf" | "json")}>
                      <SelectTrigger id="schemaType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="protobuf">Protobuf</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="schemaFile">Schema File Path (optional)</Label>
                    <Input
                      id="schemaFile"
                      value={schemaFile}
                      onChange={(e) => setSchemaFile(e.target.value)}
                      placeholder="/path/to/schema.proto"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Advanced: Raw Interface JSON */}
            <div className="space-y-2">
              <Label htmlFor="interfaces">
                Advanced: Interface Configuration (JSON)
              </Label>
              <Textarea
                id="interfaces"
                value={interfaceJson}
                onChange={(e) => setInterfaceJson(e.target.value)}
                placeholder={`{
  "interfaceName": {
    "address": "http://localhost:8080",
    "protocol": "rest",
    "functions": [
      {
        "name": "myFunction",
        "addr": "/api/call"
      }
    ]
  }
}`}
                rows={10}
                className="font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                Optional: Provide full interface configuration JSON to override simple form
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push("/services")}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
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
