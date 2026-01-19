import { NextResponse } from 'next/server';
import { generateOpenRouterChat } from '@/lib/openrouter/client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { messages, context, modelName } = await req.json();
        const targetModel = modelName || "google/gemini-flash-1.5";

        const systemInstruction = `
        You are the "Master AI Assistant" for an eKuiper deployment.
        You have global access to the entire state of the edge computing engine.
        
        GLOBAL CONTEXT:
        - SYSTEM INFO: ${JSON.stringify(context.systemInfo, null, 2)}
        - STREAMS: ${JSON.stringify(context.streams, null, 2)}
        - RULES: ${JSON.stringify(context.rules, null, 2)}
        - TABLES: ${JSON.stringify(context.tables, null, 2)}
        - RULE STATUSES & METRICS: ${JSON.stringify(context.statuses, null, 2)}
        - LIVE TRACE DATA (LOGS): ${JSON.stringify(context.traceData, null, 2)}
        - AVAILABLE SOURCES: ${JSON.stringify(context.meta?.sources || [], null, 2)}
        - AVAILABLE SINKS: ${JSON.stringify(context.meta?.sinks || [], null, 2)}
        - SERVICES: ${JSON.stringify(context.meta?.services || [], null, 2)}
        - CONFIGURATIONS (RESOLVED CONF KEYS): ${JSON.stringify(context.meta?.configs || {}, null, 2)}
        
        MISSION:
        - Provide a high-level overview of the entire system.
        - Analyze the LIVE TRACE DATA (LOGS) deeply. Look into the 'Attribute' keys of spans to find actual values of metrics (e.g., "active_power", "temperature", etc.).
        - NOTE: Metrics are often inside a stringified JSON string within an attribute (e.g., in a "value" or "payload" key). You SHOULD try to parse stringified JSON if found.
        - If a user asks for a specific value (like active power), scan the trace attributes for it.
        - Use the Rule and Stream SQL definitions to understand the schema and what fields are available.
        - Help the user understand how streams, tables, and rules are connected.
        - Identify global performance bottlenecks across all rules.
        - Troubleshoot system-wide issues (e.g., if multiple rules are failing due to a shared source).
        - Act as a senior architect for edge computing.
        
        CAPABILITIES:
        - You can explain what any rule does based on its ID and metrics.
        - You can suggest new rules based on existing streams.
        - You can analyze resource usage (CPU/Memory) reported in system info relative to rule activity.
        
        BEHAVIOR:
        1. Professional, authoritative, yet helpful.
        2. Use rich markdown for formatting.
        3. For complex answers, use H2/H3 headers.
        4. If rules are stopped or failing, highlight them immediately.
        
        OUTPUT FORMAT:
        Always return a JSON object with:
        {
          "message": "Your comprehensive analysis or answer (supports markdown)"
        }
        `;

        // Message Normalization to satisfy "alternating roles" strictness
        const normalizedMessages = [
            { role: 'system', content: systemInstruction }
        ];

        for (const msg of messages) {
            let role = msg.role;
            let content = msg.content;

            // Map frontend 'system' events to 'user' inputs
            if (role === 'system') {
                role = 'user';
                content = `[SYSTEM EVENT]: ${content}`;
            }

            const lastMsg = normalizedMessages[normalizedMessages.length - 1];

            // If incoming role matches last role (e.g. User -> User), merge content
            // Exception: The very first global system prompt can be followed by anything (usually User)
            if (lastMsg.role === role && role !== 'system') {
                lastMsg.content += `\n\n${content}`;
            } else {
                normalizedMessages.push({ role, content });
            }
        }

        const text = await generateOpenRouterChat(targetModel, normalizedMessages);

        // Robust JSON extraction
        // 1. Remove markdown code blocks
        let cleanText = text.replace(/```json/g, '').replace(/```/g, '');

        // 2. Find the JSON object (first { to last })
        const start = cleanText.indexOf('{');
        const end = cleanText.lastIndexOf('}');

        let data;
        if (start !== -1 && end !== -1) {
            try {
                const jsonStr = cleanText.substring(start, end + 1);
                data = JSON.parse(jsonStr);
            } catch (e) {
                console.warn("Failed to parse extracted JSON in Master Chat", e);
                data = { message: text };
            }
        } else {
            console.warn("No JSON found in Master Chat response");
            data = { message: text };
        }

        return NextResponse.json(data);
    } catch (e: any) {
        const msg = e.message || "";
        if (msg.includes("429") || msg.includes("quota")) {
            return NextResponse.json({ error: "AI Rate Limit Exceeded. Try again later." }, { status: 429 });
        }
        console.error("Master AI Chat Error", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
