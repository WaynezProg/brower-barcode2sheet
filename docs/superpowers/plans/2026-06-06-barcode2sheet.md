# Barcode2Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an iPhone Safari bookmarkable web app that scans barcodes or accepts voice/manual product descriptions, confirms entries, and appends rows to a fixed Google Sheet via Google Apps Script.

**Architecture:** Static HTTPS frontend (GitHub Pages + Vite) handles camera scanning (`@zxing/library`), voice/manual input, and confirmation UI. A separate Apps Script `doPost` endpoint validates a shared token, validates fields, and `appendRow`s to the bound Sheet. No Google Cloud.

**Tech Stack:** Vite, vanilla JS (ES modules), `@zxing/library`, Web Speech API, Vitest, Google Apps Script, GitHub Pages

**Spec:** `docs/superpowers/specs/2026-06-06-barcode2sheet-design.md`

---

## File Structure

```
brower-barcode2sheet/
├── apps-script/
│   └── Code.gs              # doPost: token check, validate, appendRow
├── web/
│   ├── index.html           # App shell, loads config.js then main.js
│   ├── styles.css           # Mobile-first iPhone layout
│   ├── config.example.js    # Template for APPS_SCRIPT_URL + WRITE_TOKEN
│   └── src/
│       ├── main.js          # Wire DOM events, app lifecycle
│       ├── validation.js    # Pure validation (unit-tested)
│       ├── operator.js      # localStorage read/write for operator name
│       ├── api.js           # POST to Apps Script
│       ├── scanner.js       # Camera + ZXing barcode decode
│       ├── voice.js           # Web Speech API wrapper
│       └── ui.js              # Modal, toast, form helpers
├── tests/
│   ├── validation.test.js
│   ├── operator.test.js
│   └── api.test.js
├── .github/workflows/
│   └── deploy.yml           # Build + deploy to GitHub Pages
├── .gitignore
├── package.json
├── vite.config.js
└── README.md                # Setup guide for Sheet + Apps Script + deploy
```

| File | Responsibility |
|------|----------------|
| `validation.js` | `validateEntry({ operator, barcode, description })` → `{ ok, error }` |
| `operator.js` | `getOperator()` / `saveOperator(name)` via `localStorage` |
| `api.js` | `submitEntry(payload)` → fetch Apps Script URL |
| `scanner.js` | Start/stop camera, decode barcode, callback on success |
| `voice.js` | Start/stop speech recognition, callback on result/error |
| `ui.js` | Show/hide confirm modal, toasts, enable/disable submit |
| `main.js` | Connect buttons to modules; orchestrate scan → confirm → submit |
| `Code.gs` | Server-side validation + Sheet write |

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `.gitignore`
- Create: `web/index.html` (minimal placeholder)

- [ ] **Step 1: Initialize git and package.json**

```bash
cd /Users/waynetu/claw_prog/projects/04-kurisu-github/brower-barcode2sheet
git init
```

Create `package.json`:

```json
{
  "name": "brower-barcode2sheet",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vite": "^6.3.5",
    "vitest": "^3.2.4",
    "jsdom": "^26.1.0"
  },
  "dependencies": {
    "@zxing/library": "^0.21.3"
  }
}
```

- [ ] **Step 2: Create vite.config.js**

```javascript
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'web',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'web/src'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['../tests/**/*.test.js'],
  },
});
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
web/config.js
.DS_Store
```

- [ ] **Step 4: Install dependencies**

```bash
pnpm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Create placeholder web/index.html**

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <title>商品輸入</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="app"></div>
    <script src="/config.js"></script>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.js .gitignore web/index.html
git commit -m "chore: scaffold vite project for barcode2sheet"
```

---

### Task 2: Validation Module (TDD)

