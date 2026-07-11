import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import ViewerPage from './ViewerPage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders, createTestQueryClient } from '../../../tests/test-utils';

const ME = { user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] } };

const ALBUM = {
  album: {
    _id: 'a1',
    title: 'Summer in the Valley',
    description: 'Holidays 2025',
    visibility: 'private',
    owner: 'id1',
    pageCount: 0,
  },
};

const NO_REACTIONS = {
  counts: { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  total: 0,
  viewerReaction: null,
};

const PAGE_1 = {
  _id: 'p1',
  album: 'a1',
  filename: 'photo1.jpg',
  mimeType: 'image/jpeg',
  size: 1024,
  url: '/uploads/id1/a1/photo1.jpg',
  reactions: NO_REACTIONS,
};

const PAGE_2 = {
  _id: 'p2',
  album: 'a1',
  filename: 'photo2.jpg',
  mimeType: 'image/jpeg',
  size: 2048,
  url: '/uploads/id1/a1/photo2.jpg',
  reactions: NO_REACTIONS,
};

const PAGE_3 = {
  _id: 'p3',
  album: 'a1',
  filename: 'photo3.jpg',
  mimeType: 'image/jpeg',
  size: 3072,
  url: '/uploads/id1/a1/photo3.jpg',
  reactions: NO_REACTIONS,
};

function mockApi(routes: Record<string, { body: unknown; status?: number }>) {
  vi.mocked(fetch).mockImplementation((url, options) => {
    const method = options?.method ?? 'GET';
    const key = Object.keys(routes).find((k) => {
      const [m, suffix] = k.split(' ');
      return method === m && String(url).includes(suffix);
    });
    const { body, status = 200 } = routes[key ?? ''] ?? { body: { error: 'Not found' }, status: 404 };
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  });
}

const renderViewer = () =>
  renderWithProviders(<ViewerPage />, {
    route: '/book/a1',
    path: '/book/:id',
    extraRoutes: (
      <>
        <Route path="/flipbooks" element={<div>Gallery reached</div>} />
        <Route path="/editor/:id" element={<div>Editor reached</div>} />
      </>
    ),
  });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
});

