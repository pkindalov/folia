import { describe, test, expect, vi, beforeEach } from 'vitest';
import { login, register, fetchMe, logout } from './api';
import { tokenStorage } from '../../lib/api-client';

const VALID_USER = {
  _id: '507f1f77bcf86cd799439011',
  username: 'pan',
  email: 'pan@test.com',
  roles: ['User'],
};

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('auth api service', () => {
  test('login stores the token and returns the parsed response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ token: 'jwt-1', user: VALID_USER }));
    const result = await login({ username: 'pan', password: 'secret123' });
    expect(result.token).toBe('jwt-1');
    expect(result.user.username).toBe('pan');
    expect(tokenStorage.get()).toBe('jwt-1');
  });

  test('login posts credentials to the right endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ token: 't', user: VALID_USER }));
    await login({ username: 'pan', password: 'secret123' });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/auth\/login$/);
    expect(options!.method).toBe('POST');
    expect(JSON.parse(options!.body as string)).toEqual({
      username: 'pan',
      password: 'secret123',
    });
  });

  test('failed login does not store a token', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'Invalid username or password' }, 401));
    await expect(login({ username: 'pan', password: 'wrong' })).rejects.toThrow(
      'Invalid username or password'
    );
    expect(tokenStorage.get()).toBeNull();
  });

  test('login rejects a malformed API response (zod guard)', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ token: 'jwt-1', user: { bogus: true } }));
    await expect(login({ username: 'pan', password: 'secret123' })).rejects.toThrow();
    expect(tokenStorage.get()).toBeNull();
  });

  test('register stores the token on success', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ token: 'jwt-2', user: VALID_USER }, 201));
    await register({ username: 'pan', email: 'pan@test.com', password: 'secret123' });
    expect(tokenStorage.get()).toBe('jwt-2');
  });

  test('fetchMe unwraps and validates the user', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ user: VALID_USER }));
    const user = await fetchMe();
    expect(user.username).toBe('pan');
  });

  test('fetchMe rejects an invalid payload shape', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ user: { username: 'pan' } }));
    await expect(fetchMe()).rejects.toThrow();
  });

  test('logout clears the stored token', () => {
    tokenStorage.set('jwt-3');
    logout();
    expect(tokenStorage.get()).toBeNull();
  });
});
