import { describe, test, expect, vi, beforeEach } from 'vitest';
import { deleteMyAccount } from './api';

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('settings api service', () => {
  test('deleteMyAccount deletes the /api/users/me endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ deleted: true }));
    await deleteMyAccount();

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/users\/me$/);
    expect(options!.method).toBe('DELETE');
  });

  test('deleteMyAccount surfaces the server error message', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: 'An Admin account cannot be self-deleted' }, 403)
    );
    await expect(deleteMyAccount()).rejects.toThrow('An Admin account cannot be self-deleted');
  });
});
