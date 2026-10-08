const fs = require('fs');
const https = require('https');
const auth = JSON.parse(fs.readFileSync('/Users/shane/Library/Application Support/com.vercel.cli/auth.json', 'utf8'));
const project = JSON.parse(fs.readFileSync('/Users/shane/Documents/Codex/2026-08-25/x20-wo/portfolio/.vercel/project.json', 'utf8'));
const id = process.argv[2] || 'dpl_91sGzU6Ss73h8LFt8SM7dLBwxdwQ';
function get(path) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'api.vercel.com',
      path,
      headers: { Authorization: `Bearer ${auth.token}` },
    }, (res) => {
      let d = '';
      res.on('data', (c) => { d += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}
(async () => {
  const events = await get(`/v3/deployments/${id}/events?teamId=${encodeURIComponent(project.orgId)}`);
  console.log('events status', events.status);
  const lines = events.body.split('\n').filter(Boolean).map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  for (const line of lines.slice(-40)) {
    const text = line.text || line.payload?.text || JSON.stringify(line).slice(0,200);
    if (/error|Error|failed|Failed|Type|Module/i.test(text)) console.log(text);
  }
  console.log('--- last 15 ---');
  for (const line of lines.slice(-15)) {
    console.log(line.text || line.payload?.text || '');
  }
})();
