const path = require('path');
const fs = require('fs');
const signedUrl = require('./signed-url');

const env = process.env.NODE_ENV || 'development';
const settings = require('../config/settings')[env];

// Files live in <uploadsDir>/<userId>/<albumId>/ — both ids are Mongo
// ObjectIds (validated hex strings), so the path cannot be traversed.
const albumDir = (ownerId, albumId) =>
  path.resolve(settings.uploadsDir, String(ownerId), String(albumId));

// Avatars live in <uploadsDir>/avatars/<userId>/ — kept outside the album
// directory tree so avatar files are never touched by album/page cleanup.
const avatarDir = (userId) => path.resolve(settings.uploadsDir, 'avatars', String(userId));

module.exports = {
  albumDir,
  avatarDir,

  // Resolves a single photo's path inside its album's folder (filename is
  // always server-generated — see config/upload.js — so this stays safe).
  photoPath: (ownerId, albumId, filename) =>
    path.join(albumDir(ownerId, albumId), filename),

  // Public URL a photo is served at — mirrors the static route mounted on
  // /uploads. Signed so the route can enforce that this URL was only ever
  // handed to someone who already passed an album read-access check,
  // instead of trusting the path's unguessability alone.
  photoUrl: (ownerId, albumId, filename) =>
    signedUrl.sign(`/uploads/${ownerId}/${albumId}/${filename}`),

  ensureAlbumDir: (ownerId, albumId) => {
    const dir = albumDir(ownerId, albumId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  },

  removeAlbumDir: (ownerId, albumId) => {
    fs.rmSync(albumDir(ownerId, albumId), { recursive: true, force: true });
  },

  // Resolves a single avatar's path inside its owner's folder (filename is
  // always server-generated — see config/avatar-upload.js — so this stays safe).
  avatarPath: (userId, filename) => path.join(avatarDir(userId), filename),

  // Public URL an avatar is served at — mirrors the static route mounted on
  // /uploads. Signed for the same reason photoUrl is: the route only trusts
  // a valid signature, not the path's unguessability alone.
  avatarUrl: (userId, filename) => signedUrl.sign(`/uploads/avatars/${userId}/${filename}`),

  ensureAvatarDir: (userId) => {
    const dir = avatarDir(userId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  },
};
