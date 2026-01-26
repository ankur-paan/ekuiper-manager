
import { NextRequest, NextResponse } from 'next/server';
import mqtt from 'mqtt';

// Prevent Next.js from caching this route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const topic = request.nextUrl.searchParams.get('topic');

    if (!topic) {
        return NextResponse.json({ error: 'Missing topic' }, { status: 400 });
    }

    const wsUrl = process.env.NEXT_PUBLIC_EMQX_WS_URL || "wss://mqttws.i-dacs.com:443/mqtt";
    const username = process.env.NEXT_PUBLIC_MQTT_USERNAME || "testmqtt";
    const password = process.env.NEXT_PUBLIC_MQTT_PASSWORD || "test@2025";

    // Allow override
    const brokerUrl = request.nextUrl.searchParams.get('broker') || wsUrl;

    const encoder = new TextEncoder();

    // Create a streaming response
    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: any) => {
                const message = `data: ${JSON.stringify(data)}\n\n`;
                controller.enqueue(encoder.encode(message));
            };

            // Send initial connection status
            sendEvent({ type: 'status', message: `Connecting to ${brokerUrl}...` });

            const client = mqtt.connect(brokerUrl, {
                username,
                password,
                clientId: `sse_${Math.random().toString(16).substring(2, 8)}`,
                clean: true,
                connectTimeout: 5000,
                rejectUnauthorized: false
            });

            client.on('connect', () => {
                sendEvent({ type: 'status', message: `Connected! Subscribing to ${topic}...` });
                client.subscribe(topic, (err) => {
                    if (err) {
                        sendEvent({ type: 'error', message: `Subscribe failed: ${err.message}` });
                    } else {
                        sendEvent({ type: 'status', message: `Subscribed to ${topic}` });
                    }
                });
            });

            client.on('message', (t, msg) => {
                const str = msg.toString();
                let payload: any = str;
                try {
                    if (str && (str.startsWith('{') || str.startsWith('[') || str.startsWith('"') || !isNaN(Number(str)))) {
                        payload = JSON.parse(str);
                    }
                } catch {
                    payload = str;
                }

                sendEvent({
                    type: 'message',
                    topic: t,
                    payload: payload ?? str ?? "", // Absolute fallback
                    ts: new Date().toISOString()
                });
            });

            client.on('error', (err) => {
                sendEvent({ type: 'error', message: `MQTT Error: ${err.message}` });
            });

            client.on('close', () => {
                // sendEvent({ type: 'status', message: 'Connection closed' });
            });

            // Cleanup when the connection is closed by client
            request.signal.addEventListener('abort', () => {
                console.log(`[SSE] Client disconnected for ${topic}`);
                client.end();
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
        },
    });
}
