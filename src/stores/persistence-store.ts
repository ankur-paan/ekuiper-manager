"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// =============================================================================
// User Preferences Store
// =============================================================================

interface UserPreferences {
  theme: "light" | "dark" | "system";
  sidebarCollapsed: boolean;
  defaultView: string;
  editorFontSize: number;
  autoSaveInterval: number; // in seconds, 0 = disabled
}

interface UserPreferencesStore extends UserPreferences {
  setTheme: (theme: UserPreferences["theme"]) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDefaultView: (view: string) => void;
  setEditorFontSize: (size: number) => void;
  setAutoSaveInterval: (interval: number) => void;
  resetToDefaults: () => void;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  sidebarCollapsed: false,
  defaultView: "dashboard",
  editorFontSize: 14,
  autoSaveInterval: 30,
};

export const useUserPreferencesStore = create<UserPreferencesStore>()(
  persist(
    (set) => ({
      ...DEFAULT_PREFERENCES,
      setTheme: (theme) => set({ theme }),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setDefaultView: (view) => set({ defaultView: view }),
      setEditorFontSize: (size) => set({ editorFontSize: size }),
      setAutoSaveInterval: (interval) => set({ autoSaveInterval: interval }),
      resetToDefaults: () => set(DEFAULT_PREFERENCES),
    }),
    {
      name: "ekuiper-preferences",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// =============================================================================
// Saved Configurations Store
// =============================================================================

interface SavedStream {
  id: string;
  name: string;
  sql: string;
  type: string;
  createdAt: number;
  updatedAt: number;
}

interface SavedRule {
  id: string;
  name: string;
  sql: string;
  actions: Record<string, any>[];
  options?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

interface SavedPlugin {
  id: string;
  name: string;
  language: "python" | "go";
  type: "source" | "sink" | "function";
  code: string;
  manifest: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

interface SavedTemplate {
  id: string;
  name: string;
  template: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

interface SavedPipeline {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  createdAt: number;
  updatedAt: number;
}

interface SavedConfigurationsStore {
  streams: SavedStream[];
  rules: SavedRule[];
  plugins: SavedPlugin[];
  templates: SavedTemplate[];
  pipelines: SavedPipeline[];
  
  // Stream operations
  saveStream: (stream: Omit<SavedStream, "id" | "createdAt" | "updatedAt">) => string;
  updateStream: (id: string, updates: Partial<SavedStream>) => void;
  deleteStream: (id: string) => void;
  getStream: (id: string) => SavedStream | undefined;
  
  // Rule operations
  saveRule: (rule: Omit<SavedRule, "id" | "createdAt" | "updatedAt">) => string;
  updateRule: (id: string, updates: Partial<SavedRule>) => void;
  deleteRule: (id: string) => void;
  getRule: (id: string) => SavedRule | undefined;
  
  // Plugin operations
  savePlugin: (plugin: Omit<SavedPlugin, "id" | "createdAt" | "updatedAt">) => string;
  updatePlugin: (id: string, updates: Partial<SavedPlugin>) => void;
  deletePlugin: (id: string) => void;
  getPlugin: (id: string) => SavedPlugin | undefined;
  
  // Template operations
  saveTemplate: (template: Omit<SavedTemplate, "id" | "createdAt" | "updatedAt">) => string;
  updateTemplate: (id: string, updates: Partial<SavedTemplate>) => void;
  deleteTemplate: (id: string) => void;
  getTemplate: (id: string) => SavedTemplate | undefined;
  
  // Pipeline operations
  savePipeline: (pipeline: Omit<SavedPipeline, "id" | "createdAt" | "updatedAt">) => string;
  updatePipeline: (id: string, updates: Partial<SavedPipeline>) => void;
  deletePipeline: (id: string) => void;
  getPipeline: (id: string) => SavedPipeline | undefined;
  
  // Bulk operations
  exportAll: () => string;
  importAll: (data: string) => void;
  clearAll: () => void;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useSavedConfigurationsStore = create<SavedConfigurationsStore>()(
  persist(
    (set, get) => ({
      streams: [],
      rules: [],
      plugins: [],
      templates: [],
      pipelines: [],
      
      // Stream operations
      saveStream: (stream) => {
        const id = generateId();
        const now = Date.now();
        set((state) => ({
          streams: [...state.streams, { ...stream, id, createdAt: now, updatedAt: now }],
        }));
        return id;
      },
      updateStream: (id, updates) => {
        set((state) => ({
          streams: state.streams.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
          ),
        }));
      },
      deleteStream: (id) => {
        set((state) => ({
          streams: state.streams.filter((s) => s.id !== id),
        }));
      },
      getStream: (id) => get().streams.find((s) => s.id === id),
      
      // Rule operations
      saveRule: (rule) => {
        const id = generateId();
        const now = Date.now();
        set((state) => ({
          rules: [...state.rules, { ...rule, id, createdAt: now, updatedAt: now }],
        }));
        return id;
      },
      updateRule: (id, updates) => {
        set((state) => ({
          rules: state.rules.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: Date.now() } : r
          ),
        }));
      },
      deleteRule: (id) => {
        set((state) => ({
          rules: state.rules.filter((r) => r.id !== id),
        }));
      },
      getRule: (id) => get().rules.find((r) => r.id === id),
      
      // Plugin operations
      savePlugin: (plugin) => {
        const id = generateId();
        const now = Date.now();
        set((state) => ({
          plugins: [...state.plugins, { ...plugin, id, createdAt: now, updatedAt: now }],
        }));
        return id;
      },
      updatePlugin: (id, updates) => {
        set((state) => ({
          plugins: state.plugins.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
        }));
      },
      deletePlugin: (id) => {
        set((state) => ({
          plugins: state.plugins.filter((p) => p.id !== id),
        }));
      },
      getPlugin: (id) => get().plugins.find((p) => p.id === id),
      
      // Template operations
      saveTemplate: (template) => {
        const id = generateId();
        const now = Date.now();
        set((state) => ({
          templates: [...state.templates, { ...template, id, createdAt: now, updatedAt: now }],
        }));
        return id;
      },
      updateTemplate: (id, updates) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t
          ),
        }));
      },
      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        }));
      },
      getTemplate: (id) => get().templates.find((t) => t.id === id),
      
      // Pipeline operations
      savePipeline: (pipeline) => {
        const id = generateId();
        const now = Date.now();
        set((state) => ({
          pipelines: [...state.pipelines, { ...pipeline, id, createdAt: now, updatedAt: now }],
        }));
        return id;
      },
      updatePipeline: (id, updates) => {
        set((state) => ({
          pipelines: state.pipelines.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p
          ),
        }));
      },
      deletePipeline: (id) => {
        set((state) => ({
          pipelines: state.pipelines.filter((p) => p.id !== id),
        }));
      },
      getPipeline: (id) => get().pipelines.find((p) => p.id === id),
      
      // Bulk operations
      exportAll: () => {
        const { streams, rules, plugins, templates, pipelines } = get();
        return JSON.stringify({ streams, rules, plugins, templates, pipelines }, null, 2);
      },
      importAll: (data) => {
        try {
          const parsed = JSON.parse(data);
          set({
            streams: parsed.streams || [],
            rules: parsed.rules || [],
            plugins: parsed.plugins || [],
            templates: parsed.templates || [],
            pipelines: parsed.pipelines || [],
          });
        } catch (error) {
          console.error("Failed to import configurations:", error);
        }
      },
      clearAll: () => {
        set({
          streams: [],
          rules: [],
          plugins: [],
          templates: [],
          pipelines: [],
        });
      },
    }),
    {
      name: "ekuiper-saved-configurations",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// =============================================================================
// Recent Activity Store
// =============================================================================

interface ActivityEntry {
  id: string;
  type: "create" | "update" | "delete" | "deploy" | "test";
  entity: "stream" | "rule" | "plugin" | "template" | "pipeline";
  name: string;
  timestamp: number;
  details?: string;
}

interface RecentActivityStore {
  activities: ActivityEntry[];
  addActivity: (activity: Omit<ActivityEntry, "id" | "timestamp">) => void;
  clearActivities: () => void;
  getRecentActivities: (limit?: number) => ActivityEntry[];
}

export const useRecentActivityStore = create<RecentActivityStore>()(
  persist(
    (set, get) => ({
      activities: [],
      addActivity: (activity) => {
        const entry: ActivityEntry = {
          ...activity,
          id: generateId(),
          timestamp: Date.now(),
        };
        set((state) => ({
          activities: [entry, ...state.activities].slice(0, 100), // Keep last 100
        }));
      },
      clearActivities: () => set({ activities: [] }),
      getRecentActivities: (limit = 10) => get().activities.slice(0, limit),
    }),
    {
      name: "ekuiper-recent-activity",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
