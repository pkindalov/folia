const AlbumReaction = require('../data/AlbumReaction');

// Reaction summary for a single album — total love count plus whether this
// viewer has loved it.
function resolveAlbumReactionSummary(albumId, viewerId) {
  return Promise.all([
    AlbumReaction.countDocuments({ album: albumId }),
    AlbumReaction.exists({ album: albumId, user: viewerId }),
  ]).then(([total, viewerReacted]) => ({ total, viewerReacted: Boolean(viewerReacted) }));
}

// Batched counterpart to resolveAlbumReactionSummary for a page of Album
// documents — two queries total (grouped counts + the viewer's own
// reactions) instead of one pair per album, same N+1-avoidance shape as
// resolveReactionSummaries in pages-controller.js. Returns a Map from album
// id (string) to { total, viewerReacted }.
function resolveAlbumReactionSummaries(albums, viewerId) {
  const albumIds = albums.map((album) => album._id);
  if (albumIds.length === 0) return Promise.resolve(new Map());

  return Promise.all([
    AlbumReaction.aggregate([
      { $match: { album: { $in: albumIds } } },
      { $group: { _id: '$album', count: { $sum: 1 } } },
    ]),
    AlbumReaction.find({ album: { $in: albumIds }, user: viewerId }, 'album'),
  ]).then(([grouped, viewerReactions]) => {
    const totalByAlbumId = new Map(grouped.map(({ _id, count }) => [_id.toString(), count]));
    const viewerReactedAlbumIds = new Set(
      viewerReactions.map((reaction) => reaction.album.toString())
    );

    return new Map(
      albumIds.map((albumId) => [
        albumId.toString(),
        {
          total: totalByAlbumId.get(albumId.toString()) ?? 0,
          viewerReacted: viewerReactedAlbumIds.has(albumId.toString()),
        },
      ])
    );
  });
}

module.exports = { resolveAlbumReactionSummary, resolveAlbumReactionSummaries };
