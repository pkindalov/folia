const AlbumReaction = require('../../server/data/AlbumReaction');
const {
  resolveAlbumReactionSummary,
  resolveAlbumReactionSummaries,
} = require('../../server/utilities/album-reactions');

const ALBUM_ID = '507f191e810c19729de860ea';
const OTHER_ALBUM_ID = '507f191e810c19729de860eb';
const VIEWER_ID = '507f1f77bcf86cd799439011';

describe('resolveAlbumReactionSummary', () => {
  test('returns the total count and whether the viewer has reacted', async () => {
    jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(4);
    jest.spyOn(AlbumReaction, 'exists').mockResolvedValue({ _id: 'r1' });

    const summary = await resolveAlbumReactionSummary(ALBUM_ID, VIEWER_ID);

    expect(summary).toEqual({ total: 4, viewerReacted: true });
  });

  test('reports viewerReacted: false when the viewer has not reacted', async () => {
    jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(4);
    jest.spyOn(AlbumReaction, 'exists').mockResolvedValue(null);

    const summary = await resolveAlbumReactionSummary(ALBUM_ID, VIEWER_ID);

    expect(summary).toEqual({ total: 4, viewerReacted: false });
  });

  test('returns zero/false for an album with no reactions', async () => {
    jest.spyOn(AlbumReaction, 'countDocuments').mockResolvedValue(0);
    jest.spyOn(AlbumReaction, 'exists').mockResolvedValue(null);

    const summary = await resolveAlbumReactionSummary(ALBUM_ID, VIEWER_ID);

    expect(summary).toEqual({ total: 0, viewerReacted: false });
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
