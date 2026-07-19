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

// Attaches each top-level comment's first REPLIES_PAGE_SIZE replies (as
// already-resolved plain objects — pass the output of withCommentAuthors,
// not raw documents) as a nested `replies` array, oldest-first, plus a
// `hasMoreReplies` flag for whichever comments have more than that beyond
// the first page — the rest are fetched on demand via listReplies
// (pages-controller.js), same "load more" shape as listComments' own
// before/beforeId pagination.
//
// One aggregation for every parent in the page, not one per comment — same
// N+1-avoidance shape as resolveCommentCounts above, but grouped so the
// REPLIES_PAGE_SIZE + 1 cap applies per parent instead of across the whole
// batch (a $find + $limit here would let one heavily-replied comment starve
// every other comment's replies out of the shared limit).
function attachReplies(topLevelComments) {
  const parentIds = topLevelComments.map((comment) => comment._id);
  if (parentIds.length === 0) return Promise.resolve([]);

  return Comment.aggregate([
    { $match: { parentComment: { $in: parentIds } } },
    { $sort: { createdAt: 1, _id: 1 } },
    { $group: { _id: '$parentComment', replies: { $push: '$$ROOT' } } },
    // The extra document beyond the page size reveals hasMoreReplies
    // without a separate count query per parent — same "+1" idiom as
    // listComments' own hasMore.
    { $project: { replies: { $slice: ['$replies', Comment.REPLIES_PAGE_SIZE + 1] } } },
  ]).then((groups) => {
    // $$ROOT documents come back as plain objects, not Mongoose documents —
    // hydrate them so withCommentAuthors' comment.toJSON() call below works.
    const pageByParentId = new Map(
      groups.map((group) => {
        const hasMoreReplies = group.replies.length > Comment.REPLIES_PAGE_SIZE;
        const replies = group.replies.slice(0, Comment.REPLIES_PAGE_SIZE).map((doc) => Comment.hydrate(doc));
        return [group._id.toString(), { replies, hasMoreReplies }];
      })
    );

    const allReplies = [...pageByParentId.values()].flatMap((page) => page.replies);
    return withCommentAuthors(allReplies).then((repliesWithAuthors) => {
      const repliesByParentId = new Map();
      for (const reply of repliesWithAuthors) {
        const parentId = reply.parentComment.toString();
        const existing = repliesByParentId.get(parentId) ?? [];
        existing.push(reply);
        repliesByParentId.set(parentId, existing);
      }
      return topLevelComments.map((comment) => {
        const parentId = comment._id.toString();
        return {
          ...comment,
          replies: repliesByParentId.get(parentId) ?? [],
          hasMoreReplies: pageByParentId.get(parentId)?.hasMoreReplies ?? false,
        };
      });
    });
  });
}

module.exports = { resolveCommentCounts, withCommentAuthors, attachReplies };
