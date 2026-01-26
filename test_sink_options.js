const http = require('https');

async function validate(sinkProps) {
    const data = JSON.stringify({
        id: "sink_val_test",
        sql: "SELECT * FROM sdm120_stream",
        actions: [{ mqtt: sinkProps }]
    });

    return new Promise((resolve) => {
        const req = http.request('https://ruler1.i-dacs.com/rules/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.write(data);
        req.end();
    });
}

async function run() {
    console.log("Testing connectionSelector: 'emqx_cloud_auth'...");
    const r1 = await validate({ connectionSelector: "emqx_cloud_auth", topic: "test/out" });
    console.log(`Result 1: ${r1.status} - ${r1.body}`);

    console.log("\nTesting connectionSelector: 'mqtt-idacs'...");
    const r2 = await validate({ connectionSelector: "mqtt-idacs", topic: "test/out" });
    console.log(`Result 2: ${r2.status} - ${r2.body}`);

    console.log("\nTesting confKey: '1'...");
    const r3 = await validate({ confKey: "1", topic: "test/out" });
    console.log(`Result 3: ${r3.status} - ${r3.body}`);
}

run();
