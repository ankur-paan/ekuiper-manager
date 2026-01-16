"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mqtt, { MqttClient, IClientOptions } from "mqtt";

export interface MqttMessage {
  topic: string;
  payload: string | Buffer;
  timestamp: number;
}

export interface UseMqttOptions {
  brokerUrl: string;
  options?: IClientOptions;
  onMessage?: (message: MqttMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export interface UseMqttReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
  subscribe: (topic: string | string[]) => void;
  unsubscribe: (topic: string | string[]) => void;
  publish: (topic: string, message: string | Buffer) => void;
  subscriptions: Set<string>;
}

export function useMqtt({
  brokerUrl,
  options = {},
  onMessage,
  onConnect,
  onDisconnect,
  onError,
}: UseMqttOptions): UseMqttReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [subscriptions, setSubscriptions] = useState<Set<string>>(new Set());

  const clientRef = useRef<MqttClient | null>(null);

  const connect = useCallback(() => {
    if (clientRef.current?.connected) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const client = mqtt.connect(brokerUrl, {
        ...options,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      });

      client.on("connect", () => {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        onConnect?.();
      });

      client.on("disconnect", () => {
        setIsConnected(false);
        onDisconnect?.();
      });

      client.on("error", (err) => {
        setError(err);
        setIsConnecting(false);
        onError?.(err);
      });

      client.on("close", () => {
        setIsConnected(false);
      });

      client.on("message", (topic, payload) => {
        onMessage?.({
          topic,
          payload,
          timestamp: Date.now(),
        });
      });

      clientRef.current = client;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to connect");
      setError(error);
      setIsConnecting(false);
      onError?.(error);
    }
  }, [brokerUrl, options, onConnect, onDisconnect, onError, onMessage]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end();
      clientRef.current = null;
      setIsConnected(false);
      setSubscriptions(new Set());
    }
  }, []);

  const subscribe = useCallback((topic: string | string[]) => {
    if (!clientRef.current?.connected) {
      return;
    }

    const topics = Array.isArray(topic) ? topic : [topic];
    
    clientRef.current.subscribe(topics, (err) => {
      if (err) {
        setError(err);
        return;
      }
      setSubscriptions((prev) => {
        const next = new Set(prev);
        topics.forEach((t) => next.add(t));
        return next;
      });
    });
  }, []);

  const unsubscribe = useCallback((topic: string | string[]) => {
    if (!clientRef.current?.connected) {
      return;
    }

    const topics = Array.isArray(topic) ? topic : [topic];
    
    clientRef.current.unsubscribe(topics, (err) => {
      if (err) {
        setError(err);
        return;
      }
      setSubscriptions((prev) => {
        const next = new Set(prev);
        topics.forEach((t) => next.delete(t));
        return next;
      });
    });
  }, []);

  const publish = useCallback((topic: string, message: string | Buffer) => {
    if (!clientRef.current?.connected) {
      return;
    }

    clientRef.current.publish(topic, message, (err) => {
      if (err) {
        setError(err);
      }
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.end();
        clientRef.current = null;
      }
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    publish,
    subscriptions,
  };
}
