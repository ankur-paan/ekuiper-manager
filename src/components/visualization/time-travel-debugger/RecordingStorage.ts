import { openDB, DBSchema, IDBPDatabase } from "idb";

// Types
export interface DebugEvent {
  id: string;
  timestamp: Date;
  type: "input" | "processing" | "output" | "error";
  data: Record<string, any>;
  state?: Record<string, any>;
  metadata?: {
    processingTime?: number;
    memoryUsage?: number;
    [key: string]: any;
  };
}

export interface RecordingSession {
  id: string;
  name: string;
  streamName: string;
  ruleName: string;
  startTime: Date;
  endTime?: Date;
  events: DebugEvent[];
  status: "recording" | "stopped";
  tags?: string[];
  notes?: string;
}

// IndexedDB Schema
interface DebugDBSchema extends DBSchema {
  sessions: {
    key: string;
    value: RecordingSession;
    indexes: {
      "by-date": Date;
      "by-stream": string;
      "by-rule": string;
    };
  };
}

const DB_NAME = "ekuiper-debug-sessions";
const DB_VERSION = 1;

class RecordingStorageClass {
  private db: IDBPDatabase<DebugDBSchema> | null = null;

  private async getDB(): Promise<IDBPDatabase<DebugDBSchema>> {
    if (this.db) return this.db;

    this.db = await openDB<DebugDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore("sessions", {
          keyPath: "id",
        });
        store.createIndex("by-date", "startTime");
        store.createIndex("by-stream", "streamName");
        store.createIndex("by-rule", "ruleName");
      },
    });

    return this.db;
  }

  async saveSession(session: RecordingSession): Promise<void> {
    const db = await this.getDB();
    await db.put("sessions", session);
  }

  async getSession(id: string): Promise<RecordingSession | undefined> {
    const db = await this.getDB();
    return db.get("sessions", id);
  }

  async getAllSessions(): Promise<RecordingSession[]> {
    const db = await this.getDB();
    const sessions = await db.getAll("sessions");
    // Sort by date, newest first
    return sessions.sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  async getSessionsByStream(streamName: string): Promise<RecordingSession[]> {
    const db = await this.getDB();
    return db.getAllFromIndex("sessions", "by-stream", streamName);
  }

  async getSessionsByRule(ruleName: string): Promise<RecordingSession[]> {
    const db = await this.getDB();
    return db.getAllFromIndex("sessions", "by-rule", ruleName);
  }

  async deleteSession(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete("sessions", id);
  }

  async clearAllSessions(): Promise<void> {
    const db = await this.getDB();
    await db.clear("sessions");
  }

  async getSessionCount(): Promise<number> {
    const db = await this.getDB();
    return db.count("sessions");
  }

  async exportAllSessions(): Promise<string> {
    const sessions = await this.getAllSessions();
    return JSON.stringify(sessions, null, 2);
  }

  async importSessions(data: string): Promise<number> {
    const sessions = JSON.parse(data) as RecordingSession[];
    const db = await this.getDB();

    for (const session of sessions) {
      // Generate new IDs to avoid conflicts
      session.id = `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      session.startTime = new Date(session.startTime);
      if (session.endTime) session.endTime = new Date(session.endTime);
      session.events = session.events.map((e) => ({
        ...e,
        timestamp: new Date(e.timestamp),
      }));
      await db.put("sessions", session);
    }

    return sessions.length;
  }
}

// Singleton instance
export const RecordingStorage = new RecordingStorageClass();

// Fallback for environments without IndexedDB
export class InMemoryRecordingStorage {
  private sessions: Map<string, RecordingSession> = new Map();

  async saveSession(session: RecordingSession): Promise<void> {
    this.sessions.set(session.id, session);
  }

  async getSession(id: string): Promise<RecordingSession | undefined> {
    return this.sessions.get(id);
  }

  async getAllSessions(): Promise<RecordingSession[]> {
    return Array.from(this.sessions.values()).sort(
      (a, b) =>
        new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async clearAllSessions(): Promise<void> {
    this.sessions.clear();
  }
}
