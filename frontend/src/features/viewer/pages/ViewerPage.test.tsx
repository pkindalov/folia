import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

const PAGE_1 = {
  _id: 'p1',
  album: 'a1',
  filename: 'photo1.jpg',
  mimeType: 'image/jpeg',
  size: 1024,
  url: '/uploads/id1/a1/photo1.jpg',
};

const PAGE_2 = {
  _id: 'p2',
  album: 'a1',
  filename: 'photo2.jpg',
  mimeType: 'image/jpeg',
  size: 2048,
  url: '/uploads/id1/a1/photo2.jpg',
};

const PAGE_3 = {
  _id: 'p3',
  album: 'a1',
  filename: 'photo3.jpg',
  mimeType: 'image/jpeg',
  size: 3072,
  url: '/uploads/id1/a1/photo3.jpg',
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
});
