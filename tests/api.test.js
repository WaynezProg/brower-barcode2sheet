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
