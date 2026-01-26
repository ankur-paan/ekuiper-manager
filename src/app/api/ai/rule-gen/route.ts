import { NextResponse } from 'next/server';
import { generateOpenRouterContent } from '@/lib/openrouter/client';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const { messages, context, modelName } = await req.json();
        const targetModel = modelName || "google/gemini-flash-1.5";

        const systemPrompt = `
        You are an industrial data engineer and eKuiper expert. 
        Your goal is to help a technician create a new processing rule.
        
        CONTEXT:
        Available Streams: ${JSON.stringify(context.streams, null, 2)}
        Active Shared Connections: ${JSON.stringify(context.connections, null, 2)}
        Configured Source Templates (Metadata): ${JSON.stringify(context.sourceMetadata, null, 2)}
        Configured Sink Templates (Metadata): ${JSON.stringify(context.sinkMetadata, null, 2)}
        
        SITUATIONAL AWARENESS:
        - I have provided you with DEEP metadata. Each source/sink template contains 'confKeys' which include the actual 'content' (server, topic, certs, etc.).
        - If a Stream mentions a 'confKey' (e.g. "confKey: 1"), look for that key in the 'Configured Source Templates' to understand its true source logic.
        - IGNORE generic source/sink types that have no 'confKeys'. Only focus on things configured by the user.
        
        CAPABILITIES:
        - Generate eKuiper SQL.
        - Configure Sinks.
        - Configure Rule Options.
        
        BEHAVIOR:
        1. Propose rules using VALID stream names and VALID configuration keys found in the context.
        2. Prefer 'shared connections' if available, otherwise use a matching 'confKey' from the metadata.
        3. Explain the industrial logic clearly to the technician.
        4. Focus on 'Operational' relevance (filtering peaks, transforming protocol data).
        5. For comparisons involving numbers (e.g., voltage < 250), always use proper type casting to avoid errors:
           - For binary streams, the payload (self) is []byte, so use: CAST(CAST(self, 'string'), 'float')
           - For numeric fields in JSON streams, use: CAST(field, 'float')
           - For text/string comparisons, use: CAST(field, 'string') if needed, but prefer direct comparison.
           - Always apply casting for any value comparison to ensure compatibility, as non-technical users may not specify types.
        
        OUTPUT FORMAT:
        Always return a JSON object with:
        {
          "message": "The text you want to say to the user (can include markdown)",
          "ruleId": "A suggested unique ID for the rule (if enough info)",
          "sql": "The SQL query string (if enough info)",
          "actions": [ { "type": "sink_type", "config": { ... } } ], // if enough info
          "options": { "qos": 0, "isEventTime": false, "sendMetaToSink": false } // optional
        }
        
        Current Stream Schema Context: Users interact with streams defined above. 
        Use exact stream names in the FROM clause.
        
        Current Conversation:
        ${messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
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
                data = { message: "I processed your request but had trouble formatting the response.\n\n" + text };
            }
        } else {
            data = { message: text };
        }

        return NextResponse.json(data);
    } catch (e: any) {
        const msg = e.message || "";
        if (msg.includes("429") || msg.includes("quota")) {
            return NextResponse.json({ error: "AI Rate Limit Exceeded. Try again later." }, { status: 429 });
        }
        console.error("AI Rule Gen Error", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
