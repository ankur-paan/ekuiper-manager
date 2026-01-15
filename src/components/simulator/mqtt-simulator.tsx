"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonEditor } from "@/components/editor/json-editor";
import { 
  Play, 
  Square, 
  Trash2, 
  Plus, 
  Radio, 
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  Zap,
  Wifi,
  WifiOff,
  Loader2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn, generateId } from "@/lib/utils";
import { useMqtt, type MqttMessage } from "@/hooks/use-mqtt";

interface SimulatorMessage {
  id: string;
  topic: string;
  payload: Record<string, any>;
  timestamp: number;
  status: "pending" | "sent" | "error";
}

interface PayloadTemplate {
  id: string;
  name: string;
  template: Record<string, any>;
}

const DEFAULT_TEMPLATES: PayloadTemplate[] = [
  {
    id: "sensor",
    name: "Sensor Data",
    template: {
      deviceId: "device_001",
      temperature: 25.5,
      humidity: 65,
      timestamp: "{{timestamp}}"
    }
  },
  {
    id: "alert",
    name: "Alert Event",
    template: {
      alertId: "{{uuid}}",
      severity: "high",
      message: "Temperature threshold exceeded",
      value: 85.2,
      threshold: 80,
      timestamp: "{{timestamp}}"
    }
  },
  {
    id: "machine",
    name: "Machine Telemetry",
    template: {
      machineId: "MCH_{{random}}",
      status: "running",
      rpm: 1500,
      power: 750.5,
      vibration: 0.02,
      operatingHours: 1250
    }
  },
  {
    id: "edge",
    name: "EdgeX Event",
    template: {
      apiVersion: "v2",
      id: "{{uuid}}",
      deviceName: "Random-Integer-Device",
      profileName: "Random-Integer-Device",
      sourceName: "Int32",
      origin: "{{timestamp_nano}}",
      readings: [
        {
          id: "{{uuid}}",
          origin: "{{timestamp_nano}}",
          deviceName: "Random-Integer-Device",
          resourceName: "Int32",
          profileName: "Random-Integer-Device",
          valueType: "Int32",
          value: "{{random_int}}"
        }
      ]
    }
  }
];

function processTemplate(template: any): any {
  if (typeof template === "string") {
    return template
      .replace(/\{\{timestamp\}\}/g, new Date().toISOString())
      .replace(/\{\{timestamp_nano\}\}/g, (Date.now() * 1000000).toString())
      .replace(/\{\{uuid\}\}/g, crypto.randomUUID())
      .replace(/\{\{random\}\}/g, Math.floor(Math.random() * 10000).toString())
      .replace(/\{\{random_int\}\}/g, Math.floor(Math.random() * 1000000).toString())
      .replace(/\{\{random_float\}\}/g, (Math.random() * 100).toFixed(2));
  }
  if (Array.isArray(template)) {
    return template.map(processTemplate);
  }
  if (typeof template === "object" && template !== null) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = processTemplate(value);
    }
    return result;
  }
  return template;
}

