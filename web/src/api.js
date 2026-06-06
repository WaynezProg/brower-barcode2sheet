import { normalizeEntry } from './validation.js';
import { getMode } from './mode.js';

function getConfig() {
  const cfg = globalThis.APP_CONFIG;
  if (!cfg?.APPS_SCRIPT_URL || !cfg?.WRITE_TOKEN) {
    throw new Error('Missing APP_CONFIG. Copy config.example.js to config.js');
  }
  return cfg;
}

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
  try {
    data = JSON.parse(text);
  } catch {
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

  const { APPS_SCRIPT_URL, WRITE_TOKEN } = getConfig();

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

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: '寫入失敗：伺服器回應異常（請確認 Apps Script 已 Deploy）' };
    }
    if (!data.ok) {
      return { ok: false, error: data.error ?? '寫入失敗' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `網路錯誤：${err.message}` };
  }
}
