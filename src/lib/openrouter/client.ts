
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SITE_NAME = 'eKuiper Playground';

export async function generateOpenRouterChat(model: string, messages: { role: string, content: string }[]) {
    if (!OPENROUTER_API_KEY) throw new Error("Missing OpenRouter API Key");

    // DEBUG: Log exact payload
    console.log(">>> AI REQ >>>", JSON.stringify({ model, messages }, null, 2));

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": SITE_URL,
            "X-Title": SITE_NAME,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: model || "google/gemini-flash-1.5",
            messages: messages
        })
    });

    if (!res.ok) {
        const text = await res.text();
        console.log("<<< AI ERROR <<<", res.status, text);
        throw new Error(`OpenRouter Error ${res.status}: ${text}`);
    }

    const data = await res.json();
    console.log("<<< AI RES <<<", JSON.stringify(data, null, 2));

    return data.choices?.[0]?.message?.content || "";
}

export async function generateOpenRouterContent(model: string, prompt: string) {
    return generateOpenRouterChat(model, [{ role: "user", content: prompt }]);
}

export async function listOpenRouterModels() {
    if (!OPENROUTER_API_KEY) throw new Error("Missing OpenRouter API Key");

    const res = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": SITE_URL,
            "X-Title": SITE_NAME
        }
    });

    if (!res.ok) throw new Error("Failed to fetch models from OpenRouter");
    const json = await res.json();
    return json.data || [];
}