**Files:**
- Create: `web/src/validation.js`
- Create: `tests/validation.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/validation.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { validateEntry } from '../web/src/validation.js';

describe('validateEntry', () => {
  it('rejects empty operator', () => {
    const result = validateEntry({ operator: '', barcode: '123', description: '' });
    expect(result).toEqual({ ok: false, error: '請輸入作業者名字' });
  });

  it('rejects whitespace-only operator', () => {
    const result = validateEntry({ operator: '   ', barcode: '123', description: '' });
    expect(result).toEqual({ ok: false, error: '請輸入作業者名字' });
  });

  it('rejects when barcode and description are both empty', () => {
    const result = validateEntry({ operator: '小明', barcode: '', description: '' });
    expect(result).toEqual({ ok: false, error: '請至少填寫條碼或商品描述' });
  });

  it('accepts barcode only', () => {
    const result = validateEntry({ operator: '小明', barcode: '4711234567890', description: '' });
    expect(result).toEqual({ ok: true });
  });

  it('accepts description only', () => {
    const result = validateEntry({ operator: '小明', barcode: '', description: '公仔 A' });
    expect(result).toEqual({ ok: true });
  });

  it('accepts both barcode and description', () => {
    const result = validateEntry({ operator: '小明', barcode: '123', description: '補充' });
    expect(result).toEqual({ ok: true });
  });

  it('trims fields before validating', () => {
    const result = validateEntry({ operator: ' 小明 ', barcode: ' ', description: '公仔' });
    expect(result).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test
```

Expected: FAIL — `validation.js` not found.

- [ ] **Step 3: Implement validation.js**

Create `web/src/validation.js`:

```javascript
export function validateEntry({ operator, barcode, description }) {
  const op = (operator ?? '').trim();
  const bc = (barcode ?? '').trim();
  const desc = (description ?? '').trim();

  if (!op) {
    return { ok: false, error: '請輸入作業者名字' };
  }
  if (!bc && !desc) {
    return { ok: false, error: '請至少填寫條碼或商品描述' };
  }
  return { ok: true };
}

export function normalizeEntry({ operator, barcode, description, note }) {
  return {
    operator: (operator ?? '').trim(),
    barcode: (barcode ?? '').trim(),
    description: (description ?? '').trim(),
    note: (note ?? '').trim(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/validation.js tests/validation.test.js
git commit -m "feat: add entry validation with tests"
```

---

### Task 3: Operator Storage Module (TDD)

**Files:**
- Create: `web/src/operator.js`
- Create: `tests/operator.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/operator.test.js`:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { getOperator, saveOperator, OPERATOR_KEY } from '../web/src/operator.js';

