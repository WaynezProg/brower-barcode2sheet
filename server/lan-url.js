import os from 'node:os';

export function printNetworkUrl(port) {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  console.log(`\n  Local:   http://localhost:${port}`);
  for (const ip of ips) {
    console.log(`  Network: http://${ip}:${port}  ← iPhone (needs firewall allow)`);
  }
  console.log(`  Tunnel:  pnpm tunnel  ← iPhone HTTPS if LAN blocked`);
  console.log(`  CSV:     data/entries.csv`);
  console.log(`  Diagnose: node scripts/diagnose-local.mjs\n`);
}
