const crypto = require('crypto');
const multer = require('multer');

const env = process.env.NODE_ENV || 'development';
const settings = require('./settings')[env];
const storage = require('../utilities/storage');

// Extension is derived from the allowlisted MIME type, never from the
// client-supplied filename — keeps the on-disk name fully server-generated.
const EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = storage.ensureAlbumDir(req.album.owner, req.album._id);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const extension = EXTENSION_BY_MIME_TYPE[file.mimetype];
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

// file.mimetype is client-supplied, not sniffed from the actual bytes — a
// client could mislabel arbitrary content as an image type. Mitigated by
// helmet's X-Content-Type-Options: nosniff and by the server never
// executing or transforming upload contents; accepted as a tradeoff at this
// app's scale rather than adding a magic-byte sniffing dependency.
const fileFilter = (req, file, cb) => {
  if (!EXTENSION_BY_MIME_TYPE[file.mimetype]) {
    return cb(new Error('UNSUPPORTED_FILE_TYPE'));
  }
  cb(null, true);
};

module.exports = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    fileSize: settings.maxPhotoSizeBytes,
    files: settings.maxPhotosPerUpload,
    // This endpoint only ever receives the 'photos' file field, no other
    // form fields — reject anything else outright.
    fields: 0,
  },
});
