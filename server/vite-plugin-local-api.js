import { createCsvWriter } from './csv-writer.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { printNetworkUrl } from './lan-url.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, '../data/entries.csv');

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function localApiPlugin() {
  const writer = createCsvWriter(CSV_PATH);

  return {
    name: 'local-api',
    configureServer(server) {
      printNetworkUrl(server.config.server.port ?? 5173);

      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/entries' || req.method !== 'POST') {
          next();
          return;
        }
        try {
          const payload = JSON.parse(await readBody(req));
          const operator = (payload.operator || '').trim();
          const barcode = (payload.barcode || '').trim();
          const description = (payload.description || '').trim();
          const note = (payload.note || '').trim();

          if (!operator) {
            json(res, 400, { ok: false, error: 'operator required' });
            return;
          }
          if (!barcode && !description) {
            json(res, 400, { ok: false, error: 'barcode or description required' });
            return;
          }

          const scannedAt = new Date().toISOString();
          await writer.appendRow({ scannedAt, operator, barcode, description, note });
          json(res, 200, { ok: true });
        } catch {
          json(res, 500, { ok: false, error: 'write failed' });
        }
      });
    },
  };
}
