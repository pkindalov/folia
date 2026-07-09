const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const env = process.env.NODE_ENV || 'development';

// Never allow a weak/missing JWT secret in production
const jwtSecret = process.env.JWT_SECRET;
if (env === 'production' && (!jwtSecret || jwtSecret.length < 32)) {
  throw new Error(
    'JWT_SECRET must be set to a random string of at least 32 characters in production. ' +
      'Generate one with: openssl rand -hex 32'
  );
}
if (env === 'production' && process.env.PHOTO_URL_SECRET && process.env.PHOTO_URL_SECRET.length < 32) {
  throw new Error(
    'PHOTO_URL_SECRET must be at least 32 characters in production. ' +
      'Generate one with: openssl rand -hex 32'
  );
}

// Signing photo URLs is a distinct purpose from signing session JWTs, so it
// gets its own secret rather than reusing jwtSecret — a weakness or rotation
// on one no longer automatically carries over to the other. An explicit
// PHOTO_URL_SECRET always wins; falling back to a value derived from
// jwtSecret keeps existing deployments working without a new required env var.
const photoUrlSecret =
  process.env.PHOTO_URL_SECRET ||
  crypto
    .createHmac('sha256', jwtSecret || 'dev-only-secret')
    .update('folia-photo-url')
    .digest('hex');

const base = {
  db: process.env.DB_URL || 'mongodb://localhost:27017/folia',
  port: process.env.PORT || 1337,
  jwtSecret: jwtSecret || 'dev-only-secret',
  photoUrlSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxPhotoSizeBytes: Number(process.env.MAX_PHOTO_SIZE_BYTES) || 10 * 1024 * 1024,
  maxPhotosPerUpload: Number(process.env.MAX_PHOTOS_PER_UPLOAD) || 20,
  maxPhotosPerAlbum: Number(process.env.MAX_PHOTOS_PER_ALBUM) || 300,
  admin: {
    // Identity may have defaults; the password is a secret and must be explicit
    username: process.env.ADMIN_USERNAME || 'Admin',
    email: process.env.ADMIN_EMAIL || 'admin@folia.local',
    password: process.env.ADMIN_PASSWORD,
  },
};

module.exports = {
  development: { ...base },
  test: { ...base },
  production: { ...base },
};
