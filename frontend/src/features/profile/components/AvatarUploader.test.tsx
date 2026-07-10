import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvatarUploader from './AvatarUploader';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

function mockApi(routes: Record<string, { body: unknown; status?: number }>) {
  vi.mocked(fetch).mockImplementation((url) => {
    const path = String(url);
    const match = Object.entries(routes).find(([suffix]) => path.includes(suffix));
    const { body, status = 200 } = match?.[1] ?? { body: { error: 'Not found' }, status: 404 };
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  });
}

const renderUploader = (avatarUrl: string | null = null) =>
  renderWithProviders(<AvatarUploader username="pan" avatarUrl={avatarUrl} />);

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
});

describe('AvatarUploader', () => {
  test('rejects an unsupported file type before calling the API', async () => {
    mockApi({});
    renderUploader();

    // userEvent.upload() enforces the input's `accept` attribute the way a
    // real OS file picker would; fireEvent bypasses that to simulate the
    // case the code-level check actually guards against (e.g. a file
    // dropped in rather than picked, which the input's `accept` can't stop).
    const file = new File(['not an image'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Change photo'), { target: { files: [file] } });

    expect(await screen.findByText(/only jpeg, png, webp and gif/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('rejects an oversized file before calling the API', async () => {
    mockApi({});
    const user = userEvent.setup();
    renderUploader();

    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(screen.getByLabelText('Change photo'), oversized);

    expect(await screen.findByText(/too large/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('uploads a valid file', async () => {
    mockApi({
      '/api/users/me/avatar': { body: { user: { avatarUrl: '/uploads/avatars/x/y.jpg' } } },
    });
    const user = userEvent.setup();
    renderUploader();

    const file = new File(['fake-bytes'], 'a.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText('Change photo'), file);

    await waitFor(() => {
      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/api\/users\/me\/avatar$/);
      expect(options!.method).toBe('POST');
    });
  });

  test('does not show Remove photo when there is no avatar', () => {
    renderUploader(null);
    expect(screen.queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();
  });

  test('removes the avatar', async () => {
    mockApi({ '/api/users/me/avatar': { body: { user: { avatarUrl: null } } } });
    const user = userEvent.setup();
    renderUploader('/uploads/avatars/x/existing.jpg');

    await user.click(screen.getByRole('button', { name: 'Remove photo' }));

    await waitFor(() => {
      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(String(url)).toMatch(/\/api\/users\/me\/avatar$/);
      expect(options!.method).toBe('DELETE');
    });
  });
});
