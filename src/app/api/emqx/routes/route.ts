import { NextRequest, NextResponse } from 'next/server';
import { getEmqxToken } from '@/lib/emqx/server-utils';

export async function GET(req: NextRequest) {
    // Ignore client token, use server-side managed token
    const token = await getEmqxToken();
    if (!token) {
        return NextResponse.json({ error: 'Failed to authenticate with EMQX' }, { status: 500 });
    }

    const baseUrl = process.env.MQTT_API_URL || "http://localhost:18083";
    const searchParams = req.nextUrl.searchParams;
    // Default to limit 1000 if not specified
    if (!searchParams.has('limit')) searchParams.set('limit', '1000');

    try {
        const url = `${baseUrl}/api/v5/topics?${searchParams.toString()}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Proxy] EMQX Error ${response.status}: ${errorText}`);
            return NextResponse.json({ error: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("[Proxy] Exception:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
