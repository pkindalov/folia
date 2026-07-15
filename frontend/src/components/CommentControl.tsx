import { useCallback, useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";
import Avatar from "./Avatar";
import CommentComposer from "./CommentComposer";
import useEscapeKey from "../hooks/useEscapeKey";
import { formatRelativeTime } from "../features/notifications/relativeTime";
import type { Comment } from "../features/flipbooks";

type CommentControlProps = {
  /** Resets the panel closed when the underlying photo changes — same reasoning as ReactionControl's pageId prop. */
  pageId: string;
  /** Shown on the trigger even before the thread has been fetched. */
  commentCount: number;
  /** undefined while not yet fetched. */
  comments: Comment[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Fires whenever the panel opens/closes — the parent uses this to gate the lazy fetch and to suspend the lightbox's arrow-key navigation while the panel is open. */
  onOpenChange?: (isOpen: boolean) => void;
  onAddComment: (text: string) => void;
  isAddPending: boolean;
  addError: boolean;
  onDeleteComment: (commentId: string) => void;
  /** _id of the comment currently being deleted, or null. */
  pendingDeleteCommentId: string | null;
  viewerUsername?: string;
  isAlbumOwner: boolean;
};

function CommentRow({
  comment,
  isOwnComment,
  canDelete,
  isDeletePending,
  onDelete,
}: {
  comment: Comment;
  isOwnComment: boolean;
  canDelete: boolean;
  isDeletePending: boolean;
  onDelete: () => void;
}) {
  return (
    <li
      className={`flex items-start gap-2.5 ${isDeletePending ? "opacity-60" : ""}`}
    >
      <Avatar
        username={comment.username}
        avatarUrl={comment.avatarUrl}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div>
          <span className="font-ui text-sm font-semibold text-white">
            {comment.username}
          </span>
          <span className="font-ui text-xs text-white/50 ml-2">
            {formatRelativeTime(comment.createdAt)}
          </span>
        </div>
        <p className="font-body text-sm text-white/90 leading-snug wrap-break-word">
          {comment.text}
        </p>
      </div>
      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeletePending}
          aria-label={
            isOwnComment ? "Delete your comment" : "Delete this comment"
          }
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-error hover:bg-white/10 disabled:pointer-events-none transition-colors focus-visible:ring-2 focus-visible:ring-secondary"
        >
          {isDeletePending ? (
            <Icon name="progress_activity" className="text-lg animate-spin" />
          ) : (
            <Icon name="delete" className="text-lg" />
          )}
        </button>
      )}
    </li>
  );
}

/** Inline comment-count trigger + expandable thread panel, for a single page/photo, rendered inside PhotoLightbox. */
export default function CommentControl({
  pageId,
  commentCount,
  comments,
  isLoading,
  isError,
  onOpenChange,
  onAddComment,
  isAddPending,
  addError,
  onDeleteComment,
  pendingDeleteCommentId,
  viewerUsername,
  isAlbumOwner,
}: CommentControlProps) {
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
  useEscapeKey(isOpen && !isAddPending, close);

  // Same reset-on-pageId-change trick as ReactionControl: this instance is
  // reused across photo navigation (no `key` prop), and PhotoLightbox's
  // arrow-key navigation changes the current photo via a window keydown
  // listener, so without this the panel could stay open, still showing the
  // previous photo's thread. Resetting synchronously during render (rather
  // than in an effect) avoids a frame where the stale panel is still
  // visible.
  const [lastPageId, setLastPageId] = useState(pageId);
  if (pageId !== lastPageId) {
    setLastPageId(pageId);
    setIsOpen(false);
  }

  const listRef = useRef<HTMLDivElement>(null);
  // Basic "stick to bottom on new comment" — scrollTop rather than
  // scrollIntoView on the last row, since the list can be empty and we don't
  // want to depend on a specific row ref existing.
  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [comments?.length]);

  const panelId = useId();

  const renderListContent = () => {
    if (isLoading && comments === undefined) {
      return (
        <p className="font-body italic text-white/60 text-sm text-center py-6">
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
        <p className="font-body italic text-white/60 text-sm text-center py-6">
          No comments yet.
        </p>
      );
    }
    return (
      <ul className="flex flex-col gap-2.5 py-2 px-3">
        {comments.map((comment) => (
          <CommentRow
            key={comment._id}
            comment={comment}
            isOwnComment={comment.username === viewerUsername}
            canDelete={comment.username === viewerUsername || isAlbumOwner}
            isDeletePending={pendingDeleteCommentId === comment._id}
            onDelete={() => onDeleteComment(comment._id)}
          />
        ))}
      </ul>
    );
  };

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        // Blocked from closing (not from opening — that case can't arise,
        // since a post can't be in flight before the panel is open) while a
        // post is in flight, same reasoning as the collapse button below.
        disabled={isOpen && isAddPending}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={
          isOpen ? "Hide comments" : `View comments (${commentCount})`
        }
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-ui text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none"
      >
        <Icon name="mode_comment" filled={isOpen} className="text-xl" />
        {commentCount}
      </button>

      {isOpen && (
        <div
          id={panelId}
          className="w-full max-w-sm bg-white/10 rounded-panel border border-white/10 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2">
            <span className="font-ui text-xs uppercase tracking-wide text-white/50">
              Comments
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              // See useEscapeKey above — closing while a post is in flight
              // would detach that submission's own error callback.
              disabled={isAddPending}
              aria-label="Collapse comments"
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-secondary disabled:opacity-40 disabled:pointer-events-none"
            >
              <Icon name="expand_less" className="text-xl" />
            </button>
          </div>

          <div ref={listRef} className="max-h-56 md:max-h-72 overflow-y-auto">
            {renderListContent()}
          </div>

          {addError && (
            <p
              role="alert"
              className="bg-error-container text-on-error-container rounded-paper font-ui text-sm px-3 py-2 mx-2 mt-2"
            >
              Couldn&apos;t post your comment. Try again.
            </p>
          )}

          <div className="border-t border-white/10">
            <CommentComposer
              onSubmit={onAddComment}
              isPending={isAddPending}
              hasError={addError}
            />
          </div>
        </div>
      )}
    </div>
  );
}
