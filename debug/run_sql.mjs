import https from 'https';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf8');
const serviceKeyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);
const serviceKey = serviceKeyMatch ? serviceKeyMatch[1].trim() : '';

const sql = `
ALTER TABLE public.officer_expense_claims 
ADD COLUMN IF NOT EXISTS description TEXT;
`;

const data = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: '/v1/projects/tfpzehyrkzbenjobkdsz/sql',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();