import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../components/Icon';
import type { NotificationItemData } from './NotificationBell';

type NotificationItemProps = {
  notification: NotificationItemData;
  /** Omits the row divider on the last item in the list. */
  isLast: boolean;
  onItemClick: (notification: NotificationItemData) => void;
  onDismiss: (id: string) => void;
  isDismissing: boolean;
};

// Two sibling interactive elements, not a nested button-in-link: the row
// Link is the primary click target, and the dismiss button sits beside it
// (never inside it) to keep Tab order sane and the markup valid.
export default function NotificationItem({
  notification,
  isLast,
  onItemClick,
  onDismiss,
  isDismissing,
}: NotificationItemProps) {
  const { _id, actorUsername, circleName, read, relativeTime } = notification;

  const onDismissClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDismiss(_id);
  };

  return (
    <li
      className={`relative group ${read ? '' : 'bg-secondary-container/10'} ${
        isLast ? '' : 'border-b border-outline-variant/20'
      }`}
    >
      <Link
        to="/circles"
        onClick={() => onItemClick(notification)}
        className="flex items-start px-5 py-4 hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary -outline-offset-2"
      >
        <span className="w-5 shrink-0 flex justify-center pt-1.5" aria-hidden="true">
          {!read && <span className="w-2 h-2 rounded-full bg-secondary" />}
        </span>
        <span className="flex-1">
          <span
            className={`block font-body text-sm leading-snug ${
              read ? 'text-on-surface-variant font-normal' : 'text-on-surface'
            }`}
          >
            {read ? (
              <>
                {actorUsername} invited you to {circleName}
              </>
            ) : (
              <>
                <strong className="font-semibold">{actorUsername}</strong> invited you to{' '}
                <strong className="font-semibold">{circleName}</strong>
              </>
            )}
          </span>
          <span className="block font-ui text-[11px] text-on-surface-variant mt-1">{relativeTime}</span>
        </span>
      </Link>

      <button
        type="button"
        onClick={onDismissClick}
        disabled={isDismissing}
        aria-label={`Dismiss notification from ${actorUsername}`}
        className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-primary opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
      >
        <Icon name="close" className="text-base" />
      </button>
    </li>
  );
}
