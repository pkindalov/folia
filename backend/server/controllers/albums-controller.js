const mongoose = require('mongoose');
const Album = require('../data/Album');
const Page = require('../data/Page');
const User = require('../data/User');
const Circle = require('../data/Circle');
const errorHandler = require('../utilities/error-handler');
const storage = require('../utilities/storage');
const { notifyAlbumEvent } = require('../utilities/album-notifications');
const {
  isNonEmptyString,
  parsePage,
  DELETED_USER_LABEL,
  isOwnerOrAdmin,
  checkAlbumReadAccess,
} = require('../utilities/controller-helpers');

const VISIBILITIES = ['private', 'shared', 'public'];
const ALBUMS_PAGE_SIZE = 12;

// Returns an error message, or null when the input is valid.
// For updates, fields that are undefined are simply skipped.
function validateAlbumInput(body, { partial = false } = {}) {
  const { title, description, visibility, archived, sharedWithCircle } = body || {};

  if (!partial || title !== undefined) {
    if (!isNonEmptyString(title)) return 'title is required';
    if (title.trim().length > 120) return 'title must be at most 120 characters';
  }
  if (description !== undefined) {
    if (typeof description !== 'string') return 'description must be a string';
    if (description.length > 2000) return 'description must be at most 2000 characters';
  }
  if (visibility !== undefined && !VISIBILITIES.includes(visibility)) {
    return 'visibility must be one of: private, shared, public';
  }
  if (archived !== undefined && typeof archived !== 'boolean') {
    return 'archived must be a boolean';
  }
  if (
    sharedWithCircle !== undefined &&
    sharedWithCircle !== null &&
    !mongoose.isValidObjectId(sharedWithCircle)
  ) {
    return 'sharedWithCircle must be a valid circle id or null';
  }
  return null;
}

// Sharing an album to a circle only makes sense for a circle the album's
// owner actually owns — otherwise an accidental or copy-pasted id would
// silently gate the album behind a stranger's circle. Checked against the
// album's owner (not the requester) so an Admin editing someone else's
// album can't grant their own circle read access to it. Returns an error
// message, or null when sharedWithCircle is absent or valid.
function verifySharedCircleOwnership(sharedWithCircle, ownerId) {
  if (!sharedWithCircle) return Promise.resolve(null);

  return Circle.findById(sharedWithCircle).then((circle) => {
    if (!circle || circle.owner.toString() !== ownerId.toString()) {
      return 'sharedWithCircle must reference a circle you own';
    }
    return null;
  });
}

// verifySharedCircleOwnership and this album's own save() are two separate
// writes with no shared transaction, so a circle deleted in between (its own
// delete unshares every album that already points at it, but this one hasn't
// saved that yet) can leave the just-saved album pointing at a circle that no
// longer exists. Re-checking right after save closes that window: if the
// circle is already gone, immediately fall back to private instead of
// leaving a dangling reference for someone to notice later.
function healDanglingCircleReference(album) {
  if (album.visibility !== 'shared' || !album.sharedWithCircle) {
    return Promise.resolve(album);
  }

  return Circle.exists({ _id: album.sharedWithCircle }).then((stillExists) => {
    if (!stillExists) {
      album.sharedWithCircle = null;
      album.visibility = 'private';
      return album.save();
    }

    // The circle still exists, but a circle deletion unshares its albums
    // (via a query-based updateMany) *before* deleting the circle document
    // itself — so this in-memory album can already have been reverted to
    // private in the database in the gap between our own save() and this
    // check, while the circle doc briefly still exists. Re-reading from the
    // database rather than trusting this stale in-memory copy means the
    // response always reflects what's actually committed, instead of
    // reporting 'shared' for an album that was just silently unshared.
    return Album.findById(album._id);
  });
}

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

