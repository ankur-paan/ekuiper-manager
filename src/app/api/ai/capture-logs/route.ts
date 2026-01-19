import { NextResponse } from 'next/server';
import { EKuiperClient } from '@/lib/ekuiper/client';

export const dynamic = 'force-dynamic';

/**
 * Server-side log capture API (backup for client-side capture).
 * This is used when client-side capture isn't available or fails.
 */

/**
 * Allowlist of safe capture durations (in milliseconds).
 * Using hardcoded values to prevent resource exhaustion attacks (CWE-400).
 * User provides 'durationLevel' (0-4) which maps to these safe constants.
 */
const ALLOWED_DURATIONS_MS = [
    5_000,   // Level 0: 5 seconds (quick capture)
    10_000,  // Level 1: 10 seconds (default)
    20_000,  // Level 2: 20 seconds
    30_000,  // Level 3: 30 seconds
    60_000,  // Level 4: 60 seconds (maximum)
] as const;

const DEFAULT_DURATION_LEVEL = 1; // 10 seconds

/**
 * Get a safe duration from the allowlist based on user-provided level.
 * This completely breaks the taint chain from user input to setTimeout.
 */
function getSafeDuration(durationLevel: unknown): number {
    const level = Number(durationLevel);
    // Validate level is a valid index, otherwise use default
    if (!Number.isInteger(level) || level < 0 || level >= ALLOWED_DURATIONS_MS.length) {
        return ALLOWED_DURATIONS_MS[DEFAULT_DURATION_LEVEL];
    }
    return ALLOWED_DURATIONS_MS[level];
}

export async function POST(req: Request) {
    try {
        const { ruleIds, durationLevel, serverUrl } = await req.json();

        // Get safe duration from allowlist - no user-controlled values reach setTimeout
        const captureDuration = getSafeDuration(durationLevel);

        if (!ruleIds || !Array.isArray(ruleIds) || ruleIds.length === 0) {
            return NextResponse.json({ error: "No rules specified for tracing" }, { status: 400 });
        }

        if (!serverUrl) {
            return NextResponse.json({ error: "No server URL provided" }, { status: 400 });
        }

        // Use the standard client with proper proxy routing
        const client = new EKuiperClient();
        client.setBaseUrl(serverUrl);

        // 1. Start tracing for all requested rules
        const startResults = await Promise.allSettled(
            ruleIds.map(id => client.startRuleTrace(id, "always"))
        );

        const startedRules = ruleIds.filter((_, i) => startResults[i].status === 'fulfilled');
        console.log('Capture Logs: Started tracing for %d/%d rules', startedRules.length, ruleIds.length);

        if (startedRules.length === 0) {
            return NextResponse.json({
                error: "Failed to start tracing on any rule",
                captured: {}
            }, { status: 500 });
        }

        // 2. Wait for allowed duration to capture data (uses only allowlist values)
        await new Promise(resolve => setTimeout(resolve, captureDuration));

        // 3. Stop tracing and collect data
        const results: Record<string, any[]> = {};

        for (const id of startedRules) {
            try {
                await client.stopRuleTrace(id);

                // Small delay to allow persistence
                await new Promise(resolve => setTimeout(resolve, 1500));

                const traceIds = await client.getRuleTraceIds(id);

                // Get last 10 traces for this rule
                const recentIds = Array.isArray(traceIds) ? traceIds.slice(-10) : [];

                const traceDetails = await Promise.allSettled(
                    recentIds.map(tId => client.getTraceDetail(tId))
                );

                results[id] = traceDetails
                    .filter(r => r.status === 'fulfilled')
                    .map(r => (r as PromiseFulfilledResult<any>).value);

            } catch (e: any) {
                // Use safe logging pattern to prevent format string injection (CodeQL fix)
                console.error('Failed to collect trace for %s:', String(id), e);
                results[id] = [];
            }
        }

        return NextResponse.json({
            captured: results,
            message: `Captured logs from ${Object.keys(results).length} rules`
        });

    } catch (e: any) {
        console.error("Capture Logs API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
