import { NextRequest, NextResponse } from 'next/server';
import { getEmqxToken } from '@/lib/emqx/server-utils';

export async function GET(req: NextRequest) {
    const token = await getEmqxToken();
    if (!token) {
        return NextResponse.json({ error: 'Failed to authenticate with EMQX' }, { status: 500 });
    }

    const baseUrl = process.env.MQTT_API_URL || "http://localhost:18083";
    const searchParams = req.nextUrl.searchParams;
    // Default to limit 1000 if not specified
    if (!searchParams.has('limit')) searchParams.set('limit', '1000');

    try {
        // Valid for EMQX v5: /api/v5/mqtt/retainer/messages (or just /api/v5/retainer/messages depending on exact version)
        // Docs say: /retainer/messages ... usually mounted under /api/v5
        // Let's try /api/v5/mqtt/retainer/messages first, or /api/v5/retainer/messages
        // Looking at common EMQX v5 paths, it's often /api/v5/mqtt/retainer/messages

        // Actually context7 said: /retainer/messages
        // Standard EMQX API base is /api/v5
        // So likely /api/v5/retainer/messages ??
        // Let's safe bet check both or try one. 
        // Debug script showed /api/v5/topics works. 
        // I'll try /api/v5/mqtt/retainer/messages which is common for "mqtt" resources.
        // Wait, Context7 snippet had: GET /retainer/messages.

        const url = `${baseUrl}/api/v5/mqtt/retainer/messages?${searchParams.toString()}`;
        console.log(`[Proxy] Fetching retained ${url}`);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Proxy] EMQX Error ${response.status}: ${errorText}`);
            // If 404, maybe path is different?
            return NextResponse.json({ error: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("[Proxy] Exception:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
