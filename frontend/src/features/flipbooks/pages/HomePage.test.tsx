import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import HomePage from './HomePage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

const renderHome = () =>
  renderWithProviders(<HomePage />, {
    route: '/',
    path: '/',
    extraRoutes: <Route path="/login" element={<div>Login screen</div>} />,
  });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('HomePage', () => {
  test('shows the signed-in user info', async () => {
    tokenStorage.set('jwt-ok');
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] },
      })
    );
    renderHome();
    expect(await screen.findByText('pan')).toBeInTheDocument();
    expect(screen.getByText(/pan@test\.com/)).toBeInTheDocument();
    expect(screen.queryByText(/Admin/)).not.toBeInTheDocument();
  });

  test('marks admins visibly', async () => {
    tokenStorage.set('jwt-ok');
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        user: { _id: 'id1', username: 'boss', email: 'b@test.com', roles: ['Admin'] },
      })
    );
    renderHome();
    expect(await screen.findByText(/— Admin/)).toBeInTheDocument();
  });

  test('shows session-expired state when the token is rejected', async () => {
    tokenStorage.set('stale-jwt');
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'Invalid or expired token' }, 401));
    renderHome();
    expect(await screen.findByText('Session expired.')).toBeInTheDocument();
  });

  test('sign out clears the token and redirects to login', async () => {
    tokenStorage.set('jwt-ok');
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] },
      })
    );
    const user = userEvent.setup();
    renderHome();
    await user.click(await screen.findByRole('button', { name: /sign out/i }));
    expect(tokenStorage.get()).toBeNull();
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
  });
});
