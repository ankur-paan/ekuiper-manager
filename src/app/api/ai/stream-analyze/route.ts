import { NextResponse } from 'next/server';
import { generateOpenRouterContent } from '@/lib/openrouter/client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { streamData, modelName } = await req.json();
        const targetModel = modelName || "google/gemini-flash-1.5";

        const systemPrompt = `
        You are an industrial data engineer and eKuiper expert. 
        Analyze the following eKuiper stream definition and provide a technician-friendly explanation.
        
        Technician context: They want to know WHAT data is coming in, WHERE it's from (MQTT/HTTP), and HOW it's structured.
        
        Stream Definition:
        ${JSON.stringify(streamData, null, 2)}
        
        Your explanation should be:
        1. Concise (max 100 words).
        2. Highlighting the source (e.g., "Ingests data from MQTT topic 'telemetry'").
        3. Explaining key fields (e.g., "Tracks temperature and humidity").
        4. Plain English, avoids jargon like "schemaless" or "bigint". Use "Industrial format", "Number", etc.
        
        Format the output clearly.
        `;

        const text = await generateOpenRouterContent(targetModel, systemPrompt);

        return NextResponse.json({ summary: text });
    } catch (e: any) {
        const msg = e.message || "";
        if (msg.includes("429") || msg.includes("quota")) {
            return NextResponse.json({ error: "AI Rate Limit Exceeded. Try again later." }, { status: 429 });
        }
        console.error("AI Stream Analyze Error", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
