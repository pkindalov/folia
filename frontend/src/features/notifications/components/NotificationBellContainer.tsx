import { useCallback, useState } from 'react';
import NotificationBell, { type NotificationItemData } from './NotificationBell';
import {
  useUnreadNotificationCount,
  useNotifications,
  useMarkNotificationRead,
  useDismissNotification,
} from '../hooks';
import { formatRelativeTime } from '../relativeTime';
import { toast } from '../../../lib/toast';
import useClampedPage from '../../../hooks/useClampedPage';

function withId(ids: Set<string>, id: string): Set<string> {
  return new Set(ids).add(id);
}

function withoutId(ids: Set<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}

export default function NotificationBellContainer({ variant }: { variant: 'sidebar' | 'mobile' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  const unreadCountQuery = useUnreadNotificationCount();
  const notificationsQuery = useNotifications(page, isOpen);
  const markRead = useMarkNotificationRead();
  const dismiss = useDismissNotification();

  const onToggleOpen = () => {
    if (!isOpen) setPage(1);
    setIsOpen(!isOpen);
  };
  const onClose = useCallback(() => setIsOpen(false), []);

  const onItemClick = (notification: NotificationItemData) => {
    if (!notification.read) {
      markRead.mutate(notification._id, {
        onError: (error) => toast.error(error.message),
      });
    }
  };

  // Guards against a fast double-click firing a second DELETE for the same
  // notification — without this, the second request lands after the first
  // already removed it and surfaces a spurious "not found" error toast.
  const onDismiss = (id: string) => {
    if (dismissingIds.has(id)) return;

    setDismissingIds((prev) => withId(prev, id));
    dismiss.mutate(id, {
      onError: (error) => toast.error(error.message),
      onSettled: () => setDismissingIds((prev) => withoutId(prev, id)),
    });
  };

  const notifications: NotificationItemData[] = (notificationsQuery.data?.notifications ?? []).map(
    (notification) => ({
      _id: notification._id,
      type: notification.type,
      actorUsername: notification.actorUsername,
      circleName: notification.circleName ?? null,
      albumTitle: notification.albumTitle ?? null,
      album: notification.album ?? null,
      reactionType: notification.reactionType ?? null,
      read: notification.read,
      relativeTime: formatRelativeTime(notification.createdAt),
    })
  );
  const total = notificationsQuery.data?.total ?? 0;
  const limit = notificationsQuery.data?.limit ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Dismissing the last notification on a later page (e.g. page 2 of 2)
  // would otherwise strand the panel on an empty page with no pagination
  // control left to navigate back — fall back to the new last page.
  useClampedPage(page, totalPages, setPage);

  return (
    <NotificationBell
      variant={variant}
      unreadCount={unreadCountQuery.data ?? 0}
      isOpen={isOpen}
      onToggleOpen={onToggleOpen}
      onClose={onClose}
      notifications={notifications}
      isLoading={notificationsQuery.isLoading}
      errorMessage={notificationsQuery.isError ? notificationsQuery.error.message : null}
      page={page}
      totalPages={totalPages}
      onPageChange={setPage}
      onItemClick={onItemClick}
      onDismiss={onDismiss}
      dismissingIds={dismissingIds}
    />
  );
}
