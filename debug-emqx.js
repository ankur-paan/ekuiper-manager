const https = require('https');

const config = {
    host: 'mqtt-dash.i-dacs.com',
    username: 'admin',
    password: 'QAZmqtt@2025' // From .env
};

function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: config.host,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    body: data
                });
            });
        });

        req.on('error', (e) => reject(e));

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function run() {
    try {
        console.log('1. Logging in...');
        const loginRes = await request('POST', '/api/v5/login', {
            username: config.username,
            password: config.password
        });

        console.log('Login Status:', loginRes.status);
        if (loginRes.status !== 200) {
            console.error('Login Failed:', loginRes.body);
            return;
        }

        const token = JSON.parse(loginRes.body).token;
        console.log('Token obtained (truncated):', token.substring(0, 20) + '...');

        console.log('\n2. Testing /api/v5/subscriptions...');
        const subRes = await request('GET', '/api/v5/subscriptions?limit=1000', null, token);
        console.log('Subs Status:', subRes.status);
        if (subRes.status !== 200) console.log('Subs Body:', subRes.body.substring(0, 200));

        console.log('\n3. Testing /api/v5/topics...');
        const topicsRes = await request('GET', '/api/v5/topics?limit=1000', null, token);
        console.log('Topics Status:', topicsRes.status);
        if (topicsRes.status !== 200) console.log('Topics Body:', topicsRes.body.substring(0, 200));

        console.log('\n4. Testing /api/v5/routes...');
        const routesRes = await request('GET', '/api/v5/routes?limit=1000', null, token);
        console.log('Routes Status:', routesRes.status);
        if (routesRes.status !== 200) console.log('Routes Body:', routesRes.body.substring(0, 200));

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
