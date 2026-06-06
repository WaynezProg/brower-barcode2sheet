import { describe, it, expect, afterEach } from 'vitest';
import { getMode } from '../web/src/mode.js';

describe('getMode', () => {
  const originalLocation = globalThis.location;

  afterEach(() => {
    globalThis.location = originalLocation;
  });

  it('returns local for LAN IP hostname', () => {
    globalThis.location = { hostname: '192.168.1.1' };
    expect(getMode()).toBe('local');
  });

  it('returns cloud for github.io hostname', () => {
    globalThis.location = { hostname: 'waynezprog.github.io' };
    expect(getMode()).toBe('cloud');
  });

  it('returns local for localhost', () => {
    globalThis.location = { hostname: 'localhost' };
    expect(getMode()).toBe('local');
  });
});
