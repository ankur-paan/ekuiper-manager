import { NextResponse } from 'next/server';
import { EKuiperClient } from '@/lib/ekuiper/client';

export const dynamic = 'force-dynamic';

/**
 * Server-side log capture API (backup for client-side capture).
 * This is used when client-side capture isn't available or fails.
 */
// Maximum allowed capture duration (60 seconds) to prevent resource exhaustion
const MAX_CAPTURE_DURATION_MS = 60_000;
const MIN_CAPTURE_DURATION_MS = 1_000;
const DEFAULT_CAPTURE_DURATION_MS = 10_000;

export async function POST(req: Request) {
    try {
        const { ruleIds, duration, serverUrl } = await req.json();

        // Validate and sanitize duration to prevent resource exhaustion (CodeQL fix)
        let parsedDuration = Number(duration);
        if (!Number.isFinite(parsedDuration) || parsedDuration < MIN_CAPTURE_DURATION_MS) {
            parsedDuration = DEFAULT_CAPTURE_DURATION_MS;
        }
        const safeDuration = Math.min(parsedDuration, MAX_CAPTURE_DURATION_MS);

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
        console.log(`Capture Logs: Started tracing for ${startedRules.length}/${ruleIds.length} rules`);

        if (startedRules.length === 0) {
            return NextResponse.json({
                error: "Failed to start tracing on any rule",
                captured: {}
            }, { status: 500 });
        }

        // 2. Wait for the sanitized duration to capture data
        await new Promise(resolve => setTimeout(resolve, safeDuration));

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
