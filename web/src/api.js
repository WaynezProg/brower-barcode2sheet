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
