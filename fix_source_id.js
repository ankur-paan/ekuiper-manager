
// Native fetch

const BASE_URL = 'https://ruler1.i-dacs.com';

async function fixSourceConfig() {
    try {
        // 1. Get Current Config
        const res = await fetch(`${BASE_URL}/metadata/sources/yaml/mqtt`);
        const data = await res.json();

        console.log("Current Config:", JSON.stringify(data['1'], null, 2));

        if (data['1'] && data['1'].clientid) {
            console.log("Found problematic clientid in Source '1'. Removing...");

            // Create clean config
            const newConfig = { ...data['1'] };
            delete newConfig.clientid;

            // 2. Update EXACT Config Key '1'
            // Endpoint: /metadata/sources/{type}/confKeys/{key}
            // Removing 'yaml' and using standard REST path
            const endpoint = `${BASE_URL}/metadata/sources/mqtt/confKeys/1`;

            console.log(`Sending PUT to ${endpoint}...`);

            const updateRes = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });

            if (updateRes.ok) {
                console.log("SUCCESS: Source config '1' updated. ClientID removed.");
                // Verify
                console.log("New Config:", JSON.stringify(newConfig, null, 2));
            } else {
                console.error("FAILED to update config:", await updateRes.text());
            }

            // 3. Restart Stream/Rule? 
            // Usually eKuiper requires restarting rules to pick up config changes.
            // I'll list rules to see what's running.
            const rulesRes = await fetch(`${BASE_URL}/rules`);
            const rules = await rulesRes.json();
            console.log("Running Rules to Restart:", rules.map(r => r.id));

        } else {
            console.log("No clientid found in '1'. Config is already clean.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

fixSourceConfig();
