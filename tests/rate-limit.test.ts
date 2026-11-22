import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkRateLimit } from '../src/rate-limit.js';

describe('checkRateLimit', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true when under limit', () => {
    expect(checkRateLimit('test-ip-1', 5, 60_000)).toBe(true);
  });

  it('returns false when limit exceeded', () => {
    const key = 'test-ip-exceed';
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    expect(checkRateLimit(key, 3, 60_000)).toBe(false);
  });

  it('resets after window expires', () => {
    vi.useFakeTimers();
    const key = 'test-ip-reset';
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    expect(checkRateLimit(key, 3, 60_000)).toBe(false);
    vi.advanceTimersByTime(61_000);
    expect(checkRateLimit(key, 3, 60_000)).toBe(true);
  });
});
