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

const base = {
  db: process.env.DB_URL || 'mongodb://localhost:27017/folia',
  port: process.env.PORT || 1337,
  jwtSecret: jwtSecret || 'dev-only-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  admin: {
    // Identity may have defaults; the password is a secret and must be explicit
    username: process.env.ADMIN_USERNAME || 'Admin',
    email: process.env.ADMIN_EMAIL || 'admin@folia.local',
    password: process.env.ADMIN_PASSWORD,
  },
};

module.exports = {
  development: { ...base },
  production: { ...base },
};
