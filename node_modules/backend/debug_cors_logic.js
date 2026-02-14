
const normalizeOrigin = (value) => {
    if (!value) return value;
    const trimmed = String(value).trim().replace(/\/+$/, "");
    // strip default ports so http://x:80 and https://x:443 match http://x and https://x
    return trimmed
        .replace(/^http:\/\/(.+):80$/i, "http://$1")
        .replace(/^https:\/\/(.+):443$/i, "https://$1");
};

const defaultAllowedOrigins = [
    'http://localhost:3002',
    'http://localhost:3000',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3000',
    'http://192.168.0.4:3002', // Added your local IP
    'http://192.168.0.4:3000',  // Added your local IP
    'http://172.22.48.1:3002', // Added your current access IP
    'http://172.22.48.1:3000', // Added your current access IP
    'http://crm.sdgsolutions.in',
    'https://crm.sdgsolutions.in',
    'http://crm.sdgsolutions.in:3002',
    'https://crm.sdgsolutions.in:3002',
    'http://crm.sdcsolutions.in',
    'https://crm.sdcsolutions.in',
    'http://crm.sdcsolutions.in:3002',
    'https://crm.sdcsolutions.in:3002',
];

const checkOrigin = (origin) => {
    const normalizedOrigin = normalizeOrigin(origin);

    // Simulate env being empty or default behavior
    const allowedOrigins = defaultAllowedOrigins.map(normalizeOrigin);

    if (allowedOrigins.includes(normalizedOrigin)) {
        console.log(`PASS: ${origin} (normalized: ${normalizedOrigin}) is allowed.`);
        return true;
    } else {
        console.log(`FAIL: ${origin} (normalized: ${normalizedOrigin}) is BLOCKED.`);
        return false;
    }
}

// Test cases
checkOrigin('http://crm.sdgsolutions.in:3002');
checkOrigin('http://crm.sdgsolutions.in:3002/');
checkOrigin('https://crm.sdgsolutions.in:3002');
checkOrigin('http://localhost:3002');
