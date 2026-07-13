const path = require('path');
const fs = require('fs');
const signedUrl = require('./signed-url');

const env = process.env.NODE_ENV || 'development';
const settings = require('../config/settings')[env];

// Files live in <uploadsDir>/<userId>/<albumId>/ — both ids are Mongo
// ObjectIds (validated hex strings), so the path cannot be traversed.
const albumDir = (ownerId, albumId) =>
  path.resolve(settings.uploadsDir, String(ownerId), String(albumId));

// The owner's folder itself, one level up from albumDir — every one of
// their albums lives under this, so removing it covers all of them in one
// shot (used when deleting a user entirely, not for a single album).
const userDir = (ownerId) => path.resolve(settings.uploadsDir, String(ownerId));

// Avatars live in <uploadsDir>/avatars/<userId>/ — kept outside the album
// directory tree so avatar files are never touched by album/page cleanup.
const avatarDir = (userId) => path.resolve(settings.uploadsDir, 'avatars', String(userId));

module.exports = {
  albumDir,
  userDir,
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

  // Removes every album this owner has, in one shot — only meant for
  // deleting the owner entirely (see user-deletion.js), never for a single
  // album, which must go through removeAlbumDir instead so it doesn't take
  // the owner's other albums with it.
  removeUserDir: (ownerId) => {
    fs.rmSync(userDir(ownerId), { recursive: true, force: true });
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

  removeAvatarDir: (userId) => {
    fs.rmSync(avatarDir(userId), { recursive: true, force: true });
  },
};
