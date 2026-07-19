const Comment = require('../data/Comment');
const User = require('../data/User');
const storage = require('./storage');
const { DELETED_USER_LABEL } = require('./controller-helpers');

// Batched comment count for a page of Page documents — one grouped query
// instead of one count per page, same N+1-avoidance shape as
// resolveReactionSummaries in pages-controller.js. Returns a Map from page
// id (string) to count.
function resolveCommentCounts(pages) {
  const pageIds = pages.map((page) => page._id);
  if (pageIds.length === 0) return Promise.resolve(new Map());

  return Comment.aggregate([
    { $match: { page: { $in: pageIds } } },
    { $group: { _id: '$page', count: { $sum: 1 } } },
  ]).then((grouped) => {
    const countByPageId = new Map(grouped.map(({ _id, count }) => [_id.toString(), count]));
    return new Map(pageIds.map((pageId) => [pageId.toString(), countByPageId.get(pageId.toString()) ?? 0]));
  });
}

// Resolves a list of Comment documents to plain objects carrying their
// author's current username and avatar — a single batched User lookup
// (mirrors withActorAvatarUrls in notifications-controller.js) rather than
// one per comment. avatarUrl is signed and time-limited (see storage.js), so
// it's never stored on the comment itself and is recomputed fresh here.
// Falls back to DELETED_USER_LABEL/null for a comment whose author account
// no longer exists.
function withCommentAuthors(comments) {
  const authorIds = [...new Set(comments.map((comment) => comment.user.toString()))];
  if (authorIds.length === 0) return Promise.resolve([]);

  return User.find({ _id: { $in: authorIds } }, 'username avatarFilename').then((users) => {
    const userById = new Map(users.map((user) => [user._id.toString(), user]));

    return comments.map((comment) => {
      const author = userById.get(comment.user.toString());
      return {
        ...comment.toJSON(),
        username: author ? author.username : DELETED_USER_LABEL,
        avatarUrl: author && author.avatarFilename ? storage.avatarUrl(author._id, author.avatarFilename) : null,
      };
    });
  });
}

// Attaches each top-level comment's replies (as already-resolved plain
// objects — pass the output of withCommentAuthors, not raw documents) as a
// nested `replies` array, ascending by createdAt. One batched query for
// every parent in the page, not one per comment — same N+1-avoidance shape
// as resolveCommentCounts above. Replies are never separately paginated
// (see pages-controller.js's listComments): a heavily-replied comment is
// expected to be rare at this app's scale, so embedding them all here is
// simpler than a second cursor system just for replies — capped at
// MAX_REPLIES_PER_LOAD as a payload-size backstop in case that assumption
// ever breaks, rather than left fully unbounded.
function attachReplies(topLevelComments) {
  const parentIds = topLevelComments.map((comment) => comment._id);
  if (parentIds.length === 0) return Promise.resolve([]);

  return Comment.find({ parentComment: { $in: parentIds } })
    .sort('createdAt')
    .limit(Comment.MAX_REPLIES_PER_LOAD)
    .then((replies) =>
      withCommentAuthors(replies).then((repliesWithAuthors) => {
        const repliesByParentId = new Map();
        for (const reply of repliesWithAuthors) {
          const parentId = reply.parentComment.toString();
          const existing = repliesByParentId.get(parentId) ?? [];
          existing.push(reply);
          repliesByParentId.set(parentId, existing);
        }
        return topLevelComments.map((comment) => ({
          ...comment,
          replies: repliesByParentId.get(comment._id.toString()) ?? [],
        }));
      })
    );
}

module.exports = { resolveCommentCounts, withCommentAuthors, attachReplies };