describe('ViewerPage', () => {
  test('shows the real album title and description', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: ALBUM },
    });
    renderViewer();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Summer in the Valley' })
    ).toBeInTheDocument();
    expect(screen.getByText('Holidays 2025')).toBeInTheDocument();
  });

  test('shows an empty state when the volume has no pages', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: ALBUM },
    });
    renderViewer();
    expect(await screen.findByText('This volume has no pages yet.')).toBeInTheDocument();
    expect(screen.getByText('0 pages')).toBeInTheDocument();
  });

  test('close button returns to the gallery', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    renderViewer();
    await user.click(await screen.findByRole('link', { name: /close volume/i }));
    expect(await screen.findByText('Gallery reached')).toBeInTheDocument();
  });

  test('empty state links to the editor for this volume', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    renderViewer();
    await user.click(await screen.findByRole('link', { name: /add memories in the editor/i }));
    expect(await screen.findByText('Editor reached')).toBeInTheDocument();
  });

  test('shows an error message when the album fails to load', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: { error: 'Album not found' }, status: 404 },
    });
    renderViewer();
    expect(await screen.findByText('Album not found')).toBeInTheDocument();
  });

  test('shows the album\'s photo when it has one page', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE_1] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    renderViewer();
    const photo = await screen.findByAltText('photo1.jpg');
    expect(photo).toHaveAttribute('src', '/uploads/id1/a1/photo1.jpg');
    expect(screen.queryByText('This volume has no pages yet.')).not.toBeInTheDocument();
    expect(screen.queryByText(/photo 1 of/i)).not.toBeInTheDocument();
  });

  test('navigates between multiple photos', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE_1, PAGE_2] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    renderViewer();

    expect(await screen.findByAltText('photo1.jpg')).toBeInTheDocument();
    expect(screen.getByText('Photo 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /previous photo/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /next photo/i }));
    expect(await screen.findByAltText('photo2.jpg')).toBeInTheDocument();
    expect(screen.getByText('Photo 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next photo/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /previous photo/i }));
    expect(await screen.findByAltText('photo1.jpg')).toBeInTheDocument();
  });

  test('shows the photo\'s caption when it has one', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [{ ...PAGE_1, caption: 'A day at the lake' }] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    renderViewer();
    expect(await screen.findByText('"A day at the lake"')).toBeInTheDocument();
  });

  test('shows no caption text when the photo has none', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE_1] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    renderViewer();
    await screen.findByAltText('photo1.jpg');
    expect(screen.queryByText(/^"/)).not.toBeInTheDocument();
  });

  test('clicking the photo opens it full-size in a lightbox', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE_1, PAGE_2] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    renderViewer();

    await user.click(await screen.findByRole('button', { name: /view photo1\.jpg full size/i }));
    const dialog = await screen.findByRole('dialog', { name: /photo viewer/i });
    expect(within(dialog).getAllByAltText('photo1.jpg')).toHaveLength(1);

    await user.click(within(dialog).getByRole('button', { name: /next photo/i }));
    expect(within(dialog).getByAltText('photo2.jpg')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /close photo viewer/i }));
    expect(screen.queryByRole('dialog', { name: /photo viewer/i })).not.toBeInTheDocument();
  });

  test('closes the lightbox on Escape', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE_1] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    renderViewer();

    await user.click(await screen.findByRole('button', { name: /view photo1\.jpg full size/i }));
    await screen.findByRole('dialog', { name: /photo viewer/i });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /photo viewer/i })).not.toBeInTheDocument();
  });

  test('keeps showing the photo the lightbox was opened on, even if the page list changes underneath it', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE_1, PAGE_2, PAGE_3] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/book/a1']}>
          <Routes>
            <Route path="/book/:id" element={<ViewerPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await user.click(await screen.findByRole('button', { name: /next photo/i }));
    await screen.findByAltText('photo2.jpg');
    await user.click(screen.getByRole('button', { name: /view photo2\.jpg full size/i }));
    const dialog = await screen.findByRole('dialog', { name: /photo viewer/i });
    expect(within(dialog).getByAltText('photo2.jpg')).toBeInTheDocument();

    // Simulate photo1 being removed while the lightbox stays open on photo2.
    queryClient.setQueryData(['albums', 'a1', 'pages'], [PAGE_2, PAGE_3]);

    expect(await within(dialog).findByText('Photo 1 of 2')).toBeInTheDocument();
    expect(within(dialog).getByAltText('photo2.jpg')).toBeInTheDocument();
    expect(within(dialog).queryByAltText('photo3.jpg')).not.toBeInTheDocument();
  });

  test('closes the lightbox if the photo it is showing is itself removed', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE_1, PAGE_2] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    const user = userEvent.setup();
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/book/a1']}>
          <Routes>
            <Route path="/book/:id" element={<ViewerPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await user.click(await screen.findByRole('button', { name: /view photo1\.jpg full size/i }));
    await screen.findByRole('dialog', { name: /photo viewer/i });

    // Simulate photo1 — the one the lightbox is open on — being deleted from
    // another tab. It must close instead of silently swapping to photo2.
    queryClient.setQueryData(['albums', 'a1', 'pages'], [PAGE_2]);

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /photo viewer/i })).not.toBeInTheDocument()
    );
  });

  test('seeds the viewer at the photo referenced by ?photo=, not the first photo', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE_1, PAGE_2, PAGE_3] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    renderWithProviders(<ViewerPage />, {
      route: '/book/a1?photo=p2',
      path: '/book/:id',
    });

    expect(await screen.findByAltText('photo2.jpg')).toBeInTheDocument();
    expect(screen.getByText('Photo 2 of 3')).toBeInTheDocument();
  });

  test('falls back to the first photo when ?photo= does not match any page', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE_1, PAGE_2] } },
      'GET /api/albums/a1': { body: ALBUM },
    });
    renderWithProviders(<ViewerPage />, {
      route: '/book/a1?photo=does-not-exist',
      path: '/book/:id',
    });

    expect(await screen.findByAltText('photo1.jpg')).toBeInTheDocument();
    expect(screen.getByText('Photo 1 of 2')).toBeInTheDocument();
  });

  test('picking a reaction sends it to the server and reflects the new state once saved', async () => {
    let pagesFetchCount = 0;
    vi.mocked(fetch).mockImplementation((url, options) => {
      const method = options?.method ?? 'GET';
      const urlStr = String(url);
      const respond = (body: unknown, status = 200) =>
        Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response);

      if (urlStr.includes('/api/users/me')) return respond(ME);
      if (urlStr.includes('/api/albums/a1/pages') && method === 'GET') {
        pagesFetchCount += 1;
        // The first load has no reactions; once the reaction is saved and
        // the page list is refetched, the server reflects the new pick.
        const reactions =
          pagesFetchCount === 1
            ? NO_REACTIONS
            : { counts: { ...NO_REACTIONS.counts, love: 1 }, total: 1, viewerReaction: 'love' };
        return respond({ pages: [{ ...PAGE_1, reactions }] });
      }
      if (urlStr.includes('/reaction') && method === 'PUT') {
        return respond({
          reactions: { counts: { ...NO_REACTIONS.counts, love: 1 }, total: 1, viewerReaction: 'love' },
        });
      }
      if (urlStr.includes('/api/albums/a1')) return respond(ALBUM);
      return respond({ error: 'Not found' }, 404);
    });

    const user = userEvent.setup();
    renderViewer();

    await screen.findByAltText('photo1.jpg');
    await user.click(screen.getByRole('button', { name: /react to this photo/i }));
    await user.click(screen.getByRole('button', { name: 'Love' }));

    await waitFor(() => {
      const reactionCall = vi
        .mocked(fetch)
        .mock.calls.find(([u, o]) => String(u).includes('/reaction') && o?.method === 'PUT');
      expect(reactionCall).toBeDefined();
      expect(JSON.parse(reactionCall![1]!.body as string)).toEqual({ type: 'love' });
    });

    expect(await screen.findByRole('button', { name: /you reacted: love/i })).toHaveTextContent('Love');
  });

  test('shows an error toast when saving a reaction fails', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1/pages': { body: { pages: [PAGE_1] } },
      'GET /api/albums/a1': { body: ALBUM },
      'PUT /api/albums/a1/pages/p1/reaction': { body: { error: 'Could not save reaction' }, status: 500 },
    });
    const user = userEvent.setup();
    renderViewer();

    await screen.findByAltText('photo1.jpg');
    await user.click(screen.getByRole('button', { name: /react to this photo/i }));
    await user.click(screen.getByRole('button', { name: 'Like' }));

    expect(await screen.findByText('Could not save reaction')).toBeInTheDocument();
  });

  test("shows the album love button reflecting the album's current reaction state", async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': {
        body: { album: { ...ALBUM.album, reactions: { total: 3, viewerReacted: true } } },
      },
    });
    renderViewer();

    const button = await screen.findByRole('button', {
      name: 'You loved this album — tap to remove',
    });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'See who loved this album (3)' })
    ).toHaveTextContent('3');
  });

  test('toggling the love button sends a request and reflects the new state once saved', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': {
        body: { album: { ...ALBUM.album, reactions: { total: 2, viewerReacted: false } } },
      },
      'PUT /api/albums/a1/reaction': { body: { reactions: { total: 3, viewerReacted: true } } },
    });
    const user = userEvent.setup();
    renderViewer();

    expect(
      await screen.findByRole('button', { name: 'See who loved this album (2)' })
    ).toHaveTextContent('2');
    await user.click(screen.getByRole('button', { name: 'Love this album' }));

    await screen.findByRole('button', { name: 'You loved this album — tap to remove' });
    expect(
      screen.getByRole('button', { name: 'See who loved this album (3)' })
    ).toHaveTextContent('3');
  });

  test('shows an error toast when toggling the album love reaction fails', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: ALBUM },
      'PUT /api/albums/a1/reaction': { body: { error: 'Could not save reaction' }, status: 500 },
    });
    const user = userEvent.setup();
    renderViewer();

    await user.click(await screen.findByRole('button', { name: 'Love this album' }));

    expect(await screen.findByText('Could not save reaction')).toBeInTheDocument();
  });

  test('shows who loved the album, linked to their profiles, when the count is clicked', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': {
        body: {
          album: {
            ...ALBUM.album,
            reactions: { total: 2, viewerReacted: true, reactors: ['maria', 'sam'] },
          },
        },
      },
    });
    const user = userEvent.setup();
    renderViewer();

    const countButton = await screen.findByRole('button', {
      name: 'See who loved this album (2)',
    });
    expect(screen.queryByRole('link', { name: 'maria' })).not.toBeInTheDocument();

    await user.click(countButton);

    expect(screen.getByRole('link', { name: 'maria' })).toHaveAttribute('href', '/users/maria');
    expect(screen.getByRole('link', { name: 'sam' })).toHaveAttribute('href', '/users/sam');
  });

  test('the reactor list reflects a reaction toggled while the modal was closed', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': {
        body: {
          album: {
            ...ALBUM.album,
            reactions: { total: 1, viewerReacted: false, reactors: ['maria'] },
          },
        },
      },
      'PUT /api/albums/a1/reaction': {
        body: { reactions: { total: 2, viewerReacted: true, reactors: ['sam', 'maria'] } },
      },
    });
    const user = userEvent.setup();
    renderViewer();

    await user.click(await screen.findByRole('button', { name: 'Love this album' }));
    await screen.findByRole('button', { name: 'See who loved this album (2)' });

    await user.click(screen.getByRole('button', { name: 'See who loved this album (2)' }));

    expect(screen.getByRole('link', { name: 'sam' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'maria' })).toBeInTheDocument();
  });

  test('disables the count button when nobody has loved the album yet', async () => {
    mockApi({
      'GET /api/users/me': { body: ME },
      'GET /api/albums/a1': { body: ALBUM },
    });
    renderViewer();

    await screen.findByRole('button', { name: 'Love this album' });
    expect(screen.getByRole('button', { name: 'See who loved this album (0)' })).toBeDisabled();
  });
});
