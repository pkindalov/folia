import { describe, test, expect } from 'vitest';
import { updateProfileSchema } from './schemas';

describe('updateProfileSchema', () => {
  const valid = { username: 'pan', email: 'pan@test.com' };

  test('accepts a valid update', () => {
    expect(updateProfileSchema.safeParse(valid).success).toBe(true);
  });

  test('mirrors backend username boundaries (3-30)', () => {
    expect(updateProfileSchema.safeParse({ ...valid, username: 'ab' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...valid, username: 'abc' }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ ...valid, username: 'x'.repeat(30) }).success).toBe(
      true
    );
    expect(updateProfileSchema.safeParse({ ...valid, username: 'x'.repeat(31) }).success).toBe(
      false
    );
  });

  test.each(['plainaddress', 'missing-at.com', 'no-domain@', 'two words@x.com'])(
    'rejects invalid email: "%s"',
    (email) => {
      expect(updateProfileSchema.safeParse({ ...valid, email }).success).toBe(false);
    }
  );

  test('rejects missing fields', () => {
    expect(updateProfileSchema.safeParse({ email: valid.email }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ username: valid.username }).success).toBe(false);
  });

  test('provides human-readable messages', () => {
    const result = updateProfileSchema.safeParse({ ...valid, username: 'ab' });
    expect(result.error!.issues[0].message).toBe('Username must be at least 3 characters');
  });
});
