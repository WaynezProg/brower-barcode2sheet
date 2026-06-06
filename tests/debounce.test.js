import { describe, it, expect } from 'vitest';
import { shouldSkipBarcode, recordBarcodeWrite, COOLDOWN_MS } from '../web/src/debounce.js';

describe('shouldSkipBarcode', () => {
  it('returns false for empty barcode', () => {
    const state = { lastBarcode: '123', lastWrittenAt: 1000 };
    expect(shouldSkipBarcode('', state, 2000)).toBe(false);
  });

  it('returns true for same barcode within cooldown', () => {
    const state = { lastBarcode: '123', lastWrittenAt: 1000 };
    expect(shouldSkipBarcode('123', state, 1000 + COOLDOWN_MS - 1)).toBe(true);
  });

  it('returns false for different barcode', () => {
    const state = { lastBarcode: '123', lastWrittenAt: 1000 };
    expect(shouldSkipBarcode('456', state, 1500)).toBe(false);
  });

  it('returns false for same barcode after cooldown', () => {
    const state = { lastBarcode: '123', lastWrittenAt: 1000 };
    expect(shouldSkipBarcode('123', state, 1000 + COOLDOWN_MS)).toBe(false);
  });
});

describe('recordBarcodeWrite', () => {
  it('updates state with barcode and timestamp', () => {
    const state = { lastBarcode: '', lastWrittenAt: 0 };
    recordBarcodeWrite('789', state, 5000);
    expect(state).toEqual({ lastBarcode: '789', lastWrittenAt: 5000 });
  });
});
