import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeCsvField, formatRow, createCsvWriter } from '../server/csv-writer.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('escapeCsvField', () => {
  it('returns plain string unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });
  it('wraps field with commas in quotes', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });
  it('escapes internal quotes', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });
});

describe('formatRow', () => {
  it('joins five fields with commas', () => {
    expect(formatRow(['t', 'op', 'bc', 'desc', 'note'])).toBe('t,op,bc,desc,note');
  });
});

describe('createCsvWriter', () => {
  let tmpFile;

  beforeEach(async () => {
    tmpFile = path.join(os.tmpdir(), `entries-${Date.now()}.csv`);
  });

  afterEach(async () => {
    await fs.rm(tmpFile, { force: true });
  });

  it('creates file with UTF-8 BOM header when missing', async () => {
    const writer = createCsvWriter(tmpFile);
    await writer.appendRow({
      scannedAt: '2026-06-06T00:00:00.000Z',
      operator: '小明',
      barcode: '123',
      description: '',
      note: '',
    });
    const content = await fs.readFile(tmpFile, 'utf8');
    expect(content.startsWith('\uFEFF掃描時間,作業者,條碼,商品名稱/描述,備註')).toBe(true);
    expect(content).toContain('2026-06-06T00:00:00.000Z,小明,123,,');
  });

  it('serializes concurrent appends', async () => {
    const writer = createCsvWriter(tmpFile);
    await Promise.all([
      writer.appendRow({ scannedAt: 't1', operator: 'A', barcode: '1', description: '', note: '' }),
      writer.appendRow({ scannedAt: 't2', operator: 'B', barcode: '2', description: '', note: '' }),
    ]);
    const lines = (await fs.readFile(tmpFile, 'utf8')).trim().split('\n');
    expect(lines).toHaveLength(3); // header + 2 rows
  });
});
