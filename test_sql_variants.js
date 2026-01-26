const http = require('https');

const payloads = [
    { id: "test_cast", sql: "SELECT * FROM sdm120_stream WHERE CAST(self AS string) = 'ON'" },
    { id: "test_string_func", sql: "SELECT * FROM sdm120_stream WHERE string(self) = 'ON'" },
    { id: "test_self", sql: "SELECT * FROM sdm120_stream WHERE self = 'ON'" },
    { id: "test_meta", sql: "SELECT * FROM sdm120_stream WHERE meta(topic) = 'test'" }
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
