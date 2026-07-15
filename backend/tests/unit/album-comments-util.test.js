const Comment = require('../../server/data/Comment');
const User = require('../../server/data/User');
const { resolveCommentCounts, withCommentAuthors } = require('../../server/utilities/album-comments');

const PAGE_ID = '507f191e810c19729de860eb';
const OTHER_PAGE_ID = '507f191e810c19729de860ec';
const AUTHOR_ID = '507f1f77bcf86cd799439022';
const OTHER_AUTHOR_ID = '507f1f77bcf86cd799439033';

describe('resolveCommentCounts', () => {
  test('returns an empty map for an empty page list without querying', async () => {
    const aggregate = jest.spyOn(Comment, 'aggregate');

    const counts = await resolveCommentCounts([]);

    expect(counts.size).toBe(0);
    expect(aggregate).not.toHaveBeenCalled();
  });

  test('gives every page a zero count when none have comments', async () => {
    jest.spyOn(Comment, 'aggregate').mockResolvedValue([]);

    const counts = await resolveCommentCounts([{ _id: PAGE_ID }, { _id: OTHER_PAGE_ID }]);

    expect(counts.get(PAGE_ID)).toBe(0);
    expect(counts.get(OTHER_PAGE_ID)).toBe(0);
  });

  test('reflects the real per-page comment counts', async () => {
    jest.spyOn(Comment, 'aggregate').mockResolvedValue([
      { _id: PAGE_ID, count: 3 },
      { _id: OTHER_PAGE_ID, count: 1 },
    ]);

    const counts = await resolveCommentCounts([{ _id: PAGE_ID }, { _id: OTHER_PAGE_ID }]);

    expect(counts.get(PAGE_ID)).toBe(3);
    expect(counts.get(OTHER_PAGE_ID)).toBe(1);
  });
});

describe('withCommentAuthors', () => {
  function fakeComment(overrides = {}) {
    return {
      user: AUTHOR_ID,
      toJSON: function () {
        const { toJSON: _drop, ...rest } = this;
        return rest;
      },
      ...overrides,
    };
  }

  test('resolves each comment\'s author username and avatar', async () => {
    jest.spyOn(User, 'find').mockResolvedValue([
      { _id: AUTHOR_ID, username: 'maria', avatarFilename: 'a.jpg' },
    ]);

    const [withAuthor] = await withCommentAuthors([fakeComment()]);

    expect(withAuthor.username).toBe('maria');
    expect(withAuthor.avatarUrl).toEqual(expect.stringContaining('/uploads/avatars/'));
  });

  test('falls back to null avatarUrl for an author with no avatar', async () => {
    jest.spyOn(User, 'find').mockResolvedValue([{ _id: AUTHOR_ID, username: 'maria', avatarFilename: null }]);

    const [withAuthor] = await withCommentAuthors([fakeComment()]);

    expect(withAuthor.avatarUrl).toBeNull();
  });

  test('falls back to "Deleted user" and a null avatar for a comment whose author no longer exists', async () => {
    jest.spyOn(User, 'find').mockResolvedValue([]);

    const [withAuthor] = await withCommentAuthors([fakeComment()]);

    expect(withAuthor.username).toBe('Deleted user');
    expect(withAuthor.avatarUrl).toBeNull();
  });

  test('batches distinct authors across multiple comments into a single User query', async () => {
    const find = jest.spyOn(User, 'find').mockResolvedValue([
      { _id: AUTHOR_ID, username: 'maria', avatarFilename: null },
      { _id: OTHER_AUTHOR_ID, username: 'sam', avatarFilename: null },
    ]);

    const [first, second] = await withCommentAuthors([
      fakeComment({ user: AUTHOR_ID }),
      fakeComment({ user: OTHER_AUTHOR_ID }),
    ]);

    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith(
      { _id: { $in: [AUTHOR_ID, OTHER_AUTHOR_ID] } },
      'username avatarFilename'
    );
    expect(first.username).toBe('maria');
    expect(second.username).toBe('sam');
  });

  test('returns an empty array for an empty comment list without querying', async () => {
    const find = jest.spyOn(User, 'find');

    const result = await withCommentAuthors([]);

    expect(result).toEqual([]);
    expect(find).not.toHaveBeenCalled();
  });
});
