// Native fetch in Node 21+

const BASE_URL = 'https://ruler1.i-dacs.com';

async function main() {
    try {
        // 1. Get Rule
        console.log("--- Rule Definition ---");
        try {
            const ruleRes = await fetch(`${BASE_URL}/rules/rule_4282`);
            const ruleData = await ruleRes.json();
            console.log(JSON.stringify(ruleData, null, 2));
        } catch (e) { console.log("Failed to get rule:", e.message); }

        // 2. Get Stream
        console.log("\n--- Stream Definition ---");
        try {
            const streamRes = await fetch(`${BASE_URL}/streams/sdm120_stream`);
            const streamData = await streamRes.json();
            console.log(JSON.stringify(streamData, null, 2));
        } catch (e) { console.log("Failed to get stream:", e.message); }

    } catch (err) {
        console.error("Global Error:", err);
    }
}

main();
