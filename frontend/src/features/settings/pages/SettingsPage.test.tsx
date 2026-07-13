import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import SettingsPage from './SettingsPage';
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

const calledUrls: { url: string; method: string }[] = [];

function mockApi(routes: [string, { body: unknown; status?: number }][]) {
  vi.mocked(fetch).mockImplementation((url, options) => {
    const path = String(url);
    const method = options?.method ?? 'GET';
    calledUrls.push({ url: path, method });
    const match = routes.find(([suffix]) => path.includes(suffix));
    const { body, status = 200 } = match?.[1] ?? { body: { error: 'Not found' }, status: 404 };
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  });
}

const renderPage = () =>
  renderWithProviders(<SettingsPage />, {
    route: '/settings',
    path: '/settings',
    extraRoutes: <Route path="/login" element={<div>Login page</div>} />,
  });

const findMain = () => screen.findByRole('main');

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
  calledUrls.length = 0;
});

describe('SettingsPage', () => {
  test('shows the danger zone with a delete-account button', async () => {
    mockApi([['/api/users/me', { body: { user: ME } }]]);
    renderPage();
    const main = within(await findMain());

    expect(await main.findByText('Danger zone')).toBeInTheDocument();
    expect(main.getByRole('button', { name: /Delete my account/ })).toBeInTheDocument();
  });

  test('does nothing when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    mockApi([['/api/users/me', { body: { user: ME } }]]);
    const user = userEvent.setup();
    renderPage();
    const main = within(await findMain());
    await main.findByText('Danger zone');

    await user.click(main.getByRole('button', { name: /Delete my account/ }));

    expect(calledUrls.some((call) => call.method === 'DELETE')).toBe(false);
    expect(tokenStorage.get()).toBe('jwt-ok');
  });

  test('deletes the account, clears the session, and redirects to login when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      const method = options?.method ?? 'GET';
      calledUrls.push({ url: path, method });
      if (path.includes('/api/users/me') && method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ deleted: true }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: ME }),
      } as Response);
    });

    const user = userEvent.setup();
    renderPage();
    const main = within(await findMain());
    await main.findByText('Danger zone');

    await user.click(main.getByRole('button', { name: /Delete my account/ }));

    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(tokenStorage.get()).toBeNull();
  });

  test('shows an error toast and stays on the page when deletion fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      const method = options?.method ?? 'GET';
      calledUrls.push({ url: path, method });
      if (path.includes('/api/users/me') && method === 'DELETE') {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: 'An Admin account cannot be self-deleted' }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: ME }),
      } as Response);
    });

    const user = userEvent.setup();
    renderPage();
    const main = within(await findMain());
    await main.findByText('Danger zone');

    await user.click(main.getByRole('button', { name: /Delete my account/ }));

    expect(await screen.findByText('An Admin account cannot be self-deleted')).toBeInTheDocument();
    await waitFor(() => expect(tokenStorage.get()).toBe('jwt-ok'));
  });
});
