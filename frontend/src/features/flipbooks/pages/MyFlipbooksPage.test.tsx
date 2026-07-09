import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import MyFlipbooksPage from './MyFlipbooksPage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const ME = { user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] } };

const ALBUM_1 = {
  _id: 'a1',
  title: 'Summer in the Valley',
  description: 'Holidays',
  visibility: 'public',
  owner: 'id1',
  pageCount: 4,
};
const ALBUM_2 = {
  _id: 'a2',
  title: 'Letters from Home',
  description: '',
  visibility: 'private',
  owner: 'id1',
  pageCount: 0,
};

const ALBUMS = { albums: [ALBUM_1, ALBUM_2], total: 2, page: 1, limit: 12 };

const calledUrls: string[] = [];

/** fetch mock that routes by URL. */
function mockApi(routes: Record<string, { body: unknown; status?: number }>) {
  vi.mocked(fetch).mockImplementation((url) => {
    const path = String(url);
    calledUrls.push(path);
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
  calledUrls.length = 0;
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
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums': { body: { albums: [], total: 0, page: 1, limit: 12 } },
    });
    renderPage();
    expect(await screen.findByText(/Your shelf is empty/)).toBeInTheDocument();
  });

  test('filters albums by visibility on the server', async () => {
    vi.mocked(fetch).mockImplementation((url) => {
      const path = String(url);
      calledUrls.push(path);
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      const isPublicOnly = path.includes('visibility=public');
      const albums = isPublicOnly ? [ALBUM_1] : [ALBUM_1, ALBUM_2];
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ albums, total: albums.length, page: 1, limit: 12 }),
      } as Response);
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Summer in the Valley');
    expect(screen.getByText('Letters from Home')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Public' }));
    await waitFor(() => {
      expect(calledUrls.some((url) => url.includes('visibility=public'))).toBe(true);
    });
    expect(screen.getByText('Summer in the Valley')).toBeInTheDocument();
    expect(screen.queryByText('Letters from Home')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All Volumes' }));
    expect(await screen.findByText('Letters from Home')).toBeInTheDocument();
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
      ...ALBUMS,
      albums: [{ ...ALBUM_1, coverImage: '/uploads/id1/a1/cover.jpg' }, ALBUM_2],
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

  test('shows numbered pagination and requests the clicked page', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums': { body: { ...ALBUMS, total: 30 } } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Summer in the Valley');
    expect(screen.getByRole('button', { name: 'Page 3' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => {
      expect(calledUrls.some((url) => url.includes('page=2'))).toBe(true);
    });
  });

  test('keeps the current page and pagination mounted while the next page loads', async () => {
    let resolvePage2!: (response: Response) => void;
    const page2Promise = new Promise<Response>((resolve) => {
      resolvePage2 = resolve;
    });
    vi.mocked(fetch).mockImplementation((url) => {
      const path = String(url);
      calledUrls.push(path);
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (path.includes('page=2')) {
        return page2Promise;
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...ALBUMS, total: 30 }),
      } as Response);
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Summer in the Valley');

    const page2Button = screen.getByRole('button', { name: 'Page 2' });
    await user.click(page2Button);
    await waitFor(() => {
      expect(calledUrls.some((url) => url.includes('page=2'))).toBe(true);
    });

    // The page-2 request is still in flight: the previous page's content and
    // the pager itself must stay mounted (and focus must stay put) instead of
    // unmounting into a bare loading state.
    expect(screen.getByText('Summer in the Valley')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toBe(document.activeElement);

    resolvePage2({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ albums: [ALBUM_2], total: 30, page: 2, limit: 12 }),
    } as Response);
    await waitFor(() => {
      expect(screen.queryByText('Summer in the Valley')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Letters from Home')).toBeInTheDocument();
  });

  test('only shows the create-volume tile on the first page', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums': { body: { ...ALBUMS, total: 30 } } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Summer in the Valley');
    expect(screen.getByText('Start a New Volume')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => {
      expect(calledUrls.some((url) => url.includes('page=2'))).toBe(true);
    });
    expect(screen.queryByText('Start a New Volume')).not.toBeInTheDocument();
  });
});
