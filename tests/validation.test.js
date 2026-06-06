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
