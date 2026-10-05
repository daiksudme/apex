import { describe, expect, it } from 'vitest';
import { formatDate, formatIsoDate } from './date';

describe('date formatting', () => {
  it('uses the same Asia/Tokyo calendar date for visible and machine-readable dates', () => {
    const date = new Date('2026-10-01T00:00:00+09:00');

    expect(formatDate(date)).toBe('October 1, 2026');
    expect(formatIsoDate(date)).toBe('2026-10-01');
  });

  it('keeps date-only inputs on the same calendar day', () => {
    const date = new Date('2026-10-01');

    expect(formatDate(date)).toBe('October 1, 2026');
    expect(formatIsoDate(date)).toBe('2026-10-01');
  });
  it('keeps the day before Tokyo midnight in English and ISO dates', () => {
    const date = new Date('2026-09-30T14:59:59Z');

    expect(formatDate(date)).toBe('September 30, 2026');
    expect(formatIsoDate(date)).toBe('2026-09-30');
  });
});
