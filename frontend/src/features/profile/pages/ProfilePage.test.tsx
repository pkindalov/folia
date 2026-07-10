import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfilePage from './ProfilePage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const ME = {
  _id: 'id1',
  username: 'pan',
  email: 'pan@test.com',
  roles: ['User'],
  createdAt: '2024-05-19T00:00:00.000Z',
  avatarUrl: null,
};

const CIRCLE_1 = {
  _id: 'c1',
  name: 'The Sterling Family',
  description: '',
  owner: 'id1',
  ownerUsername: 'pan',
  members: [
    { user: 'u2', username: 'maria', status: 'accepted' },
    { user: 'u3', username: 'sam', status: 'accepted' },
  ],
};

const EMPTY_CIRCLES = { circles: [], total: 0, page: 1, limit: 12 };

const calledUrls: { url: string; method: string; body?: unknown }[] = [];

function mockApi(routes: Record<string, { body: unknown; status?: number }>) {
  vi.mocked(fetch).mockImplementation((url, options) => {
    const path = String(url);
    calledUrls.push({ url: path, method: options?.method ?? 'GET', body: options?.body });
    const match = Object.entries(routes).find(([suffix]) => path.includes(suffix));
    const { body, status = 200 } = match?.[1] ?? { body: { error: 'Not found' }, status: 404 };
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  });
}

const renderPage = () =>
  renderWithProviders(<ProfilePage />, { route: '/profile', path: '/profile' });

// AppShell renders both its mobile header and desktop sidebar at once in
// jsdom (no real CSS, so the `md:hidden`/`hidden md:flex` breakpoint classes
// don't actually hide anything) — both repeat the signed-in user's name and
// avatar initial. Scoping queries to the page's own <main> region sidesteps
// that duplication instead of asserting against the whole document.
const findMain = () => screen.findByRole('main');

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
  calledUrls.length = 0;
});

