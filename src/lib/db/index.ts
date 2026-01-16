/**
 * Local JSON-based Database using LowDB
 * Starts automatically with Next.js and persists data to .data/db.json
 */

import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "path";
import fs from "fs";

// Database schema types
export interface ServerConnection {
  id: string;
  name: string;
  url: string;
  description?: string;
  status: "connected" | "disconnected" | "error" | "unknown";
  createdAt: string;
  lastConnected?: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  sql: string;
  serverId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  resource: string;
  resourceId?: string;
  serverId: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface AppSettings {
  theme: "dark" | "light" | "system";
  healthCheckInterval: number;
  autoRefreshInterval: number;
  defaultServerId: string | null;
  showNotifications: boolean;
}

export interface DatabaseSchema {
  servers: ServerConnection[];
  savedQueries: SavedQuery[];
  activityLogs: ActivityLog[];
  settings: AppSettings;
  version: number;
}

// Default data
const defaultData: DatabaseSchema = {
  servers: [
    {
      id: "localhost",
      name: "Localhost",
      url: "http://localhost:9081",
      description: "Local eKuiper instance",
      status: "unknown",
      createdAt: new Date().toISOString(),
    },
  ],
  savedQueries: [],
  activityLogs: [],
  settings: {
    theme: "dark",
    healthCheckInterval: 30000,
    autoRefreshInterval: 30000,
    defaultServerId: "localhost",
    showNotifications: true,
  },
  version: 1,
};

// Singleton database instance
let db: Low<DatabaseSchema> | null = null;

/**
 * Get or create the database instance
 */
export async function getDb(): Promise<Low<DatabaseSchema>> {
  if (db) return db;

  // Ensure data directory exists
  const dataDir = path.join(process.cwd(), ".data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, "db.json");
  const adapter = new JSONFile<DatabaseSchema>(dbPath);
  db = new Low(adapter, defaultData);

  // Read existing data or initialize
  await db.read();

  // If no data, set defaults
  if (!db.data) {
    db.data = defaultData;
    await db.write();
  }

  console.log(`[DB] Initialized at ${dbPath}`);
  return db;
}

/**
 * Reset database to default state
 */
export async function resetDb(): Promise<void> {
  const database = await getDb();
  database.data = defaultData;
  await database.write();
}

// CRUD helpers for servers
export const serversDb = {
  async getAll(): Promise<ServerConnection[]> {
    const database = await getDb();
    return database.data.servers;
  },

  async getById(id: string): Promise<ServerConnection | undefined> {
    const database = await getDb();
    return database.data.servers.find((s) => s.id === id);
  },

  async create(server: Omit<ServerConnection, "id" | "createdAt" | "status">): Promise<ServerConnection> {
    const database = await getDb();
    const newServer: ServerConnection = {
      ...server,
      id: `server-${Date.now()}`,
      status: "unknown",
      createdAt: new Date().toISOString(),
    };
    database.data.servers.push(newServer);
    await database.write();
    return newServer;
  },

  async update(id: string, updates: Partial<ServerConnection>): Promise<ServerConnection | null> {
    const database = await getDb();
    const index = database.data.servers.findIndex((s) => s.id === id);
    if (index === -1) return null;

    database.data.servers[index] = { ...database.data.servers[index], ...updates };
    await database.write();
    return database.data.servers[index];
  },

  async delete(id: string): Promise<boolean> {
    const database = await getDb();
    const index = database.data.servers.findIndex((s) => s.id === id);
    if (index === -1) return false;

    database.data.servers.splice(index, 1);
    await database.write();
    return true;
  },
};

// CRUD helpers for saved queries
export const queriesDb = {
  async getAll(): Promise<SavedQuery[]> {
    const database = await getDb();
    return database.data.savedQueries;
  },

  async getByServerId(serverId: string): Promise<SavedQuery[]> {
    const database = await getDb();
    return database.data.savedQueries.filter((q) => q.serverId === serverId);
  },

  async create(query: Omit<SavedQuery, "id" | "createdAt" | "updatedAt">): Promise<SavedQuery> {
    const database = await getDb();
    const now = new Date().toISOString();
    const newQuery: SavedQuery = {
      ...query,
      id: `query-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    database.data.savedQueries.push(newQuery);
    await database.write();
    return newQuery;
  },

  async update(id: string, updates: Partial<SavedQuery>): Promise<SavedQuery | null> {
    const database = await getDb();
    const index = database.data.savedQueries.findIndex((q) => q.id === id);
    if (index === -1) return null;

    database.data.savedQueries[index] = {
      ...database.data.savedQueries[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await database.write();
    return database.data.savedQueries[index];
  },

  async delete(id: string): Promise<boolean> {
    const database = await getDb();
    const index = database.data.savedQueries.findIndex((q) => q.id === id);
    if (index === -1) return false;

    database.data.savedQueries.splice(index, 1);
    await database.write();
    return true;
  },
};

// Activity logging
export const activityDb = {
  async log(entry: Omit<ActivityLog, "id" | "timestamp">): Promise<ActivityLog> {
    const database = await getDb();
    const newEntry: ActivityLog = {
      ...entry,
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
    database.data.activityLogs.push(newEntry);
    
    // Keep only last 1000 entries
    if (database.data.activityLogs.length > 1000) {
      database.data.activityLogs = database.data.activityLogs.slice(-1000);
    }
    
    await database.write();
    return newEntry;
  },

  async getRecent(limit = 50): Promise<ActivityLog[]> {
    const database = await getDb();
    return database.data.activityLogs.slice(-limit).reverse();
  },

  async clear(): Promise<void> {
    const database = await getDb();
    database.data.activityLogs = [];
    await database.write();
  },
};

// Settings
export const settingsDb = {
  async get(): Promise<AppSettings> {
    const database = await getDb();
    return database.data.settings;
  },

  async update(updates: Partial<AppSettings>): Promise<AppSettings> {
    const database = await getDb();
    database.data.settings = { ...database.data.settings, ...updates };
    await database.write();
    return database.data.settings;
  },
};
