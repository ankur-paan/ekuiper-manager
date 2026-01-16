"use client";

import * as React from "react";
import { useServerStore } from "@/stores/server-store";
import { AppLayout } from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, ErrorState, LoadingPage } from "@/components/common";
import {
  ArrowLeft,
  Server,
  Zap,
  Globe,
  Mail,
  Building,
  HelpCircle,
  Code,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { EKuiperClient } from "@/lib/ekuiper/client";
import { Service } from "@/lib/ekuiper/types";

interface ServiceDetailPageProps {
  params: {
    name: string;
  };
}

export default function ServiceDetailPage() {
  const router = useRouter();
  const params = useParams() as { name: string };
  const name = decodeURIComponent(params.name);
  const { servers, activeServerId } = useServerStore();
  const activeServer = servers.find((s) => s.id === activeServerId);

  const [service, setService] = React.useState<Service | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchService = React.useCallback(async () => {
    if (!activeServer) return;

    setLoading(true);
    setError(null);

    try {
      const client = new EKuiperClient(activeServer.url);
      const data = await client.getService(name);
      setService(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch service details");
    } finally {
      setLoading(false);
    }
  }, [activeServer, name]);

  React.useEffect(() => {
    fetchService();
  }, [fetchService]);

  if (!activeServer) {
    return (
      <AppLayout title={`Service: ${name}`}>
        <ErrorState
          title="No Server Connected"
          description="Please connect to an eKuiper server to view service details."
        />
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout title={`Service: ${name}`}>
        <LoadingPage label="Loading service details..." />
      </AppLayout>
    );
  }

  if (error || !service) {
    return (
      <AppLayout title={`Service: ${name}`}>
        <ErrorState
          title="Failed to Load Service"
          description={error || "Service not found"}
          onRetry={fetchService}
        />
      </AppLayout>
    );
  }

  // Helper to safely get unique functions across all interfaces
  const getAllFunctions = () => {
    const funcs: { name: string; serviceName: string; interface: string }[] = [];
    if (!service.interfaces) return funcs;

    Object.entries(service.interfaces).forEach(([interfaceName, iface]) => {
      if (iface.functions) {
        iface.functions.forEach((f) => {
          funcs.push({
            name: f.name,
            serviceName: f.serviceName,
            interface: interfaceName,
          });
        });
      }
    });

    return funcs;
  };

  const functions = getAllFunctions();

  return (
    <AppLayout title={`Service: ${name}`}>
      <div className="space-y-6">
        {/* Header Information */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-3xl font-bold tracking-tight">{name}</h2>
            </div>
            <p className="text-muted-foreground ml-12">
              External service integration
            </p>
          </div>
          <StatusBadge status="info" label="Active" />
        </div>

        {/* About Card */}
        <Card>
          <CardHeader>
            <CardTitle>About Service</CardTitle>
            <CardDescription>
              Details and metadata provided by the service author
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {service.about?.author && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Author</h4>
                  <div className="space-y-2">
                    {service.about.author.name && (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{service.about.author.name}</span>
                      </div>
                    )}
                    {service.about.author.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${service.about.author.email}`} className="text-blue-500 hover:underline">
                          {service.about.author.email}
                        </a>
                      </div>
                    )}
                    {service.about.author.company && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{service.about.author.company}</span>
                      </div>
                    )}
                    {service.about.author.website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={service.about.author.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          Website
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {service.about?.description && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Description</h4>
                  <p className="text-sm text-muted-foreground">
                    {service.about.description.en_US || service.about.description.zh_CN || "No description provided"}
                  </p>
                </div>
              )}

              {service.about?.helpUrl && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Documentation</h4>
                  <div className="flex items-center gap-2 text-sm">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={service.about.helpUrl.en_US || service.about.helpUrl.zh_CN}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      Help URL
                    </a>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Interfaces and Functions Tabs */}
        <Tabs defaultValue="interfaces">
          <TabsList>
            <TabsTrigger value="interfaces">
              <Server className="mr-2 h-4 w-4" />
              Interfaces
            </TabsTrigger>
            <TabsTrigger value="functions">
              <Zap className="mr-2 h-4 w-4" />
              Functions
              <Badge variant="secondary" className="ml-2">
                {functions.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="interfaces" className="space-y-4">
            {service.interfaces && Object.entries(service.interfaces).map(([ifaceName, iface]) => (
              <Card key={ifaceName}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Code className="h-4 w-4 text-blue-500" />
                        {ifaceName}
                      </CardTitle>
                      <CardDescription>{iface.address}</CardDescription>
                    </div>
                    <Badge variant="outline">{iface.protocol}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Schema Type:</span>
                      <span className="ml-2 font-medium">{iface.schemaType}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Schema File:</span>
                      <span className="ml-2 font-medium">{iface.schemaFile}</span>
                    </div>
                    {iface.options && (
                      <div className="col-span-full">
                        <span className="text-muted-foreground d-block mb-1">Options:</span>
                        <pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(iface.options, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {(!service.interfaces || Object.keys(service.interfaces).length === 0) && (
              <div className="text-center p-8 text-muted-foreground">
                No interfaces defined for this service
              </div>
            )}
          </TabsContent>

          <TabsContent value="functions">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Function</TableHead>
                      <TableHead>Service Name</TableHead>
                      <TableHead>Interface</TableHead>
                      <TableHead className="w-[100px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {functions.map((func) => (
                      <TableRow key={`${func.interface}-${func.name}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-yellow-500" />
                            {func.name}
                          </div>
                        </TableCell>
                        <TableCell>{func.serviceName}</TableCell>
                        <TableCell>{func.interface}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/services/functions/${func.name}`)}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {functions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                          No functions exposed by this service
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
