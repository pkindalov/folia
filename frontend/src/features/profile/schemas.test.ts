import { describe, test, expect } from 'vitest';
import { updateProfileSchema, publicUserSchema, publicProfileResponseSchema } from './schemas';

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

  test('rejects a whitespace-only username and trims valid input', () => {
    expect(updateProfileSchema.safeParse({ ...valid, username: '   ' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({ ...valid, username: ' ab' }).success).toBe(false);

    const result = updateProfileSchema.safeParse({ ...valid, username: '  pan  ' });
    expect(result.success).toBe(true);
    expect(result.data?.username).toBe('pan');
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

describe('publicUserSchema', () => {
  const valid = { _id: 'id2', username: 'maria', roles: ['User'], avatarUrl: null };

  test('accepts a valid public user, without an email field', () => {
    const result = publicUserSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('email');
  });

  test('rejects a payload missing username', () => {
    const { username: _username, ...rest } = valid;
    expect(publicUserSchema.safeParse(rest).success).toBe(false);
  });

  test('strips an email field if the backend ever regresses and includes one', () => {
    const result = publicUserSchema.safeParse({ ...valid, email: 'leaked@test.com' });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty('email');
  });

  test('publicProfileResponseSchema parses the { user } envelope', () => {
    const result = publicProfileResponseSchema.safeParse({ user: valid });
    expect(result.success).toBe(true);
    expect(result.data?.user.username).toBe('maria');
  });
});
