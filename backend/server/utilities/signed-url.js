const crypto = require('crypto');

const env = process.env.NODE_ENV || 'development';
const settings = require('../config/settings')[env];

// A photo's visibility is already checked when its URL is built (the
// requester passed checkAlbumReadAccess to get this far) — signing the URL
// carries that decision forward to the otherwise-unauthenticated /uploads
// route, instead of leaving every photo reachable by anyone who has or
// guesses the (unguessable, but permanent and unrevocable) path.
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function hmac(pathname, expiresAt) {
  return crypto
    .createHmac('sha256', settings.jwtSecret)
    .update(`${pathname}:${expiresAt}`)
    .digest('hex');
}

// Appends an expiry and a signature over (pathname, expiry) to `pathname`.
function sign(pathname, ttlMs = DEFAULT_TTL_MS) {
  const expiresAt = Date.now() + ttlMs;
  const signature = hmac(pathname, expiresAt);
  return `${pathname}?exp=${expiresAt}&sig=${signature}`;
}

// Verifies a (pathname, expiresAt, signature) triple minted by `sign`.
// `expiresAt` and `signature` typically arrive as query-string values, so
// this is deliberately lenient about their type.
function verify(pathname, expiresAt, signature) {
  if (typeof signature !== 'string' || signature.length === 0) return false;

  const expiresAtNumber = Number(expiresAt);
  if (!Number.isFinite(expiresAtNumber) || expiresAtNumber < Date.now()) return false;

  const expected = Buffer.from(hmac(pathname, expiresAtNumber), 'hex');
  const provided = Buffer.from(signature, 'hex');
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

module.exports = { sign, verify, DEFAULT_TTL_MS };
