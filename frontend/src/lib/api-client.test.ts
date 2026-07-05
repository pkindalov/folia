import { describe, test, expect, vi, beforeEach } from 'vitest';
import { api, ApiError, tokenStorage } from './api-client';

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

describe('tokenStorage', () => {
  test('set / get / clear roundtrip', () => {
    expect(tokenStorage.get()).toBeNull();
    tokenStorage.set('abc123');
    expect(tokenStorage.get()).toBe('abc123');
    tokenStorage.clear();
    expect(tokenStorage.get()).toBeNull();
  });

  test('set overwrites a previous token', () => {
    tokenStorage.set('first');
    tokenStorage.set('second');
    expect(tokenStorage.get()).toBe('second');
  });
});

describe('api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  test('sends JSON content type by default', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}));
    await api('/api/health');
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options!.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  test('does not send Authorization header without a token', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}));
    await api('/api/health');
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options!.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  test('sends Bearer token when one is stored', async () => {
    tokenStorage.set('my-jwt');
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}));
    await api('/api/users/me');
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect((options!.headers as Record<string, string>).Authorization).toBe('Bearer my-jwt');
  });

  test('prefixes the path with the API base URL', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}));
    await api('/api/health');
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/health$/);
    expect(String(url)).toMatch(/^http/);
  });

  test('returns the parsed JSON body on success', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ hello: 'world' }));
    await expect(api('/x')).resolves.toEqual({ hello: 'world' });
  });

  test('throws ApiError with the server-provided message', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'username already exists' }, 400));
    const err = (await api('/x').catch((e) => e)) as import('./api-client').ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.message).toBe('username already exists');
  });

  test('falls back to a generic message when the error body is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new SyntaxError('not json')),
    } as unknown as Response);
    const err = (await api('/x').catch((e) => e)) as import('./api-client').ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe('Request failed (502)');
  });

  test('falls back when the error field is not a string', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: { nested: true } }, 500));
    const err = (await api('/x').catch((e) => e)) as import('./api-client').ApiError;
    expect(err.message).toBe('Request failed (500)');
  });

  test('passes through method and body options', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}));
    await api('/x', { method: 'POST', body: JSON.stringify({ a: 1 }) });
    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options!.method).toBe('POST');
    expect(options!.body).toBe('{"a":1}');
  });

  test('propagates network failures (fetch rejects)', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api('/x')).rejects.toThrow('Failed to fetch');
  });
});
