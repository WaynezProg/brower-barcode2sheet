import { describe, expect, it } from 'vitest';
import { createStableReader } from '../web/src/scan-stability.js';

describe('createStableReader', () => {
  it('需要連續兩次相同條碼才採信', () => {
    const read = createStableReader(2);
    expect(read('123')).toBeNull();
    expect(read('123')).toBe('123');
  });

  it('條碼改變時重新計數', () => {
    const read = createStableReader(2);
    expect(read('123')).toBeNull();
    expect(read('456')).toBeNull();
    expect(read('456')).toBe('456');
  });

  it('空白讀取會重置狀態', () => {
    const read = createStableReader(2);
    expect(read('123')).toBeNull();
    expect(read('')).toBeNull();
    expect(read('123')).toBeNull();
    expect(read('123')).toBe('123');
  });
});
