import { NextResponse } from 'next/server';
import { listOpenRouterModels } from '@/lib/openrouter/client';

export const dynamic = 'force-dynamic';

const ALLOWED_MODELS = new Set([
    "allenai/molmo-2-8b",
    "xiaomi/mimo-v2-flash",
    "nvidia/nemotron-3-nano-30b-a3b",
    "mistralai/devstral-2512",
    "arcee-ai/trinity-mini",
    "tngtech/tng-r1t-chimera",
    "nvidia/nemotron-nano-12b-v2-vl",
    "qwen/qwen3-next-80b-a3b-instruct",
    "nvidia/nemotron-nano-9b-v2",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "z-ai/glm-4.5-air",
    "qwen/qwen3-coder",
    "moonshotai/kimi-k2",
    "cognitivecomputations/dolphin-mistral-24b-venice-edition",
    "google/gemma-3n-e2b-it",
    "tngtech/deepseek-r1t2-chimera",
    "deepseek/deepseek-r1-0528",
    "google/gemma-3n-e4b-it",
    "qwen/qwen3-4b",
    "tngtech/deepseek-r1t-chimera",
    "mistralai/mistral-small-3.1-24b-instruct",
    "google/gemma-3-4b-it",
    "google/gemma-3-12b-it",
    "google/gemma-3-27b-it",
    "google/gemini-2.0-flash-exp",
    "meta-llama/llama-3.3-70b-instruct",
    "meta-llama/llama-3.2-3b-instruct",
    "qwen/qwen-2.5-vl-7b-instruct",
    "nousresearch/hermes-3-llama-3.1-405b",
    "meta-llama/llama-3.1-405b-instruct"
]);

export async function GET() {
    try {
        const rawModels = await listOpenRouterModels();

        // Filter based on allowed list (including :free variants)
        const models = rawModels
            .filter((m: any) => {
                const baseId = m.id.split(':')[0];
                return ALLOWED_MODELS.has(m.id) || ALLOWED_MODELS.has(baseId);
            })
            .map((m: any) => ({
                id: m.id,
                name: m.name || m.id
            }));

        // Sort mainly by name
        models.sort((a: any, b: any) => a.name.localeCompare(b.name));

        return NextResponse.json(models);
    } catch (e: any) {
        console.error("List Models Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