describe('operator storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty string when not set', () => {
    expect(getOperator()).toBe('');
  });

  it('saves and retrieves operator name', () => {
    saveOperator('小明');
    expect(localStorage.getItem(OPERATOR_KEY)).toBe('小明');
    expect(getOperator()).toBe('小明');
  });

  it('trims saved operator name', () => {
    saveOperator('  小華  ');
    expect(getOperator()).toBe('小華');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test tests/operator.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement operator.js**

Create `web/src/operator.js`:

```javascript
export const OPERATOR_KEY = 'barcode2sheet:operator';

export function getOperator() {
  return (localStorage.getItem(OPERATOR_KEY) ?? '').trim();
}

export function saveOperator(name) {
  const trimmed = (name ?? '').trim();
  if (trimmed) {
    localStorage.setItem(OPERATOR_KEY, trimmed);
  } else {
    localStorage.removeItem(OPERATOR_KEY);
  }
  return trimmed;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test tests/operator.test.js
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/operator.js tests/operator.test.js
git commit -m "feat: add operator localStorage helpers"
```

---

### Task 4: API Client Module (TDD)

**Files:**
- Create: `web/src/api.js`
- Create: `tests/api.test.js`
- Create: `web/config.example.js`

- [ ] **Step 1: Create config.example.js**

Create `web/config.example.js`:

```javascript
// Copy to web/config.js and fill in real values before deploy.
window.APP_CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  WRITE_TOKEN: 'your-shared-secret-token',
};
```

- [ ] **Step 2: Write failing tests**

Create `tests/api.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitEntry } from '../web/src/api.js';

describe('submitEntry', () => {
  beforeEach(() => {
    globalThis.APP_CONFIG = {
      APPS_SCRIPT_URL: 'https://example.com/exec',
      WRITE_TOKEN: 'test-token',
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.APP_CONFIG;
  });

  it('POSTs normalized payload and returns ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitEntry({
      operator: '小明',
      barcode: '123',
      description: '',
      note: '盒損',
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: 'test-token',
        operator: '小明',
        barcode: '123',
        description: '',
        note: '盒損',
      }),
    });
  });

  it('returns error when server responds with ok:false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, error: 'operator required' }),
    }));

    const result = await submitEntry({
      operator: '小明',
      barcode: '123',
      description: '',
      note: '',
    });

    expect(result).toEqual({ ok: false, error: 'operator required' });
  });

  it('returns network error on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const result = await submitEntry({
      operator: '小明',
      barcode: '123',
      description: '',
      note: '',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('network');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm test tests/api.test.js
```

Expected: FAIL — `api.js` not found.

- [ ] **Step 4: Implement api.js**

Create `web/src/api.js`:

```javascript
import { normalizeEntry } from './validation.js';

function getConfig() {
  const cfg = globalThis.APP_CONFIG;
  if (!cfg?.APPS_SCRIPT_URL || !cfg?.WRITE_TOKEN) {
    throw new Error('Missing APP_CONFIG. Copy config.example.js to config.js');
  }
  return cfg;
}

export async function submitEntry(entry) {
  const { APPS_SCRIPT_URL, WRITE_TOKEN } = getConfig();
  const normalized = normalizeEntry(entry);

  const body = JSON.stringify({
    token: WRITE_TOKEN,
    operator: normalized.operator,
    barcode: normalized.barcode,
    description: normalized.description,
    note: normalized.note,
  });

  try {
    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
    });

    const data = await response.json();
    if (!data.ok) {
      return { ok: false, error: data.error ?? '寫入失敗' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `網路錯誤：${err.message}` };
  }
}
```

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/api.js web/config.example.js tests/api.test.js
git commit -m "feat: add Apps Script API client with tests"
```

---

### Task 5: Google Apps Script Backend

**Files:**
- Create: `apps-script/Code.gs`
- Create: `apps-script/README.md` (setup steps)

- [ ] **Step 1: Create Code.gs**

Create `apps-script/Code.gs`:

```javascript
/** @OnlyCurrentDoc */

const WRITE_TOKEN = 'REPLACE_WITH_SAME_TOKEN_AS_FRONTEND';
const SHEET_NAME = 'Sheet1'; // or your tab name

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    if (payload.token !== WRITE_TOKEN) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 403);
    }

    const operator = (payload.operator || '').trim();
    const barcode = (payload.barcode || '').trim();
    const description = (payload.description || '').trim();
    const note = (payload.note || '').trim();

    if (!operator) {
      return jsonResponse({ ok: false, error: 'operator required' }, 400);
    }
    if (!barcode && !description) {
      return jsonResponse({ ok: false, error: 'barcode or description required' }, 400);
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const scannedAt = new Date().toISOString();
    sheet.appendRow([scannedAt, operator, barcode, description, note]);

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: 'write failed' }, 500);
  }
}

function jsonResponse(body, _statusCode) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 2: Create apps-script/README.md**

```markdown
# Apps Script Setup

1. Open your Google Sheet → Extensions → Apps Script.
2. Paste `Code.gs` contents. Set `WRITE_TOKEN` and `SHEET_NAME`.
3. First row headers: `掃描時間 | 作業者 | 條碼 | 商品名稱/描述 | 備註`
4. Deploy → New deployment → Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the deployment URL into `web/config.js` as `APPS_SCRIPT_URL`.
6. Test with curl:

```bash
curl -X POST 'YOUR_APPS_SCRIPT_URL' \
  -H 'Content-Type: text/plain' \
  -d '{"token":"YOUR_TOKEN","operator":"測試","barcode":"123","description":"","note":""}'
```

Expected: `{"ok":true}` and a new row in the Sheet.
```

- [ ] **Step 3: Manual verification (human step)**

Deploy Script per README, run curl test.

Expected: row appended with ISO timestamp.

- [ ] **Step 4: Commit**

