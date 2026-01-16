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

async function readConnections(): Promise<EKuiperConnection[]> {
  try {
    const data = await fs.readFile(CONNECTIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeConnections(connections: EKuiperConnection[]): Promise<void> {
  await fs.writeFile(CONNECTIONS_FILE, JSON.stringify(connections, null, 2));
}

/**
 * GET /api/connections/[id] - Get a specific connection
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const connections = await readConnections();
  const connection = connections.find((c) => c.id === params.id);

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  return NextResponse.json(connection);
}

/**
 * PUT /api/connections/[id] - Update a connection
 */
export async function PUT(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const body = await request.json();
    const connections = await readConnections();
    const index = connections.findIndex((c) => c.id === params.id);

    if (index === -1) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    // If setting as default, unset others
    if (body.isDefault) {
      connections.forEach((c) => (c.isDefault = false));
    }

    connections[index] = {
      ...connections[index],
      ...body,
      id: params.id, // Prevent ID change
      updatedAt: new Date().toISOString(),
    };

    await writeConnections(connections);
    return NextResponse.json(connections[index]);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update connection" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/connections/[id] - Delete a connection
 */
export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const connections = await readConnections();
    const index = connections.findIndex((c) => c.id === params.id);

    if (index === -1) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    const wasDefault = connections[index].isDefault;
    connections.splice(index, 1);

    // If deleted connection was default, make another one default
    if (wasDefault && connections.length > 0) {
      connections[0].isDefault = true;
    }

    await writeConnections(connections);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete connection" },
      { status: 500 }
    );
  }
}
