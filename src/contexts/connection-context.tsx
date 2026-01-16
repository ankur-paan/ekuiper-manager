"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useServerStore } from "@/stores/server-store";

interface ConnectionStatus {
  isConnected: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  error: string | null;
  serverUrl: string | null;
}

interface ConnectionContextType {
  status: ConnectionStatus;
  checkConnection: () => Promise<boolean>;
  resetConnection: () => void;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const { getActiveServer } = useServerStore();
  const [status, setStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isChecking: false,
    lastChecked: null,
    error: null,
    serverUrl: null,
  });

  const checkConnection = useCallback(async (): Promise<boolean> => {
    const server = getActiveServer();
    if (!server) {
      setStatus({
        isConnected: false,
        isChecking: false,
        lastChecked: new Date(),
        error: "No server configured",
        serverUrl: null,
      });
      return false;
    }

    setStatus((prev) => ({ ...prev, isChecking: true, serverUrl: server.url }));

    try {
      const response = await fetch("/api/ekuiper/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: server.url }),
      });

      const result = await response.json();

      setStatus({
        isConnected: result.success,
        isChecking: false,
        lastChecked: new Date(),
        error: result.success ? null : result.message,
        serverUrl: server.url,
      });

      return result.success;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection check failed";
      setStatus({
        isConnected: false,
        isChecking: false,
        lastChecked: new Date(),
        error: message,
        serverUrl: server.url,
      });
      return false;
    }
  }, [getActiveServer]);

  const resetConnection = useCallback(() => {
    setStatus({
      isConnected: false,
      isChecking: false,
      lastChecked: null,
      error: null,
      serverUrl: null,
    });
  }, []);

  // Check connection when server changes
  useEffect(() => {
    const server = getActiveServer();
    if (server && server.url !== status.serverUrl) {
      checkConnection();
    }
  }, [getActiveServer, checkConnection, status.serverUrl]);

  return (
    <ConnectionContext.Provider value={{ status, checkConnection, resetConnection }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error("useConnection must be used within a ConnectionProvider");
  }
  return context;
}

export function useIsConnected() {
  const { status } = useConnection();
  return status.isConnected;
}
