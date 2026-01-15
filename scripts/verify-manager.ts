
import { EKuiperManagerClient } from "../src/lib/ekuiper/manager-client";
import { SystemInfo } from "../src/lib/ekuiper/manager-types";

// Helper to instantiate client with direct mode
const client = new EKuiperManagerClient("https://ruler1.i-dacs.com", undefined, 5000, true);

async function verifyManager() {
    console.log("Starting Manager Feature Verification...");

    try {
        // 1. Manager System Info (different from Base Info)
        console.log("Checking Manager System Info...");
        try {
            const sysContext = await client.getSystemInfo();
            console.log("Manager System Info:", sysContext);
        } catch (e) {
            console.warn("getSystemInfo failed - might need auth or different endpoint?", e);
        }

        // 2. Metrics
        console.log("Checking Server Metrics...");
        try {
            const metrics = await client.getServerMetrics();
            console.log("Metrics:", metrics);
        } catch (e) {
            console.warn("getServerMetrics failed", e);
        }

        // 3. Source Configs
        console.log("Checking Source Configs (mqtt)...");
        try {
            const mqttConfigs = await client.getSourceConfigs("mqtt");
            console.log("MQTT Configs keys:", Object.keys(mqttConfigs || {}));
        } catch (e) {
            console.warn("getSourceConfigs failed", e);
        }

        // 4. Shared Connections
        console.log("Checking Shared Connections...");
        try {
            const connections = await client.listConnections();
            console.log(`Found ${connections.length} connections`);
        } catch (e) {
            console.warn("listConnections failed", e);
        }

        console.log("Manager Verification Completed.");
    } catch (error) {
        console.error("Manager Verification Failed Fatal:", error);
        process.exit(1);
    }
}

verifyManager();
