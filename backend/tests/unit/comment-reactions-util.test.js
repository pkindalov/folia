const CommentReaction = require('../../server/data/CommentReaction');
const User = require('../../server/data/User');
const { resolveCommentReactionSummaries } = require('../../server/utilities/comment-reactions');

const COMMENT_ID = '507f191e810c19729de860ed';
const OTHER_COMMENT_ID = '507f191e810c19729de860ee';
const VIEWER_ID = '507f1f77bcf86cd799439011';
const REACTOR_ID = '507f1f77bcf86cd799439022';

describe('resolveCommentReactionSummaries', () => {
  test('returns an empty map for an empty comment list without querying', async () => {
    const aggregate = jest.spyOn(CommentReaction, 'aggregate');

    const summaries = await resolveCommentReactionSummaries([], VIEWER_ID);

    expect(summaries.size).toBe(0);
    expect(aggregate).not.toHaveBeenCalled();
  });

  test('zero-fills every reaction type for a comment with no reactions', async () => {
    jest.spyOn(CommentReaction, 'aggregate').mockResolvedValue([]);
    jest.spyOn(CommentReaction, 'find').mockResolvedValue([]);

    const summaries = await resolveCommentReactionSummaries([{ _id: COMMENT_ID }], VIEWER_ID);

    const summary = summaries.get(COMMENT_ID);
    expect(summary.total).toBe(0);
    expect(summary.viewerReaction).toBeNull();
    expect(summary.reactors).toEqual([]);
    expect(summary.counts).toEqual({ like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 });
  });

  test('reflects real per-comment counts, the viewer\'s own reaction, and resolved reactor usernames', async () => {
    jest.spyOn(CommentReaction, 'aggregate').mockImplementation((pipeline) => {
      const isGroupedCounts = pipeline[1].$group._id && pipeline[1].$group._id.comment;
      if (isGroupedCounts) {
        return Promise.resolve([{ _id: { comment: COMMENT_ID, type: 'love' }, count: 2 }]);
      }
      return Promise.resolve([
        { _id: COMMENT_ID, reactors: [{ user: REACTOR_ID, type: 'love' }] },
      ]);
    });
    jest.spyOn(CommentReaction, 'find').mockResolvedValue([{ comment: COMMENT_ID, type: 'love' }]);
    jest.spyOn(User, 'find').mockResolvedValue([{ _id: REACTOR_ID, username: 'maria' }]);

    const summaries = await resolveCommentReactionSummaries([{ _id: COMMENT_ID }], VIEWER_ID);

    const summary = summaries.get(COMMENT_ID);
    expect(summary.counts.love).toBe(2);
    expect(summary.total).toBe(2);
    expect(summary.viewerReaction).toBe('love');
    expect(summary.reactors).toEqual([{ username: 'maria', type: 'love' }]);
  });

  test('batches distinct comments into a single set of queries', async () => {
    const aggregate = jest.spyOn(CommentReaction, 'aggregate').mockResolvedValue([]);
    const find = jest.spyOn(CommentReaction, 'find').mockResolvedValue([]);

    const summaries = await resolveCommentReactionSummaries(
      [{ _id: COMMENT_ID }, { _id: OTHER_COMMENT_ID }],
      VIEWER_ID
    );

    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(find).toHaveBeenCalledTimes(1);
    expect(summaries.get(COMMENT_ID)).toBeDefined();
    expect(summaries.get(OTHER_COMMENT_ID)).toBeDefined();
  });
});
