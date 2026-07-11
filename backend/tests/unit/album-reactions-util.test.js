const AlbumReaction = require('../../server/data/AlbumReaction');
const User = require('../../server/data/User');
const {
  resolveAlbumReactionSummary,
  resolveAlbumReactionSummaries,
} = require('../../server/utilities/album-reactions');

const ALBUM_ID = '507f191e810c19729de860ea';
const OTHER_ALBUM_ID = '507f191e810c19729de860eb';
const VIEWER_ID = '507f1f77bcf86cd799439011';
const REACTOR_ID = '507f1f77bcf86cd799439022';
const OTHER_REACTOR_ID = '507f1f77bcf86cd799439033';

// AlbumReaction.find(...).sort(...).limit(...) is chained in
// resolveAlbumReactionSummary — a thenable that also exposes chainable
// sort/limit no-ops, so it works as both `await AlbumReaction.find(...)`
// (resolveAlbumReactionSummaries, unchained) and the chained form here.
function mockReactorQuery(docs) {
  const query = Promise.resolve(docs);
  query.sort = () => query;
  query.limit = () => query;
  return query;
}

describe('resolveAlbumReactionSummary', () => {
  beforeEach(() => {
    jest.spyOn(AlbumReaction, 'find').mockReturnValue(mockReactorQuery([]));
  });

  test('returns the total count and whether the viewer has reacted', async () => {
    jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(4);
    jest.spyOn(AlbumReaction, 'exists').mockResolvedValue({ _id: 'r1' });

    const summary = await resolveAlbumReactionSummary(ALBUM_ID, VIEWER_ID);

    expect(summary).toEqual({ total: 4, viewerReacted: true, reactors: [] });
  });

  test('reports viewerReacted: false when the viewer has not reacted', async () => {
    jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(4);
    jest.spyOn(AlbumReaction, 'exists').mockResolvedValue(null);

    const summary = await resolveAlbumReactionSummary(ALBUM_ID, VIEWER_ID);

    expect(summary).toEqual({ total: 4, viewerReacted: false, reactors: [] });
  });

  test('returns zero/false/empty for an album with no reactions', async () => {
    jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AlbumReaction, 'exists').mockResolvedValue(null);

    const summary = await resolveAlbumReactionSummary(ALBUM_ID, VIEWER_ID);

    expect(summary).toEqual({ total: 0, viewerReacted: false, reactors: [] });
  });

  test('resolves reactor usernames, most recent first, falling back for a deleted account', async () => {
    jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(2);
    jest.spyOn(AlbumReaction, 'exists').mockResolvedValue(null);
    const find = jest
      .spyOn(AlbumReaction, 'find')
      .mockReturnValue(mockReactorQuery([{ user: REACTOR_ID }, { user: OTHER_REACTOR_ID }]));
    jest.spyOn(User, 'find').mockResolvedValue([{ _id: REACTOR_ID, username: 'maria' }]);

    const summary = await resolveAlbumReactionSummary(ALBUM_ID, VIEWER_ID);

    expect(summary.reactors).toEqual(['maria', 'Deleted user']);
    expect(find).toHaveBeenCalledWith({ album: ALBUM_ID }, 'user');
  });

  test('requests reactors sorted most-recent-first, capped at the resolver\'s limit', async () => {
    jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AlbumReaction, 'exists').mockResolvedValue(null);
    const query = mockReactorQuery([]);
    const sort = jest.spyOn(query, 'sort');
    const limit = jest.spyOn(query, 'limit');
    jest.spyOn(AlbumReaction, 'find').mockReturnValue(query);

    await resolveAlbumReactionSummary(ALBUM_ID, VIEWER_ID);

    expect(sort).toHaveBeenCalledWith('-createdAt');
    expect(limit).toHaveBeenCalledWith(50);
  });
});

describe('resolveAlbumReactionSummaries', () => {
  test('returns an empty map for an empty album list without querying', async () => {
    const aggregate = jest.spyOn(AlbumReaction, 'aggregate');
    const find = jest.spyOn(AlbumReaction, 'find');

    const summaries = await resolveAlbumReactionSummaries([], VIEWER_ID);

    expect(summaries.size).toBe(0);
    expect(aggregate).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });

  test('gives every album a zero-filled summary when none have reactions', async () => {
    jest.spyOn(AlbumReaction, 'aggregate').mockResolvedValue([]);
    jest.spyOn(AlbumReaction, 'find').mockResolvedValue([]);

    const summaries = await resolveAlbumReactionSummaries(
      [{ _id: ALBUM_ID }, { _id: OTHER_ALBUM_ID }],
      VIEWER_ID
    );

    expect(summaries.get(ALBUM_ID)).toEqual({ total: 0, viewerReacted: false });
    expect(summaries.get(OTHER_ALBUM_ID)).toEqual({ total: 0, viewerReacted: false });
  });

  test('reflects mixed counts and which albums this viewer has reacted to', async () => {
    jest.spyOn(AlbumReaction, 'aggregate').mockResolvedValue([
      { _id: ALBUM_ID, count: 5 },
      { _id: OTHER_ALBUM_ID, count: 1 },
    ]);
    jest.spyOn(AlbumReaction, 'find').mockResolvedValue([{ album: OTHER_ALBUM_ID }]);

    const summaries = await resolveAlbumReactionSummaries(
      [{ _id: ALBUM_ID }, { _id: OTHER_ALBUM_ID }],
      VIEWER_ID
    );

    expect(summaries.get(ALBUM_ID)).toEqual({ total: 5, viewerReacted: false });
    expect(summaries.get(OTHER_ALBUM_ID)).toEqual({ total: 1, viewerReacted: true });
  });
});
