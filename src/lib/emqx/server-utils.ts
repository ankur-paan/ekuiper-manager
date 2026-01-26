import { NextResponse } from 'next/server';

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getEmqxToken(): Promise<string | null> {
    // Check cache
    if (cachedToken && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    const baseUrl = process.env.MQTT_API_URL || "http://localhost:18083";
    const username = process.env.MQTT_API_USERNAME;
    const password = process.env.MQTT_API_PASSWORD;

    if (!username || !password) {
        console.error('[EMQX Auth] Missing server-side credentials');
        return null;
    }

    try {
        console.log('[EMQX Auth] Fetching new token...');
        const response = await fetch(`${baseUrl}/api/v5/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            console.error('[EMQX Auth] Login failed:', await response.text());
            return null;
        }

        const data = await response.json();
        cachedToken = data.token;
        // Expire slightly before actual expiry (usually 1h, allow 55m)
        tokenExpiry = Date.now() + (55 * 60 * 1000);

        return cachedToken;
    } catch (error) {
        console.error('[EMQX Auth] Exception:', error);
        return null;
    }
}
