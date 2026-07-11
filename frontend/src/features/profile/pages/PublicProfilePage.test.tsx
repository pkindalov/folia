import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import PublicProfilePage from './PublicProfilePage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const MARIA = {
  _id: 'id2',
  username: 'maria',
  roles: ['User'],
  createdAt: '2024-05-19T00:00:00.000Z',
  avatarUrl: null,
};

const ME = {
  _id: 'id1',
  username: 'pan',
  email: 'pan@test.com',
  roles: ['User'],
  avatarUrl: null,
};

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

const renderPage = () =>
  renderWithProviders(<PublicProfilePage />, {
    route: '/users/maria',
    path: '/users/:username',
  });

const findMain = () => screen.findByRole('main');

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
});

describe('PublicProfilePage', () => {
  test('shows the requested user\'s username, role, and member-since', async () => {
    mockApi({ '/api/users/me': { body: { user: ME } }, '/api/users/maria': { body: { user: MARIA } } });
    renderPage();

    const main = within(await findMain());
    expect(await main.findByRole('heading', { name: 'maria' })).toBeInTheDocument();
    expect(main.getByText('User')).toBeInTheDocument();
    expect(main.getByText(/Member since May 19, 2024/)).toBeInTheDocument();
  });

  test('never renders owner-only controls', async () => {
    mockApi({ '/api/users/me': { body: { user: ME } }, '/api/users/maria': { body: { user: MARIA } } });
    renderPage();

    await screen.findByRole('heading', { name: 'maria' });
    expect(screen.queryByRole('button', { name: /edit profile/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/change photo/i)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument();
  });

  test('shows the server error message for an unknown user', async () => {
    mockApi({
      '/api/users/me': { body: { user: ME } },
      '/api/users/ghost': { body: { error: 'User not found' }, status: 404 },
    });
    renderWithProviders(<PublicProfilePage />, { route: '/users/ghost', path: '/users/:username' });

    expect(await screen.findByText('User not found')).toBeInTheDocument();
  });
});
