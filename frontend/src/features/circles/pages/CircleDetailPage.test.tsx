import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import CircleDetailPage from './CircleDetailPage';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

const ME = { user: { _id: 'id1', username: 'pan', email: 'pan@test.com', roles: ['User'] } };
const MEMBER_ME = { user: { _id: 'u2', username: 'maria', email: 'maria@test.com', roles: ['User'] } };

const CIRCLE = {
  _id: 'c1',
  name: 'The Sterling Family',
  purpose: 'family_lineage',
  privacy: 'private',
  owner: 'id1',
  ownerUsername: 'pan',
  members: [{ user: 'u2', username: 'maria', status: 'accepted' }],
};

const calledUrls: string[] = [];

/** fetch mock that routes by URL suffix — declare more specific (longer) suffixes first. */
function mockApi(routes: [string, { body: unknown; status?: number }][]) {
  vi.mocked(fetch).mockImplementation((url) => {
    const path = String(url);
    calledUrls.push(path);
    const match = routes.find(([suffix]) => path.includes(suffix));
    const { body, status = 200 } = match?.[1] ?? { body: { error: 'Not found' }, status: 404 };
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  });
}

const renderPage = () =>
  renderWithProviders(<CircleDetailPage />, {
    route: '/circles/c1',
    path: '/circles/:id',
    extraRoutes: <Route path="/circles" element={<div>Circles list</div>} />,
  });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
  calledUrls.length = 0;
});

describe('CircleDetailPage', () => {
  test('shows the circle and its members', async () => {
    mockApi([
      ['/api/users/me', { body: ME }],
      ['/api/circles/c1', { body: { circle: CIRCLE } }],
    ]);
    renderPage();
    expect(await screen.findByText('The Sterling Family')).toBeInTheDocument();
    expect(screen.getByText('maria')).toBeInTheDocument();
    expect(screen.getByText('Owned by pan')).toBeInTheDocument();
  });

  test('shows a 403 error for a non-member', async () => {
    mockApi([
      ['/api/users/me', { body: ME }],
      ['/api/circles/c1', { body: { error: 'You do not have access to this circle' }, status: 403 }],
    ]);
    renderPage();
    expect(await screen.findByText('You do not have access to this circle')).toBeInTheDocument();
  });

  test('the owner can search for and invite a member (added as pending)', async () => {
    const updatedCircle = {
      ...CIRCLE,
      members: [...CIRCLE.members, { user: 'u4', username: 'jules', status: 'pending' }],
    };
    mockApi([
      ['/api/circles/c1/members', { body: { circle: updatedCircle }, status: 201 }],
      ['/api/users/search', { body: { users: [{ _id: 'u4', username: 'jules' }] } }],
      ['/api/circles/c1', { body: { circle: CIRCLE } }],
      ['/api/users/me', { body: ME }],
    ]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('The Sterling Family');

    await user.type(screen.getByPlaceholderText('Search by username…'), 'jul');
    await user.click(await screen.findByRole('button', { name: 'Invite' }));

    await waitFor(() => {
      expect(calledUrls.some((url) => url.includes('/api/circles/c1/members'))).toBe(true);
    });
    expect(await screen.findByText('jules')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  test('a member can remove themselves', async () => {
    const updatedCircle = { ...CIRCLE, members: [] };
    mockApi([
      ['/api/circles/c1/members/u2', { body: { circle: updatedCircle } }],
      ['/api/circles/c1', { body: { circle: CIRCLE } }],
      ['/api/users/me', { body: MEMBER_ME }],
    ]);
    const user = userEvent.setup();
    renderPage();
    const removeButton = await screen.findByRole('button', { name: 'Remove maria' });

    await user.click(removeButton);
    await waitFor(() => {
      expect(calledUrls.some((url) => url.includes('/api/circles/c1/members/u2'))).toBe(true);
    });
  });

  test('a non-owner, non-search member list has no add-member panel', async () => {
    mockApi([
      ['/api/circles/c1', { body: { circle: CIRCLE } }],
      ['/api/users/me', { body: MEMBER_ME }],
    ]);
    renderPage();
    await screen.findByText('Owned by pan');
    expect(screen.queryByPlaceholderText('Search by username…')).not.toBeInTheDocument();
    expect(screen.queryByText('Delete circle')).not.toBeInTheDocument();
  });

  test('the owner can edit the circle name, purpose, and privacy', async () => {
    const updatedCircle = {
      ...CIRCLE,
      name: 'Renamed Circle',
      purpose: 'academic',
      privacy: 'restricted',
    };
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      calledUrls.push(path);
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ circle: updatedCircle }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ circle: CIRCLE }),
      } as Response);
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText('The Sterling Family');

    await user.click(screen.getByLabelText('Edit circle'));
    const nameInput = screen.getByLabelText('Circle name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Circle');
    await user.click(screen.getByText('Academic Memories'));
    await user.click(screen.getByText('Restricted'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      const put = calledUrls.find((url) => url.includes('/api/circles/c1'));
      expect(put).toBeDefined();
    });
    expect(await screen.findByText('Renamed Circle')).toBeInTheDocument();
  });

  test('the owner can delete the circle', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApi([
      ['/api/circles/c1', { body: { deleted: true }, status: 200 }],
      ['/api/users/me', { body: ME }],
    ]);
    // First call returns the circle for the initial fetch; DELETE reuses the
    // same suffix, so distinguish by response shape the component reads —
    // getOne looks for `circle`, delete looks for `deleted`.
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      calledUrls.push(path);
      if (path.includes('/api/users/me')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(ME) } as Response);
      }
      if (options?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ deleted: true }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ circle: CIRCLE }),
      } as Response);
    });

    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: /Delete circle/ }));

    expect(await screen.findByText('Circles list')).toBeInTheDocument();
  });
});
