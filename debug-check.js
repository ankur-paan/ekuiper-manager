const http = require('http');

const topic = encodeURIComponent('esp81b14a0256552a3731378c1974ce/#');
const url = `http://localhost:3000/api/debug/mqtt?topic=${topic}&timeout=8000`;

console.log(`Fetching ${url}...`);

http.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
            const json = JSON.parse(data);
            console.log(JSON.stringify(json, null, 2));
        } catch (e) {
            console.log("Raw Response:", data);
        }
    });

}).on('error', (err) => {
    console.error('Error:', err.message);
});
