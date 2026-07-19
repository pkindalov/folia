import { useState, type MouseEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/Icon";
import Emoji from "../../../components/Emoji";
import Avatar from "../../../components/Avatar";
import { REACTION_EMOJI, REACTION_LABEL_KEY } from "../../../components/reactionPresentation";
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
type MessageParts = { leading: ReactNode; subject: string; trailing?: string };

// Rendered inline in place of the reaction name (e.g. "reacted [heart icon] to
// a photo in") — the sr-only label keeps the reaction type announced to
// screen readers even though the icon itself is decorative.
function ReactionMessageIcon({ type }: { type: ReactionNotificationType }) {
  const { t: tSocial } = useTranslation('social');
  const { t } = useTranslation('notifications');
  return (
    <>
      {t('item.reacted')}{" "}
      <Emoji emoji={REACTION_EMOJI[type]} className="text-sm align-text-bottom" />
      <span className="sr-only">{tSocial(REACTION_LABEL_KEY[type])}</span>{" "}
      {t('item.toAPhotoIn')}
    </>
  );
}

// Rendered inline for album_reaction — always the love icon, since an album
// (unlike a photo) can only be loved, not reacted to with the full picker.
function AlbumLoveMessageIcon() {
  const { t } = useTranslation('notifications');
  return (
    <>
      {t('item.loved')}{" "}
      <Emoji emoji={REACTION_EMOJI.love} className="text-sm align-text-bottom" />
    </>
  );
}

// Rendered inline for page_comment — the comment icon plus a truncated
// preview of what was said, so the row reads as "commented [icon] "nice
// shot!" on a photo in" rather than just "commented on a photo in" with no
// hint of the content.
const COMMENT_PREVIEW_MAX_LENGTH = 40;

// Truncates by Unicode code point (via the spread operator), not UTF-16 code
// unit — a plain string.slice can cut a surrogate pair in half and corrupt
// the trailing character, which comment text (arbitrary user input,
// including emoji) can easily contain.
function truncateCommentPreview(commentText: string | null): string | null {
  if (!commentText) return commentText;
  const codePoints = [...commentText];
  if (codePoints.length <= COMMENT_PREVIEW_MAX_LENGTH) return commentText;
  return `${codePoints.slice(0, COMMENT_PREVIEW_MAX_LENGTH).join("").trimEnd()}…`;
}

function CommentMessageIcon({ commentText }: { commentText: string | null }) {
  const { t } = useTranslation('notifications');
  const preview = truncateCommentPreview(commentText);

  return (
    <>
      {t('item.commented')}{" "}
      <Icon
        name="mode_comment"
        filled
        className="text-sm align-text-bottom text-secondary"
      />
      {preview ? ` "${preview}"` : ""} {t('item.onAPhotoIn')}
    </>
  );
}

// Rendered inline for comment_reply — same truncated-preview shape as
// CommentMessageIcon, but with a reply icon and verb so the row reads
// distinctly from "commented on your photo" (this is "replied to your
// comment", a different relationship to the viewer).
function ReplyMessageIcon({ commentText }: { commentText: string | null }) {
  const { t } = useTranslation('notifications');
  const preview = truncateCommentPreview(commentText);

  return (
    <>
      {t('item.replied')}{" "}
      <Icon
        name="reply"
        className="text-sm align-text-bottom text-secondary"
      />
      {preview ? ` "${preview}"` : ""} {t('item.toYourCommentOnAPhotoIn')}
    </>
  );
}

// Rendered inline for comment_reaction — same truncated-preview shape as
// ReplyMessageIcon, but with the picked reaction's own icon/verb (mirrors
// ReactionMessageIcon) so the row reads as "reacted [icon] to your comment
// "text" on a photo in", distinct from "replied to your comment".
function CommentReactionMessageIcon({
  type,
  commentText,
}: {
  type: ReactionNotificationType;
  commentText: string | null;
}) {
  const { t: tSocial } = useTranslation('social');
  const { t } = useTranslation('notifications');
  const preview = truncateCommentPreview(commentText);

  return (
    <>
      {t('item.reacted')}{" "}
      <Emoji emoji={REACTION_EMOJI[type]} className="text-sm align-text-bottom" />
      <span className="sr-only">{tSocial(REACTION_LABEL_KEY[type])}</span> {t('item.toYourComment')}
      {preview ? ` "${preview}"` : ""} {t('item.onAPhotoIn')}
    </>
  );
}

type NotificationsTFunction = ReturnType<typeof useTranslation<'notifications'>>['t'];

const MESSAGE_PARTS_BY_TYPE: Record<
  NotificationItemData["type"],
  (notification: NotificationItemData, t: NotificationsTFunction) => MessageParts
> = {
  circle_invite: ({ circleName }, t) => ({
    leading: t('item.circleInvite'),
    subject: circleName ?? t('item.circleFallback'),
  }),
  circle_invite_accepted: ({ circleName }, t) => ({
    leading: t('item.circleInviteAccepted'),
    subject: circleName ?? t('item.circleFallback'),
  }),
  circle_invite_declined: ({ circleName }, t) => ({
    leading: t('item.circleInviteDeclined'),
    subject: circleName ?? t('item.circleFallback'),
  }),
  circle_deleted: ({ circleName }, t) => ({
    leading: t('item.circleDeleted'),
    subject: circleName ?? t('item.circleFallback'),
  }),
  album_shared: ({ albumTitle, circleName }, t) => ({
    leading: t('item.albumShared'),
    subject: albumTitle ?? t('item.albumFallback'),
    trailing: t('item.sharedWith', { circleName }),
  }),
  album_updated: ({ albumTitle, circleName }, t) => ({
    leading: t('item.albumUpdated'),
    subject: albumTitle ?? t('item.albumFallback'),
    trailing: t('item.sharedWithTrailing', { circleName }),
  }),
  album_deleted: ({ albumTitle, circleName }, t) => ({
    leading: t('item.albumDeleted'),
    subject: albumTitle ?? t('item.albumFallback'),
    trailing: t('item.sharedWithTrailing', { circleName }),
  }),
  album_photos_added: ({ albumTitle, circleName }, t) => ({
    leading: t('item.albumPhotosAdded'),
    subject: albumTitle ?? t('item.albumFallback'),
    trailing: t('item.inCircle', { circleName }),
  }),
  album_photo_removed: ({ albumTitle, circleName }, t) => ({
    leading: t('item.albumPhotoRemoved'),
    subject: albumTitle ?? t('item.albumFallback'),
    trailing: t('item.inCircle', { circleName }),
  }),
  album_photo_caption_updated: ({ albumTitle, circleName }, t) => ({
    leading: t('item.albumPhotoCaptionUpdated'),
    subject: albumTitle ?? t('item.albumFallback'),
    trailing: t('item.sharedWithTrailing', { circleName }),
  }),
  page_reaction: ({ albumTitle, circleName, reactionType }, t) => ({
    leading: <ReactionMessageIcon type={reactionType ?? "like"} />,
    subject: albumTitle ?? t('item.albumFallback'),
    trailing: circleName ? t('item.sharedWithTrailing', { circleName }) : undefined,
  }),
  album_reaction: ({ albumTitle, circleName }, t) => ({
    leading: <AlbumLoveMessageIcon />,
    subject: albumTitle ?? t('item.albumFallback'),
    trailing: circleName ? t('item.sharedWithTrailing', { circleName }) : undefined,
  }),
  page_comment: ({ albumTitle, circleName, commentText }, t) => ({
    leading: <CommentMessageIcon commentText={commentText} />,
    subject: albumTitle ?? t('item.albumFallback'),
    trailing: circleName ? t('item.sharedWithTrailing', { circleName }) : undefined,
  }),
  comment_reply: ({ albumTitle, circleName, commentText }, t) => ({
    leading: <ReplyMessageIcon commentText={commentText} />,
    subject: albumTitle ?? t('item.albumFallback'),
    trailing: circleName ? t('item.sharedWithTrailing', { circleName }) : undefined,
  }),
  comment_reaction: ({ albumTitle, circleName, reactionType, commentText }, t) => ({
    leading: (
      <CommentReactionMessageIcon type={reactionType ?? "like"} commentText={commentText} />
    ),
    subject: albumTitle ?? t('item.albumFallback'),
    trailing: circleName ? t('item.sharedWithTrailing', { circleName }) : undefined,
  }),
};

// Where clicking the row navigates. Most album_* types link straight to the
// album itself; album_deleted is the one exception — there's no album left
// to view, so it falls back to /circles like the circle_* types.
// album_photos_added and page_reaction deep-link to the specific photo when
// one is recorded (?photo=<pageId>, read by ViewerPage) — a legacy
// notification with no recorded page just opens the album like the other
// album_* types.
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
  page_reaction: ({ album, page }) => {
    if (!album) return "/circles";
    return page ? `/book/${album}?photo=${page}` : `/book/${album}`;
  },
  album_reaction: ({ album }) => (album ? `/book/${album}` : "/circles"),
  page_comment: ({ album, page }) => {
    if (!album) return "/circles";
    return page ? `/book/${album}?photo=${page}` : `/book/${album}`;
  },
  comment_reply: ({ album, page }) => {
    if (!album) return "/circles";
    return page ? `/book/${album}?photo=${page}` : `/book/${album}`;
  },
  comment_reaction: ({ album, page }) => {
    if (!album) return "/circles";
    return page ? `/book/${album}?photo=${page}` : `/book/${album}`;
  },
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
  const { t } = useTranslation('notifications');
  const {
    _id,
    actorUsername,
    actorAvatarUrl,
    thumbnailUrl,
    read,
    relativeTime,
  } = notification;
  const { leading, subject, trailing } =
    MESSAGE_PARTS_BY_TYPE[notification.type](notification, t);
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
              ? t('item.markAsUnread', { username: actorUsername })
              : t('item.markAsRead', { username: actorUsername })
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
          aria-label={t('item.dismiss', { username: actorUsername })}
          className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Icon name="close" className="text-base" />
        </button>
      </span>
    </li>
  );
}
