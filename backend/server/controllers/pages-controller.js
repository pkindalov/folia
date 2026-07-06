const mongoose = require('mongoose');
const fs = require('fs');
const Album = require('../data/Album');
const Page = require('../data/Page');
const storage = require('../utilities/storage');

const env = process.env.NODE_ENV || 'development';
const settings = require('../config/settings')[env];

const canModify = (album, user) =>
  album.owner.toString() === user._id.toString() || user.roles.includes('Admin');

// Recomputes and persists pageCount from the real Page count — never
// hand-incremented, so it can't drift from what's actually on disk/in Mongo.
function syncPageCount(album) {
  return Page.countDocuments({ album: album._id }).then((pageCount) => {
    album.pageCount = pageCount;
    return album.save().then(() => pageCount);
  });
}

function removeFiles(ownerId, albumId, filenames) {
  for (const filename of filenames) {
    const filePath = storage.photoPath(ownerId, albumId, filename);
    fs.rm(filePath, { force: true }, (err) => {
      if (err) console.error(`Failed to remove orphaned upload ${filePath}:`, err);
    });
  }
}

module.exports = {
  // Loads the album, checks the caller can modify it, and stashes it on
  // req.album — runs before multer so unauthorized requests never touch disk.
  requireOwnedAlbum: (req, res, next) => {
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
        req.album = album;
        next();
      })
      .catch(() => res.status(500).json({ error: 'Failed to load album' }));
  },

  list: (req, res) => {
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

        return Page.find({ album: id })
          .sort('createdAt')
          .then((pages) => {
            res.json({
              pages: pages.map((page) => ({
                ...page.toJSON(),
                url: `/uploads/${album.owner}/${album._id}/${page.filename}`,
              })),
            });
          });
      })
      .catch(() => res.status(500).json({ error: 'Failed to load pages' }));
  },

  upload: (req, res) => {
    const album = req.album;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'No photos were uploaded' });
    }

    // Not atomic with the insert below — two concurrent uploads to the same
    // album could both pass this check and land slightly over the cap.
    // Acceptable at this app's single-user scale; not worth locking for.
    Page.countDocuments({ album: album._id })
      .then((existingCount) => {
        if (existingCount + files.length > settings.maxPhotosPerAlbum) {
          removeFiles(album.owner, album._id, files.map((f) => f.filename));
          return res.status(400).json({
            error: `An album can have at most ${settings.maxPhotosPerAlbum} photos`,
          });
        }

        return Page.insertMany(
          files.map((file) => ({
            album: album._id,
            filename: file.filename,
            mimeType: file.mimetype,
            size: file.size,
          }))
        )
          .then((pages) =>
            syncPageCount(album).then((pageCount) => {
              res.status(201).json({
                pages: pages.map((page) => ({
                  ...page.toJSON(),
                  url: `/uploads/${album.owner}/${album._id}/${page.filename}`,
                })),
                pageCount,
              });
            })
          )
          .catch((err) => {
            removeFiles(album.owner, album._id, files.map((f) => f.filename));
            throw err;
          });
      })
      .catch(() => res.status(500).json({ error: 'Failed to save photos' }));
  },

  remove: (req, res) => {
    const album = req.album;
    const { pageId } = req.params;
    if (!mongoose.isValidObjectId(pageId)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    Page.findOne({ _id: pageId, album: album._id })
      .then((page) => {
        if (!page) return res.status(404).json({ error: 'Photo not found' });

        // Only remove the file once the record is confirmed gone — otherwise
        // a failed deleteOne would leave a DB record pointing at nothing.
        return page
          .deleteOne()
          .then(() => {
            const filePath = storage.photoPath(album.owner, album._id, page.filename);
            fs.rm(filePath, { force: true }, (err) => {
              if (err) console.error(`Failed to remove deleted photo ${filePath}:`, err);
            });
          })
          .then(() => syncPageCount(album))
          .then((pageCount) => res.json({ deleted: true, pageCount }));
      })
      .catch(() => res.status(500).json({ error: 'Failed to delete photo' }));
  },
};