describe('ProfilePage', () => {
  test('shows the identity card with username, email, role, and member-since', async () => {
    mockApi({
      '/api/users/me': { body: { user: ME } },
      '/api/circles': { body: EMPTY_CIRCLES },
    });
    renderPage();
    const main = within(await findMain());

    expect(await main.findByText('pan')).toBeInTheDocument();
    expect(main.getByText('pan@test.com')).toBeInTheDocument();
    expect(main.getByText('User')).toBeInTheDocument();
    expect(main.getByText(/Member since May 19, 2024/)).toBeInTheDocument();
  });

  test('falls back to initials when the user has no avatar', async () => {
    mockApi({
      '/api/users/me': { body: { user: ME } },
      '/api/circles': { body: EMPTY_CIRCLES },
    });
    renderPage();
    const main = within(await findMain());
    await main.findByText('pan');
    expect(main.getByText('P')).toBeInTheDocument();
  });

  test('edits the profile and shows the updated values', async () => {
    let currentUser = ME;
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      calledUrls.push({ url: path, method: options?.method ?? 'GET' });
      if (path.includes('/api/users/me') && options?.method === 'PUT') {
        currentUser = { ...currentUser, username: 'newname', email: 'new@test.com' };
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ user: currentUser }),
        } as Response);
      }
      if (path.includes('/api/users/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ user: currentUser }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(EMPTY_CIRCLES),
      } as Response);
    });

    const user = userEvent.setup();
    renderPage();
    const main = within(await findMain());
    await main.findByText('pan');

    await user.click(main.getByRole('button', { name: 'Edit Profile' }));
    const usernameInput = main.getByLabelText('Username');
    const emailInput = main.getByLabelText('Email');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'newname');
    await user.clear(emailInput);
    await user.type(emailInput, 'new@test.com');
    await user.click(main.getByRole('button', { name: 'Save changes' }));

    expect(await main.findByText('newname')).toBeInTheDocument();
    expect(main.getByText('new@test.com')).toBeInTheDocument();
  });

  test('shows a validation error for an invalid email without calling the API', async () => {
    mockApi({
      '/api/users/me': { body: { user: ME } },
      '/api/circles': { body: EMPTY_CIRCLES },
    });
    const user = userEvent.setup();
    renderPage();
    const main = within(await findMain());
    await main.findByText('pan');

    await user.click(main.getByRole('button', { name: 'Edit Profile' }));
    const emailInput = main.getByLabelText('Email');
    await user.clear(emailInput);
    await user.type(emailInput, 'not-an-email');
    await user.click(main.getByRole('button', { name: 'Save changes' }));

    expect(await main.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(calledUrls.some((call) => call.method === 'PUT')).toBe(false);
  });

  test('cancel exits edit mode without saving', async () => {
    mockApi({
      '/api/users/me': { body: { user: ME } },
      '/api/circles': { body: EMPTY_CIRCLES },
    });
    const user = userEvent.setup();
    renderPage();
    const main = within(await findMain());
    await main.findByText('pan');

    await user.click(main.getByRole('button', { name: 'Edit Profile' }));
    expect(main.getByLabelText('Username')).toBeInTheDocument();
    await user.click(main.getByRole('button', { name: 'Cancel' }));

    expect(main.queryByLabelText('Username')).not.toBeInTheDocument();
    expect(main.getByRole('button', { name: 'Edit Profile' })).toBeInTheDocument();
  });

  test('uploads an avatar photo', async () => {
    const withAvatar = { ...ME, avatarUrl: '/uploads/avatars/id1/new.jpg' };
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      calledUrls.push({ url: path, method: options?.method ?? 'GET' });
      if (path.includes('/api/users/me/avatar') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ user: withAvatar }),
        } as Response);
      }
      if (path.includes('/api/users/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ user: ME }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(EMPTY_CIRCLES),
      } as Response);
    });

    const user = userEvent.setup();
    renderPage();
    const main = within(await findMain());
    await main.findByText('pan');

    const file = new File(['fake-bytes'], 'new.jpg', { type: 'image/jpeg' });
    const input = main.getByLabelText('Change photo') as HTMLInputElement;
    await user.upload(input, file);

    await waitFor(() => {
      expect(
        calledUrls.some(
          (call) => call.url.includes('/api/users/me/avatar') && call.method === 'POST'
        )
      ).toBe(true);
    });
  });

  test('shows Remove photo only when an avatar is set, and removes it', async () => {
    const withAvatar = { ...ME, avatarUrl: '/uploads/avatars/id1/existing.jpg' };
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      calledUrls.push({ url: path, method: options?.method ?? 'GET' });
      if (path.includes('/api/users/me/avatar') && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ user: ME }),
        } as Response);
      }
      if (path.includes('/api/users/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ user: withAvatar }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(EMPTY_CIRCLES),
      } as Response);
    });

    const user = userEvent.setup();
    renderPage();
    const main = within(await findMain());
    await main.findByText('pan');

    const removeButton = main.getByRole('button', { name: 'Remove photo' });
    await user.click(removeButton);

    await waitFor(() => {
      expect(
        calledUrls.some(
          (call) => call.url.includes('/api/users/me/avatar') && call.method === 'DELETE'
        )
      ).toBe(true);
    });
  });

  test('does not show Remove photo when the user has no avatar', async () => {
    mockApi({
      '/api/users/me': { body: { user: ME } },
      '/api/circles': { body: EMPTY_CIRCLES },
    });
    renderPage();
    const main = within(await findMain());
    await main.findByText('pan');
    expect(main.queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();
  });

  test('shows a circles summary with member counts and a link to /circles', async () => {
    mockApi({
      '/api/users/me': { body: { user: ME } },
      '/api/circles': { body: { circles: [CIRCLE_1], total: 1, page: 1, limit: 12 } },
    });
    renderPage();
    const main = within(await findMain());

    expect(await main.findByText('The Sterling Family')).toBeInTheDocument();
    expect(main.getByText('2 members')).toBeInTheDocument();
    expect(main.getByRole('link', { name: 'View All Circles' })).toHaveAttribute(
      'href',
      '/circles'
    );
  });

  test('shows an empty-state message and can open the create-circle modal', async () => {
    mockApi({
      '/api/users/me': { body: { user: ME } },
      '/api/circles': { body: EMPTY_CIRCLES },
    });
    const user = userEvent.setup();
    renderPage();
    const main = within(await findMain());

    expect(await main.findByText(/haven't created any circles/)).toBeInTheDocument();
    await user.click(main.getByRole('button', { name: 'Create your first circle' }));
    expect(await screen.findByText('New Circle')).toBeInTheDocument();
  });
});
