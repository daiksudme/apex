import { describe, expect, it } from 'vitest';
import { formatDate, formatIsoDate } from './date';

describe('date formatting', () => {
  it('uses the same Asia/Tokyo calendar date for visible and machine-readable dates', () => {
    const date = new Date('2026-10-01T00:00:00+09:00');

    expect(formatDate(date)).toBe('2026年10月1日');
    expect(formatIsoDate(date)).toBe('2026-10-01');
  });

  it('keeps date-only inputs on the same calendar day', () => {
    const date = new Date('2026-10-01');

    expect(formatDate(date)).toBe('2026年10月1日');
    expect(formatIsoDate(date)).toBe('2026-10-01');
  });
});
