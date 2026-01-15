import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const CONNECTIONS_FILE = path.join(DATA_DIR, "connections.json");

interface EKuiperConnection {
  id: string;
  name: string;
  url: string;
  description?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // Directory exists
  }
}

async function readConnections(): Promise<EKuiperConnection[]> {
  await ensureDataDir();
  try {
    const data = await fs.readFile(CONNECTIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeConnections(connections: EKuiperConnection[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(CONNECTIONS_FILE, JSON.stringify(connections, null, 2));
}

/**
 * GET /api/connections - List all saved eKuiper connections
 */
export async function GET() {
  try {
    const connections = await readConnections();
    return NextResponse.json(connections);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read connections" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/connections - Create a new eKuiper connection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, description, isDefault } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: "Name and URL are required" },
        { status: 400 }
      );
    }

    const connections = await readConnections();

    // If this is set as default, unset other defaults
    if (isDefault) {
      connections.forEach((c) => (c.isDefault = false));
    }

    const newConnection: EKuiperConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      url,
      description,
      isDefault: isDefault || connections.length === 0, // First connection is default
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    connections.push(newConnection);
    await writeConnections(connections);

    return NextResponse.json(newConnection, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create connection" },
      { status: 500 }
    );
  }
}
