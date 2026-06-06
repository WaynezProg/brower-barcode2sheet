# P2 Local CSV Scanner Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Mac-local `pnpm local` mode where iPhones on the same WiFi get continuous barcode-scanner UX with instant CSV writes to `data/entries.csv`, while keeping GitHub Pages + Apps Script cloud mode unchanged.

**Architecture:** Vite dev server with a custom middleware plugin handles `POST /api/entries` and serializes CSV appends through an in-memory queue. Frontend auto-detects mode via hostname (`github.io` = cloud, else local) and branches UX: local gets continuous scan + direct write + audio/haptic feedback; cloud keeps P1 confirm-modal flow.

**Tech Stack:** Node.js (Vite middleware), vanilla JS, Vitest, existing `@zxing/library`

**Spec:** `docs/superpowers/specs/2026-06-06-local-csv-mode-design.md`

---

## File Structure

```
brower-barcode2sheet/
├── server/
│   ├── csv-writer.js          # escapeCsvField, formatRow, createCsvWriter(queue)
│   ├── vite-plugin-local-api.js  # configureServer middleware for /api/entries
│   └── lan-url.js             # printNetworkUrl()
├── web/src/
│   ├── mode.js                # getMode(): 'local' | 'cloud'
│   ├── feedback.js            # beep, vibrate, flash
│   ├── debounce.js            # shouldSkipBarcode(barcode, state, now)
│   ├── api.js                 # MODIFY: route submitEntry by mode
│   ├── scanner.js             # MODIFY: add pauseDecode/resumeDecode for cooldown
│   ├── main.js                # MODIFY: local continuous vs cloud single scan
│   └── ui.js                  # MODIFY: mode badge, flash overlay helpers
├── web/index.html             # MODIFY: mode badge, flash div, scan btn label
├── web/styles.css             # MODIFY: badge + flash styles
├── tests/
│   ├── csv-writer.test.js
│   ├── debounce.test.js
│   └── mode.test.js
├── data/                      # gitignored, auto-created
│   └── entries.csv
├── vite.config.js             # MODIFY: conditional localApiPlugin
├── package.json               # MODIFY: "local" script
└── .gitignore                 # MODIFY: data/
```

---

### Task 1: CSV Writer Module (TDD)

**Files:**
- Create: `server/csv-writer.js`
- Create: `tests/csv-writer.test.js`

- [ ] **Step 1: Write failing tests**

```javascript
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
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm test tests/csv-writer.test.js
```

- [ ] **Step 3: Implement csv-writer.js**

```javascript
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
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm test tests/csv-writer.test.js
```

- [ ] **Step 5: Commit**

```bash
git add server/csv-writer.js tests/csv-writer.test.js
git commit -m "feat: add CSV writer with append queue"
```

---

### Task 2: Barcode Cooldown + Mode Detection (TDD)

**Files:**
- Create: `web/src/debounce.js`
- Create: `web/src/mode.js`
- Create: `tests/debounce.test.js`
- Create: `tests/mode.test.js`

- [ ] **Step 1: debounce tests + implementation**

`web/src/debounce.js`:

```javascript
const COOLDOWN_MS = 1500;

export function shouldSkipBarcode(barcode, state, now = Date.now()) {
  if (!barcode) return false;
  if (barcode === state.lastBarcode && now - state.lastWrittenAt < COOLDOWN_MS) {
    return true;
  }
  return false;
}

export function recordBarcodeWrite(barcode, state, now = Date.now()) {
  state.lastBarcode = barcode;
  state.lastWrittenAt = now;
  return state;
}

export { COOLDOWN_MS };
```

Tests: same barcode within 1500ms → true; different barcode → false; after 1500ms → false.

- [ ] **Step 2: mode.js**

```javascript
export function getMode() {
  const host = globalThis.location?.hostname ?? '';
  return host.endsWith('github.io') ? 'cloud' : 'local';
}
```

Tests: mock `location.hostname` for `192.168.1.1` → local, `waynezprog.github.io` → cloud.

- [ ] **Step 3: Run all tests, commit**

```bash
pnpm test
git add web/src/debounce.js web/src/mode.js tests/debounce.test.js tests/mode.test.js
git commit -m "feat: add mode detection and barcode cooldown helpers"
```

---

### Task 3: Vite Local API Plugin

**Files:**
- Create: `server/vite-plugin-local-api.js`
- Create: `server/lan-url.js`
- Modify: `vite.config.js`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create vite-plugin-local-api.js**

