import { describe, test, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  userSchema,
  authResponseSchema,
  meResponseSchema,
} from './schemas';

const VALID_USER = {
  _id: '507f1f77bcf86cd799439011',
  username: 'pan',
  email: 'pan@test.com',
  roles: ['User'],
};

describe('loginSchema', () => {
  test('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ username: 'pan', password: 'x' }).success).toBe(true);
  });

  test.each([
    ['empty username', { username: '', password: 'x' }, 'Username is required'],
    ['empty password', { username: 'pan', password: '' }, 'Password is required'],
  ])('rejects %s with message', (_name, input, message) => {
    const result = loginSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0].message).toBe(message);
  });

  test('rejects missing fields', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
    expect(loginSchema.safeParse({ username: 'pan' }).success).toBe(false);
  });

  test('rejects non-string values', () => {
    expect(loginSchema.safeParse({ username: 42, password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ username: 'pan', password: null }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  const valid = { username: 'pan', email: 'pan@test.com', password: 'secret123' };

  test('accepts a valid registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  test('mirrors backend username boundaries (3-30)', () => {
    expect(registerSchema.safeParse({ ...valid, username: 'ab' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, username: 'abc' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, username: 'x'.repeat(30) }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, username: 'x'.repeat(31) }).success).toBe(false);
  });

  test.each(['plainaddress', 'missing-at.com', 'no-domain@', 'two words@x.com'])(
    'rejects invalid email: "%s"',
    (email) => {
      expect(registerSchema.safeParse({ ...valid, email }).success).toBe(false);
    }
  );

  test('mirrors backend password boundaries (8-128)', () => {
    expect(registerSchema.safeParse({ ...valid, password: '1234567' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: '12345678' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, password: 'x'.repeat(128) }).success).toBe(true);
    expect(registerSchema.safeParse({ ...valid, password: 'x'.repeat(129) }).success).toBe(false);
  });

  test('provides human-readable messages', () => {
    const result = registerSchema.safeParse({ ...valid, password: 'short' });
    expect(result.error!.issues[0].message).toBe('Password must be at least 8 characters');
  });
});

describe('API response schemas', () => {
  test('userSchema accepts a valid user', () => {
    expect(userSchema.safeParse(VALID_USER).success).toBe(true);
  });

  test('userSchema passes through unknown extra fields', () => {
    const parsed = userSchema.parse({ ...VALID_USER, createdAt: '2026-01-01', extra: 42 });
    expect(parsed.extra).toBe(42);
  });

  test.each([
    ['missing _id', { ...VALID_USER, _id: undefined }],
    ['missing username', { ...VALID_USER, username: undefined }],
    ['roles not an array', { ...VALID_USER, roles: 'Admin' }],
    ['roles with non-strings', { ...VALID_USER, roles: [1, 2] }],
  ])('userSchema rejects %s', (_name, input) => {
    expect(userSchema.safeParse(input).success).toBe(false);
  });

  test('authResponseSchema requires token and user', () => {
    expect(authResponseSchema.safeParse({ token: 't', user: VALID_USER }).success).toBe(true);
    expect(authResponseSchema.safeParse({ user: VALID_USER }).success).toBe(false);
    expect(authResponseSchema.safeParse({ token: 't' }).success).toBe(false);
  });

  test('meResponseSchema requires a wrapped user', () => {
    expect(meResponseSchema.safeParse({ user: VALID_USER }).success).toBe(true);
    expect(meResponseSchema.safeParse(VALID_USER).success).toBe(false);
  });
});
