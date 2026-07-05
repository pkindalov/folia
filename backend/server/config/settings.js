const dotenv = require('dotenv');

dotenv.config();

const base = {
  db: process.env.DB_URL || 'mongodb://localhost:27017/folia',
  port: process.env.PORT || 1337,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
};

module.exports = {
  development: { ...base },
  production: { ...base },
};
