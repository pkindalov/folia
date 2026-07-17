const CommentReaction = require('../data/CommentReaction');
const Reaction = require('../data/Reaction');
const { resolveUsernames } = require('./controller-helpers');

// Caps how many reactors are resolved and shipped per comment, same
// reasoning (and same limit) as pages-controller.js's MAX_REACTORS_PER_PAGE.
const MAX_REACTORS_PER_COMMENT = 50;

function zeroFilledCounts() {
  return Object.fromEntries(Reaction.REACTION_TYPES.map((type) => [type, 0]));
}

// Batched reaction summary for a list of comments (top-level and/or replies,
// mixed) — three queries total, same N+1-avoidance shape as
// resolveReactionSummaries in pages-controller.js, just keyed by comment
// instead of page. Takes each comment's _id as-is (a real ObjectId on a live
// Comment document or the output of withCommentAuthors), same assumption
// resolveReactionSummaries makes for pages. Returns a Map from comment id
// (string) to { counts, total, viewerReaction, reactors }.
function resolveCommentReactionSummaries(comments, viewerId) {
  const commentIds = comments.map((comment) => comment._id);
  if (commentIds.length === 0) return Promise.resolve(new Map());

  return Promise.all([
    CommentReaction.aggregate([
      { $match: { comment: { $in: commentIds } } },
      { $group: { _id: { comment: '$comment', type: '$type' }, count: { $sum: 1 } } },
    ]),
    CommentReaction.find({ comment: { $in: commentIds }, user: viewerId }, 'comment type'),
    CommentReaction.aggregate([
      { $match: { comment: { $in: commentIds } } },
      {
        $group: {
          _id: '$comment',
          reactors: {
            $topN: {
              n: MAX_REACTORS_PER_COMMENT,
              sortBy: { createdAt: -1 },
              output: { user: '$user', type: '$type' },
            },
          },
        },
      },
    ]),
  ]).then(([grouped, viewerReactions, reactorGroups]) => {
    const viewerReactionByCommentId = new Map(
      viewerReactions.map((reaction) => [reaction.comment.toString(), reaction.type])
    );

    const summaryByCommentId = new Map(
      commentIds.map((commentId) => [
        commentId.toString(),
        { counts: zeroFilledCounts(), total: 0, viewerReaction: null, reactors: [] },
      ])
    );

    for (const { _id, count } of grouped) {
      const summary = summaryByCommentId.get(_id.comment.toString());
      summary.counts[_id.type] = count;
      summary.total += count;
    }

    for (const [commentId, summary] of summaryByCommentId) {
      summary.viewerReaction = viewerReactionByCommentId.get(commentId) ?? null;
    }

    const allReactorUserIds = reactorGroups.flatMap((group) => group.reactors.map((reactor) => reactor.user));

    return resolveUsernames(allReactorUserIds).then((usernames) => {
      let cursor = 0;
      for (const group of reactorGroups) {
        const summary = summaryByCommentId.get(group._id.toString());
        summary.reactors = group.reactors.map((reactor) => ({
          username: usernames[cursor++],
          type: reactor.type,
        }));
      }
      return summaryByCommentId;
    });
  });
}

module.exports = { resolveCommentReactionSummaries };
