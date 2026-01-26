
const http = require('http');

// This connects to the Next.js API route helper, which proxies to eKuiper
// URL: http://localhost:3000/api/ekuiper/streams/sdm120_stream
const url = 'http://localhost:3000/api/ekuiper/streams/sdm120_stream';

console.log(`Fetching ${url}...`);

http.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log("Raw:", data);
        }
    });
}).on('error', err => console.error(err));
