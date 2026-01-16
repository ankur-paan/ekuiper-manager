/**
 * Database API Routes
 * Provides REST API access to the local JSON database
 */

import { NextRequest, NextResponse } from "next/server";
import { serversDb, queriesDb, activityDb, settingsDb, getDb } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");

  try {
    // Initialize DB on first request
    await getDb();

    switch (resource) {
      case "servers":
        return NextResponse.json(await serversDb.getAll());

      case "queries": {
        const serverId = searchParams.get("serverId");
        if (serverId) {
          return NextResponse.json(await queriesDb.getByServerId(serverId));
        }
        return NextResponse.json(await queriesDb.getAll());
      }

      case "activity": {
        const limit = parseInt(searchParams.get("limit") || "50", 10);
        return NextResponse.json(await activityDb.getRecent(limit));
      }

      case "settings":
        return NextResponse.json(await settingsDb.get());

      default:
        return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
    }
  } catch (error) {
    console.error("[DB API] Error:", error);
    return NextResponse.json(
      { error: "Database error", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");

  try {
    const body = await request.json();

    switch (resource) {
      case "servers":
        return NextResponse.json(await serversDb.create(body));

      case "queries":
        return NextResponse.json(await queriesDb.create(body));

      case "activity":
        return NextResponse.json(await activityDb.log(body));

      default:
        return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
    }
  } catch (error) {
    console.error("[DB API] Error:", error);
    return NextResponse.json(
      { error: "Database error", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");
  const id = searchParams.get("id");

  try {
    const body = await request.json();

    switch (resource) {
      case "servers":
        if (!id) {
          return NextResponse.json({ error: "ID required" }, { status: 400 });
        }
        const updatedServer = await serversDb.update(id, body);
        if (!updatedServer) {
          return NextResponse.json({ error: "Server not found" }, { status: 404 });
        }
        return NextResponse.json(updatedServer);

      case "queries":
        if (!id) {
          return NextResponse.json({ error: "ID required" }, { status: 400 });
        }
        const updatedQuery = await queriesDb.update(id, body);
        if (!updatedQuery) {
          return NextResponse.json({ error: "Query not found" }, { status: 404 });
        }
        return NextResponse.json(updatedQuery);

      case "settings":
        return NextResponse.json(await settingsDb.update(body));

      default:
        return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
    }
  } catch (error) {
    console.error("[DB API] Error:", error);
    return NextResponse.json(
      { error: "Database error", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resource = searchParams.get("resource");
  const id = searchParams.get("id");

  try {
    switch (resource) {
      case "servers":
        if (!id) {
          return NextResponse.json({ error: "ID required" }, { status: 400 });
        }
        const deletedServer = await serversDb.delete(id);
        if (!deletedServer) {
          return NextResponse.json({ error: "Server not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true });

      case "queries":
        if (!id) {
          return NextResponse.json({ error: "ID required" }, { status: 400 });
        }
        const deletedQuery = await queriesDb.delete(id);
        if (!deletedQuery) {
          return NextResponse.json({ error: "Query not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true });

      case "activity":
        await activityDb.clear();
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json({ error: "Invalid resource" }, { status: 400 });
    }
  } catch (error) {
    console.error("[DB API] Error:", error);
    return NextResponse.json(
      { error: "Database error", details: String(error) },
      { status: 500 }
    );
  }
}
