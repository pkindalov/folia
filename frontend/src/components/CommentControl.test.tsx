import type { ComponentProps } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CommentControl from './CommentControl';
import type { ReactionSummary, TopLevelComment } from '../features/flipbooks';

const ZERO_REACTIONS: ReactionSummary = {
  counts: { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 },
  total: 0,
  viewerReaction: null,
  reactors: [],
};

const COMMENT: TopLevelComment = {
  _id: 'c1',
  page: 'p1',
  user: 'u1',
  username: 'maria',
  avatarUrl: null,
  text: 'Lovely photo!',
  parentComment: null,
  reactions: ZERO_REACTIONS,
  createdAt: new Date().toISOString(),
  replies: [],
  hasMoreReplies: false,
};

const DEFAULT_PROPS: ComponentProps<typeof CommentControl> = {
  pageId: 'p1',
  commentCount: 0,
  comments: undefined,
  isLoading: false,
  isError: false,
  onAddComment: vi.fn().mockResolvedValue(undefined),
  onDeleteComment: vi.fn(),
  pendingDeleteCommentId: null,
  isAlbumOwner: false,
};

const renderControl = (props: Partial<ComponentProps<typeof CommentControl>> = {}) =>
  render(<CommentControl {...DEFAULT_PROPS} {...props} />);

