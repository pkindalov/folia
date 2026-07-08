import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ExplorePage from './ExplorePage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders, createTestQueryClient } from '../../../tests/test-utils';

const ME = { user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] } };

const EMPTY_SHARED = { albums: [], total: 0, page: 1, limit: 12 };

const PUBLIC_ALBUMS = {
  albums: [
    {
      _id: 'a1',
      title: 'Summer in the Valley',
      description: 'Holidays',
      visibility: 'public',
      owner: 'id2',
      ownerUsername: 'elena',
      pageCount: 12,
      coverImage: '/uploads/id2/a1/cover.jpg',
    },
    {
      _id: 'a2',
      title: 'Letters from Home',
      description: '',
      visibility: 'public',
      owner: 'id3',
      ownerUsername: 'okafor',
      pageCount: 0,
      coverImage: null,
    },
  ],
  total: 2,
  page: 1,
  limit: 12,
};

const SHARED_ALBUM = {
  _id: 'a9',
  title: 'The Family Reunion',
  description: '',
  visibility: 'shared',
  owner: 'id3',
  ownerUsername: 'sam',
  pageCount: 2,
  coverImage: null,
};

const calledUrls: string[] = [];

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
  renderWithProviders(<ExplorePage />, { route: '/explore', path: '/explore' });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
  calledUrls.length = 0;
});

describe('ExplorePage', () => {
  test('lists public albums with their author and photo count', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/shared-with-me': { body: EMPTY_SHARED },
      '/api/albums/public': { body: PUBLIC_ALBUMS },
    });
    renderPage();
    expect(await screen.findByText('Summer in the Valley')).toBeInTheDocument();
    expect(screen.getByText('by elena')).toBeInTheDocument();
    expect(screen.getByText('12 pages')).toBeInTheDocument();
    expect(screen.getByText('Letters from Home')).toBeInTheDocument();
    expect(screen.getByText('by okafor')).toBeInTheDocument();
  });

  test('renders the cover photo when an album has one', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/shared-with-me': { body: EMPTY_SHARED },
      '/api/albums/public': { body: PUBLIC_ALBUMS },
    });
    renderPage();
    await screen.findByText('Summer in the Valley');
    expect(document.querySelectorAll('img[src="/uploads/id2/a1/cover.jpg"]')).toHaveLength(1);
  });

  test('shows an empty-state message when there are no public albums', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/shared-with-me': { body: EMPTY_SHARED },
      '/api/albums/public': { body: { albums: [], total: 0, page: 1, limit: 12 } },
    });
    renderPage();
    expect(await screen.findByText(/no public volumes yet/i)).toBeInTheDocument();
  });

  test('shows numbered pagination when there is more than one page', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/shared-with-me': { body: EMPTY_SHARED },
      '/api/albums/public': { body: { ...PUBLIC_ALBUMS, total: 30, limit: 12 } },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Summer in the Valley');
    expect(screen.getByRole('button', { name: 'Page 3' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => {
      expect(calledUrls.some((url) => url.includes('page=2'))).toBe(true);
    });
  });

  test('does not show pagination when everything fits on one page', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/shared-with-me': { body: EMPTY_SHARED },
      '/api/albums/public': { body: PUBLIC_ALBUMS },
    });
    renderPage();
    await screen.findByText('Summer in the Valley');
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  test('shows the API error when public albums fail to load', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/shared-with-me': { body: EMPTY_SHARED },
      '/api/albums/public': { body: { error: 'Failed to load public albums' }, status: 500 },
    });
    renderPage();
    expect(await screen.findByText('Failed to load public albums')).toBeInTheDocument();
  });

  test('shows a Shared With You section when albums are shared with the user', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/shared-with-me': {
        body: { albums: [SHARED_ALBUM], total: 1, page: 1, limit: 12 },
      },
      '/api/albums/public': { body: { albums: [], total: 0, page: 1, limit: 12 } },
    });
    renderPage();
    expect(await screen.findByText('Shared With You')).toBeInTheDocument();
    expect(screen.getByText('The Family Reunion')).toBeInTheDocument();
  });

  test('hides the Shared With You section when nothing has been shared', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/shared-with-me': { body: EMPTY_SHARED },
      '/api/albums/public': { body: PUBLIC_ALBUMS },
    });
    renderPage();
    await screen.findByText('Summer in the Valley');
    expect(screen.queryByText('Shared With You')).not.toBeInTheDocument();
  });

  test('shows the API error when shared-with-me albums fail to load', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/shared-with-me': { body: { error: 'Failed to load shared albums' }, status: 500 },
      '/api/albums/public': { body: PUBLIC_ALBUMS },
    });
    renderPage();
    expect(await screen.findByText('Failed to load shared albums')).toBeInTheDocument();
  });

  test('falls back to the last valid page after the public total shrinks on a later page', async () => {
    const page1Albums = Array.from({ length: 12 }, (_, i) => ({
      _id: `a${i + 1}`,
      title: `Volume ${i + 1}`,
      description: '',
      visibility: 'public',
      owner: 'id2',
      ownerUsername: 'elena',
      pageCount: 1,
      coverImage: null,
    }));
    const page2Album = { ...page1Albums[0], _id: 'a13', title: 'Volume 13' };
    let total = 13;
    vi.mocked(fetch).mockImplementation((url) => {
      const path = String(url);
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (path.includes('/api/albums/shared-with-me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(EMPTY_SHARED),
        } as Response);
      }
      const page = new URL(path, 'http://localhost').searchParams.get('page') ?? '1';
      const albums = page === '2' ? (total === 13 ? [page2Album] : []) : page1Albums;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ albums, total, page: Number(page), limit: 12 }),
      } as Response);
    });
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/explore']}>
          <Routes>
            <Route path="/explore" element={<ExplorePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await screen.findByText('Volume 1');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await screen.findByText('Volume 13');

    // The album on page 2 disappears from the public total (e.g. its owner
    // un-published it) — the page should clamp back to 1 instead of getting
    // stuck on a blank page with no pagination control to return.
    total = 12;
    await queryClient.invalidateQueries({ queryKey: ['albums', 'public'] });

    await waitFor(() => {
      expect(screen.getByText('Volume 1')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
    });
  });
});
