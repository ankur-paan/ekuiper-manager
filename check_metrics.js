const https = require('https');

function getStatus(ruleId) {
    https.get(`https://ruler1.i-dacs.com/rules/${ruleId}/status`, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const status = JSON.parse(data);
                console.log(`Rule: ${ruleId}`);
                console.log(`Status: ${status.status}`);

                // Find metrics
                const metrics = Object.entries(status)
                    .filter(([key]) => key.includes('records_in') || key.includes('records_out') || key.includes('exception'))
                    .sort();

                metrics.forEach(([key, val]) => {
                    console.log(`${key}: ${val}`);
                });
            } catch (e) {
                console.log("Error parsing status:", e.message);
                console.log("Raw data:", data);
            }
        });
    }).on('error', (err) => {
        console.error("Fetch error:", err.message);
    });
}

getStatus('rule_4907');
