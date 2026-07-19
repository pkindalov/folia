import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import Icon from '../../../components/Icon';
import Pagination from '../../../components/Pagination';
import useFocusTrap from '../../../hooks/useFocusTrap';
import useOutsideClick from '../../../hooks/useOutsideClick';
import useEscapeKey from '../../../hooks/useEscapeKey';
import NotificationItem from './NotificationItem';
import type { AppNotification } from '../schemas';

export type NotificationItemData = {
  _id: string;
  type: AppNotification['type'];
  actorUsername: string;
  actorAvatarUrl: string | null;
  // Only present on circle-scoped types — page_reaction/page_comment/
  // comment_reply have neither.
  circleName: string | null;
  // Only present on the album_* and page_reaction/page_comment/comment_reply
  // types.
  albumTitle: string | null;
  album: string | null;
  // Required for page_reaction/page_comment/comment_reply; also present on
  // album_photos_added as the representative uploaded photo (thumbnail +
  // deep-link target).
  page: string | null;
  // Only present on page_reaction.
  reactionType: AppNotification['reactionType'] | null;
  // Present on page_comment (the comment) and comment_reply (the reply) — a
  // snapshot of that comment's body.
  commentText: string | null;
  thumbnailUrl: string | null;
  read: boolean;
  relativeTime: string; // pre-formatted, just render it
};

