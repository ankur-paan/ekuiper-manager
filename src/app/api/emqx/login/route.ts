import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        const baseUrl = process.env.MQTT_API_URL || "http://localhost:18083";

        // EMQX 5.x Login endpoint
        const response = await fetch(`${baseUrl}/api/v5/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Auth failed' }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
