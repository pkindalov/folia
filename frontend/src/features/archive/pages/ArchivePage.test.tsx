import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ArchivePage from './ArchivePage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const ME = { user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] } };

const ARCHIVED_ALBUM = {
  _id: 'a1',
  title: 'The Founding Years',
  description: '',
  visibility: 'private',
  owner: 'id1',
  pageCount: 12,
  archived: true,
  coverImage: null,
};

const ARCHIVED_ALBUMS = { albums: [ARCHIVED_ALBUM], total: 1, page: 1, limit: 12 };

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
  renderWithProviders(<ArchivePage />, { route: '/archive', path: '/archive' });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
  calledUrls.length = 0;
});

describe('ArchivePage', () => {
  test('shows an empty-state message when nothing is archived', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/archived': { body: { albums: [], total: 0, page: 1, limit: 12 } },
    });
    renderPage();
    expect(await screen.findByText('Nothing has been archived yet.')).toBeInTheDocument();
  });

  test('lists archived albums from the API', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums/archived': { body: ARCHIVED_ALBUMS } });
    renderPage();
    expect(await screen.findByText('The Founding Years')).toBeInTheDocument();
    expect(screen.getByText('12 pages')).toBeInTheDocument();
  });

  test('shows the API error when archived albums fail to load', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/archived': { body: { error: 'Failed to load archived albums' }, status: 500 },
    });
    renderPage();
    expect(await screen.findByText('Failed to load archived albums')).toBeInTheDocument();
  });

  test('restoring a volume calls the API with archived: false', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/archived': { body: ARCHIVED_ALBUMS },
      '/api/albums/a1': { body: { album: { ...ARCHIVED_ALBUM, archived: false } } },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Restore The Founding Years' }));

    await waitFor(() => {
      const putCall = vi.mocked(fetch).mock.calls.find(([, options]) => options?.method === 'PUT');
      expect(putCall).toBeDefined();
      expect(JSON.parse(putCall![1]!.body as string)).toEqual({ archived: false });
    });
  });

  test('shows numbered pagination when there is more than one page', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/archived': { body: { ...ARCHIVED_ALBUMS, total: 30 } },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('The Founding Years');
    expect(screen.getByRole('button', { name: 'Page 3' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => {
      expect(calledUrls.some((url) => url.includes('page=2'))).toBe(true);
    });
  });

  test('falls back to the last valid page after restoring the only album on a later page', async () => {
    // 13 albums total: a full page 1 (a1..a12) and a lone album on page 2 (a13).
    const page1Albums = Array.from({ length: 12 }, (_, i) => ({
      ...ARCHIVED_ALBUM,
      _id: `a${i + 1}`,
      title: `Volume ${i + 1}`,
    }));
    const page2Album = { ...ARCHIVED_ALBUM, _id: 'a13', title: 'Volume 13' };
    let total = 13;

    vi.stubGlobal('fetch', vi.fn());
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      calledUrls.push(path);

      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (path.includes('/api/albums/archived')) {
        const page = new URL(path, 'http://localhost').searchParams.get('page') ?? '1';
        const albums = page === '2' ? (total === 13 ? [page2Album] : []) : page1Albums;
        const body = { albums, total, page: Number(page), limit: 12 };
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
      }
      if (path.includes('/api/albums/a13') && options?.method === 'PUT') {
        total = 12;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ album: { ...page2Album, archived: false } }),
        } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) } as Response);
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Volume 1');
    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await screen.findByText('Volume 13');

    await user.click(screen.getByRole('button', { name: 'Restore Volume 13' }));

    // Once the restore drops total to 12 (a single page), the page should
    // clamp back to 1 instead of showing a blank page 2 with no way back.
    // The stale (pre-restore) page-1 cache entry renders first with its old
    // total, so wait for its background refetch to settle on the new total
    // before asserting pagination is gone.
    await waitFor(() => {
      expect(screen.getByText('Volume 1')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
    });
  });
});
