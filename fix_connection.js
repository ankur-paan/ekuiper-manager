const https = require('https');

const connectionUpdate = {
    id: "emqx_cloud_auth",
    typ: "mqtt",
    props: {
        clientid: "ruler1",
        insecureSkipVerify: false,
        password: "test@2025",
        protocolVersion: "3.1.1",
        qos: 1, // Number, not string!
        retained: false,
        server: "tcp://mqtt.i-dacs.com:1883",
        username: "testmqtt"
    }
};

const data = JSON.stringify(connectionUpdate);

const req = https.request('https://ruler1.i-dacs.com/connections/emqx_cloud_auth', {
    method: 'PUT',
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
