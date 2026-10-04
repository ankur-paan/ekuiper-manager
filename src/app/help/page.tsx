'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Cpu,
  ExternalLink,
  Github,
  HelpCircle,
  Layers,
  Radio,
  Server,
  Terminal,
  Workflow,
} from 'lucide-react';
import { AppLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { INDUSTRIAL_DRIVERS, DRIVER_CATEGORIES } from '@/lib/ekuiper/driver-catalog';

const docLinks = [
  {
    title: 'LF Edge eKuiper Documentation',
    desc: 'Official architectural reference, stream syntax, windowing functions, and rule execution.',
    url: 'https://ekuiper.org/docs/en/latest/',
    tag: 'Official Docs',
  },
  {
    title: 'GitHub LF Edge Repository',
    desc: 'Source code, open issue tracker, releases, and edge deployment manifests.',
    url: 'https://github.com/lf-edge/ekuiper',
    tag: 'v2.x Engine',
  },
  {
    title: 'SQL Function Reference',
    desc: 'Complete index of mathematical, string, aggregate, and DSP functions available in queries.',
    url: 'https://ekuiper.org/docs/en/latest/sqls/functions/overview.html',
    tag: 'SQL Reference',
  },
  {
    title: 'Plugin & Portable Extension Guide',
    desc: 'Guide to authoring custom native Go plugins, WASM functions, and Python portable runtimes.',
    url: 'https://ekuiper.org/docs/en/latest/extension/overview.html',
    tag: 'Extensions',
  },
];

const cliSnippets = [
  {
    cmd: 'kuiperd',
    desc: 'Starts the edge stream processing daemon',
  },
  {
    cmd: 'bin/kuiper create rule <rule_id> -f <rule.json>',
    desc: 'Deploy a stream rule definition from JSON',
  },
  {
    cmd: 'bin/kuiper getstatus rule <rule_id>',
    desc: 'Inspect metrics and exceptions for a rule',
  },
  {
    cmd: 'bin/kuiper query',
    desc: 'Interactive SQL query shell against edge streams',
  },
];

export default function HelpPage() {
  return (
    <AppLayout title="Documentation & Help">
      <div className="mx-auto max-w-5xl flex flex-col gap-8 pb-12">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 text-primary" />
            <h2 className="text-2xl font-semibold tracking-tight">Documentation & Reference</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Architectural reference, streaming SQL manuals, and edge operations guidance for LF Edge eKuiper.
          </p>
        </div>

        {/* Documentation Portals */}
        <div className="grid gap-4 sm:grid-cols-2">
          {docLinks.map((doc) => (
            <Card
              key={doc.title}
              className="group relative flex flex-col justify-between overflow-hidden border-border/80 bg-card/60 transition-colors hover:border-primary/40 hover:bg-card/90"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground font-normal">
                    {doc.tag}
                  </Badge>
                  <ExternalLink className="size-3.5 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <CardTitle className="pt-2 text-base font-semibold tracking-tight text-foreground">
                  {doc.title}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                  {doc.desc}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full justify-between text-xs transition-transform duration-150 active:scale-[0.97]"
                >
                  <a href={doc.url} target="_blank" rel="noopener noreferrer">
                    Open documentation
                    <ArrowRight className="size-3.5" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* System Architecture Overview */}
        <Card className="border-border/80 bg-card/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <CardTitle className="text-sm font-semibold tracking-tight">eKuiper Edge Stream Pipeline Architecture</CardTitle>
            </div>
            <CardDescription className="text-xs">
              eKuiper is a lightweight IoT stream processing engine designed for resource-constrained edge computing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Radio className="size-4 text-blue-500" />
                  1. Source Ingestion
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Streams ingest telemetry via MQTT, Neuron IPC, EdgeX, OPC-UA, HTTP, or WebSocket. Data schemas can be inferred dynamically or validated against Protobuf/Custom schemas.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-mono text-[10px]">MQTT</Badge>
                  <Badge variant="secondary" className="font-mono text-[10px]">Neuron</Badge>
                  <Badge variant="secondary" className="font-mono text-[10px]">OPC-UA</Badge>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Workflow className="size-4 text-emerald-500" />
                  2. Stream Engine & Rules
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  SQL queries and DAG topologies filter, transform, aggregate across tumbling/sliding/count windows, and execute custom Go/Python DSP algorithms in microsecond latency.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-mono text-[10px]">Windowing</Badge>
                  <Badge variant="secondary" className="font-mono text-[10px]">Topologies</Badge>
                  <Badge variant="secondary" className="font-mono text-[10px]">DSP / AI</Badge>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <Server className="size-4 text-amber-500" />
                  3. Sink Dispatch
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Processed signals and alerts route to MQTT brokers, InfluxDB, PostgreSQL, Redis, EdgeX message buses, or local files with built-in retry and caching buffers.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-mono text-[10px]">InfluxDB</Badge>
                  <Badge variant="secondary" className="font-mono text-[10px]">REST</Badge>
                  <Badge variant="secondary" className="font-mono text-[10px]">Kafka</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Industrial Protocols & Southbound Drivers Reference */}
        <Card className="border-border/80 bg-card/60">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="size-4 text-primary" />
                <CardTitle className="text-sm font-semibold tracking-tight">Industrial Protocols & Southbound Drivers</CardTitle>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">
                {INDUSTRIAL_DRIVERS.length} Drivers
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Fieldbus, CNC machine tool, power telecontrol, and IoT connectivity supported via edge gateways and Neuron streams.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DRIVER_CATEGORIES.map((category) => {
                const drivers = INDUSTRIAL_DRIVERS.filter((d) => d.category === category);
                return (
                  <div key={category} className="rounded-lg border border-border/50 bg-muted/20 p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                      <span>{category}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{drivers.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {drivers.map((d) => (
                        <span
                          key={d.id}
                          title={`${d.desc}${d.port ? ` · Default Port: ${d.port}` : ''}`}
                          className="inline-flex items-center gap-1 rounded bg-background px-1.5 py-0.5 text-[11px] font-mono border border-border/60 text-muted-foreground hover:text-foreground cursor-help"
                        >
                          {d.name}
                          {d.port && <span className="text-[9px] text-muted-foreground/70">:{d.port}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* CLI Reference */}
        <Card className="border-border/80 bg-card/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-primary" />
              <CardTitle className="text-sm font-semibold tracking-tight">CLI Quick Commands</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Common commands executed on the target edge host or container.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {cliSnippets.map((snippet) => (
              <div
                key={snippet.cmd}
                className="flex flex-col justify-between gap-1 rounded-md border border-border/50 bg-muted/30 p-2.5 sm:flex-row sm:items-center"
              >
                <code className="font-mono text-xs text-primary">{snippet.cmd}</code>
                <span className="text-xs text-muted-foreground">{snippet.desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Community & Releases */}
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-border/80 bg-gradient-to-r from-card to-muted/20 p-6 sm:flex-row">
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">LF Edge Open Source Community</h3>
            <p className="text-xs text-muted-foreground">
              eKuiper is an open source project governed under LF Edge and the Linux Foundation.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-2 text-xs transition-transform duration-150 active:scale-[0.97]"
            >
              <a href="https://github.com/lf-edge/ekuiper" target="_blank" rel="noopener noreferrer">
                <Github className="size-3.5" />
                GitHub
              </a>
            </Button>
            <Button
              asChild
              size="sm"
              className="h-8 gap-2 text-xs transition-transform duration-150 active:scale-[0.97]"
            >
              <Link href="/nodes">
                Manage Nodes
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
