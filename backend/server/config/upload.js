const crypto = require('crypto');
const multer = require('multer');

const env = process.env.NODE_ENV || 'development';
const settings = require('./settings')[env];
const storage = require('../utilities/storage');
const { EXTENSION_BY_MIME_TYPE, fileFilter } = require('./image-upload-filter');

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