export function MqttSimulator() {
  const [brokerUrl, setBrokerUrl] = useState("ws://localhost:8083/mqtt");
  const [topic, setTopic] = useState("demo/sensor");
  const [intervalMs, setIntervalMs] = useState(1000);
  const [isSimulating, setIsSimulating] = useState(false);
  const [messages, setMessages] = useState<SimulatorMessage[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PayloadTemplate>(DEFAULT_TEMPLATES[0]);
  const [customPayload, setCustomPayload] = useState(
    JSON.stringify(DEFAULT_TEMPLATES[0].template, null, 2)
  );
  const [receivedMessages, setReceivedMessages] = useState<MqttMessage[]>([]);
  const [subscribeTopics, setSubscribeTopics] = useState("demo/#");

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageCountRef = useRef(0);

  // Real MQTT connection using the hook
  const {
    isConnected,
    isConnecting,
    error: mqttError,
    connect,
    disconnect,
    publish,
    subscribe,
    unsubscribe,
    subscriptions,
  } = useMqtt({
    brokerUrl,
    options: {
      clientId: `ekuiper-playground-${generateId()}`,
      clean: true,
      reconnectPeriod: 5000,
    },
    onConnect: () => {
      toast({
        title: "Connected to MQTT Broker",
        description: `Successfully connected to ${brokerUrl}`,
      });
    },
    onDisconnect: () => {
      setIsSimulating(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      toast({
        title: "Disconnected",
        description: "MQTT connection closed",
      });
    },
    onError: (error) => {
      toast({
        title: "Connection Error",
        description: error.message,
        variant: "destructive",
      });
    },
    onMessage: (message) => {
      setReceivedMessages((prev) => [message, ...prev].slice(0, 100));
    },
  });

  const handleConnect = useCallback(() => {
    connect();
  }, [connect]);

  const handleDisconnect = useCallback(() => {
    setIsSimulating(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    disconnect();
  }, [disconnect]);

  const handleSubscribe = useCallback(() => {
    if (subscribeTopics) {
      const topics = subscribeTopics.split(",").map((t) => t.trim());
      subscribe(topics);
      toast({
        title: "Subscribed",
        description: `Subscribed to: ${topics.join(", ")}`,
      });
    }
  }, [subscribe, subscribeTopics]);

  const sendMessage = useCallback(() => {
    try {
      const payload = processTemplate(JSON.parse(customPayload));
      const payloadStr = JSON.stringify(payload);
      
      const message: SimulatorMessage = {
        id: generateId(),
        topic,
        payload,
        timestamp: Date.now(),
        status: "pending",
      };

      setMessages((prev) => [message, ...prev].slice(0, 100));
      
      // Publish to real MQTT broker
      publish(topic, payloadStr);
      
      // Update status to sent
      setMessages((prev) => 
        prev.map((m) => 
          m.id === message.id ? { ...m, status: "sent" as const } : m
        )
      );
      
      messageCountRef.current += 1;
    } catch (error) {
      toast({
        title: "Error",
        description: "Invalid JSON payload",
        variant: "destructive",
      });
    }
  }, [customPayload, topic, publish]);

  const startSimulation = useCallback(() => {
    if (!isConnected) {
      toast({
        title: "Not connected",
        description: "Connect to broker first",
        variant: "destructive",
      });
      return;
    }

    setIsSimulating(true);
    messageCountRef.current = 0;

    // Send first message immediately
    sendMessage();

    // Then send at interval
    intervalRef.current = setInterval(sendMessage, intervalMs);

    toast({
      title: "Simulation started",
      description: `Sending messages every ${intervalMs}ms`,
    });
  }, [isConnected, intervalMs, sendMessage]);

  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    toast({
      title: "Simulation stopped",
      description: `Sent ${messageCountRef.current} messages`,
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messageCountRef.current = 0;
  }, []);

  const selectTemplate = useCallback((template: PayloadTemplate) => {
    setSelectedTemplate(template);
    setCustomPayload(JSON.stringify(template.template, null, 2));
  }, []);

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Connection Settings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Radio className="h-5 w-5" />
                MQTT Simulator
              </CardTitle>
              <CardDescription>
                Real MQTT connection for testing eKuiper streams
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isConnecting && (
                <Badge variant="secondary" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Connecting...
                </Badge>
              )}
              {isConnected && (
                <Badge variant="success" className="gap-1">
                  <Wifi className="h-3 w-3" />
                  Connected
                </Badge>
              )}
              {!isConnected && !isConnecting && (
                <Badge variant="secondary" className="gap-1">
                  <WifiOff className="h-3 w-3" />
                  Disconnected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Broker URL (WebSocket)</label>
              <Input
                value={brokerUrl}
                onChange={(e) => setBrokerUrl(e.target.value)}
                placeholder="ws://localhost:8083/mqtt"
                disabled={isConnected || isConnecting}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use ws:// or wss:// for browser MQTT connections
              </p>
            </div>
            <div className="flex items-end">
              {!isConnected ? (
                <Button 
                  onClick={handleConnect} 
                  className="w-full"
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              ) : (
                <Button onClick={handleDisconnect} variant="outline" className="w-full">
                  Disconnect
                </Button>
              )}
            </div>
          </div>
          {mqttError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {mqttError.message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Message Configuration */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Message Configuration</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <Tabs defaultValue="payload" className="h-full flex flex-col">
            <TabsList>
              <TabsTrigger value="payload">Publish</TabsTrigger>
              <TabsTrigger value="subscribe">
                Subscribe {receivedMessages.length > 0 && `(${receivedMessages.length})`}
              </TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
              <TabsTrigger value="history">Sent ({messages.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="payload" className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium mb-1 block">Topic</label>
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="demo/sensor"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Interval (ms)</label>
                  <Input
                    type="number"
                    value={intervalMs}
                    onChange={(e) => setIntervalMs(parseInt(e.target.value) || 1000)}
                    min={100}
                    step={100}
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0">
                <label className="text-sm font-medium mb-1 block">
                  Payload (JSON) - Use {`{{timestamp}}, {{uuid}}, {{random}}`} for dynamic values
                </label>
                <JsonEditor
                  value={customPayload}
                  onChange={setCustomPayload}
                  height="200px"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={sendMessage}
                  disabled={!isConnected}
                  variant="outline"
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  Send Once
                </Button>
                {!isSimulating ? (
                  <Button
                    onClick={startSimulation}
                    disabled={!isConnected}
                    className="gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Start Simulation
                  </Button>
                ) : (
                  <Button
                    onClick={stopSimulation}
                    variant="destructive"
                    className="gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                )}
                {isSimulating && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />
                    Sending every {intervalMs}ms
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="subscribe" className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex gap-2">
                <Input
                  value={subscribeTopics}
                  onChange={(e) => setSubscribeTopics(e.target.value)}
                  placeholder="topic1, topic2, demo/#"
                  className="flex-1"
                />
                <Button 
                  onClick={handleSubscribe}
                  disabled={!isConnected}
                >
                  Subscribe
                </Button>
              </div>
              
              {subscriptions.size > 0 && (
                <div className="flex flex-wrap gap-1">
                  <span className="text-sm text-muted-foreground">Subscribed:</span>
                  {Array.from(subscriptions).map((sub) => (
                    <Badge key={sub} variant="secondary" className="text-xs">
                      {sub}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex-1 overflow-auto space-y-2">
                {receivedMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No messages received. Subscribe to topics to see incoming messages.
                  </div>
                ) : (
                  receivedMessages.map((msg, idx) => (
                    <div key={idx} className="p-3 rounded-lg border bg-card text-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-primary">{msg.topic}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                        {typeof msg.payload === "string" 
                          ? msg.payload 
                          : JSON.stringify(JSON.parse(msg.payload.toString()), null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
              
              {receivedMessages.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setReceivedMessages([])}
                  className="self-end"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </TabsContent>

            <TabsContent value="templates" className="flex-1 overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DEFAULT_TEMPLATES.map((template) => (
                  <Card
                    key={template.id}
                    className={cn(
                      "cursor-pointer transition-all hover:border-primary",
                      selectedTemplate.id === template.id && "border-primary bg-primary/5"
                    )}
                    onClick={() => selectTemplate(template)}
                  >
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm">{template.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <pre className="text-xs text-muted-foreground bg-muted p-2 rounded overflow-hidden max-h-24">
                        {JSON.stringify(template.template, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="history" className="flex-1 overflow-auto">
              <div className="flex justify-end mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearMessages}
                  disabled={messages.length === 0}
                  className="gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear
                </Button>
              </div>
              <div className="space-y-2">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No messages sent yet
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="p-3 rounded-lg border bg-card text-sm"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {msg.status === "sent" ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : msg.status === "error" ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className="font-mono text-primary">{msg.topic}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(msg.payload, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
