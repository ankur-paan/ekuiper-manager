import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Dynamic API route that proxies all requests to the eKuiper server.
 * This handles CORS issues and allows the frontend to communicate with eKuiper.
 * 
 * The eKuiper base URL is configured via:
 * 1. Query parameter: ?ekuiper_url=http://...
 * 2. Header: X-EKuiper-URL
 * 3. Environment variable: EKUIPER_URL
 * 4. Default: http://localhost:9081
 * 
 * SSRF Protection:
 * - Only allows requests to localhost, loopback, and explicitly allowed hosts
 * - Configure EKUIPER_ALLOWED_HOSTS env var for additional hosts (comma-separated)
 */

/**
 * Validate URL against allowlist to prevent SSRF attacks.
 * Only allows localhost and explicitly configured hosts.
 */
function isAllowedHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // Always allow localhost and loopback addresses
    const localPatterns = [
      'localhost',
      '127.0.0.1',
      '::1',
      '0.0.0.0',
    ];

    if (localPatterns.includes(hostname)) {
      return true;
    }

    // Check for IPv4 loopback range (127.x.x.x)
    if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    // Allow hosts from environment variable (comma-separated)
    const allowedHosts = (process.env.EKUIPER_ALLOWED_HOSTS || '')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(h => h.length > 0);

    if (allowedHosts.includes(hostname)) {
      return true;
    }

    // Allow private network ranges if explicitly enabled
    if (process.env.EKUIPER_ALLOW_PRIVATE_NETWORKS === 'true') {
      // 10.x.x.x
      if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
      // 172.16-31.x.x
      if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
      // 192.168.x.x
      if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    }

    return false;
  } catch {
    return false;
  }
}

function getEKuiperBaseUrl(request: NextRequest): string {
  // Check query parameter first
  const urlParam = request.nextUrl.searchParams.get("ekuiper_url");
  if (urlParam) {
    return normalizeUrl(urlParam);
  }

  // Check header
  const headerUrl = request.headers.get("X-EKuiper-URL");
  if (headerUrl) {
    return normalizeUrl(headerUrl);
  }

  // Fall back to environment variable or default
  const fallback = process.env.EKUIPER_URL || "http://localhost:9081";
  return normalizeUrl(fallback);
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

async function proxyRequest(
  request: NextRequest,
  method: string,
  path: string
): Promise<NextResponse> {
  const baseUrl = getEKuiperBaseUrl(request);

  // SSRF Protection: Validate the target URL against allowlist
  if (!isAllowedHost(baseUrl)) {
    console.warn('SSRF Protection: Blocked request to disallowed host: %s', baseUrl);
    return NextResponse.json(
      { error: 'Target host is not allowed. Only localhost and configured hosts are permitted.' },
      { status: 403 }
    );
  }

  // Ensure baseUrl doesn't end with slash and path doesn't start with slash
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Forward query parameters from the original request (excluding our internal ekuiper_url param)
  const forwardParams = new URLSearchParams(request.nextUrl.searchParams);
  forwardParams.delete("ekuiper_url"); // Remove our proxy-specific param
  const queryString = forwardParams.toString() ? `?${forwardParams.toString()}` : "";
  const targetUrl = `${cleanBaseUrl}${cleanPath}${queryString}`;

  try {
    // Get request body for non-GET requests
    let body: string | undefined;
    if (method !== "GET" && method !== "HEAD") {
      try {
        body = await request.text();
      } catch {
        // No body
      }
    }

    // Set a timeout for the fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Forward the request to eKuiper (URL has been validated by isAllowedHost)
    const response = await fetch(targetUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
      },
      body: body || undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    // Get response data
    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = responseText;
    }

    // Return the response with proper CORS headers
    return NextResponse.json(responseData, {
      status: response.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-EKuiper-URL",
      },
    });
  } catch (error) {
    // Helper function to check if error is connection refused
    const isConnectionError = (err: unknown): boolean => {
      if (!(err instanceof Error)) return false;
      // Check message
      if (err.message.includes("ECONNREFUSED") || err.message.includes("fetch failed")) return true;
      // Check cause (can be an AggregateError)
      if (err.cause) {
        if (typeof err.cause === "object" && "code" in err.cause && err.cause.code === "ECONNREFUSED") return true;
        if (err.cause instanceof Error && err.cause.message?.includes("ECONNREFUSED")) return true;
      }
      return false;
    };

    const isConnErr = isConnectionError(error);

    // Only log non-connection errors to avoid spam
    if (!isConnErr) {
      console.error(`Error proxying request to ${targetUrl}:`, error);
    }

    // Provide user-friendly error message
    let userMessage = "Failed to connect to eKuiper";
    if (isConnErr) {
      userMessage = `Cannot connect to eKuiper at ${baseUrl}. Make sure eKuiper is running.`;
    } else if (error instanceof Error && error.name === "AbortError") {
      userMessage = `Connection to ${baseUrl} timed out.`;
    }

    return NextResponse.json(
      {
        error: userMessage,
        details: `Server: ${baseUrl}`,
      },
      {
        status: 502,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ path?: string[] }> }) {
  const params = await props.params;
  const path = params.path ? params.path.join("/") : "";
  return proxyRequest(request, "GET", path);
}

export async function POST(request: NextRequest, props: { params: Promise<{ path?: string[] }> }) {
  const params = await props.params;
  const path = params.path ? params.path.join("/") : "";
  return proxyRequest(request, "POST", path);
}

export async function PUT(request: NextRequest, props: { params: Promise<{ path?: string[] }> }) {
  const params = await props.params;
  const path = params.path ? params.path.join("/") : "";
  return proxyRequest(request, "PUT", path);
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ path?: string[] }> }) {
  const params = await props.params;
  const path = params.path ? params.path.join("/") : "";
  return proxyRequest(request, "DELETE", path);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-EKuiper-URL",
    },
  });
}
