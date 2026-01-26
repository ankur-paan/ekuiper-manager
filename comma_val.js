const http = require('https');

async function validate(sql) {
    const data = JSON.stringify({
        id: "debug_val",
        sql: sql,
        actions: [{ log: {} }]
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
    const v1 = "SELECT * FROM sdm120_stream WHERE CAST(self, 'string') = 'ON'";
    const r1 = await validate(v1);
    console.log(`CAST COMMA test: ${r1.status} - ${r1.body}`);

    const v2 = "SELECT * FROM sdm120_stream WHERE CAST(self, \"string\") = 'ON'";
    const r2 = await validate(v2);
    console.log(`CAST COMMA DQUOTE test: ${r2.status} - ${r2.body}`);
}

run();
