const http = require('http');

const data = JSON.stringify({
  name: "Test Lead Tool Call",
  email: "testcool@test.com",
  status: "New"
});

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/leads',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', console.error);
req.write(data);
req.end();