```bash
git add apps-script/Code.gs apps-script/README.md
git commit -m "feat: add Apps Script doPost endpoint for sheet writes"
```

---

### Task 6: UI Shell (HTML + CSS)

**Files:**
- Modify: `web/index.html`
- Create: `web/styles.css`
- Create: `web/src/ui.js`

- [ ] **Step 1: Replace web/index.html with full markup**

```html
<!DOCTYPE html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>商品輸入</title>
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <main id="app" class="app">
      <header class="header">
        <h1>商品輸入</h1>
        <p class="operator-display">作業者：<span id="operator-label"></span></p>
      </header>

      <section class="card" id="operator-section">
        <label for="operator-input">作業者名字</label>
        <input id="operator-input" type="text" placeholder="輸入你的名字" autocomplete="name" />
      </section>

      <section class="card">
        <div class="actions">
          <button type="button" id="scan-btn" class="btn btn-primary">掃描條碼</button>
          <button type="button" id="voice-btn" class="btn btn-secondary">語音輸入</button>
        </div>
        <p class="hint">語音不穩時可直接在下方手動輸入</p>

        <label for="barcode-input">條碼</label>
        <input id="barcode-input" type="text" inputmode="numeric" />

        <label for="description-input">商品名稱 / 描述</label>
        <textarea id="description-input" rows="3"></textarea>

        <label for="note-input">備註</label>
        <input id="note-input" type="text" />

        <button type="button" id="submit-btn" class="btn btn-primary btn-block" disabled>送出</button>
      </section>
    </main>

    <!-- Scanner overlay -->
    <div id="scanner-overlay" class="overlay hidden" aria-hidden="true">
      <video id="scanner-video" playsinline muted></video>
      <div class="scanner-frame"></div>
      <button type="button" id="scanner-cancel" class="btn btn-secondary">取消掃描</button>
    </div>

    <!-- Confirm modal -->
    <div id="confirm-modal" class="modal hidden" role="dialog" aria-modal="true">
      <div class="modal-content">
        <h2>確認寫入</h2>
        <dl class="confirm-list">
          <dt>掃描時間</dt><dd>送出時自動產生</dd>
          <dt>作業者</dt><dd id="confirm-operator"></dd>
          <dt>條碼</dt><dd><input id="confirm-barcode" type="text" /></dd>
          <dt>商品名稱 / 描述</dt><dd><textarea id="confirm-description" rows="2"></textarea></dd>
          <dt>備註</dt><dd><input id="confirm-note" type="text" /></dd>
        </dl>
        <div class="modal-actions">
          <button type="button" id="confirm-cancel" class="btn btn-secondary">取消</button>
          <button type="button" id="confirm-submit" class="btn btn-primary">寫入</button>
        </div>
      </div>
    </div>

    <div id="toast" class="toast hidden" role="status"></div>

    <script src="/config.js"></script>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create web/styles.css**

```css
:root {
  --bg: #f5f5f7;
  --card: #ffffff;
  --text: #1d1d1f;
  --muted: #6e6e73;
  --primary: #0071e3;
  --danger: #ff3b30;
  --radius: 12px;
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
}

.app {
  max-width: 480px;
  margin: 0 auto;
  padding: 16px 16px calc(16px + var(--safe-bottom));
}

.header h1 { margin: 0 0 4px; font-size: 1.5rem; }
.operator-display { margin: 0 0 16px; color: var(--muted); }

.card {
  background: var(--card);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,.08);
}

label { display: block; margin: 12px 0 6px; font-weight: 600; font-size: 0.9rem; }
input, textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d2d2d7;
  border-radius: 8px;
  font-size: 1rem;
}

.actions { display: flex; gap: 8px; }
.hint { color: var(--muted); font-size: 0.85rem; margin: 8px 0 0; }

