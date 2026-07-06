import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import ExplorePage from './ExplorePage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const ME = { user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] } };

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
};

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
  renderWithProviders(<ExplorePage />, { route: '/explore', path: '/explore' });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
});

describe('ExplorePage', () => {
  test('lists public albums with their author and photo count', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums/public': { body: PUBLIC_ALBUMS } });
    renderPage();
    expect(await screen.findByText('Summer in the Valley')).toBeInTheDocument();
    expect(screen.getByText('by elena')).toBeInTheDocument();
    expect(screen.getByText('12 pages')).toBeInTheDocument();
    expect(screen.getByText('Letters from Home')).toBeInTheDocument();
    expect(screen.getByText('by okafor')).toBeInTheDocument();
  });

  test('renders the cover photo when an album has one', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums/public': { body: PUBLIC_ALBUMS } });
    renderPage();
    await screen.findByText('Summer in the Valley');
    expect(document.querySelectorAll('img[src="/uploads/id2/a1/cover.jpg"]')).toHaveLength(1);
  });

  test('shows an empty-state message when there are no public albums', async () => {
    mockApi({ '/api/users/me': { body: ME }, '/api/albums/public': { body: { albums: [] } } });
    renderPage();
    expect(await screen.findByText(/no public volumes yet/i)).toBeInTheDocument();
  });

  test('shows the API error when public albums fail to load', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/albums/public': { body: { error: 'Failed to load public albums' }, status: 500 },
    });
    renderPage();
    expect(await screen.findByText('Failed to load public albums')).toBeInTheDocument();
  });
});
