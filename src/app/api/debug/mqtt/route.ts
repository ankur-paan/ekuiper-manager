
import { NextResponse } from 'next/server';
import mqtt from 'mqtt';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const topic = searchParams.get('topic');
    const timeoutVal = parseInt(searchParams.get('timeout') || '5000');

    if (!topic) {
        return NextResponse.json({ error: 'Missing topic parameter' }, { status: 400 });
    }

    const wsUrlParam = searchParams.get('broker');
    // Default to the WSS URL which we know works for the browser (port 443)
    let connectUrl = wsUrlParam || process.env.NEXT_PUBLIC_EMQX_WS_URL || "wss://mqttws.i-dacs.com:443/mqtt";

    // Allow overriding via backend-specific var if set, but default to WSS
    if (process.env.MQTT_BROKER_URL && !wsUrlParam) {
        connectUrl = process.env.MQTT_BROKER_URL;
    }

    const username = process.env.NEXT_PUBLIC_MQTT_USERNAME || "testmqtt";
    const password = process.env.NEXT_PUBLIC_MQTT_PASSWORD || "test@2025";

    // Basic logging - limit length
    const logUrl = connectUrl.replace(/:[^:]*@/, ':***@'); // hide auth if present
    console.log(`[DebugAPI] Connecting to ${logUrl} (Topic: ${topic})...`);

    return new Promise<NextResponse>((resolve) => {
        let client: mqtt.MqttClient | null = null;
        let resolved = false;

        const safeResolve = (response: NextResponse) => {
            if (!resolved) {
                resolved = true;
                if (client) {
                    try { client.end(true); } catch { }
                    client = null;
                }
                resolve(response);
            }
        };

        const timer = setTimeout(() => {
            safeResolve(NextResponse.json({
                status: 'timeout',
                message: `Connected to ${connectUrl}, but received no message on '${topic}' within ${timeoutVal}ms. Check if the topic is correct and data is flowing.`,
                debug: { url: connectUrl, topic }
            }, { status: 408 }));
        }, timeoutVal);

        try {
            // Determine protocol options
            const options: mqtt.IClientOptions = {
                username,
                password,
                clientId: `dbg_${Math.random().toString(16).substring(2, 8)}`,
                clean: true,
                connectTimeout: 5000,
                rejectUnauthorized: false, // Trust self-signed
                reconnectPeriod: 0, // Disable auto-reconnect for this one-shot test
            };

            client = mqtt.connect(connectUrl, options);

            client.on('connect', () => {
                // console.log('[DebugAPI] Connected. Subscribing...');
                if (!client) return;
                client.subscribe(topic, (err) => {
                    if (err) {
                        console.error('[DebugAPI] Subscribe Error:', err.message);
                        safeResolve(NextResponse.json({ error: 'Subscribe failed', details: err.message }, { status: 500 }));
                    }
                });
            });

            client.on('message', (t, message) => {
                // console.log('[DebugAPI] Message received:', t, message.toString());
                const msgStr = message.toString();
                let payload = msgStr;
                try { payload = JSON.parse(msgStr); } catch { }

                clearTimeout(timer);
                safeResolve(NextResponse.json({
                    status: 'success',
                    topic: t,
                    payload
                }));
            });

            client.on('error', (err) => {
                console.error('[DebugAPI] Client Error:', err.message);
                clearTimeout(timer);
                safeResolve(NextResponse.json({ error: 'MQTT Client Error', details: err.message }, { status: 500 }));
            });

        } catch (e: any) {
            console.error('[DebugAPI] Sync Error:', e);
            clearTimeout(timer);
            safeResolve(NextResponse.json({ error: 'Exception', details: e.message }, { status: 500 }));
        }
    });
}