```javascript
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
```

- [ ] **Step 2: Create lan-url.js**

```javascript
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
```

- [ ] **Step 3: Update vite.config.js**

```javascript
import { localApiPlugin } from './server/vite-plugin-local-api.js';

export default defineConfig({
  // ...existing...
  plugins: process.env.LOCAL_SERVER ? [localApiPlugin()] : [],
  server: {
    host: process.env.LOCAL_SERVER ? '0.0.0.0' : true,
  },
});
```

- [ ] **Step 4: Update package.json**

```json
"local": "LOCAL_SERVER=1 vite"
```

- [ ] **Step 5: Update .gitignore** — add `data/`

- [ ] **Step 6: Manual smoke**

```bash
pnpm local
# In another terminal:
curl -s -X POST http://localhost:5173/api/entries \
  -H 'Content-Type: application/json' \
  -d '{"operator":"測試","barcode":"999","description":"","note":""}'
```

Expected: `{"ok":true}`, `data/entries.csv` has row.

- [ ] **Step 7: Commit**

```bash
git add server/ vite.config.js package.json .gitignore
git commit -m "feat: add Vite local API plugin for CSV writes"
```

---

### Task 4: Feedback Module

**Files:**
- Create: `web/src/feedback.js`
- Modify: `web/index.html`, `web/styles.css`, `web/src/ui.js`

- [ ] **Step 1: feedback.js**

```javascript
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
  }
  return audioCtx;
}

function beep(freq, durationMs) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => osc.stop(), durationMs);
  } catch { /* silent */ }
}

export function feedbackSuccess() {
  beep(880, 120);
  navigator.vibrate?.(40);
  flash('success');
}

export function feedbackError() {
  beep(440, 100);
  setTimeout(() => beep(440, 100), 180);
  navigator.vibrate?.(80);
  flash('error');
}

export function initFeedback() {
  // Call on first user gesture to unlock AudioContext on iOS
  getAudioContext();
}

function flash(type) {
  const el = document.getElementById('flash-overlay');
  if (!el) return;
  el.className = `flash-overlay flash-${type}`;
  setTimeout(() => { el.className = 'flash-overlay hidden'; }, 300);
}
```

- [ ] **Step 2: Add to index.html before `</body>`**

```html
<div id="flash-overlay" class="flash-overlay hidden"></div>
<span id="mode-badge" class="mode-badge"></span>
```

(mode badge in header near h1)

- [ ] **Step 3: CSS**

```css
.mode-badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 999px; background: #e8e8ed; }
.mode-badge.local { background: #d1fae5; color: #065f46; }
.mode-badge.cloud { background: #dbeafe; color: #1e40af; }
.flash-overlay { position: fixed; inset: 0; z-index: 400; pointer-events: none; }
.flash-overlay.hidden { display: none; }
.flash-overlay.flash-success { background: rgba(52, 199, 89, 0.35); }
.flash-overlay.flash-error { background: rgba(255, 59, 48, 0.35); }
```

- [ ] **Step 4: ui.js — add `setModeBadge(mode)`**

- [ ] **Step 5: Commit**

```bash
git add web/src/feedback.js web/index.html web/styles.css web/src/ui.js
git commit -m "feat: add scan feedback beep, vibrate, and flash overlay"
```

---

### Task 5: API Routing by Mode

**Files:**
- Modify: `web/src/api.js`
- Modify: `tests/api.test.js`

- [ ] **Step 1: Update api.js**

```javascript
import { getMode } from './mode.js';

async function submitLocal(entry, normalized) {
  const body = JSON.stringify({
    operator: normalized.operator,
    barcode: normalized.barcode,
    description: normalized.description,
    note: normalized.note,
  });
  const response = await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch {
    return { ok: false, error: '寫入失敗：伺服器回應異常' };
  }
  if (!data.ok) return { ok: false, error: data.error ?? '寫入失敗' };
  return { ok: true };
}

export async function submitEntry(entry) {
  const normalized = normalizeEntry(entry);
  if (getMode() === 'local') {
    try {
      return await submitLocal(entry, normalized);
    } catch (err) {
      return { ok: false, error: `網路錯誤：${err.message}` };
    }
  }
  // existing cloud path unchanged...
}
```

- [ ] **Step 2: Add local mode test** — mock `getMode` → local, fetch `/api/entries`

- [ ] **Step 3: Run tests, commit**

```bash
pnpm test
git commit -m "feat: route API submit to local CSV or cloud Apps Script"
```

