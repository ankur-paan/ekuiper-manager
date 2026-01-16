import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper function to check if error is connection refused
function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Check message
  if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed")) return true;
  // Check cause (can be an AggregateError)
  if (err.cause) {
    if (typeof err.cause === "object" && "code" in err.cause && err.cause.code === "ECONNREFUSED") return true;
    if (err.cause instanceof Error && err.cause.message?.includes("ECONNREFUSED")) return true;
  }
  return false;
}

// Ensure URL has a protocol
function normalizeUrl(url: string): string {
  if (!url) return url;
  // If URL doesn't start with http:// or https://, add https://
  if (!url.match(/^https?:\/\//i)) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Test connection to an eKuiper instance
 * POST /api/ekuiper/test-connection
 * Body: { url: "http://ekuiper-host:9081" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { url } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, message: "URL is required" },
        { status: 400 }
      );
    }

    // Normalize URL to ensure it has a protocol
    url = normalizeUrl(url);

    // Test by calling the ping endpoint (or just check if we can reach the server)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      // First try /ping endpoint (available in newer eKuiper versions)
      let response = await fetch(`${url}/ping`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return NextResponse.json({
          success: true,
          message: "Connected successfully to eKuiper",
          version: await response.text().catch(() => "unknown"),
        });
      }

      // If ping fails, try to list streams as a connectivity check
      response = await fetch(`${url}/streams`, {
        method: "GET",
        signal: controller.signal,
      });

      if (response.ok) {
        return NextResponse.json({
          success: true,
          message: "Connected successfully to eKuiper",
        });
      }

      return NextResponse.json({
        success: false,
        message: `eKuiper responded with status ${response.status}`,
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json({
          success: false,
          message: "Connection timeout - eKuiper did not respond within 5 seconds",
        });
      }

      // Check for connection refused errors
      if (isConnectionError(fetchError)) {
        return NextResponse.json({
          success: false,
          message: `Cannot connect to ${url}. Make sure eKuiper is running and accessible.`,
        });
      }

      throw fetchError;
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
        details: "Make sure eKuiper is running and accessible from this server",
      },
      { status: 200 } // Return 200 so client can read the error message
    );
  }
}
