import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CirclesPage from './CirclesPage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const ME = { user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] } };

const CIRCLE_1 = {
  _id: 'c1',
  name: 'The Sterling Family',
  description: 'Keeping track of the whole clan',
  owner: 'id1',
  ownerUsername: 'pan',
  members: [
    { user: 'u2', username: 'maria', status: 'accepted' },
    { user: 'u3', username: 'sam', status: 'accepted' },
  ],
};
const CIRCLE_2 = {
  _id: 'c2',
  name: 'Oxford Class of 88',
  description: '',
  owner: 'id1',
  ownerUsername: 'pan',
  members: [],
};

const CIRCLES = { circles: [CIRCLE_1, CIRCLE_2], total: 2, page: 1, limit: 12 };

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
  renderWithProviders(<CirclesPage />, { route: '/circles', path: '/circles' });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
  calledUrls.length = 0;
});

describe('CirclesPage', () => {
  test('lists circles from the API', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/circles/invites': { body: { invites: [], total: 0, page: 1, limit: 12 } },
      '/api/circles': { body: CIRCLES },
    });
    renderPage();
    expect(await screen.findByText('The Sterling Family')).toBeInTheDocument();
    expect(screen.getByText('Oxford Class of 88')).toBeInTheDocument();
    expect(screen.getByText('Keeping track of the whole clan')).toBeInTheDocument();
    expect(screen.getByText('Create New Circle')).toBeInTheDocument();
  });

  test('shows an empty-state message when there are no circles', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/circles': { body: { circles: [], total: 0, page: 1, limit: 12 } },
    });
    renderPage();
    expect(await screen.findByText(/haven't created any circles/)).toBeInTheDocument();
  });

  test('shows the API error when circles fail to load', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/circles': { body: { error: 'Failed to load circles' }, status: 500 },
    });
    renderPage();
    expect(await screen.findByText('Failed to load circles')).toBeInTheDocument();
  });

  test('shows member counts and overflow avatars', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/circles/invites': { body: { invites: [], total: 0, page: 1, limit: 12 } },
      '/api/circles': { body: CIRCLES },
    });
    renderPage();
    await screen.findByText('The Sterling Family');
    expect(screen.getByText('2 members')).toBeInTheDocument();
    expect(screen.getByText('0 members')).toBeInTheDocument();
  });

  test('opens the create-circle modal from the dashed card', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/circles/invites': { body: { invites: [], total: 0, page: 1, limit: 12 } },
      '/api/circles': { body: CIRCLES },
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByText('Create New Circle'));
    expect(await screen.findByText('New Circle')).toBeInTheDocument();
  });

  test('shows numbered pagination and requests the clicked page', async () => {
    mockApi({
      '/api/users/me': { body: ME },
      '/api/circles': { body: { ...CIRCLES, total: 30 } },
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('The Sterling Family');
    expect(screen.getByRole('button', { name: 'Page 3' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => {
      expect(calledUrls.some((url) => url.includes('page=2'))).toBe(true);
    });
    expect(screen.queryByText('Create New Circle')).not.toBeInTheDocument();
  });

  const INVITE = {
    _id: 'c9',
    name: 'Distant Cousins',
    description: '',
    ownerUsername: 'zed',
  };

  test('shows a pending invitation and accepts it', async () => {
    let acceptCalled = false;
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      calledUrls.push(path);
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (path.includes('/api/circles/invites')) {
        const invites = acceptCalled ? [] : [INVITE];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ invites, total: invites.length, page: 1, limit: 12 }),
        } as Response);
      }
      if (path.includes('/api/circles/c9/members/id1') && options?.method === 'PUT') {
        acceptCalled = true;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ circle: { ...CIRCLE_1, _id: 'c9' } }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ circles: [], total: 0, page: 1, limit: 12 }),
      } as Response);
    });

    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Distant Cousins')).toBeInTheDocument();
    expect(screen.getByText('Invited by zed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => {
      expect(
        calledUrls.some((url) => url.includes('/api/circles/c9/members/id1'))
      ).toBe(true);
    });
  });

  test('shows numbered pagination for invites and requests the clicked page', async () => {
    vi.mocked(fetch).mockImplementation((url) => {
      const path = String(url);
      calledUrls.push(path);
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (path.includes('/api/circles/invites')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ invites: [INVITE], total: 30, page: 1, limit: 12 }),
        } as Response);
      }
      // No circles of its own — keeps the circles grid's Pagination from
      // also rendering, so the invites Pagination is unambiguous.
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ circles: [], total: 0, page: 1, limit: 12 }),
      } as Response);
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Distant Cousins');
    expect(screen.getByRole('button', { name: 'Page 3' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Page 2' }));
    await waitFor(() => {
      expect(
        calledUrls.some((url) => url.includes('/api/circles/invites') && url.includes('page=2'))
      ).toBe(true);
    });
  });

  test('declines a pending invitation', async () => {
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      calledUrls.push(path);
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (path.includes('/api/circles/invites')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ invites: [INVITE], total: 1, page: 1, limit: 12 }),
        } as Response);
      }
      if (path.includes('/api/circles/c9/members/id1') && options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ circle: { ...CIRCLE_1, _id: 'c9', members: [] } }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ circles: [], total: 0, page: 1, limit: 12 }),
      } as Response);
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Distant Cousins');

    await user.click(screen.getByRole('button', { name: 'Decline' }));
    await waitFor(() => {
      expect(
        calledUrls.some(
          (url) => url.includes('/api/circles/c9/members/id1')
        )
      ).toBe(true);
    });
  });
});
