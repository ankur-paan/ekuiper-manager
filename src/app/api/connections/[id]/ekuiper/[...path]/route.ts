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
}

async function readConnections(): Promise<EKuiperConnection[]> {
  try {
    const data = await fs.readFile(CONNECTIONS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function getConnectionUrl(connectionId: string): Promise<string | null> {
  const connections = await readConnections();
  const connection = connections.find((c) => c.id === connectionId);
  return connection?.url || null;
}

async function proxyToEKuiper(
  request: NextRequest,
  method: string,
  connectionId: string,
  ekuiperPath: string
): Promise<NextResponse> {
  const baseUrl = await getConnectionUrl(connectionId);

  if (!baseUrl) {
    return NextResponse.json(
      { error: "Connection not found", connectionId },
      { status: 404 }
    );
  }

  const targetUrl = `${baseUrl}/${ekuiperPath}`;

  try {
    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = await request.text();
      } catch {
        // No body
      }
    }

    const response = await fetch(targetUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body || undefined,
    });

    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = responseText;
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    console.error(`Error proxying to eKuiper at ${targetUrl}:`, error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to connect to eKuiper",
        details: `Could not reach eKuiper at ${baseUrl}. Make sure eKuiper is running.`,
      },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string; path: string[] }> }
) {
  const params = await props.params;
  const ekuiperPath = params.path.join("/");
  return proxyToEKuiper(request, "GET", params.id, ekuiperPath);
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; path: string[] }> }
) {
  const params = await props.params;
  const ekuiperPath = params.path.join("/");
  return proxyToEKuiper(request, "POST", params.id, ekuiperPath);
}

export async function PUT(
  request: NextRequest,
  props: { params: Promise<{ id: string; path: string[] }> }
) {
  const params = await props.params;
  const ekuiperPath = params.path.join("/");
  return proxyToEKuiper(request, "PUT", params.id, ekuiperPath);
}

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; path: string[] }> }
) {
  const params = await props.params;
  const ekuiperPath = params.path.join("/");
  return proxyToEKuiper(request, "DELETE", params.id, ekuiperPath);
}
