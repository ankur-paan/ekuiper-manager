const http = require('https');

const payloads = [
    { id: "cast_quoted_type", sql: "SELECT * FROM sdm120_stream WHERE CAST(self AS 'string') = 'ON'" },
    { id: "cast_comma", sql: "SELECT * FROM sdm120_stream WHERE CAST(self, 'string') = 'ON'" },
    { id: "cast_bigint", sql: "SELECT * FROM sdm120_stream WHERE CAST(self AS bigint) = 1" },
    { id: "cast_self_project", sql: "SELECT CAST(self AS string) AS val FROM sdm120_stream" },
    { id: "self_to_string", sql: "SELECT * FROM sdm120_stream WHERE self::string = 'ON'" }
];

async function validate(payload) {
    return new Promise((resolve) => {
        const data = JSON.stringify({
            id: "val_" + payload.id,
            sql: payload.sql,
            actions: [{ log: {} }]
        });

        const req = http.request('https://ruler1.i-dacs.com/rules/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({ id: payload.id, status: res.statusCode, body });
            });
        });

        req.on('error', (e) => resolve({ id: payload.id, error: e.message }));
        req.write(data);
        req.end();
    });
}

async function run() {
    for (const p of payloads) {
        const res = await validate(p);
        console.log(`Test ${res.id}: ${res.status} - ${res.body}`);
    }
}

run();
