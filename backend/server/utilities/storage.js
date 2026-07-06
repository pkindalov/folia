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

  ensureAlbumDir: (ownerId, albumId) => {
    const dir = albumDir(ownerId, albumId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  },

  removeAlbumDir: (ownerId, albumId) => {
    fs.rmSync(albumDir(ownerId, albumId), { recursive: true, force: true });
  },
};
