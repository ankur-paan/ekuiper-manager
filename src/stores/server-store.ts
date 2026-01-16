"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EKuiperClient } from "@/lib/ekuiper";

interface ServerConfig {
  id: string;
  name: string;
  url: string;
  isDefault: boolean;
}

type ConnectionStatus = "unknown" | "connecting" | "connected" | "disconnected";

interface ServerState {
  servers: ServerConfig[];
  activeServerId: string | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  addServer: (server: Omit<ServerConfig, "id">) => void;
  removeServer: (id: string) => void;
  updateServer: (id: string, updates: Partial<ServerConfig>) => void;
  setActiveServer: (id: string) => void;
  getActiveServer: () => ServerConfig | null;
  getClient: () => EKuiperClient | null;
  testConnection: () => Promise<boolean>;
  setConnectionStatus: (status: ConnectionStatus, error?: string | null) => void;
  isConnected: () => boolean;
}

const DEFAULT_SERVERS: ServerConfig[] = [
  {
    id: "local",
    name: "Local eKuiper",
    url: "http://localhost:9081",
    isDefault: true,
  },
];

export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      servers: DEFAULT_SERVERS,
      activeServerId: "local",
      connectionStatus: "unknown",
      connectionError: null,

      addServer: (server) => {
        const id = crypto.randomUUID();
        set((state) => ({
          servers: [...state.servers, { ...server, id }],
        }));
      },

      removeServer: (id) => {
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== id),
          activeServerId: state.activeServerId === id ? null : state.activeServerId,
        }));
      },

      updateServer: (id, updates) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      setActiveServer: (id) => {
        // Reset connection status when switching servers
        set({ activeServerId: id, connectionStatus: "unknown", connectionError: null });
      },

      getActiveServer: () => {
        const state = get();
        return state.servers.find((s) => s.id === state.activeServerId) || null;
      },

      getClient: () => {
        const server = get().getActiveServer();
        if (!server) return null;
        // Use the API proxy with eKuiper URL passed via header
        return new EKuiperClient("/api/ekuiper", server.url);
      },

      testConnection: async () => {
        const server = get().getActiveServer();
        if (!server) {
          set({ connectionStatus: "disconnected", connectionError: "No server selected" });
          return false;
        }

        set({ connectionStatus: "connecting", connectionError: null });

        try {
          const response = await fetch("/api/ekuiper/test-connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: server.url }),
          });

          const result = await response.json();

          if (result.success) {
            set({ connectionStatus: "connected", connectionError: null });
            return true;
          } else {
            set({ connectionStatus: "disconnected", connectionError: result.error || "Connection failed" });
            return false;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          set({ connectionStatus: "disconnected", connectionError: errorMessage });
          return false;
        }
      },

      setConnectionStatus: (status, error = null) => {
        set({ connectionStatus: status, connectionError: error });
      },

      isConnected: () => {
        return get().connectionStatus === "connected";
      },
    }),
    {
      name: "ekuiper-servers",
      partialize: (state) => ({
        servers: state.servers,
        activeServerId: state.activeServerId,
        // Don't persist connection status
      }),
    }
  )
);
