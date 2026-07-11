const Page = require('../data/Page');
const storage = require('./storage');

// The cover is whichever page the user explicitly picked; absent that,
// it's the earliest-uploaded page. Falls back to null for an empty album.
function resolveCoverImage(album) {
  const explicit = album.coverPage
    ? Page.findOne({ _id: album.coverPage, album: album._id })
    : Promise.resolve(null);

  return explicit.then((page) => {
    if (page) return storage.photoUrl(album.owner, album._id, page.filename);
    return Page.findOne({ album: album._id })
      .sort('createdAt')
      .then((firstPage) =>
        firstPage ? storage.photoUrl(album.owner, album._id, firstPage.filename) : null
      );
  });
}

// Batched counterpart to resolveCoverImage for a page of albums — two
// queries total (explicit covers + earliest-page-per-album) instead of
// resolveCoverImage's up to two queries per album, avoiding an N+1 as list
// pages grow. Returns a Map from album id (string) to coverImage url or null.
function resolveCoverImages(albums) {
  const albumIds = albums.map((album) => album._id);
  const coverPageIds = albums.filter((album) => album.coverPage).map((album) => album.coverPage);

  return Promise.all([
    coverPageIds.length > 0 ? Page.find({ _id: { $in: coverPageIds } }) : Promise.resolve([]),
    albumIds.length > 0
      ? Page.aggregate([
          { $match: { album: { $in: albumIds } } },
          { $sort: { album: 1, createdAt: 1 } },
          { $group: { _id: '$album', filename: { $first: '$filename' } } },
        ])
      : Promise.resolve([]),
  ]).then(([explicitPages, firstPages]) => {
    const explicitPageById = new Map(explicitPages.map((page) => [page._id.toString(), page]));
    const firstFilenameByAlbumId = new Map(
      firstPages.map((entry) => [entry._id.toString(), entry.filename])
    );

    return new Map(
      albums.map((album) => {
        const explicitPage = album.coverPage
          ? explicitPageById.get(album.coverPage.toString())
          : undefined;
        // Guard against a coverPage that (somehow) belongs to a different
        // album, same as resolveCoverImage's { _id, album } query does.
        const explicitPageBelongsToAlbum =
          explicitPage !== undefined && explicitPage.album.toString() === album._id.toString();
        const filename = explicitPageBelongsToAlbum
          ? explicitPage.filename
          : firstFilenameByAlbumId.get(album._id.toString());
        const coverImage = filename ? storage.photoUrl(album.owner, album._id, filename) : null;
        return [album._id.toString(), coverImage];
      })
    );
  });
}

module.exports = { resolveCoverImage, resolveCoverImages };
