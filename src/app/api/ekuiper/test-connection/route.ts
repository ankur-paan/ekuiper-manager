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

// SSRF Protection: Validate URL to prevent requests to internal/private networks
function isValidExternalUrl(urlString: string): { valid: boolean; reason?: string } {
  try {
    const parsedUrl = new URL(urlString);

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return { valid: false, reason: "Only HTTP and HTTPS protocols are allowed" };
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Block localhost and loopback addresses
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return { valid: false, reason: "Localhost addresses are not allowed" };
    }

    // Block private IPv4 ranges
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b, c] = ipv4Match.map(Number);
      // 10.0.0.0/8
      if (a === 10) {
        return { valid: false, reason: "Private IP addresses (10.x.x.x) are not allowed" };
      }
      // 172.16.0.0/12
      if (a === 172 && b >= 16 && b <= 31) {
        return { valid: false, reason: "Private IP addresses (172.16-31.x.x) are not allowed" };
      }
      // 192.168.0.0/16
      if (a === 192 && b === 168) {
        return { valid: false, reason: "Private IP addresses (192.168.x.x) are not allowed" };
      }
      // 169.254.0.0/16 (link-local)
      if (a === 169 && b === 254) {
        return { valid: false, reason: "Link-local addresses are not allowed" };
      }
      // 0.0.0.0
      if (a === 0) {
        return { valid: false, reason: "Invalid IP address" };
      }
    }

    // Block common internal hostnames
    const blockedPatterns = [
      /^internal\./i,
      /^intranet\./i,
      /^private\./i,
      /\.local$/i,
      /\.internal$/i,
      /\.corp$/i,
      /\.lan$/i,
    ];
    for (const pattern of blockedPatterns) {
      if (pattern.test(hostname)) {
        return { valid: false, reason: "Internal hostnames are not allowed" };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }
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

    // SSRF Protection: Validate URL before making request
    const validation = isValidExternalUrl(url);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, message: validation.reason || "Invalid URL" },
        { status: 400 }
      );
    }

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
