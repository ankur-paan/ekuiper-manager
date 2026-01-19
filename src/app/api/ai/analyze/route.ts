import { NextResponse } from 'next/server';
import { EKuiperClient } from '@/lib/ekuiper/client';
import { generateOpenRouterContent } from '@/lib/openrouter/client';


export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { ruleId, ekuiperUrl, modelName } = await request.json();

        if (!ruleId || !ekuiperUrl) {
            return NextResponse.json({ error: 'Missing params' }, { status: 400 });
        }

        // Handle relative URLs (Next.js Proxy)
        let baseUrl = ekuiperUrl;
        if (baseUrl && baseUrl.startsWith('/')) {
            const host = request.headers.get('host') || 'localhost:3000';
            const protocol = host.includes('localhost') ? 'http' : 'https'; // Simple heuristic
            baseUrl = `${protocol}://${host}${baseUrl}`;
        }

        // Initialize client in DIRECT mode for server-side fetching
        const client = new EKuiperClient(baseUrl, undefined, undefined, true);

        console.log(`AI Analyze: Fetching rule ${ruleId} from ${ekuiperUrl}`);

        // 1. Fetch Rule Definition (SQL) using the client
        let ruleData;
        try {
            ruleData = await client.getRule(ruleId);
        } catch (e: any) {
            console.error(`Fetch Rule Failed:`, e.message);
            return NextResponse.json({ error: `eKuiper Rule Fetch Failed: ${e.message}` }, { status: 502 });
        }
        const sql = ruleData.sql || "SQL not available";

        // 2. Fetch Topology (to get Node IDs)
        let topoData;
        try {
            topoData = await client.getRuleTopology(ruleId);
        } catch (e: any) {
            console.error(`Fetch Topo Failed:`, e.message);
            return NextResponse.json({ error: `eKuiper Topo Fetch Failed: ${e.message}` }, { status: 502 });
        }

        // Extract Unique Node IDs
        const nodeIds = Array.from(new Set([
            ...(topoData.sources || []),
            ...Object.keys(topoData.edges || {}),
            ...Object.values(topoData.edges || {}).flat()
        ]));

        if (nodeIds.length === 0) {
            return NextResponse.json({});
        }

        // 3. Prompt Gemini
        const targetModel = modelName || "gemini-1.5-flash";

        console.log(`AI Analyze: Prompting Gemini (${targetModel}) for ${nodeIds.length} nodes...`);

        try {
            const prompt = `
            You are an Industrial Automation Expert helping a factory technician.
            Analyze this eKuiper Rule (Stream Processing Logic) and map it to its Topology Nodes.
            
            Rule ID: ${ruleId}
            SQL Logic: "${sql}"
            
            Topology Node IDs: ${JSON.stringify(nodeIds)}
            
            Your Goal: specific explanations for each Node ID.
            
            Task:
            Return a JSON object where:
            - Keys are EXACTLY the Node IDs provided.
            - Values are short, simple (max 12 words) plain English descriptions of what that step does locally.
            
            Guidance:
            - For Sources: What data is entering?
            - For Filters/Where: What condition is being checked? (e.g., "Checks if temp > 50")
            - For Aggregations: What math is happening? (e.g., "Averages temp over 1 minute")
            - For Sinks: Where is data going?
            - Avoid technical terms like "SQL", "Select", "Project". Use "Formats", "Calculates", "Sends".
            
            Strictly return ONLY the JSON object. No markdown.
            `;

            const text = await generateOpenRouterContent(targetModel, prompt);

            // Robust JSON extraction
            let cleanText = text.replace(/```json/g, '').replace(/```/g, '');
            const start = cleanText.indexOf('{');
            const end = cleanText.lastIndexOf('}');

            let analysis = {};
            if (start !== -1 && end !== -1) {
                try {
                    const jsonStr = cleanText.substring(start, end + 1);
                    analysis = JSON.parse(jsonStr);
                } catch (e) {
                    console.error("Failed to parse AI response", text);
                    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
                }
            } else {
                console.error("No JSON found in AI response", text);
                return NextResponse.json({ error: "No JSON found in AI response" }, { status: 500 });
            }

            return NextResponse.json(analysis);
        } catch (aiError: any) {
            const msg = aiError.message || "";
            if (msg.includes("429") || msg.includes("Too Many Requests") || msg.includes("quota")) {
                return NextResponse.json({ error: "AI Rate Limit Exceeded. Try again later." }, { status: 429 });
            }
            console.error("AI Provider Error:", aiError);
            return NextResponse.json({ error: `AI Provider Error: ${msg}` }, { status: 500 });
        }

    } catch (error: any) {
        console.error("AI Analysis Failed", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
