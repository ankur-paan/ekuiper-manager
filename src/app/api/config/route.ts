import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Defaults to auto, but we want to ensure we read fresh env vars

export async function GET() {
    return NextResponse.json({
        ekuiper: {
            url: process.env.EKUIPER_API_URL || process.env.EKUIPER_URL || "http://localhost:9081",
        },
        emqx: {
            url: process.env.MQTT_API_URL || process.env.NEXT_PUBLIC_EMQX_URL || "http://localhost:18083",
            wsUrl: process.env.MQTT_WS_URL || process.env.NEXT_PUBLIC_EMQX_WS_URL || "ws://localhost:8083/mqtt",
            brokerUrl: process.env.MQTT_BROKER_URL || "mqtts://mqtt.i-dacs.com:8883", // Start smart default
            username: process.env.MQTT_USERNAME || process.env.NEXT_PUBLIC_MQTT_USERNAME || "admin",
            password: process.env.MQTT_PASSWORD || process.env.NEXT_PUBLIC_MQTT_PASSWORD || "public",
        },
        supabase: {
            url: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
            key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
        }
    });
}
