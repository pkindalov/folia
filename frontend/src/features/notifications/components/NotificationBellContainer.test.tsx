import { describe, test, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route } from 'react-router-dom';
import NotificationBellContainer from './NotificationBellContainer';
import { tokenStorage } from '../../../lib/api-client';
import { renderWithProviders } from '../../../tests/test-utils';

type FakeNotification = {
  _id: string;
  recipient: string;
  type: 'circle_invite' | 'circle_invite_accepted' | 'circle_invite_declined' | 'circle_deleted';
  circle: string;
  circleName: string;
  actorUsername: string;
  read: boolean;
  createdAt: string;
};

const baseNotification: FakeNotification = {
  _id: 'n1',
  recipient: 'u1',
  type: 'circle_invite',
  circle: 'c1',
  circleName: 'The Sterling Family',
  actorUsername: 'maria',
  read: false,
  createdAt: new Date().toISOString(),
};

let notifications: FakeNotification[] = [];

function respond(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

function mockApi() {
  vi.mocked(fetch).mockImplementation((url, options) => {
    const path = String(url);
    const method = (options?.method ?? 'GET').toUpperCase();

    if (method === 'GET' && path.includes('/unread-count')) {
      return respond({ count: notifications.filter((n) => !n.read).length });
    }
    if (method === 'GET' && path.startsWith('/api/notifications?')) {
      const params = new URLSearchParams(path.split('?')[1]);
      const page = Number(params.get('page') ?? '1');
      const pageSize = 1;
      const start = (page - 1) * pageSize;
      const pageItems = notifications.slice(start, start + pageSize);
      return respond({ notifications: pageItems, total: notifications.length, page, limit: pageSize });
    }
    if (method === 'PUT' && /\/read$/.test(path)) {
      const id = path.split('/')[3];
      notifications = notifications.map((n) => (n._id === id ? { ...n, read: true } : n));
      return respond({ notification: notifications.find((n) => n._id === id) });
    }
    if (method === 'DELETE') {
      const id = path.split('/').pop();
      notifications = notifications.filter((n) => n._id !== id);
      return respond({ deleted: true });
    }
    return respond({ error: 'Not found' }, 404);
  });
}

const renderBell = (variant: 'sidebar' | 'mobile' = 'sidebar') =>
  renderWithProviders(<NotificationBellContainer variant={variant} />, {
    route: '/',
    path: '/',
    extraRoutes: <Route path="/circles" element={<div>Circles page reached</div>} />,
  });

const openPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /notifications/i }));
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  tokenStorage.set('jwt-ok');
  notifications = [];
  mockApi();
});

