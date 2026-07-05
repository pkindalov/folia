import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import MyFlipbooksPage from './MyFlipbooksPage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';
import { mockFlipbooks } from '../mock';

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response;

const ME = { user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] } };

const renderPage = () =>
  renderWithProviders(<MyFlipbooksPage />, {
    route: '/flipbooks',
    path: '/flipbooks',
    extraRoutes: <Route path="/login" element={<div>Login screen</div>} />,
  });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('MyFlipbooksPage', () => {
  test('shows the signed-in user in the shell', async () => {
    tokenStorage.set('jwt-ok');
    vi.mocked(fetch).mockResolvedValue(jsonResponse(ME));
    renderPage();
    expect(await screen.findByText('pan')).toBeInTheDocument();
    expect(screen.getByText(/pan@test\.com/)).toBeInTheDocument();
  });

  test('renders the gallery with all mock volumes', async () => {
    tokenStorage.set('jwt-ok');
    vi.mocked(fetch).mockResolvedValue(jsonResponse(ME));
    renderPage();
    expect(await screen.findByText('The Gallery')).toBeInTheDocument();
    for (const book of mockFlipbooks) {
      expect(screen.getByText(book.title)).toBeInTheDocument();
    }
    expect(screen.getByText('Start a New Volume')).toBeInTheDocument();
  });

  test('filters volumes by visibility', async () => {
    tokenStorage.set('jwt-ok');
    vi.mocked(fetch).mockResolvedValue(jsonResponse(ME));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('The Gallery');

    await user.click(screen.getByRole('button', { name: 'Public' }));
    expect(screen.getByText('Summer in the Valley')).toBeInTheDocument();
    expect(screen.queryByText('Letters from Home')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All Volumes' }));
    expect(screen.getByText('Letters from Home')).toBeInTheDocument();
  });

  test('shows session-expired state when the token is rejected', async () => {
    tokenStorage.set('stale-jwt');
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: 'Invalid or expired token' }, 401));
    renderPage();
    expect(await screen.findByText('Session expired.')).toBeInTheDocument();
  });

  test('sign out clears the token and redirects to login', async () => {
    tokenStorage.set('jwt-ok');
    vi.mocked(fetch).mockResolvedValue(jsonResponse(ME));
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /sign out/i }));
    expect(tokenStorage.get()).toBeNull();
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
  });
});
