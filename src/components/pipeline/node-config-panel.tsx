"use client";

import { useState, useEffect } from "react";
import { usePipelineStore } from "@/stores/pipeline-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SQLEditor } from "@/components/editor/sql-editor";
import { JsonEditor } from "@/components/editor/json-editor";
import { X, Database, Cpu, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface NodeConfigPanelProps {
  nodeId: string;
}

export function NodeConfigPanel({ nodeId }: NodeConfigPanelProps) {
  const { nodes, updateNode, selectNode } = usePipelineStore();
  
  const node = nodes.find((n) => n.id === nodeId);
  
  const [label, setLabel] = useState(node?.data?.label || "");
  const [streamName, setStreamName] = useState(node?.data?.streamName || "");
  const [memoryTopic, setMemoryTopic] = useState(node?.data?.memoryTopic || "");
  const [sql, setSql] = useState(node?.data?.sql || "");
  const [ruleId, setRuleId] = useState(node?.data?.ruleId || "");
  const [sinkConfig, setSinkConfig] = useState(
    JSON.stringify(node?.data?.config || { log: {} }, null, 2)
  );

  useEffect(() => {
    if (node) {
      setLabel(node.data?.label || "");
      setStreamName(node.data?.streamName || "");
      setMemoryTopic(node.data?.memoryTopic || "");
      setSql(node.data?.sql || "");
      setRuleId(node.data?.ruleId || "");
      setSinkConfig(JSON.stringify(node.data?.config || { log: {} }, null, 2));
    }
  }, [nodeId, node]);

  if (!node) return null;

  const handleSave = () => {
    const updates: any = { label };
    
    if (node.type === "source") {
      updates.streamName = streamName;
      updates.memoryTopic = memoryTopic;
    } else if (node.type === "processor") {
      updates.sql = sql;
      updates.ruleId = ruleId;
    } else if (node.type === "sink") {
      try {
        updates.config = JSON.parse(sinkConfig);
      } catch (e) {
        // Invalid JSON, don't update
      }
    }
    
    updateNode(nodeId, updates);
  };

  const getNodeIcon = () => {
    switch (node.type) {
      case "source":
        return <Database className="h-5 w-5 text-green-500" />;
      case "processor":
        return <Cpu className="h-5 w-5 text-blue-500" />;
      case "sink":
        return <Send className="h-5 w-5 text-purple-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getNodeIcon()}
          <span className="font-medium capitalize">{node.type} Node</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => selectNode(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div>
          <label className="text-sm font-medium mb-1 block">Label</label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Node label"
          />
        </div>

        {/* Source Node Config */}
        {node.type === "source" && (
          <>
            <div>
              <label className="text-sm font-medium mb-1 block">Stream Name</label>
              <Input
                value={streamName}
                onChange={(e) => setStreamName(e.target.value)}
                placeholder="my_stream"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Data Source / Topic</label>
              <Input
                value={memoryTopic}
                onChange={(e) => setMemoryTopic(e.target.value)}
                placeholder="topic/data or memory/topic"
              />
            </div>
            <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Source Types:</p>
              <ul className="space-y-1">
                <li>• <code>mqtt</code> - MQTT broker topic</li>
                <li>• <code>memory</code> - Internal memory topic</li>
                <li>• <code>httppull</code> - HTTP polling</li>
                <li>• <code>httppush</code> - HTTP webhook</li>
                <li>• <code>edgex</code> - EdgeX message bus</li>
                <li>• <code>file</code> - File-based source</li>
                <li>• <code>redis</code> - Redis pub/sub</li>
                <li>• <code>kafka</code> - Apache Kafka</li>
                <li>• <code>sql</code> - SQL database polling</li>
                <li>• <code>video</code> - Video stream (RTSP/file)</li>
                <li>• <code>neuron</code> - Neuron integration</li>
                <li>• <code>zmq</code> - ZeroMQ</li>
              </ul>
            </div>
          </>
        )}

        {/* Processor Node Config */}
        {node.type === "processor" && (
          <>
            <div>
              <label className="text-sm font-medium mb-1 block">Rule ID</label>
              <Input
                value={ruleId}
                onChange={(e) => setRuleId(e.target.value)}
                placeholder="rule_1"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">SQL Query</label>
              <SQLEditor
                value={sql}
                onChange={setSql}
                height="200px"
                placeholder="SELECT * FROM stream_name WHERE value > 100"
              />
            </div>
            <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
              <p className="font-medium mb-1">Tips:</p>
              <ul className="space-y-1">
                <li>• Use window functions for aggregations</li>
                <li>• Access metadata with <code>meta(key)</code></li>
                <li>• Use CASE for conditional logic</li>
              </ul>
            </div>
          </>
        )}

        {/* Sink Node Config */}
        {node.type === "sink" && (
          <>
            <Tabs defaultValue="config">
              <TabsList className="w-full">
                <TabsTrigger value="config" className="flex-1">Configuration</TabsTrigger>
                <TabsTrigger value="templates" className="flex-1">Templates</TabsTrigger>
              </TabsList>
              <TabsContent value="config" className="mt-3">
                <label className="text-sm font-medium mb-1 block">Sink Configuration (JSON)</label>
                <JsonEditor
                  value={sinkConfig}
                  onChange={setSinkConfig}
                  height="250px"
                />
              </TabsContent>
              <TabsContent value="templates" className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                <p className="text-xs text-muted-foreground mb-2">Common Sinks</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({ log: {} }, null, 2))}
                >
                  Log Sink
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    mqtt: {
                      server: "tcp://localhost:1883",
                      topic: "result/topic"
                    }
                  }, null, 2))}
                >
                  MQTT Sink
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    rest: {
                      url: "http://localhost:8080/api/data",
                      method: "POST",
                      bodyType: "json"
                    }
                  }, null, 2))}
                >
                  REST API Sink
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    memory: {
                      topic: "internal/topic"
                    }
                  }, null, 2))}
                >
                  Memory Sink (Pipeline)
                </Button>

                <p className="text-xs text-muted-foreground mt-4 mb-2">Database Sinks</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    influx: {
                      addr: "http://localhost:8086",
                      bucket: "mydb",
                      org: "myorg",
                      token: "$TOKEN",
                      measurement: "data"
                    }
                  }, null, 2))}
                >
                  InfluxDB Sink
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    tdengine: {
                      host: "localhost",
                      port: 6030,
                      database: "mydb",
                      table: "mytable"
                    }
                  }, null, 2))}
                >
                  TDengine Sink
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    redis: {
                      addr: "localhost:6379",
                      dataType: "string",
                      keyType: "single",
                      field: "result"
                    }
                  }, null, 2))}
                >
                  Redis Sink
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    sql: {
                      url: "mysql://user:pwd@localhost:3306/mydb",
                      table: "results"
                    }
                  }, null, 2))}
                >
                  SQL Database Sink
                </Button>

                <p className="text-xs text-muted-foreground mt-4 mb-2">Messaging Sinks</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    kafka: {
                      brokers: "localhost:9092",
                      topic: "result-topic"
                    }
                  }, null, 2))}
                >
                  Kafka Sink
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    zmq: {
                      server: "tcp://localhost:5563",
                      topic: "result"
                    }
                  }, null, 2))}
                >
                  ZeroMQ Sink
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    neuron: {
                      url: "tcp://localhost:7081",
                      nodeName: "node1",
                      groupName: "group1"
                    }
                  }, null, 2))}
                >
                  Neuron Sink
                </Button>

                <p className="text-xs text-muted-foreground mt-4 mb-2">File & Media Sinks</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    file: {
                      path: "/tmp/result.json",
                      fileType: "json"
                    }
                  }, null, 2))}
                >
                  File Sink
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    image: {
                      path: "/tmp/images",
                      format: "jpeg"
                    }
                  }, null, 2))}
                >
                  Image Sink
                </Button>

                <p className="text-xs text-muted-foreground mt-4 mb-2">EdgeX Sinks</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setSinkConfig(JSON.stringify({
                    edgex: {
                      protocol: "tcp",
                      host: "localhost",
                      port: 5563,
                      topic: "result"
                    }
                  }, null, 2))}
                >
                  EdgeX Message Bus
                </Button>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button className="w-full" onClick={handleSave}>
          Apply Changes
        </Button>
      </div>
    </div>
  );
}