describe('CommentControl', () => {
  test('shows the trigger with the preloaded count even at zero', () => {
    renderControl({ commentCount: 0 });
    expect(screen.getByRole('button', { name: 'View comments (0)' })).toBeInTheDocument();
  });

  test('shows the preloaded count on the trigger before the thread is fetched', () => {
    renderControl({ commentCount: 5, comments: undefined });
    expect(screen.getByRole('button', { name: 'View comments (5)' })).toBeInTheDocument();
  });

  test('clicking the trigger opens the panel and notifies the parent', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderControl({ onOpenChange });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));

    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: 'Hide comments' })).toBeInTheDocument();
  });

  test('shows a loading message while the thread is being fetched', async () => {
    const user = userEvent.setup();
    renderControl({ isLoading: true, comments: undefined });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));

    expect(screen.getByText('Loading comments…')).toBeInTheDocument();
  });

  test('shows an error message when the fetch fails', async () => {
    const user = userEvent.setup();
    renderControl({ isError: true, comments: undefined });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load comments. Try again.");
  });

  test('shows an empty state once the fetch resolves with no comments', async () => {
    const user = userEvent.setup();
    renderControl({ comments: [] });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));

    expect(screen.getByText('No comments yet.')).toBeInTheDocument();
  });

  test('renders each comment with its author and text', async () => {
    const user = userEvent.setup();
    renderControl({ commentCount: 1, comments: [COMMENT] });

    await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

    expect(screen.getByText('maria')).toBeInTheDocument();
    expect(screen.getByText('Lovely photo!')).toBeInTheDocument();
  });

  test('shows a delete button on the viewer\'s own comment', async () => {
    const user = userEvent.setup();
    renderControl({ commentCount: 1, comments: [COMMENT], viewerId: 'u1' });

    await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

    expect(screen.getByRole('button', { name: 'Delete your comment' })).toBeInTheDocument();
  });

  // Ownership is decided by id, not the display username — a stale cached
  // username (e.g. the viewer renamed their account in another tab) must
  // not hide the delete button on the viewer's own, freshly-resolved
  // comment, nor show it on a comment that only happens to share a
  // display name.
  test('shows a delete button on the viewer\'s own comment even when the cached viewer username is stale', async () => {
    const user = userEvent.setup();
    renderControl({
      commentCount: 1,
      comments: [COMMENT],
      viewerId: 'u1',
      viewerUsername: 'maria-old-handle',
    });

    await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

    expect(screen.getByRole('button', { name: 'Delete your comment' })).toBeInTheDocument();
  });

  test('hides the delete button when only the username matches, not the id', async () => {
    const user = userEvent.setup();
    renderControl({
      commentCount: 1,
      comments: [COMMENT],
      viewerId: 'someone-else-id',
      viewerUsername: 'maria',
    });

    await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  test('shows a delete button on someone else\'s comment when the viewer is the album owner', async () => {
    const user = userEvent.setup();
    renderControl({
      commentCount: 1,
      comments: [COMMENT],
      viewerId: 'someone-else-id',
      isAlbumOwner: true,
    });

    await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

    expect(screen.getByRole('button', { name: 'Delete this comment' })).toBeInTheDocument();
  });

  test('hides the delete button for a comment that is neither the viewer\'s own nor theirs to moderate', async () => {
    const user = userEvent.setup();
    renderControl({
      commentCount: 1,
      comments: [COMMENT],
      viewerId: 'someone-else-id',
      isAlbumOwner: false,
    });

    await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  test('clicking delete calls onDeleteComment with the comment id', async () => {
    const onDeleteComment = vi.fn();
    const user = userEvent.setup();
    renderControl({
      commentCount: 1,
      comments: [COMMENT],
      viewerId: 'u1',
      onDeleteComment,
    });

    await user.click(screen.getByRole('button', { name: 'View comments (1)' }));
    await user.click(screen.getByRole('button', { name: 'Delete your comment' }));

    expect(onDeleteComment).toHaveBeenCalledWith('c1');
  });

  test('shows a pending spinner in place of the delete button while that comment is being deleted', async () => {
    const user = userEvent.setup();
    renderControl({
      commentCount: 1,
      comments: [COMMENT],
      viewerId: 'u1',
      pendingDeleteCommentId: 'c1',
    });

    await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

    expect(screen.getByRole('button', { name: 'Delete your comment' })).toBeDisabled();
  });

  test('shows an error banner when posting a comment fails', async () => {
    const user = userEvent.setup();
    renderControl({ erroredCommentTarget: null });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't post your comment. Try again.");
  });

  test('submitting the composer calls onAddComment with the typed text', async () => {
    const onAddComment = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderControl({ comments: [], onAddComment });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));
    await user.type(screen.getByPlaceholderText('Add a comment…'), 'Nice!{Enter}');

    expect(onAddComment).toHaveBeenCalledWith('Nice!');
  });

  test('closes and reopens closed when the underlying photo (pageId) changes', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = renderControl({ pageId: 'p1', onOpenChange });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));
    expect(screen.getByRole('button', { name: 'Hide comments' })).toBeInTheDocument();

    rerender(<CommentControl {...DEFAULT_PROPS} pageId="p2" onOpenChange={onOpenChange} />);

    expect(screen.getByRole('button', { name: 'View comments (0)' })).toBeInTheDocument();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  test('cannot be collapsed while a post is in flight, so its onError can never be detached mid-request', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderControl({ comments: [], pendingCommentTarget: null, onOpenChange });

    await user.click(screen.getByRole('button', { name: 'View comments (0)' }));
    onOpenChange.mockClear();

    expect(screen.getByRole('button', { name: 'Collapse comments' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hide comments' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Collapse comments' }));
    await user.keyboard('{Escape}');

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  describe('pagination', () => {
    test('does not show a "See earlier comments" button when there is no older portion', async () => {
      const user = userEvent.setup();
      renderControl({ commentCount: 1, comments: [COMMENT], hasMoreComments: false });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

      expect(screen.queryByRole('button', { name: /see earlier comments/i })).not.toBeInTheDocument();
    });

    test('shows a "See earlier comments" button when an older portion exists, and clicking it fetches more', async () => {
      const onFetchMoreComments = vi.fn();
      const user = userEvent.setup();
      renderControl({
        commentCount: 1,
        comments: [COMMENT],
        hasMoreComments: true,
        onFetchMoreComments,
      });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));
      await user.click(screen.getByRole('button', { name: /see earlier comments/i }));

      expect(onFetchMoreComments).toHaveBeenCalledTimes(1);
    });

    test('disables the "See earlier comments" button while the older portion is loading', async () => {
      const user = userEvent.setup();
      renderControl({
        commentCount: 1,
        comments: [COMMENT],
        hasMoreComments: true,
        isFetchingMoreComments: true,
      });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

      expect(screen.getByRole('button', { name: 'Loading earlier comments' })).toBeDisabled();
    });
  });

  describe('replies', () => {
    test('clicking Reply opens an inline composer, and submitting it calls onAddComment with the parent comment id', async () => {
      const onAddComment = vi.fn().mockResolvedValue(undefined);
      const user = userEvent.setup();
      renderControl({ commentCount: 1, comments: [COMMENT], onAddComment });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));
      await user.click(screen.getByRole('button', { name: 'Reply' }));
      await user.type(screen.getByPlaceholderText('Write a reply…'), 'Totally agree!{Enter}');

      expect(onAddComment).toHaveBeenCalledWith('Totally agree!', 'c1');
    });

    test('clicking Reply again (Cancel) hides the inline composer', async () => {
      const user = userEvent.setup();
      renderControl({ commentCount: 1, comments: [COMMENT] });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));
      await user.click(screen.getByRole('button', { name: 'Reply' }));
      expect(screen.getByPlaceholderText('Write a reply…')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByPlaceholderText('Write a reply…')).not.toBeInTheDocument();
    });

    test('renders a reply with its own author, text, and delete button, but no Reply trigger of its own', async () => {
      const user = userEvent.setup();
      const REPLY = {
        _id: 'reply1',
        page: 'p1',
        user: 'u2',
        username: 'sam',
        avatarUrl: null,
        text: 'Totally agree!',
        parentComment: 'c1',
        reactions: ZERO_REACTIONS,
        createdAt: new Date().toISOString(),
      };
      renderControl({
        commentCount: 1,
        comments: [{ ...COMMENT, replies: [REPLY] }],
        viewerId: 'u2',
      });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

      expect(screen.getByText('sam')).toBeInTheDocument();
      expect(screen.getByText('Totally agree!')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete your comment' })).toBeInTheDocument();
      // Only the top-level comment gets a Reply trigger — one level deep.
      expect(screen.getAllByRole('button', { name: 'Reply' })).toHaveLength(1);
    });

    test('deleting a reply calls onDeleteComment with the reply\'s own id', async () => {
      const onDeleteComment = vi.fn();
      const user = userEvent.setup();
      const REPLY = {
        _id: 'reply1',
        page: 'p1',
        user: 'u2',
        username: 'sam',
        avatarUrl: null,
        text: 'Totally agree!',
        parentComment: 'c1',
        reactions: ZERO_REACTIONS,
        createdAt: new Date().toISOString(),
      };
      renderControl({
        commentCount: 1,
        comments: [{ ...COMMENT, replies: [REPLY] }],
        viewerId: 'u2',
        onDeleteComment,
      });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));
      await user.click(screen.getByRole('button', { name: 'Delete your comment' }));

      expect(onDeleteComment).toHaveBeenCalledWith('reply1');
    });

    // Regression test: addComment is one shared mutation for the whole
    // page, so before pendingCommentTarget/erroredCommentTarget existed,
    // every mounted composer (the bottom one, plus whichever reply
    // composer was open) watched the same isPending/hasError booleans —
    // meaning an unrelated reply resolving would trigger the top-level
    // composer's own "clear draft on successful settle" effect too.
    test('a reply resolving elsewhere does not clear an untouched, unsubmitted top-level draft', async () => {
      const user = userEvent.setup();
      const { rerender } = renderControl({ commentCount: 1, comments: [COMMENT] });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));
      const topLevelTextarea = screen.getByPlaceholderText('Add a comment…');
      await user.type(topLevelTextarea, 'Still typing this one');

      // A reply to this comment starts submitting...
      rerender(
        <CommentControl {...DEFAULT_PROPS} comments={[COMMENT]} commentCount={1} pendingCommentTarget="c1" />
      );
      // ...and resolves successfully.
      rerender(<CommentControl {...DEFAULT_PROPS} comments={[COMMENT]} commentCount={1} />);

      expect(topLevelTextarea).toHaveValue('Still typing this one');
    });

    test('an errored reply shows its own inline error banner, next to its own composer', async () => {
      const user = userEvent.setup();
      renderControl({ commentCount: 1, comments: [COMMENT], erroredCommentTarget: 'c1' });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));
      await user.click(screen.getByRole('button', { name: 'Reply' }));

      expect(screen.getByRole('alert')).toHaveTextContent("Couldn't post your reply. Try again.");
    });

    test('a top-level error does not also flag an unrelated open reply composer', async () => {
      const user = userEvent.setup();
      renderControl({ commentCount: 1, comments: [COMMENT], erroredCommentTarget: null });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));
      expect(screen.getByRole('alert')).toHaveTextContent("Couldn't post your comment. Try again.");

      await user.click(screen.getByRole('button', { name: 'Reply' }));
      // Only the top-level error banner — the reply composer got no error of its own.
      expect(screen.getAllByRole('alert')).toHaveLength(1);
    });

    test('shows a "Load more replies" button when hasMoreReplies is true, and hides it otherwise', async () => {
      const user = userEvent.setup();
      renderControl({ commentCount: 1, comments: [{ ...COMMENT, hasMoreReplies: true }] });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

      expect(screen.getByRole('button', { name: 'Load more replies' })).toBeInTheDocument();
    });

    test('does not show a "Load more replies" button when hasMoreReplies is false', async () => {
      const user = userEvent.setup();
      renderControl({ commentCount: 1, comments: [{ ...COMMENT, hasMoreReplies: false }] });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

      expect(screen.queryByRole('button', { name: 'Load more replies' })).not.toBeInTheDocument();
    });

    test('clicking "Load more replies" calls onLoadMoreReplies with the comment id', async () => {
      const onLoadMoreReplies = vi.fn();
      const user = userEvent.setup();
      renderControl({
        commentCount: 1,
        comments: [{ ...COMMENT, hasMoreReplies: true }],
        onLoadMoreReplies,
      });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));
      await user.click(screen.getByRole('button', { name: 'Load more replies' }));

      expect(onLoadMoreReplies).toHaveBeenCalledWith('c1');
    });

    test('shows a pending spinner in place of "Load more replies" only for the comment that is loading', async () => {
      const OTHER_COMMENT = { ...COMMENT, _id: 'c2', hasMoreReplies: true };
      const user = userEvent.setup();
      renderControl({
        commentCount: 2,
        comments: [{ ...COMMENT, hasMoreReplies: true }, OTHER_COMMENT],
        pendingRepliesCommentId: 'c1',
      });

      await user.click(screen.getByRole('button', { name: 'View comments (2)' }));

      expect(screen.getByRole('button', { name: 'Loading more replies' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load more replies' })).toBeEnabled();
    });

    test('shows an error message next to "Load more replies" only for the comment that failed', async () => {
      const OTHER_COMMENT = { ...COMMENT, _id: 'c2', hasMoreReplies: true };
      const user = userEvent.setup();
      renderControl({
        commentCount: 2,
        comments: [{ ...COMMENT, hasMoreReplies: true }, OTHER_COMMENT],
        erroredRepliesCommentId: 'c1',
      });

      await user.click(screen.getByRole('button', { name: 'View comments (2)' }));

      expect(screen.getByRole('button', { name: "Couldn't load more replies. Try again." })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Load more replies' })).toBeInTheDocument();
    });
  });

  describe('reactions', () => {
    test('does not render a reaction control when onReactToComment is omitted', async () => {
      const user = userEvent.setup();
      renderControl({ commentCount: 1, comments: [COMMENT] });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

      expect(screen.queryByRole('button', { name: 'React to this comment' })).not.toBeInTheDocument();
    });

    test('shows "Like" on a comment with no viewer reaction yet', async () => {
      const user = userEvent.setup();
      renderControl({ commentCount: 1, comments: [COMMENT], onReactToComment: vi.fn() });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

      expect(screen.getByRole('button', { name: 'React to this comment' })).toHaveTextContent('Like');
    });

    test('picking a reaction calls onReactToComment with the comment id and chosen type', async () => {
      const onReactToComment = vi.fn();
      const user = userEvent.setup();
      renderControl({ commentCount: 1, comments: [COMMENT], onReactToComment });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));
      await user.click(screen.getByRole('button', { name: 'React to this comment' }));
      await user.click(screen.getByRole('button', { name: 'Love' }));

      expect(onReactToComment).toHaveBeenCalledWith('c1', 'love');
    });

    test('disables the reaction trigger while that comment\'s reaction mutation is pending', async () => {
      const user = userEvent.setup();
      renderControl({
        commentCount: 1,
        comments: [COMMENT],
        onReactToComment: vi.fn(),
        pendingReactionCommentId: 'c1',
      });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));

      expect(screen.getByRole('button', { name: 'React to this comment' })).toBeDisabled();
    });

    test('reacting to a reply calls onReactToComment with the reply\'s own id', async () => {
      const onReactToComment = vi.fn();
      const user = userEvent.setup();
      const REPLY = {
        _id: 'reply1',
        page: 'p1',
        user: 'u2',
        username: 'sam',
        avatarUrl: null,
        text: 'Totally agree!',
        parentComment: 'c1',
        reactions: ZERO_REACTIONS,
        createdAt: new Date().toISOString(),
      };
      renderControl({
        commentCount: 1,
        comments: [{ ...COMMENT, replies: [REPLY] }],
        onReactToComment,
      });

      await user.click(screen.getByRole('button', { name: 'View comments (1)' }));
      const [, replyReactionTrigger] = screen.getAllByRole('button', { name: 'React to this comment' });
      await user.click(replyReactionTrigger);
      await user.click(screen.getByRole('button', { name: 'Haha' }));

      expect(onReactToComment).toHaveBeenCalledWith('reply1', 'haha');
    });
  });
});
