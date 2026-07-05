const crypto = require('crypto');

// scrypt is a slow, memory-hard KDF designed for passwords.
// (HMAC-SHA256 is too fast — vulnerable to brute-force if the DB leaks.)
const SCRYPT_KEYLEN = 64;

module.exports = {
  generateSalt: () => {
    return crypto.randomBytes(32).toString('base64');
  },

  generateHashedPassword: (salt, password) => {
    return crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  },

  // Constant-time comparison — prevents timing attacks
  verifyPassword: (salt, password, hashedPass) => {
    const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
    const stored = Buffer.from(hashedPass, 'hex');
    if (candidate.length !== stored.length) return false;
    return crypto.timingSafeEqual(candidate, stored);
  },
};
