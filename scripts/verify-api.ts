import { ekuiperClient, EKuiperClient } from "../src/lib/ekuiper/client";
import { Stream, Rule, PluginType } from "../src/lib/ekuiper/types";

// Override singleton or create new client for verification against external instance
// The 4th argument 'true' enables direct mode
const client = new EKuiperClient("https://ruler1.i-dacs.com", undefined, 5000, true);

async function verifyBaseApis() {
    console.log("Starting Base API Verification...");

    try {
        // 1. System Info
        console.log("Checking System Info...");
        const info = await client.getInfo();
        console.log("System Info:", info);
        if (!info.version) throw new Error("Invalid system info");

        // 2. Streams
        console.log("Checking Streams...");
        const streams = await client.listStreams();
        console.log(`Found ${streams.length} streams`);

        const streamName = "test_verify_stream";
        const streamSql = `CREATE STREAM ${streamName} () WITH (FORMAT="JSON", TYPE="memory")`;

        // Cleanup potential leftovers from previous failed runs
        let ruleId = "test_verify_rule"; // Define ruleId here for cleanup
        try { await client.deleteRule(ruleId); console.log("Cleaned up rule"); } catch (e) { console.log("Cleanup rule failed (ignoring):", e); }
        try { await client.deleteStream(streamName); console.log("Cleaned up stream"); } catch (e) { console.log("Cleanup stream failed (ignoring):", e); }

        try {
            try {
                await client.createStream(streamSql);
            } catch (e: any) {
                console.error("Create Stream Failed:", e);
                if (e.response) {
                    const text = await e.response.text();
                    console.error("Response body:", text);
                }
                throw e;
            }
            console.log("Created stream:", streamName);

            const stream = await client.getStream(streamName);
            console.log("Fetched stream:", stream.Name);
            if (stream.Name !== streamName) throw new Error("Stream name mismatch");

        } finally {
            try {
                await client.deleteStream(streamName);
                console.log("Deleted stream:", streamName);
            } catch (e) {
                console.warn("Failed to delete stream", e);
            }
        }

        // 3. Rules
        console.log("Checking Rules...");
        ruleId = "test_verify_rule";
        const ruleSql = "SELECT * FROM test_verify_stream";
        const ruleActions = [{ log: {} }];

        // We need the stream to exist for the rule
        await client.createStream(streamSql);

        try {
            await client.createRule({
                id: ruleId,
                sql: ruleSql,
                actions: ruleActions,
            });
            console.log("Created rule:", ruleId);

            const rule = await client.getRule(ruleId);
            console.log("Fetched rule:", rule.id);
            if (rule.id !== ruleId) throw new Error("Rule ID mismatch");

            const status = await client.getRuleStatus(ruleId);
            console.log("Rule status:", status);

        } finally {
            await client.deleteRule(ruleId);
            console.log("Deleted rule:", ruleId);
            await client.deleteStream(streamName);
        }

        // 4. Plugins
        console.log("Checking Plugins...");
        const functionPlugins = await client.listPlugins("functions");
        console.log("Function plugins:", functionPlugins);

        // 5. UDFs (New Feature)
        console.log("Checking UDFs...");
        const udfs = await client.listUDFs();
        console.log("UDFs:", udfs);

        console.log("Base API Verification Passed!");
    } catch (error) {
        console.error("Verification Failed:", error);
        process.exit(1);
    }
}

verifyBaseApis();
