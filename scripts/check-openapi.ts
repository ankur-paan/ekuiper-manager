
import { EKuiperClient } from "../src/lib/ekuiper/client";

const client = new EKuiperClient("https://ruler1.i-dacs.com", undefined, 5000, true);

async function checkOpenAPI() {
    const paths = [
        "/static/swagger/swagger.json",
        "/swagger/swagger.json",
        "/swagger.json",
        "/api-docs/swagger.json",
        "/v1/swagger.json"
    ];

    for (const path of paths) {
        try {
            console.log(`Checking ${path}...`);
            const response = await (client as any).request(path);
            console.log(`FOUND at ${path}!`);
            // console.log(JSON.stringify(response).slice(0, 100));
            return;
        } catch (e) {
            console.log(`Not found at ${path}`);
        }
    }
    console.log("Could not find OpenAPI spec");
}

// Need to allow public access to 'request' for this test script or cast to any
(client as any).request = (endpoint: string) => {
    // Re-implement basic fetch since 'request' is private
    return fetch(`https://ruler1.i-dacs.com${endpoint}`).then(res => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json();
    });
};

checkOpenAPI();
