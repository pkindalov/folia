import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import MyFlipbooksPage from './MyFlipbooksPage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const ME = { user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] } };

const ALBUMS = {
  albums: [
    { _id: 'a1', title: 'Summer in the Valley', description: 'Holidays', visibility: 'public', owner: 'id1', pageCount: 4 },
    { _id: 'a2', title: 'Letters from Home', description: '', visibility: 'private', owner: 'id1', pageCount: 0 },
  ],
};

/** fetch mock that routes by URL. */
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
  renderWithProviders(<MyFlipbooksPage />, {
    route: '/flipbooks',
    path: '/flipbooks',
    extraRoutes: (
      <>
        <Route path="/login" element={<div>Login screen</div>} />
        <Route path="/editor" element={<div>Editor new</div>} />
        <Route path="/editor/:id" element={<div>Editor edit</div>} />
      </>
    ),
  });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
});

describe('MyFlipbooksPage', () => {
  test('lists albums from the API', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums': { body: ALBUMS } });
    renderPage();
    expect(await screen.findByText('Summer in the Valley')).toBeInTheDocument();
    expect(screen.getByText('Letters from Home')).toBeInTheDocument();
    expect(screen.getByText('Start a New Volume')).toBeInTheDocument();
  });

  test('shows an empty-state invitation when there are no albums', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums': { body: { albums: [] } } });
    renderPage();
    expect(await screen.findByText(/Your shelf is empty/)).toBeInTheDocument();
  });

  test('filters albums by visibility', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums': { body: ALBUMS } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Summer in the Valley');

    await user.click(screen.getByRole('button', { name: 'Public' }));
    expect(screen.getByText('Summer in the Valley')).toBeInTheDocument();
    expect(screen.queryByText('Letters from Home')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All Volumes' }));
    expect(screen.getByText('Letters from Home')).toBeInTheDocument();
  });

  test('shows the API error when albums fail to load', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums': { body: { error: 'Failed to load albums' }, status: 500 },
    });
    renderPage();
    expect(await screen.findByText('Failed to load albums')).toBeInTheDocument();
  });

  test('edit button navigates to the album editor', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums': { body: ALBUMS } });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit Summer in the Valley' }));
    expect(await screen.findByText('Editor edit')).toBeInTheDocument();
  });

  test('create card navigates to the blank editor', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums': { body: ALBUMS } });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByText('Start a New Volume'));
    expect(await screen.findByText('Editor new')).toBeInTheDocument();
  });

  test('renders the album cover photo when one is set', async () => {
    const albumsWithCover = {
      albums: [
        { ...ALBUMS.albums[0], coverImage: '/uploads/id1/a1/cover.jpg' },
        ALBUMS.albums[1],
      ],
    };
    mockApi({ '/api/users/me': { body: ME }, '/api/albums': { body: albumsWithCover } });
    renderPage();
    await screen.findByText('Summer in the Valley');
    const coverImages = document.querySelectorAll('img[src="/uploads/id1/a1/cover.jpg"]');
    expect(coverImages).toHaveLength(1);
  });

  test('falls back to the placeholder color when an album has no cover photo', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums': { body: ALBUMS } });
    renderPage();
    await screen.findByText('Letters from Home');
    expect(document.querySelectorAll('img').length).toBe(0);
  });

  test('sign out clears the token and redirects to login', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums': { body: ALBUMS } });
    const user = userEvent.setup();
    renderPage();
    const [signOutButton] = await screen.findAllByRole('button', { name: /sign out/i });
    await user.click(signOutButton);
    expect(tokenStorage.get()).toBeNull();
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
  });
});
