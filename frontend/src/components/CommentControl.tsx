import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Avatar from "./Avatar";
import CommentComposer from "./CommentComposer";
import CommentReactionControl from "./CommentReactionControl";
import useEscapeKey from "../hooks/useEscapeKey";
import { formatRelativeTime } from "../features/notifications/relativeTime";
import type { Comment, ReactionType, TopLevelComment } from "../features/flipbooks";

type CommentControlProps = {
  /** Resets the panel closed when the underlying photo changes — same reasoning as ReactionControl's pageId prop. */
  pageId: string;
  /** Shown on the trigger even before the thread has been fetched. */
  commentCount: number;
  /** undefined while not yet fetched. */
  comments: TopLevelComment[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Fires whenever the panel opens/closes — the parent uses this to gate the lazy fetch and to suspend the lightbox's arrow-key navigation while the panel is open. */
  onOpenChange?: (isOpen: boolean) => void;
  /** parentCommentId is set when submitting a reply to a top-level comment — replies are exactly one level deep, so it's never itself a reply's id. */
  onAddComment: (text: string, parentCommentId?: string) => Promise<void>;
  /**
   * Which composer's submission is in flight — null for the top-level
   * composer, a comment id for that comment's own reply composer,
   * undefined for neither. There's only one shared addComment mutation for
   * the whole page (see ViewerPage), so without this every mounted
   * composer (the bottom one, plus whichever reply composer happens to be
   * open) would show the same pending/error state regardless of which one
   * actually submitted.
   */
  pendingCommentTarget?: string | null;
  erroredCommentTarget?: string | null;
  onDeleteComment: (commentId: string) => void;
  /** _id of the comment currently being deleted, or null. */
  pendingDeleteCommentId: string | null;
  /** Omitted entirely (rather than made optional-and-unused) hides the reaction control on every row — mirrors onDeleteComment/onAddComment's own presence-gating shape. */
  onReactToComment?: (commentId: string, type: ReactionType) => void;
  /** _id of the comment whose reaction mutation is in flight, or null. */
  pendingReactionCommentId?: string | null;
  /** Drives isOwnComment/canDelete — a stable id, unlike username (see viewerUsername below, which stays username-based only because the reactor list it feeds has no ids to compare against). */
  viewerId?: string;
  viewerUsername?: string;
  isAlbumOwner: boolean;
  /** light = paper surface (AlbumSpread), dark = photo overlay (PhotoLightbox). Mirrors ReactionControl's variant. */
  variant?: 'light' | 'dark';
  /** Whether an older portion of the thread exists beyond what's currently loaded. */
  hasMoreComments?: boolean;
  isFetchingMoreComments?: boolean;
  /** A "See earlier comments" fetch failed — surfaced inline next to the button rather than replacing the (still-valid) already-loaded thread. */
  hasFetchMoreCommentsError?: boolean;
  onFetchMoreComments?: () => void;
  /** Fires a further portion of one comment's replies — see hasMoreReplies on TopLevelComment. */
  onLoadMoreReplies?: (commentId: string) => void;
  /** _id of the comment whose "load more replies" is in flight, or null. One shared mutation for the whole page (see ViewerPage's useLoadMoreReplies), same reasoning as pendingCommentTarget above. */
  pendingRepliesCommentId?: string | null;
  /** _id of the comment whose "load more replies" most recently failed, or null. */
  erroredRepliesCommentId?: string | null;
};

function CommentRow({
  comment,
  isOwnComment,
  canDelete,
  isDeletePending,
  onDelete,
  isLight,
  variant,
  onReact,
  isReactionPending,
  viewerUsername,
  // "li" for a reply — each is a direct sibling inside its own replies
  // <ul>. "div" for a top-level comment — TopLevelCommentItem already
  // supplies the <li> for the outer comments <ul>, and a <li> can't
  // validly contain another <li> without a <ul>/<ol> in between.
  as = "li",
}: {
  comment: Comment;
  isOwnComment: boolean;
  canDelete: boolean;
  isDeletePending: boolean;
  onDelete: () => void;
  isLight: boolean;
  variant: "light" | "dark";
  onReact?: (type: ReactionType) => void;
  isReactionPending: boolean;
  viewerUsername?: string;
  as?: "li" | "div";
}) {
  const Container = as;
  return (
    <Container
      className={`flex items-start gap-2.5 ${isDeletePending ? "opacity-60" : ""}`}
    >
      <Avatar
        username={comment.username}
        avatarUrl={comment.avatarUrl}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div>
          <span
            className={`font-ui text-sm font-semibold ${isLight ? "text-on-surface" : "text-white"}`}
          >
            {comment.username}
          </span>
          <span
            className={`font-ui text-xs ml-2 ${isLight ? "text-on-surface-variant" : "text-white/50"}`}
          >
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>
        <p
          className={`font-body text-sm leading-snug wrap-break-word ${isLight ? "text-on-surface" : "text-white/90"}`}
        >
          {comment.text}
        </p>
        {onReact && (
          <div className="mt-1">
            <CommentReactionControl
              reactions={comment.reactions}
              onReact={onReact}
              isPending={isReactionPending}
              variant={variant}
              viewerUsername={viewerUsername}
            />
          </div>
        )}
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeletePending}
          aria-label={
            isOwnComment ? "Delete your comment" : "Delete this comment"
          }
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center disabled:pointer-events-none transition-colors focus-visible:ring-2 focus-visible:ring-secondary ${
            isLight
              ? "text-on-surface-variant hover:text-error hover:bg-error-container"
              : "text-white/40 hover:text-error hover:bg-white/10"
          }`}
        >
          {isDeletePending ? (
            <Icon name="progress_activity" className="text-lg animate-spin" />
          ) : (
            <Icon name="delete" className="text-lg" />
          )}
        </button>
      )}
    </Container>
  );
}

// A top-level comment plus its Reply trigger, inline reply composer (when
// open), and its own replies — exactly one level deep, so a reply never
// gets a Reply trigger of its own.
function TopLevelCommentItem({
  comment,
  viewerId,
  viewerUsername,
  isAlbumOwner,
  pendingDeleteCommentId,
  onDeleteComment,
  onReactToComment,
  pendingReactionCommentId,
  isLight,
  variant,
  isReplying,
  onToggleReply,
  onAddReply,
  isAddPending,
  addError,
  onLoadMoreReplies,
  isLoadingMoreReplies,
  loadMoreRepliesError,
}: {
  comment: TopLevelComment;
  viewerId?: string;
  viewerUsername?: string;
  isAlbumOwner: boolean;
  pendingDeleteCommentId: string | null;
  onDeleteComment: (commentId: string) => void;
  onReactToComment?: (commentId: string, type: ReactionType) => void;
  pendingReactionCommentId?: string | null;
  isLight: boolean;
  variant: "light" | "dark";
  isReplying: boolean;
  onToggleReply: () => void;
  onAddReply: (text: string) => Promise<void>;
  isAddPending: boolean;
  addError: boolean;
  onLoadMoreReplies?: () => void;
  isLoadingMoreReplies: boolean;
  loadMoreRepliesError: boolean;
}) {
  return (
    <li className="flex flex-col gap-1.5">
      <CommentRow
        comment={comment}
        isOwnComment={comment.user === viewerId}
        canDelete={comment.user === viewerId || isAlbumOwner}
        isDeletePending={pendingDeleteCommentId === comment._id}
        onDelete={() => onDeleteComment(comment._id)}
        onReact={onReactToComment ? (type) => onReactToComment(comment._id, type) : undefined}
        isReactionPending={pendingReactionCommentId === comment._id}
        viewerUsername={viewerUsername}
        isLight={isLight}
        variant={variant}
        as="div"
      />
      <div className="pl-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={onToggleReply}
          className={`self-start font-ui text-xs uppercase tracking-wide transition-colors ${
            isLight ? "text-on-surface-variant hover:text-secondary" : "text-white/50 hover:text-white"
          }`}
        >
          {isReplying ? "Cancel" : "Reply"}
        </button>
        {isReplying && (
          <>
            <CommentComposer
              onSubmit={onAddReply}
              isPending={isAddPending}
              variant={variant}
              placeholder="Write a reply…"
              autoFocus
            />
            {addError && (
              <p
                role="alert"
                className="bg-error-container text-on-error-container rounded-paper font-ui text-xs px-3 py-2"
              >
                Couldn&apos;t post your reply. Try again.
              </p>
            )}
          </>
        )}
        {comment.replies.length > 0 && (
          <ul className="flex flex-col gap-2.5">
            {comment.replies.map((reply) => (
              <CommentRow
                key={reply._id}
                comment={reply}
                isOwnComment={reply.user === viewerId}
                canDelete={reply.user === viewerId || isAlbumOwner}
                isDeletePending={pendingDeleteCommentId === reply._id}
                onDelete={() => onDeleteComment(reply._id)}
                onReact={onReactToComment ? (type) => onReactToComment(reply._id, type) : undefined}
                isReactionPending={pendingReactionCommentId === reply._id}
                viewerUsername={viewerUsername}
                isLight={isLight}
                variant={variant}
              />
            ))}
          </ul>
        )}
        {comment.hasMoreReplies && (
          <button
            type="button"
            onClick={onLoadMoreReplies}
            disabled={isLoadingMoreReplies}
            aria-label={isLoadingMoreReplies ? "Loading more replies" : undefined}
            className={`self-start flex items-center gap-1.5 font-ui text-xs uppercase tracking-wide transition-colors disabled:pointer-events-none ${
              loadMoreRepliesError
                ? "text-error hover:text-error"
                : isLight
                  ? "text-on-surface-variant hover:text-secondary disabled:text-on-surface-variant/60"
                  : "text-white/50 hover:text-white disabled:text-white/40"
            }`}
          >
            {isLoadingMoreReplies ? (
              <Icon name="progress_activity" className="text-sm animate-spin" />
            ) : loadMoreRepliesError ? (
              "Couldn't load more replies. Try again."
            ) : (
              "Load more replies"
            )}
          </button>
        )}
      </div>
    </li>
  );
}

/** Inline comment-count trigger + expandable thread panel, for a single page/photo — rendered in both PhotoLightbox and AlbumSpread. */
export default function CommentControl({
  pageId,
  commentCount,
  comments,
  isLoading,
  isError,
  onOpenChange,
  onAddComment,
  pendingCommentTarget,
  erroredCommentTarget,
  onDeleteComment,
  pendingDeleteCommentId,
  onReactToComment,
  pendingReactionCommentId = null,
  viewerId,
  viewerUsername,
  isAlbumOwner,
  variant = 'dark',
  hasMoreComments = false,
  isFetchingMoreComments = false,
  hasFetchMoreCommentsError = false,
  onFetchMoreComments,
  onLoadMoreReplies,
  pendingRepliesCommentId = null,
  erroredRepliesCommentId = null,
}: CommentControlProps) {
  const isLight = variant === 'light';
  // null represents the top-level (bottom) composer specifically — see the
  // prop doc above for why undefined ("nothing pending/errored") and null
  // ("the top-level composer, specifically") have to stay distinguishable.
  const isTopLevelAddPending = pendingCommentTarget === null;
  const topLevelAddError = erroredCommentTarget === null;
  const isAnyAddPending = pendingCommentTarget !== undefined;
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => onOpenChange?.(isOpen), [isOpen, onOpenChange]);
  const close = useCallback(() => setIsOpen(false), []);
  // Same as ReactionControl's picker/ReactorsModal — closes this panel
  // without also closing the lightbox underneath it, since useEscapeKey
  // stops the keypress from reaching PhotoLightbox's own window-level
  // Escape listener. Suspended while a post is in flight — closing (and
  // thus resetting the parent's mutation, see ViewerPage's
  // handleCommentsOpenChange) mid-request would detach this submission's
  // own onError callback, silently swallowing a failure that lands after
  // the panel is already closed.
  useEscapeKey(isOpen && !isAnyAddPending, close);

  // Same reset-on-pageId-change trick as ReactionControl: this instance is
  // reused across photo navigation (no `key` prop), and PhotoLightbox's
  // arrow-key navigation changes the current photo via a window keydown
  // listener, so without this the panel could stay open, still showing the
  // previous photo's thread. Resetting synchronously during render (rather
  // than in an effect) avoids a frame where the stale panel is still
  // visible.
  const [lastPageId, setLastPageId] = useState(pageId);
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(null);
  if (pageId !== lastPageId) {
    setLastPageId(pageId);
    setIsOpen(false);
    setReplyingToCommentId(null);
  }

  const handleToggleReply = (commentId: string) => {
    setReplyingToCommentId((current) => (current === commentId ? null : commentId));
  };

  const listRef = useRef<HTMLDivElement>(null);

  // Captured by handleFetchMore just before it asks for an older portion —
  // scrollTop alongside scrollHeight, since the restore-position math below
  // needs the delta, not just the new height (the "See earlier comments"
  // button is normally only reachable at the very top of the list, but
  // mobile overscroll/bounce can leave scrollTop slightly non-zero even
  // there). Cleared unconditionally once the fetch settles — including on
  // failure, where comments never changes — so a later, unrelated update
  // can't misread a stale pending fetch as "an older portion just loaded"
  // and apply leftover scroll math against it.
  const pendingOlderPortion = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const handleFetchMore = () => {
    const list = listRef.current;
    if (list) pendingOlderPortion.current = { scrollHeight: list.scrollHeight, scrollTop: list.scrollTop };
    onFetchMoreComments?.();
  };
  useEffect(() => {
    if (!isFetchingMoreComments) pendingOlderPortion.current = null;
  }, [isFetchingMoreComments]);

  // One effect, not two independent ones — an older portion loading and the
  // newest comment changing (a fresh post landing at the same moment) can
  // in principle land in the same commit, and only one of "restore the
  // pre-fetch position" vs. "stick to the bottom" can win. Older-portion
  // restoration takes explicit priority: revealing history the viewer just
  // asked for shouldn't be undone by an unrelated concurrent post.
  const previousCommentsRef = useRef<{ length: number; newestId: string | undefined }>({
    length: 0,
    newestId: undefined,
  });
  useLayoutEffect(() => {
    const list = listRef.current;
    const currentLength = comments?.length ?? 0;
    const newestId = currentLength > 0 ? comments?.[currentLength - 1]?._id : undefined;
    const previous = previousCommentsRef.current;
    const pending = pendingOlderPortion.current;

    if (list && pending && currentLength !== previous.length) {
      list.scrollTop = pending.scrollTop + (list.scrollHeight - pending.scrollHeight);
    } else if (list && newestId !== previous.newestId) {
      list.scrollTop = list.scrollHeight;
    }
    pendingOlderPortion.current = null;
    previousCommentsRef.current = { length: currentLength, newestId };
  }, [comments]);

  const panelId = useId();

  const hintTextClass = isLight ? "text-on-surface-variant" : "text-white/60";

  const renderListContent = () => {
    if (isLoading && comments === undefined) {
      return (
        <p className={`font-body italic text-sm text-center py-6 ${hintTextClass}`}>
          Loading comments…
        </p>
      );
    }
    if (isError) {
      return (
        <p
          role="alert"
          className="bg-error-container text-on-error-container rounded-paper font-ui text-sm px-3 py-2 mx-2 my-2"
        >
          Couldn&apos;t load comments. Try again.
        </p>
      );
    }
    if (comments === undefined || comments.length === 0) {
      return (
        <p className={`font-body italic text-sm text-center py-6 ${hintTextClass}`}>
          No comments yet.
        </p>
      );
    }
    return (
      <>
        {hasMoreComments && (
          <button
            type="button"
            onClick={handleFetchMore}
            disabled={isFetchingMoreComments}
            aria-label={isFetchingMoreComments ? "Loading earlier comments" : undefined}
            className={`w-full flex items-center justify-center gap-1.5 py-2 font-ui text-xs uppercase tracking-wide transition-colors disabled:pointer-events-none ${
              hasFetchMoreCommentsError
                ? "text-error hover:text-error"
                : isLight
                  ? "text-on-surface-variant hover:text-secondary disabled:text-on-surface-variant/60"
                  : "text-white/60 hover:text-white disabled:text-white/40"
            }`}
          >
            {isFetchingMoreComments ? (
              <Icon name="progress_activity" className="text-base animate-spin" />
            ) : hasFetchMoreCommentsError ? (
              "Couldn't load earlier comments. Try again."
            ) : (
              "See earlier comments"
            )}
          </button>
        )}
        <ul className="flex flex-col gap-3 py-2 px-3">
          {comments.map((comment) => (
            <TopLevelCommentItem
              key={comment._id}
              comment={comment}
              viewerId={viewerId}
              viewerUsername={viewerUsername}
              isAlbumOwner={isAlbumOwner}
              pendingDeleteCommentId={pendingDeleteCommentId}
              onDeleteComment={onDeleteComment}
              onReactToComment={onReactToComment}
              pendingReactionCommentId={pendingReactionCommentId}
              isLight={isLight}
              variant={variant}
              isReplying={replyingToCommentId === comment._id}
              onToggleReply={() => handleToggleReply(comment._id)}
              onAddReply={(text) => onAddComment(text, comment._id)}
              isAddPending={pendingCommentTarget === comment._id}
              addError={erroredCommentTarget === comment._id}
              onLoadMoreReplies={onLoadMoreReplies ? () => onLoadMoreReplies(comment._id) : undefined}
              isLoadingMoreReplies={pendingRepliesCommentId === comment._id}
              loadMoreRepliesError={erroredRepliesCommentId === comment._id}
            />
          ))}
        </ul>
      </>
    );
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        // Blocked from closing (not from opening — that case can't arise,
        // since a post can't be in flight before the panel is open) while a
        // post is in flight, same reasoning as the collapse button below.
        disabled={isOpen && isAnyAddPending}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={
          isOpen ? "Hide comments" : `View comments (${commentCount})`
        }
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-ui text-sm transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none ${
          isLight
            ? "text-on-surface-variant hover:bg-surface-container-low hover:text-secondary"
            : "text-white/80 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon name="mode_comment" filled={isOpen} className="text-xl" />
        {commentCount}
      </button>

      {isOpen && (
        // Floats above the trigger (like ReactionControl's picker) instead
        // of pushing the surrounding layout taller — it sits right next to
        // the like button, so growing in flow would shove that row down
        // every time the thread opens.
        <div
          id={panelId}
          className={`absolute bottom-full right-0 mb-2 w-80 max-w-[85vw] max-h-[70vh] rounded-panel border flex flex-col overflow-hidden z-20 ${
            isLight
              ? "bg-surface-container-lowest paper-depth border-outline-variant/40"
              : "bg-inverse-surface border-white/10"
          }`}
        >
          <div className="flex items-center justify-between px-3 py-2">
            <span className={`font-ui text-xs uppercase tracking-wide ${isLight ? "text-on-surface-variant" : "text-white/50"}`}>
              Comments
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              // See useEscapeKey above — closing while a post is in flight
              // would detach that submission's own error callback.
              disabled={isAnyAddPending}
              aria-label="Collapse comments"
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-40 disabled:pointer-events-none ${
                isLight
                  ? "text-on-surface-variant hover:bg-surface-container-low hover:text-secondary"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon name="expand_less" className="text-xl" />
            </button>
          </div>

          <div ref={listRef} className="max-h-56 md:max-h-72 overflow-y-auto">
            {renderListContent()}
          </div>

          {topLevelAddError && (
            <p
              role="alert"
              className="bg-error-container text-on-error-container rounded-paper font-ui text-sm px-3 py-2 mx-2 mt-2"
            >
              Couldn&apos;t post your comment. Try again.
            </p>
          )}

          <div className={`border-t ${isLight ? "border-outline-variant/40" : "border-white/10"}`}>
            <CommentComposer
              onSubmit={onAddComment}
              isPending={isTopLevelAddPending}
              variant={variant}
            />
          </div>
        </div>
      )}
    </div>
  );
}
