const mongoose = require('mongoose');
const Album = require('../data/Album');
const Page = require('../data/Page');
const User = require('../data/User');
const errorHandler = require('../utilities/error-handler');
const storage = require('../utilities/storage');

const VISIBILITIES = ['private', 'shared', 'public'];
const ALBUMS_PAGE_SIZE = 12;

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

// Page size is fixed server-side — only the page number is caller-controlled,
// so a client can't request an unbounded page of results.
function parsePage(query) {
  const page = parseInt(query?.page, 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

// Returns an error message, or null when the input is valid.
// For updates, fields that are undefined are simply skipped.
function validateAlbumInput(body, { partial = false } = {}) {
  const { title, description, visibility, archived } = body || {};

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
  return null;
}

function canModify(album, user) {
  return album.owner.toString() === user._id.toString() || user.roles.includes('Admin');
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
      .then(([total, albums]) =>
        Promise.all(albums.map(withCoverImage)).then((albums) => ({ total, albums }))
      )
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
      .then(([total, albums]) =>
        Promise.all(albums.map(withCoverImage)).then((albums) => ({ total, albums }))
      )
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
      .then(([total, albums]) => {
        const ownerIds = [...new Set(albums.map((album) => album.owner.toString()))];
        return User.find({ _id: { $in: ownerIds } }, 'username').then((users) => {
          const usernameByOwnerId = new Map(
            users.map((user) => [user._id.toString(), user.username])
          );
          return Promise.all(
            albums.map((album) =>
              resolveCoverImage(album).then((coverImage) => ({
                ...album.toJSON(),
                ownerUsername: usernameByOwnerId.get(album.owner.toString()),
                coverImage,
              }))
            )
          ).then((albums) => ({ total, albums }));
        });
      })
      .then(({ total, albums }) => res.json({ albums, total, page, limit: ALBUMS_PAGE_SIZE }))
      .catch(() => res.status(500).json({ error: 'Failed to load public albums' }));
  },

  getOne: (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Album not found' });
    }

    Album.findById(id)
      .then((album) => {
        if (!album) return res.status(404).json({ error: 'Album not found' });
        if (album.visibility === 'private' && !canModify(album, req.user)) {
          return res.status(403).json({ error: 'This album is private' });
        }
        return withCoverImage(album).then((album) => res.json({ album }));
      })
      .catch(() => res.status(500).json({ error: 'Failed to load album' }));
  },

  create: (req, res) => {
    const error = validateAlbumInput(req.body);
    if (error) return res.status(400).json({ error });

    const { title, description, visibility } = req.body;

    Album.create({
      title: title.trim(),
      description: description ?? '',
      visibility: visibility ?? 'private',
      owner: req.user._id,
    })
      .then((album) => {
        // Every user gets their own folder under uploads/, one subfolder per album
        storage.ensureAlbumDir(req.user._id, album._id);
        // A brand-new album can't have any pages yet, so its cover is always null.
        res.status(201).json({ album: { ...album.toJSON(), coverImage: null } });
      })
      .catch((err) => res.status(400).json({ error: errorHandler.handleMongooseError(err) }));
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
        if (!canModify(album, req.user)) {
          return res.status(403).json({ error: 'You do not own this album' });
        }

        const { title, description, visibility, archived } = req.body;
        if (title !== undefined) album.title = title.trim();
        if (description !== undefined) album.description = description;
        if (visibility !== undefined) album.visibility = visibility;
        if (archived !== undefined) album.archived = archived;

        return album
          .save()
          .then((saved) => withCoverImage(saved).then((album) => res.json({ album })))
          .catch((err) => res.status(400).json({ error: errorHandler.handleMongooseError(err) }));
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
        if (!canModify(album, req.user)) {
          return res.status(403).json({ error: 'You do not own this album' });
        }

        return album.deleteOne().then(() =>
          // Its pages (and their files) go with it — otherwise the Page
          // records would orphan once the album they reference is gone
          Page.deleteMany({ album: album._id }).then(() => {
            storage.removeAlbumDir(album.owner, album._id);
            res.json({ deleted: true });
          })
        );
      })
      .catch(() => res.status(500).json({ error: 'Failed to delete album' }));
  },
};
