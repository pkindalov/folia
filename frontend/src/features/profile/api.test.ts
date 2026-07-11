import { describe, test, expect, vi, beforeEach } from 'vitest';
import { updateProfile, uploadAvatar, removeAvatar, getPublicProfile } from './api';

const VALID_USER = {
  _id: '507f1f77bcf86cd799439011',
  username: 'pan',
  email: 'pan@test.com',
  roles: ['User'],
  avatarUrl: null,
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

describe('profile api service', () => {
  test('updateProfile puts the fields to the right endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ user: VALID_USER }));
    const user = await updateProfile({ username: 'newname', email: 'new@test.com' });
    expect(user.username).toBe('pan');

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/users\/me$/);
    expect(options!.method).toBe('PUT');
    expect(JSON.parse(options!.body as string)).toEqual({
      username: 'newname',
      email: 'new@test.com',
    });
  });

  test('updateProfile rejects a malformed API response (zod guard)', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ user: { bogus: true } }));
    await expect(updateProfile({ username: 'pan', email: 'pan@test.com' })).rejects.toThrow();
  });

  test('updateProfile surfaces the server error message', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'username already exists' }, 400));
    await expect(
      updateProfile({ username: 'taken', email: 'pan@test.com' })
    ).rejects.toThrow('username already exists');
  });

  test('uploadAvatar posts a FormData body with the file under "avatar"', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ user: { ...VALID_USER, avatarUrl: '/uploads/avatars/x/y.jpg' } })
    );
    const file = new File(['fake-bytes'], 'a.jpg', { type: 'image/jpeg' });
    const user = await uploadAvatar(file);
    expect(user.avatarUrl).toBe('/uploads/avatars/x/y.jpg');

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/users\/me\/avatar$/);
    expect(options!.method).toBe('POST');
    expect(options!.body).toBeInstanceOf(FormData);
    expect((options!.body as FormData).get('avatar')).toBe(file);
    // FormData needs the browser to set its own multipart boundary — the
    // caller must not have hardcoded a Content-Type header.
    expect((options!.headers as Record<string, string> | undefined)?.['Content-Type']).toBeUndefined();
  });

  test('removeAvatar deletes the avatar endpoint', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ user: VALID_USER }));
    await removeAvatar();
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/users\/me\/avatar$/);
    expect(options!.method).toBe('DELETE');
  });

  test('getPublicProfile fetches the user by username and never sees an email field', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ user: { _id: 'id2', username: 'maria', roles: ['User'], avatarUrl: null } })
    );
    const user = await getPublicProfile('maria');
    expect(user.username).toBe('maria');
    expect(user).not.toHaveProperty('email');

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/users\/maria$/);
  });

  test('getPublicProfile strips an email field if the server ever regresses and sends one', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        user: { _id: 'id2', username: 'maria', roles: ['User'], avatarUrl: null, email: 'leaked@test.com' },
      })
    );
    const user = await getPublicProfile('maria');
    expect(user).not.toHaveProperty('email');
  });

  test('getPublicProfile rejects a malformed API response (zod guard)', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ user: { bogus: true } }));
    await expect(getPublicProfile('maria')).rejects.toThrow();
  });

  test('getPublicProfile surfaces the server error message for an unknown user', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'User not found' }, 404));
    await expect(getPublicProfile('ghost')).rejects.toThrow('User not found');
  });
});
