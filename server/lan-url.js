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
    console.log(`  Network: http://${ip}:${port}  ← iPhone bookmark this`);
  }
  console.log(`  CSV:     data/entries.csv\n`);
}