describe('NotificationBellContainer', () => {
  test('shows no badge when there are no unread notifications', async () => {
    renderBell();
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  test('shows the unread count on the badge', async () => {
    notifications = [baseNotification, { ...baseNotification, _id: 'n2', read: false }];
    renderBell();
    expect(
      await screen.findByRole('button', { name: 'Notifications, 2 unread' })
    ).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  test('caps the displayed badge count at "9+"', async () => {
    notifications = Array.from({ length: 15 }, (_, i) => ({
      ...baseNotification,
      _id: `n${i}`,
      read: false,
    }));
    renderBell();
    expect(
      await screen.findByRole('button', { name: 'Notifications, 15 unread' })
    ).toBeInTheDocument();
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  test('opens the panel and lists notifications', async () => {
    notifications = [baseNotification];
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);

    expect(
      await screen.findByText(
        (_, element) => element?.textContent === 'maria invited you to The Sterling Family'
      )
    ).toBeInTheDocument();
  });

  test('renders an accepted-invite notification with its own message', async () => {
    notifications = [{ ...baseNotification, type: 'circle_invite_accepted' }];
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);

    expect(
      await screen.findByText(
        (_, element) => element?.textContent === 'maria accepted your invite to The Sterling Family'
      )
    ).toBeInTheDocument();
  });

  test('renders a declined-invite notification with its own message', async () => {
    notifications = [{ ...baseNotification, type: 'circle_invite_declined' }];
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);

    expect(
      await screen.findByText(
        (_, element) => element?.textContent === 'maria declined your invite to The Sterling Family'
      )
    ).toBeInTheDocument();
  });

  test('renders a circle-deleted notification with its own message', async () => {
    notifications = [{ ...baseNotification, type: 'circle_deleted' }];
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);

    expect(
      await screen.findByText(
        (_, element) => element?.textContent === 'maria deleted the circle The Sterling Family'
      )
    ).toBeInTheDocument();
  });

  test('shows an empty state when there are no notifications', async () => {
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);

    expect(await screen.findByText('No notifications yet.')).toBeInTheDocument();
  });

  test('clicking a notification marks it read and navigates to /circles', async () => {
    notifications = [baseNotification];
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);

    const message = await screen.findByText(
      (_, element) => element?.textContent === 'maria invited you to The Sterling Family'
    );
    const link = message.closest('a');
    expect(link).not.toBeNull();
    await user.click(link!);

    expect(await screen.findByText('Circles page reached')).toBeInTheDocument();
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/n1/read'),
        expect.objectContaining({ method: 'PUT' })
      )
    );
  });

  test('dismissing a notification deletes it and removes it from the list', async () => {
    notifications = [baseNotification];
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);

    await screen.findByText(
      (_, element) => element?.textContent === 'maria invited you to The Sterling Family'
    );
    await user.click(screen.getByLabelText('Dismiss notification from maria'));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/n1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    );
    await waitFor(() => expect(screen.getByText('No notifications yet.')).toBeInTheDocument());
  });

  test('a second click on dismiss while the first is still in flight does not fire a second request or an error toast', async () => {
    notifications = [baseNotification];
    let resolveDelete: (() => void) | undefined;
    vi.mocked(fetch).mockImplementation((url, options) => {
      const path = String(url);
      const method = (options?.method ?? 'GET').toUpperCase();

      if (method === 'GET' && path.includes('/unread-count')) {
        return respond({ count: notifications.filter((n) => !n.read).length });
      }
      if (method === 'GET' && path.startsWith('/api/notifications?')) {
        return respond({ notifications, total: notifications.length, page: 1, limit: 1 });
      }
      if (method === 'DELETE') {
        return new Promise((resolve) => {
          resolveDelete = () => {
            notifications = [];
            resolve({ ok: true, status: 200, json: () => Promise.resolve({ deleted: true }) } as Response);
          };
        });
      }
      return respond({ error: 'Not found' }, 404);
    });

    const user = userEvent.setup();
    renderBell();
    await openPanel(user);

    const dismissButton = await screen.findByLabelText('Dismiss notification from maria');
    await user.click(dismissButton);
    await user.click(dismissButton);

    resolveDelete?.();
    await waitFor(() => expect(screen.getByText('No notifications yet.')).toBeInTheDocument());

    const deleteCalls = vi
      .mocked(fetch)
      .mock.calls.filter(([, options]) => (options?.method ?? '').toUpperCase() === 'DELETE');
    expect(deleteCalls).toHaveLength(1);
    expect(screen.queryByText('Notification not found')).not.toBeInTheDocument();
  });

  test('clamps back to the last valid page after dismissing the only item on a later page', async () => {
    notifications = [
      { ...baseNotification, _id: 'n1', actorUsername: 'maria', circleName: 'The Sterling Family' },
      { ...baseNotification, _id: 'n2', actorUsername: 'sam', circleName: 'Book Club' },
    ];
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);

    await screen.findByText(
      (_, element) => element?.textContent === 'maria invited you to The Sterling Family'
    );

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText(
      (_, element) => element?.textContent === 'sam invited you to Book Club'
    );

    await user.click(screen.getByLabelText('Dismiss notification from sam'));

    await waitFor(() =>
      expect(
        screen.getByText(
          (_, element) => element?.textContent === 'maria invited you to The Sterling Family'
        )
      ).toBeInTheDocument()
    );
    expect(screen.queryByText('No notifications yet.')).not.toBeInTheDocument();
  });

  test('Escape closes the panel', async () => {
    notifications = [baseNotification];
    const user = userEvent.setup();
    renderBell();
    await openPanel(user);
    await screen.findByText(
      (_, element) => element?.textContent === 'maria invited you to The Sterling Family'
    );

    await user.keyboard('{Escape}');

    await waitFor(() => expect(document.getElementById('notifications-panel-sidebar')).toBeNull());
  });
});
