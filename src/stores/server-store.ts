/**
 * Server Connection Store
 * Manages multiple eKuiper server connections with Hybrid Persistence (Browser vs Database)
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Simple unique ID generator (no external deps needed)
const uuidv4 = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export type ServerStatus = "connected" | "disconnected" | "error" | "unknown";
export type StorageMode = "browser" | "database";

export interface ServerConnection {
  id: string;
  name: string;
  url: string;
  description?: string;
  status: ServerStatus;
  createdAt: Date;
  updatedAt?: Date;
}

interface ServerState {
  // Config
  storageMode: StorageMode;

  // Data
  servers: ServerConnection[];
  savedBrowserServers: ServerConnection[]; // Specific storage for browser mode
  activeServerId: string | null;

  // UI State
  isLoading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  // Actions
  setStorageMode: (mode: StorageMode) => void;
  fetchServers: () => Promise<void>;
  addServer: (server: { name: string; url: string; description?: string }) => Promise<void>;
  updateServer: (id: string, updates: Partial<ServerConnection>) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  setActiveServer: (id: string | null) => void;
  getActiveServer: () => ServerConnection | null;
  setHasHydrated: (state: boolean) => void;
}

export const useServerStore = create<ServerState>()(
  persist(
    (set, get) => ({
      storageMode: 'database', // Default to DB
      servers: [],
      savedBrowserServers: [],
      activeServerId: null,
      isLoading: false,
      error: null,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setStorageMode: (mode) => {
        set({ storageMode: mode });
        if (mode === 'database') {
          get().fetchServers();
        } else {
          set(state => ({ servers: state.savedBrowserServers }));
        }
      },

      fetchServers: async () => {
        const { storageMode, savedBrowserServers } = get();

        if (storageMode === 'browser') {
          set({ servers: savedBrowserServers, isLoading: false, error: null });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const res = await fetch('/api/servers');
          if (!res.ok) throw new Error('Failed to fetch servers');
          const data = await res.json();

          const servers = data.map((s: any) => ({
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: s.updatedAt ? new Date(s.updatedAt) : undefined,
            status: s.status || "unknown"
          }));
          set({ servers, isLoading: false });
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
        }
      },

      addServer: async (serverData) => {
        const { storageMode } = get();
        set({ isLoading: true, error: null });

        if (storageMode === 'browser') {
          const newServer: ServerConnection = {
            id: `local-${Date.now()}`,
            ...serverData,
            status: 'unknown',
            createdAt: new Date()
          };
          set(state => ({
            servers: [...state.servers, newServer],
            savedBrowserServers: [...state.savedBrowserServers, newServer],
            activeServerId: state.activeServerId || newServer.id,
            isLoading: false
          }));
          return;
        }

        try {
          const res = await fetch('/api/servers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(serverData)
          });
          if (!res.ok) throw new Error('Failed to create server');
          const raw = await res.json();
          const newServer: ServerConnection = {
            ...raw,
            createdAt: new Date(raw.createdAt),
            updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : undefined,
            status: "unknown"
          };

          set((state) => ({
            servers: [...state.servers, newServer],
            activeServerId: state.activeServerId || newServer.id,
            isLoading: false
          }));
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
        }
      },

      updateServer: async (id, updates) => {
        const { storageMode } = get();

        if (storageMode === 'browser') {
          set(state => {
            const updatedServers = state.servers.map(s => s.id === id ? { ...s, ...updates } : s);
            return {
              servers: updatedServers,
              savedBrowserServers: updatedServers // Sync backup
            };
          });
          return;
        }

        try {
          set({ isLoading: true });
          const res = await fetch(`/api/servers/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
          });
          if (!res.ok) throw new Error('Failed to update server');
          const raw = await res.json();
          set((state) => ({
            servers: state.servers.map((s) =>
              s.id === id ? { ...s, ...raw, createdAt: new Date(raw.createdAt) } : s
            ),
            isLoading: false
          }));
        } catch (err: any) {
          set({ error: err.message, isLoading: false });
        }
      },

      removeServer: async (id) => {
        const { storageMode } = get();

        if (storageMode === 'browser') {
          set(state => {
            const remaining = state.servers.filter(s => s.id !== id);
            return {
              servers: remaining,
              savedBrowserServers: remaining,
              activeServerId: state.activeServerId === id
                ? (remaining[0]?.id || null)
                : state.activeServerId
            };
          });
          return;
        }

        try {
          await fetch(`/api/servers/${id}`, { method: 'DELETE' });
          set((state) => ({
            servers: state.servers.filter((s) => s.id !== id),
            activeServerId:
              state.activeServerId === id
                ? (state.servers.find((s) => s.id !== id)?.id || null)
                : state.activeServerId,
          }));
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      setActiveServer: (id) => set({ activeServerId: id }),

      getActiveServer: () => {
        const { servers, activeServerId } = get();
        return servers.find((s) => s.id === activeServerId) || null;
      },
    }),
    {
      name: "ekuiper-store-v3-hybrid",
      partialize: (state) => ({
        storageMode: state.storageMode,
        savedBrowserServers: state.savedBrowserServers,
        activeServerId: state.activeServerId
      }),
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
