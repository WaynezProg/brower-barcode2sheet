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