---

### Task 6: Continuous Scanner + Main Flow

**Files:**
- Modify: `web/src/scanner.js`
- Modify: `web/src/main.js`

- [ ] **Step 1: scanner.js — add decoding pause**

```javascript
let paused = false;

// inside decode callback:
if (paused) return;
if (result) onResult(result.getText());

return {
  start, stop,
  pause() { paused = true; },
  resume() { paused = false; },
};
```

- [ ] **Step 2: main.js local branch**

Key logic:

```javascript
import { getMode } from './mode.js';
import { shouldSkipBarcode, recordBarcodeWrite } from './debounce.js';
import { feedbackSuccess, feedbackError, initFeedback } from './feedback.js';

const cooldownState = { lastBarcode: '', lastWrittenAt: 0 };
let continuousActive = false;

function initMode() {
  const mode = getMode();
  setModeBadge(mode);
  $('scan-btn').textContent = mode === 'local' ? '開始掃碼' : '掃描條碼';
}

async function handleLocalScan(code) {
  const operator = getOperator() || $('operator-input').value.trim();
  if (!operator) { showToast('請輸入作業者', 'error'); return; }
  if (shouldSkipBarcode(code, cooldownState)) {
    showToast('剛掃過', 'error', 800);
    return;
  }
  scanner.pause();
  const fields = readFormFields();
  const entry = { operator, barcode: code, description: fields.description, note: fields.note };
  const response = await submitEntry(entry);
  if (!response.ok) {
    feedbackError();
    showToast(response.error, 'error');
    scanner.resume();
    return;
  }
  recordBarcodeWrite(code, cooldownState);
  feedbackSuccess();
  $('barcode-input').value = '';
  refreshSubmitState();
  scanner.resume();
}

function initScanner() {
  const mode = getMode();
  $('scan-btn').addEventListener('click', async () => {
    initFeedback();
    if (mode === 'local') {
      if (continuousActive) {
        continuousActive = false;
        await scanner.stop();
        overlay.classList.add('hidden');
        $('scan-btn').textContent = '開始掃碼';
        return;
      }
      continuousActive = true;
      $('scan-btn').textContent = '結束掃碼';
      overlay.classList.remove('hidden');
      await scanner.start(video, handleLocalScan, () => {});
      return;
    }
    // existing cloud single-scan flow...
  });
}
```

- [ ] **Step 3: Cloud initConfirmFlow unchanged**

- [ ] **Step 4: Manual test with `pnpm local`**

- [ ] **Step 5: Commit**

```bash
git add web/src/scanner.js web/src/main.js
git commit -m "feat: add local continuous scan with direct CSV write"
```

---

### Task 7: README + Docs

**Files:**
- Modify: `README.md`
- Commit spec doc

- [ ] **Step 1: README section**

```markdown
## 本機掃碼機模式（P2）

```bash
pnpm local
# iPhone Safari 開啟 Network URL 書籤
```

- 連續掃碼、直接寫入 `data/entries.csv`
- 語音/手動仍要確認
- GitHub Pages 書籤仍走雲端模式
```

- [ ] **Step 2: Commit docs**

```bash
git add docs/superpowers/specs/2026-06-06-local-csv-mode-design.md README.md
git commit -m "docs: add P2 local CSV mode spec and README"
```

---

### Task 8: Verification

- [ ] `pnpm test` — all pass
- [ ] `pnpm local` + curl API test
- [ ] iPhone on WiFi: continuous scan 3 barcodes → 3 CSV rows + beep
- [ ] 1.5s duplicate → no new row
- [ ] Voice/manual → confirm modal works
- [ ] GitHub Pages build still works (`pnpm build`)

---

## Spec Coverage

| Requirement | Task |
|-------------|------|
| `data/entries.csv` | 1, 3 |
| `POST /api/entries` | 3 |
| Append queue | 1 |
| Mode auto-detect | 2, 6 |
| Continuous scan | 6 |
| Direct barcode write | 6 |
| Voice/manual confirm | 6 (unchanged cloud path) |
| 1.5s cooldown | 2, 6 |
| Beep/vibrate/flash | 4, 6 |
| Description/note on scan | 6 |
| Clear barcode only | 6 |
| Cloud P1 preserved | 5, 6 |
| `pnpm local` + network URL | 3 |
| `data/` gitignored | 3 |

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-06-06-local-csv-mode.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task
2. **Inline Execution** — implement in this session

Which approach?
