import { useState, type MouseEvent } from "react";
import { Link } from "react-router-dom";
import Icon from "../../../components/Icon";
import Avatar from "../../../components/Avatar";
import type { NotificationItemData } from "./NotificationBell";
import { REACTION_NOTIFICATION_TYPES } from "../schemas";

type ReactionNotificationType = (typeof REACTION_NOTIFICATION_TYPES)[number];

type NotificationItemProps = {
  notification: NotificationItemData;
  /** Omits the row divider on the last item in the list. */
  isLast: boolean;
  onItemClick: (notification: NotificationItemData) => void;
  onDismiss: (id: string) => void;
  isDismissing: boolean;
  onToggleRead: (id: string, nextRead: boolean) => void;
  isTogglingRead: boolean;
};

// A message reads as "{actor} {leading} {subject} {trailing}", with actor
// and subject bolded when unread. subject is the thing the action was done
// to (a circle for circle_* types, an album for album_* types); trailing is
// optional plain-text context after it (e.g. which circle an album was
// shared with). Record over NotificationItemData['type'] rather than a
// switch: adding a notification type without a case here is a compile error,
// not a silent runtime gap.
type MessageParts = { leading: string; subject: string; trailing?: string };

const REACTION_LABELS: Record<ReactionNotificationType, string> = {
  like: "Like",
  love: "Love",
  haha: "Haha",
  wow: "Wow",
  sad: "Sad",
  angry: "Angry",
};

const MESSAGE_PARTS_BY_TYPE: Record<
  NotificationItemData["type"],
  (notification: NotificationItemData) => MessageParts
> = {
  circle_invite: ({ circleName }) => ({
    leading: "invited you to",
    subject: circleName ?? "a circle",
  }),
  circle_invite_accepted: ({ circleName }) => ({
    leading: "accepted your invite to",
    subject: circleName ?? "a circle",
  }),
  circle_invite_declined: ({ circleName }) => ({
    leading: "declined your invite to",
    subject: circleName ?? "a circle",
  }),
  circle_deleted: ({ circleName }) => ({
    leading: "deleted the circle",
    subject: circleName ?? "a circle",
  }),
  album_shared: ({ albumTitle, circleName }) => ({
    leading: "shared a new album",
    subject: albumTitle ?? "an album",
    trailing: `with ${circleName}`,
  }),
  album_updated: ({ albumTitle, circleName }) => ({
    leading: "updated the album",
    subject: albumTitle ?? "an album",
    trailing: `shared with ${circleName}`,
  }),
  album_deleted: ({ albumTitle, circleName }) => ({
    leading: "deleted the album",
    subject: albumTitle ?? "an album",
    trailing: `shared with ${circleName}`,
  }),
  album_photos_added: ({ albumTitle, circleName }) => ({
    leading: "added new photos to",
    subject: albumTitle ?? "an album",
    trailing: `in ${circleName}`,
  }),
  album_photo_removed: ({ albumTitle, circleName }) => ({
    leading: "removed a photo from",
    subject: albumTitle ?? "an album",
    trailing: `in ${circleName}`,
  }),
  album_photo_caption_updated: ({ albumTitle, circleName }) => ({
    leading: "updated a photo's caption in",
    subject: albumTitle ?? "an album",
    trailing: `shared with ${circleName}`,
  }),
  page_reaction: ({ albumTitle, circleName, reactionType }) => ({
    leading: `reacted "${REACTION_LABELS[reactionType ?? "like"]}" to a photo in`,
    subject: albumTitle ?? "an album",
    trailing: circleName ? `shared with ${circleName}` : undefined,
  }),
};

// Where clicking the row navigates. Most album_* types link straight to the
// album itself; album_deleted is the one exception — there's no album left
// to view, so it falls back to /circles like the circle_* types.
// album_photos_added deep-links to the specific uploaded photo when one is
// recorded (?photo=<pageId>, read by ViewerPage) — a legacy notification
// with no recorded page just opens the album like the other album_* types.
// Record over NotificationItemData['type'] rather than a switch, for the
// same exhaustiveness reason as MESSAGE_PARTS_BY_TYPE above.
const LINK_TO_BY_TYPE: Record<
  NotificationItemData["type"],
  (notification: NotificationItemData) => string
