import fs from 'node:fs/promises';
import path from 'node:path';

const HEADER = '掃描時間,作業者,條碼,商品名稱/描述,備註';
const BOM = '\uFEFF';

export function escapeCsvField(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function formatRow(fields) {
  return fields.map(escapeCsvField).join(',');
}

export function createCsvWriter(filePath) {
  let chain = Promise.resolve();
  let initialized = false;

  async function ensureFile() {
    if (initialized) return;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, BOM + HEADER + '\n', 'utf8');
    }
    initialized = true;
  }

  function appendRow({ scannedAt, operator, barcode, description, note }) {
    chain = chain.then(async () => {
      await ensureFile();
      const line = formatRow([scannedAt, operator, barcode, description, note]);
      await fs.appendFile(filePath, line + '\n', 'utf8');
    });
    return chain;
  }

  return { appendRow };
}
