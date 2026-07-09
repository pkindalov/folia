import { describe, test, expect } from 'vitest';
import { formatRelativeTime } from './relativeTime';

const NOW = new Date('2026-07-09T12:00:00.000Z');

describe('formatRelativeTime', () => {
  test('renders "Just now" for under a minute', () => {
    expect(formatRelativeTime('2026-07-09T11:59:30.000Z', NOW)).toBe('Just now');
  });

  test('renders minutes ago under an hour', () => {
    expect(formatRelativeTime('2026-07-09T11:45:00.000Z', NOW)).toBe('15m ago');
  });

  test('renders hours ago under a day', () => {
    expect(formatRelativeTime('2026-07-09T09:00:00.000Z', NOW)).toBe('3h ago');
  });

  test('renders days ago under a week', () => {
    expect(formatRelativeTime('2026-07-06T12:00:00.000Z', NOW)).toBe('3d ago');
  });

  test('renders a short date at a week or older, omitting the year when current', () => {
    expect(formatRelativeTime('2026-06-01T12:00:00.000Z', NOW)).toBe('Jun 1');
  });

  test('includes the year when the date falls in a previous year', () => {
    expect(formatRelativeTime('2025-06-01T12:00:00.000Z', NOW)).toBe('Jun 1, 2025');
  });
});