function withCoverImage(album) {
  return resolveCoverImage(album).then((coverImage) => ({ ...album.toJSON(), coverImage }));
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

function withCoverImages(albums) {
  return resolveCoverImages(albums).then((coverImageByAlbumId) =>
    albums.map((album) => ({
      ...album.toJSON(),
      coverImage: coverImageByAlbumId.get(album._id.toString()) ?? null,
    }))
  );
}

// Attaches ownerUsername and coverImage to each album — shared by listPublic
// and listSharedWithMe, which both need the same owner-lookup + cover shape.
function withOwnerUsernamesAndCovers(albums) {
  const ownerIds = [...new Set(albums.map((album) => album.owner.toString()))];
  return Promise.all([User.find({ _id: { $in: ownerIds } }, 'username'), resolveCoverImages(albums)]).then(
    ([users, coverImageByAlbumId]) => {
      const usernameByOwnerId = new Map(users.map((user) => [user._id.toString(), user.username]));
      return albums.map((album) => ({
        ...album.toJSON(),
        ownerUsername: usernameByOwnerId.get(album.owner.toString()) ?? DELETED_USER_LABEL,
        coverImage: coverImageByAlbumId.get(album._id.toString()) ?? null,
      }));
    }
  );
}

module.exports = {
  list: (req, res) => {
    const page = parsePage(req.query);
    const { visibility } = req.query || {};
    if (visibility !== undefined && !VISIBILITIES.includes(visibility)) {
      return res.status(400).json({ error: 'visibility must be one of: private, shared, public' });
    }
    // Archived volumes are filed away — they belong on the Archive page, not
    // cluttering the main gallery.
    const filter = {
      owner: req.user._id,
      archived: { $ne: true },
      ...(visibility ? { visibility } : {}),
    };

    Promise.all([
      Album.countDocuments(filter),
      Album.find(filter)
        .sort('-updatedAt')
        .skip((page - 1) * ALBUMS_PAGE_SIZE)
        .limit(ALBUMS_PAGE_SIZE),
    ])
      .then(([total, albums]) => withCoverImages(albums).then((albums) => ({ total, albums })))
      .then(({ total, albums }) => res.json({ albums, total, page, limit: ALBUMS_PAGE_SIZE }))
      .catch(() => res.status(500).json({ error: 'Failed to load albums' }));
  },

  // The owner's own archived volumes, for the Archive page.
  listArchived: (req, res) => {
    const page = parsePage(req.query);
    const filter = { owner: req.user._id, archived: true };

    Promise.all([
      Album.countDocuments(filter),
      Album.find(filter)
        .sort('-updatedAt')
        .skip((page - 1) * ALBUMS_PAGE_SIZE)
        .limit(ALBUMS_PAGE_SIZE),
    ])
      .then(([total, albums]) => withCoverImages(albums).then((albums) => ({ total, albums })))
      .then(({ total, albums }) => res.json({ albums, total, page, limit: ALBUMS_PAGE_SIZE }))
      .catch(() => res.status(500).json({ error: 'Failed to load archived albums' }));
  },

  // Every public album, across all owners, for the community Explore page.
  listPublic: (req, res) => {
    const page = parsePage(req.query);
    const filter = { visibility: 'public' };

    Promise.all([
      Album.countDocuments(filter),
      Album.find(filter)
        .sort('-createdAt')
        .skip((page - 1) * ALBUMS_PAGE_SIZE)
        .limit(ALBUMS_PAGE_SIZE),
    ])
      .then(([total, albums]) =>
        withOwnerUsernamesAndCovers(albums).then((albums) => ({ total, albums }))
      )
      .then(({ total, albums }) => res.json({ albums, total, page, limit: ALBUMS_PAGE_SIZE }))
      .catch(() => res.status(500).json({ error: 'Failed to load public albums' }));
  },

  // Albums explicitly shared with a circle the requester owns or has
  // accepted membership in — the "shared with you" counterpart to the
  // public Explore listing. Excludes the requester's own albums, which
  // already show up in their own gallery.
  listSharedWithMe: (req, res) => {
    const page = parsePage(req.query);

    Circle.find(
      {
        $or: [
          { owner: req.user._id },
          { members: { $elemMatch: { user: req.user._id, status: 'accepted' } } },
        ],
      },
      '_id'
    )
      .then((circles) => {
        const circleIds = circles.map((circle) => circle._id);
        const filter = {
          visibility: 'shared',
          sharedWithCircle: { $in: circleIds },
          owner: { $ne: req.user._id },
        };

        return Promise.all([
          Album.countDocuments(filter),
          Album.find(filter)
            .sort('-updatedAt')
            .skip((page - 1) * ALBUMS_PAGE_SIZE)
            .limit(ALBUMS_PAGE_SIZE),
        ]);
      })
      .then(([total, albums]) =>
        withOwnerUsernamesAndCovers(albums).then((albums) => ({ total, albums }))
      )
      .then(({ total, albums }) => res.json({ albums, total, page, limit: ALBUMS_PAGE_SIZE }))
      .catch(() => res.status(500).json({ error: 'Failed to load shared albums' }));
  },

  getOne: (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Album not found' });
    }

    Album.findById(id)
      .then((album) => {
        if (!album) return res.status(404).json({ error: 'Album not found' });
        return checkAlbumReadAccess(album, req.user).then((denied) => {
          if (denied) return res.status(denied.status).json({ error: denied.error });
          return withCoverImage(album).then((album) => res.json({ album }));
        });
      })
      .catch(() => res.status(500).json({ error: 'Failed to load album' }));
  },

  create: (req, res) => {
    const error = validateAlbumInput(req.body);
    if (error) return res.status(400).json({ error });

    const { title, description, visibility, sharedWithCircle } = req.body;
    // sharedWithCircle only means anything for a 'shared' album — silently
    // drop it otherwise rather than storing an inconsistent combination.
    const effectiveVisibility = visibility ?? 'private';
    const effectiveSharedWithCircle =
      effectiveVisibility === 'shared' ? (sharedWithCircle ?? null) : null;

    verifySharedCircleOwnership(effectiveSharedWithCircle, req.user._id).then((circleError) => {
      if (circleError) return res.status(400).json({ error: circleError });

      Album.create({
        title: title.trim(),
        description: description ?? '',
        visibility: effectiveVisibility,
        sharedWithCircle: effectiveSharedWithCircle,
        owner: req.user._id,
      })
        .then(healDanglingCircleReference)
        .then((album) => {
          // Every user gets their own folder under uploads/, one subfolder per album
          storage.ensureAlbumDir(req.user._id, album._id);
          // No-ops unless the album actually ended up 'shared' with a circle
          // (healDanglingCircleReference may have just reverted it to private).
          notifyAlbumEvent({ type: 'album_shared', album, actorUser: req.user });
          // A brand-new album can't have any pages yet, so its cover is always null.
          res.status(201).json({ album: { ...album.toJSON(), coverImage: null } });
        })
        .catch((err) => res.status(400).json({ error: errorHandler.handleMongooseError(err) }));
    }).catch(() => res.status(500).json({ error: 'Failed to create album' }));
  },

  update: (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const error = validateAlbumInput(req.body, { partial: true });
    if (error) return res.status(400).json({ error });

    Album.findById(id)
      .then((album) => {
        if (!album) return res.status(404).json({ error: 'Album not found' });
        if (!isOwnerOrAdmin(album, req.user)) {
          return res.status(403).json({ error: 'You do not own this album' });
        }

        const { title, description, visibility, archived, sharedWithCircle } = req.body;
        // sharedWithCircle only means anything for a 'shared' album — silently
        // drop it (whatever was submitted or already stored) once the album
        // isn't 'shared', rather than persisting an inconsistent combination.
        const effectiveVisibility = visibility !== undefined ? visibility : album.visibility;
        const effectiveSharedWithCircle =
          effectiveVisibility === 'shared'
            ? sharedWithCircle !== undefined
              ? sharedWithCircle
              : album.sharedWithCircle
            : null;

        // Only re-verify ownership when sharedWithCircle is a genuinely new
        // value from this request — a carried-forward stored value was
        // already valid when the owner originally set it, and re-checking it
        // against whoever happens to be making this request (e.g. an Admin
        // editing an unrelated field) would wrongly reject their own edits.
        const circleOwnershipCheck =
          sharedWithCircle !== undefined
            ? verifySharedCircleOwnership(effectiveSharedWithCircle, album.owner)
            : Promise.resolve(null);

        return circleOwnershipCheck.then((circleError) => {
          if (circleError) return res.status(400).json({ error: circleError });

          // Captured before mutating below, to tell apart "just became shared
          // with this circle" from "already shared with this same circle,
          // only its content changed" once the save has gone through.
          const wasSharedWithCircleId =
            album.visibility === 'shared' && album.sharedWithCircle
              ? album.sharedWithCircle.toString()
              : null;
          const titleChanged = title !== undefined && title.trim() !== album.title;
          const descriptionChanged = description !== undefined && description !== album.description;

          if (title !== undefined) album.title = title.trim();
          if (description !== undefined) album.description = description;
          if (visibility !== undefined) album.visibility = visibility;
          if (archived !== undefined) album.archived = archived;
          album.sharedWithCircle = effectiveSharedWithCircle;

          return album
            .save()
            .then(healDanglingCircleReference)
            .then((saved) => {
              const isNowSharedWithCircleId =
                saved.visibility === 'shared' && saved.sharedWithCircle
                  ? saved.sharedWithCircle.toString()
                  : null;

              if (isNowSharedWithCircleId && isNowSharedWithCircleId !== wasSharedWithCircleId) {
                // Newly shared (or re-shared with a different circle) — this
                // is the "here's new content for you" moment, same type as a
                // brand-new album, regardless of whether that happened via
                // create() or here via an edit.
                notifyAlbumEvent({ type: 'album_shared', album: saved, actorUser: req.user });
              } else if (isNowSharedWithCircleId && (titleChanged || descriptionChanged)) {
                // Still shared with the same circle as before — a routine
                // edit to content the circle can already see.
                notifyAlbumEvent({ type: 'album_updated', album: saved, actorUser: req.user });
              }

              return withCoverImage(saved).then((album) => res.json({ album }));
            })
            .catch((err) => {
              // The album was deleted by a concurrent request between the
              // findById above and this save — a 404 reflects that better
              // than the generic "Invalid data" 400.
              if (err instanceof mongoose.Error.DocumentNotFoundError) {
                return res.status(404).json({ error: 'Album not found' });
              }
              res.status(400).json({ error: errorHandler.handleMongooseError(err) });
            });
        });
      })
      .catch(() => res.status(500).json({ error: 'Failed to update album' }));
  },

  remove: (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Album not found' });
    }

    Album.findById(id)
      .then((album) => {
        if (!album) return res.status(404).json({ error: 'Album not found' });
        if (!isOwnerOrAdmin(album, req.user)) {
          return res.status(403).json({ error: 'You do not own this album' });
        }

        // Atomic find-and-delete, not album.deleteOne(): two concurrent
        // delete requests for the same album could both pass the checks
        // above before either removes it, and Model#deleteOne() doesn't
        // error when nothing matches — so without this, both would fall
        // through and double-fire the album_deleted notification below.
        // findOneAndDelete only ever actually removes the document once;
        // whichever request loses the race gets null back and skips the
        // cleanup/notification, since the winning request already did it.
        return Album.findOneAndDelete({ _id: id }).then((deletedAlbum) => {
          if (!deletedAlbum) return res.json({ deleted: true });

          // Its pages (and their files) go with it — otherwise the Page
          // records would orphan once the album they reference is gone
          return Page.deleteMany({ album: deletedAlbum._id }).then(() => {
            storage.removeAlbumDir(deletedAlbum.owner, deletedAlbum._id);
            notifyAlbumEvent({ type: 'album_deleted', album: deletedAlbum, actorUser: req.user });
            res.json({ deleted: true });
          });
        });
      })
      .catch(() => res.status(500).json({ error: 'Failed to delete album' }));
  },
};