> = {
  circle_invite: () => "/circles",
  circle_invite_accepted: () => "/circles",
  circle_invite_declined: () => "/circles",
  circle_deleted: () => "/circles",
  album_shared: ({ album }) => (album ? `/book/${album}` : "/circles"),
  album_updated: ({ album }) => (album ? `/book/${album}` : "/circles"),
  album_deleted: () => "/circles",
  album_photos_added: ({ album, page }) => {
    if (!album) return "/circles";
    return page ? `/book/${album}?photo=${page}` : `/book/${album}`;
  },
  album_photo_removed: ({ album }) => (album ? `/book/${album}` : "/circles"),
  album_photo_caption_updated: ({ album }) =>
    album ? `/book/${album}` : "/circles",
  page_reaction: ({ album }) => (album ? `/book/${album}` : "/circles"),
};

// No fallback content on load failure (unlike Avatar, which always has an
// initials circle to fall back to) — a signed thumbnail URL can 404 if the
// underlying photo/album is deleted after the notification was created but
// before it's viewed, so a failed load hides the image rather than leaving
// the browser's broken-image glyph in the list.
function NotificationThumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;

  return (
    <img
      src={src}
      alt=""
      className="block mt-3 w-50 h-50 max-w-full shrink-0 rounded-card object-cover border border-outline-variant/40"
      onError={() => setFailed(true)}
    />
  );
}

// Two sibling interactive elements, not a nested button-in-link: the row
// Link is the primary click target, and the dismiss button sits beside it
// (never inside it) to keep Tab order sane and the markup valid.
export default function NotificationItem({
  notification,
  isLast,
  onItemClick,
  onDismiss,
  isDismissing,
  onToggleRead,
  isTogglingRead,
}: NotificationItemProps) {
  const {
    _id,
    actorUsername,
    actorAvatarUrl,
    thumbnailUrl,
    read,
    relativeTime,
  } = notification;
  const { leading, subject, trailing } =
    MESSAGE_PARTS_BY_TYPE[notification.type](notification);
  const linkTo = LINK_TO_BY_TYPE[notification.type](notification);

  const onDismissClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onDismiss(_id);
  };

  const onToggleReadClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleRead(_id, !read);
  };

  return (
    <li
      className={`relative group ${read ? "" : "bg-secondary-container/10"} ${
        isLast ? "" : "border-b border-outline-variant/20"
      }`}
    >
      <Link
        to={linkTo}
        onClick={() => onItemClick(notification)}
        className="flex items-start gap-3 px-5 py-4 hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-secondary -outline-offset-2"
      >
        <span className="relative shrink-0">
          <Avatar
            username={actorUsername}
            avatarUrl={actorAvatarUrl}
            size="sm"
          />
          {!read && (
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-secondary border-2 border-surface-container-lowest"
            />
          )}
        </span>
        <span className="flex-1 pr-16">
          <span
            className={`block font-body text-sm leading-snug ${
              read ? "text-on-surface-variant font-normal" : "text-on-surface"
            }`}
          >
            {read ? (
              <>
                {actorUsername} {leading} {subject}
                {trailing ? ` ${trailing}` : ""}
              </>
            ) : (
              <>
                <strong className="font-semibold">{actorUsername}</strong>{" "}
                {leading} <strong className="font-semibold">{subject}</strong>
                {trailing ? ` ${trailing}` : ""}
              </>
            )}
          </span>
          <span className="block font-ui text-[11px] text-on-surface-variant mt-1">
            {relativeTime}
          </span>
          {thumbnailUrl && <NotificationThumbnail src={thumbnailUrl} />}
        </span>
      </Link>

      <span className="absolute top-3 right-3 flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onToggleReadClick}
          disabled={isTogglingRead}
          aria-label={
            read
              ? `Mark notification from ${actorUsername} as unread`
              : `Mark notification from ${actorUsername} as read`
          }
          className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Icon
            name={read ? "mark_email_unread" : "mark_email_read"}
            className="text-base"
          />
        </button>
        <button
          type="button"
          onClick={onDismissClick}
          disabled={isDismissing}
          aria-label={`Dismiss notification from ${actorUsername}`}
          className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Icon name="close" className="text-base" />
        </button>
      </span>
    </li>
  );
}
