/**
 * Server Connection Store
 * Manages multiple eKuiper server connections with persistence
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ServerStatus = "connected" | "disconnected" | "error" | "unknown";

export interface ServerConnection {
  id: string;
  name: string;
  url: string;
  description?: string;
  status: ServerStatus;
  createdAt: Date;
  lastConnected?: Date;
}

interface ServerState {
  // State
  servers: ServerConnection[];
  activeServerId: string | null;
  _hasHydrated: boolean;
  
  // Actions
  addServer: (server: Omit<ServerConnection, "id" | "createdAt" | "status">) => string;
  updateServer: (id: string, updates: Partial<Omit<ServerConnection, "id">>) => void;
  removeServer: (id: string) => void;
  setActiveServer: (id: string | null) => void;
  getActiveServer: () => ServerConnection | null;
  setHasHydrated: (state: boolean) => void;
}

export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      servers: [
        {
          id: "localhost",
          name: "Localhost",
          url: "http://localhost:9081",
          description: "Local eKuiper instance",
          status: "unknown" as ServerStatus,
          createdAt: new Date(),
        },
      ],
      activeServerId: "localhost",
      _hasHydrated: false,

      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },

      addServer: (serverData) => {
        const id = `server-${Date.now()}`;
        const server: ServerConnection = {
          ...serverData,
          id,
          status: "unknown",
          createdAt: new Date(),
        };
        set((state) => ({
          servers: [...state.servers, server],
          activeServerId: state.activeServerId || id,
        }));
        return id;
      },

      updateServer: (id, updates) => {
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      removeServer: (id) => {
        set((state) => ({
          servers: state.servers.filter((s) => s.id !== id),
          activeServerId:
            state.activeServerId === id 
              ? (state.servers.find((s) => s.id !== id)?.id || null)
              : state.activeServerId,
        }));
      },

      setActiveServer: (id) => {
        set({ activeServerId: id });
      },

      getActiveServer: () => {
        const { servers, activeServerId } = get();
        return servers.find((s) => s.id === activeServerId) || null;
      },
    }),
    {
      name: "ekuiper-servers",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
