import { NextResponse } from 'next/server';
import { generateOpenRouterContent } from '@/lib/openrouter/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { plan, sql, modelName } = await request.json();

        const prompt = `
You are an expert in Stream Processing and SQL optimization.
Analyze this eKuiper Execution Plan and the corresponding SQL.

SQL: "${sql || 'N/A'}"

Execution Plan (JSON):
${JSON.stringify(plan, null, 2)}

Provide a helpful, concise explanation of this plan.
- Walk through the logical steps (Scan, Filter, Project, etc.).
- Identify any potential performance bottlenecks.
- Explain how the data flows based on the operators.

Format your response in Markdown, suitable for a developer to read quickly.
`;

        const explanation = await generateOpenRouterContent(modelName || "google/gemini-flash-1.5", prompt);
        return NextResponse.json({ explanation });
    } catch (e: any) {
        const msg = e.message || "";
        if (msg.includes("429") || msg.includes("quota")) {
            return NextResponse.json({ error: "AI Rate Limit Exceeded. Try again later." }, { status: 429 });
        }
        console.error("Plan Explain Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