type NotificationBellProps = {
  variant: 'sidebar' | 'mobile';
  unreadCount: number;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  notifications: NotificationItemData[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onItemClick: (notification: NotificationItemData) => void;
  onDismiss: (id: string) => void;
  dismissingIds: Set<string>;
  onToggleRead: (id: string, nextRead: boolean) => void;
  togglingReadIds: Set<string>;
  totalCount: number;
  onMarkAllRead: () => void;
  onMarkAllUnread: () => void;
  onDeleteAll: () => void;
  isBulkActionPending: boolean;
};

const MAX_DISPLAYED_UNREAD_COUNT = 9;
// Visual gap between the trigger row and the panel it anchors to, matching
// the design spec's "~8px above/below" callouts.
const PANEL_ANCHOR_GAP_PX = 8;

function computeAnchorStyle(triggerEl: HTMLElement, variant: 'sidebar' | 'mobile'): CSSProperties {
  const triggerRect = triggerEl.getBoundingClientRect();
  if (variant === 'sidebar') {
    return { bottom: window.innerHeight - triggerRect.top + PANEL_ANCHOR_GAP_PX };
  }
  return {
    top: triggerRect.bottom + PANEL_ANCHOR_GAP_PX,
    right: window.innerWidth - triggerRect.right,
  };
}

function NotificationBadge({ unreadCount, variant }: { unreadCount: number; variant: 'sidebar' | 'mobile' }) {
  if (unreadCount <= 0) return null;

  const label = unreadCount > MAX_DISPLAYED_UNREAD_COUNT ? '9+' : String(unreadCount);
  const sizeClasses = variant === 'mobile' ? 'min-w-4 h-4' : 'min-w-[18px] h-[18px]';

  return (
    <span
      aria-hidden="true"
      className={`absolute -top-1 -right-1 ${sizeClasses} px-1 rounded-full bg-secondary text-on-secondary font-ui text-[10px] font-semibold flex items-center justify-center border border-surface-container-lowest`}
    >
      {label}
    </span>
  );
}

/**
 * Bell trigger + anchored notifications dropdown. Renders as either the
 * desktop sidebar row or the mobile header icon button depending on
 * `variant`; both share the same panel behavior (focus trap, Escape,
 * outside click, anchored positioning).
 */
export default function NotificationBell({
  variant,
  unreadCount,
  isOpen,
  onToggleOpen,
  onClose,
  notifications,
  isLoading,
  errorMessage,
  page,
  totalPages,
  onPageChange,
  onItemClick,
  onDismiss,
  dismissingIds,
  onToggleRead,
  togglingReadIds,
  totalCount,
  onMarkAllRead,
  onMarkAllUnread,
  onDeleteAll,
  isBulkActionPending,
}: NotificationBellProps) {
  const { t } = useTranslation('notifications');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [anchorStyle, setAnchorStyle] = useState<CSSProperties>({});

  // panelRef/triggerRef are stable across renders (useRef never changes
  // identity), so this only needs to be computed once — without it, a new
  // array literal on every render would make useOutsideClick tear down and
  // re-attach its listener on every re-render while the panel is open (e.g.
  // each unread-count poll).
  const outsideClickRefs = useMemo(() => [panelRef, triggerRef], [panelRef, triggerRef]);

  useFocusTrap(panelRef, isOpen);
  useOutsideClick(outsideClickRefs, onClose, isOpen);
  useEscapeKey(isOpen, onClose);

  // The trigger row's exact position on screen depends on layout the bell
  // doesn't control (e.g. how many rows sit above it in the sidebar footer),
  // so the panel's offset is measured from the trigger itself rather than
  // hardcoded — recomputed synchronously before paint whenever it opens, and
  // again on resize so a stale offset doesn't outlive a rotation/resize
  // while the panel is left open.
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    setAnchorStyle(computeAnchorStyle(triggerRef.current, variant));

    const onResize = () => {
      if (triggerRef.current) setAnchorStyle(computeAnchorStyle(triggerRef.current, variant));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen, variant]);

  const handleItemClick = (notification: NotificationItemData) => {
    onItemClick(notification);
    onClose();
  };

  const ariaLabel =
    unreadCount > 0 ? t('bell.notificationsUnread', { count: unreadCount }) : t('bell.notifications');
  // Both the sidebar and mobile bells are always mounted at once (toggled
  // only via CSS per breakpoint), so the panel id must be per-variant —
  // otherwise two elements could share the same id if both were opened
  // across a breakpoint change without closing the first.
  const panelId = `notifications-panel-${variant}`;

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={onToggleOpen}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={ariaLabel}
          className="flex items-center gap-4 px-4 py-3 font-body text-sm tracking-wide uppercase rounded-paper hover:bg-surface-container-low transition-colors text-left"
        >
          <span className="relative">
            <Icon name="notifications" filled={unreadCount > 0} className="text-lg" />
            <NotificationBadge unreadCount={unreadCount} variant={variant} />
          </span>
          {t('bell.notifications')}
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={onToggleOpen}
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={ariaLabel}
          className="min-w-10 min-h-10 flex items-center justify-center text-on-surface-variant hover:text-secondary transition-colors"
        >
          <span className="relative">
            <Icon name="notifications" filled={unreadCount > 0} className="text-xl" />
            <NotificationBadge unreadCount={unreadCount} variant={variant} />
          </span>
        </button>
      )}

      {isOpen && (
        <div
          ref={panelRef}
          id={panelId}
          aria-label={t('bell.notifications')}
          style={anchorStyle}
          className={`fixed z-60 flex flex-col bg-surface-container-lowest rounded-panel paper-depth border border-outline-variant/40 overflow-hidden ${
            variant === 'sidebar'
              ? 'left-8 w-95 max-h-140'
              : 'w-[calc(100vw-40px)] max-w-100 max-h-[85vh]'
          }`}
        >
          <div className="shrink-0 px-5 py-4 border-b border-outline-variant/40 font-ui text-ui-label uppercase text-on-surface-variant">
            {t('bell.notifications')}
          </div>

          <div
            role="group"
            aria-label={t('bell.bulkActionsLabel')}
            className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-outline-variant/40"
          >
            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={isBulkActionPending || unreadCount === 0}
              aria-label={t('bell.markAllRead')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="done_all" className="text-base" />
            </button>
            <button
              type="button"
              onClick={onMarkAllUnread}
              disabled={isBulkActionPending || totalCount - unreadCount === 0}
              aria-label={t('bell.markAllUnread')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="mark_email_unread" className="text-base" />
            </button>
            <span className="flex-1" aria-hidden="true" />
            <span className="w-px h-5 bg-outline-variant/40" aria-hidden="true" />
            <button
              type="button"
              onClick={onDeleteAll}
              disabled={isBulkActionPending || totalCount === 0}
              aria-label={t('bell.deleteAll')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-error hover:bg-error-container/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Icon name="delete_sweep" className="text-base" />
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading && (
              <p className="py-16 text-center font-body italic text-on-surface-variant text-sm">
                {t('bell.fetching')}
              </p>
            )}

            {!isLoading && errorMessage !== null && (
              <p
                role="alert"
                className="mx-4 mt-4 px-4 py-3 bg-error-container text-on-error-container rounded-paper font-ui text-sm"
              >
                {errorMessage}
              </p>
            )}

            {!isLoading && errorMessage === null && notifications.length === 0 && (
              <div className="py-16 px-6 text-center">
                <p className="font-body italic text-on-surface-variant text-sm">{t('bell.empty')}</p>
                <p className="font-body text-on-surface-variant text-sm">
                  {t('bell.emptyHint')}
                </p>
              </div>
            )}

            {!isLoading && errorMessage === null && notifications.length > 0 && (
              <ul>
                {notifications.map((notification, index) => (
                  <NotificationItem
                    key={notification._id}
                    notification={notification}
                    isLast={index === notifications.length - 1}
                    onItemClick={handleItemClick}
                    onDismiss={onDismiss}
                    isDismissing={dismissingIds.has(notification._id)}
                    onToggleRead={onToggleRead}
                    isTogglingRead={togglingReadIds.has(notification._id)}
                  />
                ))}
              </ul>
            )}
          </div>

          {totalPages > 1 && (
            <div className="shrink-0 px-5 pb-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
            </div>
          )}
        </div>
      )}
    </>
  );
}
