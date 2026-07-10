const crypto = require('crypto');
const multer = require('multer');

const env = process.env.NODE_ENV || 'development';
const settings = require('./settings')[env];
const storage = require('../utilities/storage');
const { EXTENSION_BY_MIME_TYPE, fileFilter } = require('./image-upload-filter');

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = storage.ensureAvatarDir(req.user._id);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const extension = EXTENSION_BY_MIME_TYPE[file.mimetype];
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

module.exports = multer({
  storage: diskStorage,
  fileFilter,
  limits: {
    // Reuses the album-photo size cap rather than adding a separate env var
    // — an avatar is the same kind of upload (a single allowlisted image),
    // just capped at one file instead of many.
    fileSize: settings.maxPhotoSizeBytes,
    files: 1,
    // This endpoint only ever receives the 'avatar' file field, no other
    // form fields — reject anything else outright.
    fields: 0,
  },
});
