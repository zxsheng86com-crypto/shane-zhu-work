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
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

(async () => {
  for (let i = 0; i < 60; i++) {
    const j = await get(`/v13/deployments/${id}?teamId=${encodeURIComponent(project.orgId)}`);
    console.log(j.readyState, j.url || '');
    if (j.readyState === 'READY' || j.readyState === 'ERROR' || j.readyState === 'CANCELED') {
      console.log(JSON.stringify({
        readyState: j.readyState,
        url: j.url,
        alias: j.alias,
        inspectorUrl: j.inspectorUrl,
      }, null, 2));
      process.exit(j.readyState === 'READY' ? 0 : 1);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  process.exit(1);
})();
