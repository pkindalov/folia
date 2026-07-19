import { describe, test, expect } from 'vitest';
import { formatRelativeTime, type RelativeTimeLabels } from './relativeTime';

const NOW = new Date('2026-07-09T12:00:00.000Z');

const EN_LABELS: RelativeTimeLabels = {
  justNow: 'Just now',
  minutesAgo: (n) => `${n}m ago`,
  hoursAgo: (n) => `${n}h ago`,
  daysAgo: (n) => `${n}d ago`,
};

const BG_LABELS: RelativeTimeLabels = {
  justNow: 'Току-що',
  minutesAgo: (n) => `преди ${n}м`,
  hoursAgo: (n) => `преди ${n}ч`,
  daysAgo: (n) => `преди ${n}д`,
};

describe('formatRelativeTime', () => {
  test('renders "Just now" for under a minute', () => {
    expect(formatRelativeTime('2026-07-09T11:59:30.000Z', EN_LABELS, 'en-US', NOW)).toBe(
      'Just now'
    );
  });

  test('renders minutes ago under an hour', () => {
    expect(formatRelativeTime('2026-07-09T11:45:00.000Z', EN_LABELS, 'en-US', NOW)).toBe(
      '15m ago'
    );
  });

  test('renders hours ago under a day', () => {
    expect(formatRelativeTime('2026-07-09T09:00:00.000Z', EN_LABELS, 'en-US', NOW)).toBe('3h ago');
  });

  test('renders days ago under a week', () => {
    expect(formatRelativeTime('2026-07-06T12:00:00.000Z', EN_LABELS, 'en-US', NOW)).toBe('3d ago');
  });

  test('renders a short date at a week or older, omitting the year when current', () => {
    expect(formatRelativeTime('2026-06-01T12:00:00.000Z', EN_LABELS, 'en-US', NOW)).toBe('Jun 1');
  });

  test('includes the year when the date falls in a previous year', () => {
    expect(formatRelativeTime('2025-06-01T12:00:00.000Z', EN_LABELS, 'en-US', NOW)).toBe(
      'Jun 1, 2025'
    );
  });

  test('clamps a future timestamp (clock skew) to "Just now" instead of a negative duration', () => {
    expect(formatRelativeTime('2026-07-09T12:05:00.000Z', EN_LABELS, 'en-US', NOW)).toBe(
      'Just now'
    );
  });

  test('renders "Just now" for an unparseable timestamp instead of "Invalid Date"', () => {
    expect(formatRelativeTime('not-a-date', EN_LABELS, 'en-US', NOW)).toBe('Just now');
  });

  test('is label-agnostic — a different language plugs in cleanly', () => {
    expect(formatRelativeTime('2026-07-09T11:59:30.000Z', BG_LABELS, 'bg-BG', NOW)).toBe(
      'Току-що'
    );
    expect(formatRelativeTime('2026-07-09T11:45:00.000Z', BG_LABELS, 'bg-BG', NOW)).toBe(
      'преди 15м'
    );
    expect(formatRelativeTime('2026-07-09T09:00:00.000Z', BG_LABELS, 'bg-BG', NOW)).toBe(
      'преди 3ч'
    );
    expect(formatRelativeTime('2026-07-06T12:00:00.000Z', BG_LABELS, 'bg-BG', NOW)).toBe(
      'преди 3д'
    );
  });

  test('formats the week-or-older fallback date using the given locale', () => {
    const enDate = formatRelativeTime('2026-06-01T12:00:00.000Z', EN_LABELS, 'en-US', NOW);
    const bgDate = formatRelativeTime('2026-06-01T12:00:00.000Z', BG_LABELS, 'bg-BG', NOW);
    expect(enDate).not.toBe(bgDate);
  });
});
