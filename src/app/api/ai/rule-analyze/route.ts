import { NextResponse } from 'next/server';
import { generateOpenRouterChat } from '@/lib/openrouter/client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { messages, context, modelName } = await req.json();
        const targetModel = modelName || "google/gemini-flash-1.5";

        const systemInstruction = `
        You are an industrial data scientist and eKuiper maintenance expert.
        Analyze the following rule configuration and its real-time operational status.
        
        RULE DEFINITION:
        ${JSON.stringify(context.rule, null, 2)}
        
        CURRENT OPERATIONAL STATUS & METRICS:
        ${JSON.stringify(context.status, null, 2)}
        
        MISSION:
        - Help the technician understand what the rule is doing.
        - Analyze performance: Are there errors? Is data flowing? Are there latency issues?
        - Suggest optimizations: Are there many "dropped" messages? Is the SQL efficient?
        - Explain metrics in non-technical terms.
        
        FOCUS:
        - Input/Output rates.
        - Exceptional situations (error counts, source/sink failures).
        - Logic explanation (Why this SQL was written).
        
        BEHAVIOR:
        1. Keep responses professional, industrial, and insight-driven.
        2. Use bullet points for metrics analysis.
        3. If there are errors (e.g. status shows "exceptions"), prioritize explaining the cause and fix.
        
        OUTPUT FORMAT:
        Always return a JSON object with:
        {
          "message": "Your insight-driven analysis for the technician (supports markdown)"
        }
        `;

        // Message Normalization
        const normalizedMessages = [
            { role: 'system', content: systemInstruction }
        ];

        for (const msg of messages) {
            let role = msg.role;
            let content = msg.content;
            if (role === 'system') {
                role = 'user';
                content = `[SYSTEM EVENT]: ${content}`;
            }
            const lastMsg = normalizedMessages[normalizedMessages.length - 1];
            if (lastMsg.role === role && role !== 'system') {
                lastMsg.content += `\n\n${content}`;
            } else {
                normalizedMessages.push({ role, content });
            }
        }

        const text = await generateOpenRouterChat(targetModel, normalizedMessages);

        // Robust JSON extraction
        let cleanText = text.replace(/```json/g, '').replace(/```/g, '');
        const start = cleanText.indexOf('{');
        const end = cleanText.lastIndexOf('}');

        let data;
        if (start !== -1 && end !== -1) {
            try {
                const jsonStr = cleanText.substring(start, end + 1);
                data = JSON.parse(jsonStr);
            } catch (e) {
                data = { message: text };
            }
        } else {
            console.warn("No JSON found in Rule Analyze response");
            data = { message: text };
        }

        return NextResponse.json(data);
    } catch (e: any) {
        const msg = e.message || "";
        if (msg.includes("429") || msg.includes("quota")) {
            return NextResponse.json({ error: "AI Rate Limit Exceeded. Try again later." }, { status: 429 });
        }
        console.error("AI Rule Analyze Error", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
