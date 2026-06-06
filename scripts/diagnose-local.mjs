#!/usr/bin/env node
import { execSync } from 'node:child_process';
import os from 'node:os';
import { createConnection } from 'node:net';

const PORT = 5173;

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function getLanIps() {
  const ips = [];
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const net of addrs ?? []) {
      if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
    }
  }
  return ips;
}

function portOpen(host, port) {
  return new Promise((resolve) => {
    const sock = createConnection({ host, port, timeout: 2000 });
    sock.on('connect', () => { sock.destroy(); resolve(true); });
    sock.on('error', () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

const nodePath = sh('which node') || process.execPath;
const firewall = sh('/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate');
const allowedApps = sh('/usr/libexec/ApplicationFirewall/socketfilterfw --listapps');
const nodeAllowed = allowedApps.includes(nodePath);
const listening = sh(`lsof -iTCP:${PORT} -sTCP:LISTEN`) || '(nothing on port 5173)';
const ips = getLanIps();

console.log('=== brower-barcode2sheet local diagnose ===\n');
console.log(`Node:      ${nodePath}`);
console.log(`Firewall:  ${firewall || 'unknown'}`);
console.log(`Node allowed in firewall: ${nodeAllowed ? 'yes' : 'NO ← likely blocks iPhone'}`);
console.log(`\nPort ${PORT} listener:\n${listening}\n`);

for (const ip of ips) {
  const ok = await portOpen(ip, PORT);
  console.log(`curl http://${ip}:${PORT} from Mac: ${ok ? 'OK' : 'FAIL'}`);
}

console.log('\n--- Recommendations ---');
if (!nodeAllowed && firewall.includes('enabled')) {
  console.log('1. System Settings → Network → Firewall → Options → allow incoming for:');
  console.log(`   ${nodePath}`);
  console.log('   Or use ngrok (pnpm tunnel) — bypasses LAN firewall.');
}
console.log('2. iPhone needs HTTPS for camera. If LAN works but scan fails, use:');
console.log('   Terminal 1: pnpm local');
console.log('   Terminal 2: pnpm tunnel');
console.log('   iPhone: open the https://….ngrok-free.app URL');