.btn {
  border: none;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 1rem;
  cursor: pointer;
}
.btn-primary { background: var(--primary); color: #fff; }
.btn-secondary { background: #e8e8ed; color: var(--text); }
.btn-block { width: 100%; margin-top: 16px; }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }

.overlay {
  position: fixed;
  inset: 0;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.overlay.hidden { display: none; }
#scanner-video { width: 100%; max-height: 70vh; object-fit: cover; }
.scanner-frame {
  position: absolute;
  width: 70%;
  height: 30%;
  border: 2px solid #fff;
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(0,0,0,.4);
}
#scanner-cancel { position: absolute; bottom: calc(24px + var(--safe-bottom)); }

.modal {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.45);
  display: flex;
  align-items: flex-end;
  z-index: 200;
}
.modal.hidden { display: none; }
.modal-content {
  background: var(--card);
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  border-radius: 16px 16px 0 0;
  padding: 20px 16px calc(20px + var(--safe-bottom));
}
.confirm-list { margin: 0 0 16px; }
.confirm-list dt { font-weight: 600; margin-top: 8px; }
.confirm-list dd { margin: 4px 0 0; }
.modal-actions { display: flex; gap: 8px; }
.modal-actions .btn { flex: 1; }

.toast {
  position: fixed;
  left: 16px;
  right: 16px;
  bottom: calc(16px + var(--safe-bottom));
  padding: 12px 16px;
  border-radius: 10px;
  color: #fff;
  text-align: center;
  z-index: 300;
}
.toast.hidden { display: none; }
.toast.success { background: #34c759; }
.toast.error { background: var(--danger); }
```

- [ ] **Step 3: Create web/src/ui.js**

```javascript
export function $(id) {
  return document.getElementById(id);
}

export function showToast(message, type = 'success', durationMs = 2500) {
  const el = $('toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => el.classList.add('hidden'), durationMs);
}

export function showModal(modalId) {
  $(modalId).classList.remove('hidden');
}

export function hideModal(modalId) {
  $(modalId).classList.add('hidden');
}

export function setSubmitEnabled(enabled) {
  $('submit-btn').disabled = !enabled;
}

export function clearEntryFields() {
  $('barcode-input').value = '';
  $('description-input').value = '';
  $('note-input').value = '';
}

export function readFormFields() {
  return {
    operator: $('operator-input').value,
    barcode: $('barcode-input').value,
    description: $('description-input').value,
    note: $('note-input').value,
  };
}

export function syncOperatorLabel(name) {
  $('operator-label').textContent = name || '（未設定）';
}

export function fillConfirmModal(entry) {
  $('confirm-operator').textContent = entry.operator;
  $('confirm-barcode').value = entry.barcode;
  $('confirm-description').value = entry.description;
  $('confirm-note').value = entry.note;
}

export function readConfirmModal(operator) {
  return {
    operator,
    barcode: $('confirm-barcode').value,
    description: $('confirm-description').value,
    note: $('confirm-note').value,
  };
}
```

- [ ] **Step 4: Visual check in dev**

Create local `web/config.js` from example (dummy values), then:

```bash
pnpm dev
```

Open `http://localhost:5173` — layout renders, buttons visible.

- [ ] **Step 5: Commit**

```bash
git add web/index.html web/styles.css web/src/ui.js
git commit -m "feat: add mobile-first UI shell and helpers"
```

---

### Task 7: Barcode Scanner Module

**Files:**
- Create: `web/src/scanner.js`

- [ ] **Step 1: Implement scanner.js**

```javascript
import { BrowserMultiFormatReader } from '@zxing/library';

export function createScanner() {
  const reader = new BrowserMultiFormatReader();
  let stream = null;
  let active = false;

  async function start(videoEl, onResult, onError) {
    if (active) return;
    active = true;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      videoEl.srcObject = stream;
      await videoEl.play();

      reader.decodeFromVideoDevice(undefined, videoEl, (result, err) => {
        if (result) {
          onResult(result.getText());
        }
        if (err && err.name !== 'NotFoundException') {
          onError?.(err);
        }
      });
    } catch (err) {
      active = false;
      onError?.(err);
      throw err;
    }
  }

  async function stop() {
    active = false;
    reader.reset();
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  return { start, stop };
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/scanner.js
git commit -m "feat: add ZXing camera scanner module"
```

---

### Task 8: Voice Input Module

**Files:**
- Create: `web/src/voice.js`

- [ ] **Step 1: Implement voice.js**

```javascript
export function createVoiceInput() {
  const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;

  function isSupported() {
    return Boolean(SpeechRecognition);
  }

  function start({ onResult, onError, onEnd }) {
    if (!isSupported()) {
      onError?.(new Error('此瀏覽器不支援語音輸入，請手動輸入'));
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript ?? '';
      onResult?.(text);
    };
    recognition.onerror = (event) => onError?.(new Error(event.error || '語音辨識失敗'));
    recognition.onend = () => onEnd?.();

    recognition.start();
    return recognition;
  }

  return { isSupported, start };
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/voice.js
git commit -m "feat: add Web Speech API voice input wrapper"
```

---

### Task 9: Main App Wiring

**Files:**
- Create: `web/src/main.js`

- [ ] **Step 1: Implement main.js**

```javascript
import { getOperator, saveOperator } from './operator.js';
import { validateEntry } from './validation.js';
import { submitEntry } from './api.js';
import { createScanner } from './scanner.js';
import { createVoiceInput } from './voice.js';
import {
  $, showToast, showModal, hideModal, setSubmitEnabled,
  clearEntryFields, readFormFields, syncOperatorLabel,
  fillConfirmModal, readConfirmModal,
} from './ui.js';

const scanner = createScanner();
const voice = createVoiceInput();

function refreshSubmitState() {
  const entry = readFormFields();
  const result = validateEntry(entry);
  setSubmitEnabled(result.ok);
  return result;
}

function initOperator() {
  const saved = getOperator();
  if (saved) {
    $('operator-input').value = saved;
    syncOperatorLabel(saved);
  }
  $('operator-input').addEventListener('input', () => {
    const name = saveOperator($('operator-input').value);
    syncOperatorLabel(name);
    refreshSubmitState();
  });
}

function initForm() {
  ['barcode-input', 'description-input', 'note-input'].forEach((id) => {
    $(id).addEventListener('input', refreshSubmitState);
  });
}

function initScanner() {
  $('scan-btn').addEventListener('click', async () => {
    const overlay = $('scanner-overlay');
    const video = $('scanner-video');
    overlay.classList.remove('hidden');

    try {
      await scanner.start(
        video,
        async (code) => {
          await scanner.stop();
          overlay.classList.add('hidden');
          $('barcode-input').value = code;
          refreshSubmitState();
          showToast('條碼已帶入');
        },
        () => {},
      );
    } catch {
      overlay.classList.add('hidden');
      showToast('無法開啟相機，請手動輸入條碼', 'error');
    }
  });

  $('scanner-cancel').addEventListener('click', async () => {
    await scanner.stop();
    $('scanner-overlay').classList.add('hidden');
  });
}

function initVoice() {
  $('voice-btn').addEventListener('click', () => {
    if (!voice.isSupported()) {
      showToast('語音不可用，請手動輸入', 'error');
      $('description-input').focus();
      return;
    }
    showToast('請開始說話…', 'success', 1500);
    voice.start({
      onResult: (text) => {
        $('description-input').value = text;
        refreshSubmitState();
        showToast('語音已帶入');
      },
      onError: (err) => {
        showToast(err.message, 'error');
        $('description-input').focus();
      },
    });
  });
}

function initConfirmFlow() {
  $('submit-btn').addEventListener('click', () => {
    const entry = readFormFields();
    const result = validateEntry(entry);
    if (!result.ok) {
      showToast(result.error, 'error');
      return;
    }
    fillConfirmModal(entry);
    showModal('confirm-modal');
  });

  $('confirm-cancel').addEventListener('click', () => hideModal('confirm-modal'));

  $('confirm-submit').addEventListener('click', async () => {
    const operator = getOperator() || $('operator-input').value.trim();
    const entry = readConfirmModal(operator);
    const result = validateEntry(entry);
    if (!result.ok) {
      showToast(result.error, 'error');
      return;
    }

    $('confirm-submit').disabled = true;
    const response = await submitEntry(entry);
    $('confirm-submit').disabled = false;

    if (!response.ok) {
      showToast(response.error, 'error');
      return;
    }

    hideModal('confirm-modal');
    clearEntryFields();
    refreshSubmitState();
    showToast('寫入成功');
  });
}

initOperator();
initForm();
initScanner();
initVoice();
initConfirmFlow();
refreshSubmitState();
```

- [ ] **Step 2: Local dev smoke test**

```bash
pnpm dev
```

Verify: operator input enables submit; modal opens; validation toasts work (API will fail without real config — expected).

- [ ] **Step 3: Commit**

```bash
git add web/src/main.js
git commit -m "feat: wire up scan, voice, confirm, and submit flow"
```

---

### Task 10: GitHub Pages Deploy

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

- [ ] **Step 1: Create deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install
      - name: Create runtime config
        run: |
          cat > web/config.js <<EOF
          window.APP_CONFIG = {
            APPS_SCRIPT_URL: '${{ secrets.APPS_SCRIPT_URL }}',
            WRITE_TOKEN: '${{ secrets.WRITE_TOKEN }}',
          };
          EOF
      - run: pnpm build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Create root README.md**

```markdown
# brower-barcode2sheet

iPhone Safari 商品輸入工具：掃條碼 / 語音 / 手動輸入 → 確認 → 寫入 Google Sheet。

## 開發

```bash
cp web/config.example.js web/config.js
# 填入 APPS_SCRIPT_URL 與 WRITE_TOKEN
pnpm install
pnpm dev
pnpm test
```

## 部署

1. 依 `apps-script/README.md` 設定 Google Sheet + Apps Script。
2. GitHub repo Settings → Secrets → `APPS_SCRIPT_URL`, `WRITE_TOKEN`。
3. Settings → Pages → Source: **GitHub Actions**。
4. Push to `main` → 取得 Pages URL → iPhone Safari 加入書籤。

## 手動測試（iPhone）

- [ ] 書籤開啟 HTTPS 頁面
- [ ] 輸入作業者，重新開啟仍記住
- [ ] 掃條碼成功帶入欄位
- [ ] 語音或手動輸入描述
- [ ] 確認 Modal 寫入成功
- [ ] 兩台手機同時寫入，Sheet 兩列正確
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "chore: add GitHub Pages deploy workflow and README"
```

---

### Task 11: End-to-End Verification

- [ ] **Step 1: Run unit tests**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 2: Production build**

```bash
cp web/config.example.js web/config.js
pnpm build
```

Expected: `dist/` contains `index.html`, assets, `config.js`.

- [ ] **Step 3: Apps Script curl test**

Per `apps-script/README.md` — POST test entry.

Expected: `{"ok":true}`, row in Sheet.

- [ ] **Step 4: iPhone Safari checklist**

| Case | Expected |
|------|----------|
| 掃碼成功寫入 | Sheet 新列正確 |
| 僅描述寫入 | 條碼空白、描述有值 |
| 作業者空白 | 送出 disabled / 錯誤提示 |
| 條碼描述皆空 | 錯誤提示 |
| 斷網寫入 | 錯誤 toast，表單保留 |
| 2 台同時寫入 | 兩列 append，無覆蓋 |
| 語音不可用 | 手動輸入可寫入 |

- [ ] **Step 5: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: address e2e verification issues"
```

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| 作業者手動輸入 + localStorage | Task 3, 9 |
| 固定 Google Sheet via Apps Script | Task 5 |
| iPhone Safari 書籤 HTTPS | Task 10 |
| 條碼掃描 @zxing/library | Task 7, 9 |
| 語音 Web Speech + 手動備援 | Task 8, 9 |
| 確認 Modal 後寫入 | Task 6, 9 |
| 五欄資料模型 | Task 5 |
| 前端 + 後端驗證 | Task 2, 5 |
| shared token | Task 4, 5 |
| 寫入失敗保留表單 | Task 9 |
| 多人 appendRow | Task 5 (architecture) |
| 防重複僅確認畫面 | Task 9 (no extra logic) |
| 測試計畫 | Task 11 |

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-06-barcode2sheet.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks
2. **Inline Execution** — execute tasks in this session with checkpoints

Which approach?
