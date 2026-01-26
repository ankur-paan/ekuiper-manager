const https = require('https');

const rule = {
    id: "test_rule_2201_v2",
    sql: "SELECT * FROM sdm120_stream",
    actions: [
        {
            mqtt: {
                confKey: "1",
                topic: "test/2201"
            }
        }
    ]
};

const data = JSON.stringify(rule);

const req = https.request('https://ruler1.i-dacs.com/rules', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
}, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        console.log(`Body: ${body}`);
    });
});

req.on('error', (e) => console.error(e));
req.write(data);
req.end();
