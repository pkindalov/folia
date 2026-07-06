import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import ViewerPage from './ViewerPage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

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
});
