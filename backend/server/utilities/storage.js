const path = require('path');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';
const settings = require('../config/settings')[env];

// Files live in <uploadsDir>/<userId>/<albumId>/ — both ids are Mongo
// ObjectIds (validated hex strings), so the path cannot be traversed.
const albumDir = (ownerId, albumId) =>
  path.resolve(settings.uploadsDir, String(ownerId), String(albumId));

module.exports = {
  albumDir,

  // Resolves a single photo's path inside its album's folder (filename is
  // always server-generated — see config/upload.js — so this stays safe).
  photoPath: (ownerId, albumId, filename) =>
    path.join(albumDir(ownerId, albumId), filename),

  ensureAlbumDir: (ownerId, albumId) => {
    const dir = albumDir(ownerId, albumId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  },

  removeAlbumDir: (ownerId, albumId) => {
    fs.rmSync(albumDir(ownerId, albumId), { recursive: true, force: true });
  },
};
