import { NextResponse } from 'next/server';
import { generateOpenRouterContent } from '@/lib/openrouter/client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { prompt, modelName } = await req.json();
        const targetModel = modelName || "google/gemini-flash-1.5";

        const systemPrompt = `
        You are an eKuiper expert. Generate a Stream Definition JSON based on the user request.
        
        Supported Source Types: mqtt, httppull, httppush, memory, neuron, edgex, file, redis, simulator.
        Supported Data Types: bigint, float, string, boolean, datetime, bytea, array, struct.
        Supported Formats: json, binary, protobuf, delimited.

        Return ONLY a JSON object with this structure:
        {
           "name": "suggested_name",
           "sourceType": "mqtt", 
           "datasource": "topic/example",
           "format": "json",
           "fields": [
               { "name": "temp", "type": "float" }
           ],
           "description": "Brief explanation of what this stream does"
        }
        
        User Request: "${prompt}"
        
        If the user mentions specific topics, types, or names, use them.
        If abstract (e.g. "temperature sensor"), infer reasonable defaults (mqtt, topic=sensors/temp, fields=[temperature float]).
        `;

        const text = await generateOpenRouterContent(targetModel, systemPrompt);

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
                console.error("Failed to parse AI Stream Gen response", text);
                return NextResponse.json({ error: "AI response was not valid JSON", raw: text }, { status: 500 });
            }
        } else {
            console.error("No JSON found in AI Stream Gen response", text);
            return NextResponse.json({ error: "AI response did not contain JSON", raw: text }, { status: 500 });
        }

        return NextResponse.json(data);

    } catch (e: any) {
        const msg = e.message || "";
        if (msg.includes("429") || msg.includes("quota")) {
            return NextResponse.json({ error: "AI Rate Limit Exceeded. Try again later." }, { status: 429 });
        }
        console.error("AI Stream Gen Error", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
