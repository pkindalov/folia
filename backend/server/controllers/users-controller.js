const fs = require('fs');
const User = require('mongoose').model('User');
const encryption = require('../utilities/encryption');
const errorHandler = require('../utilities/error-handler');
const auth = require('../config/auth');
const storage = require('../utilities/storage');
const { isNonEmptyString } = require('../utilities/controller-helpers');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Never leaks the internal avatarFilename to a client — only the signed URL
// it's served at. Accepts either a Mongoose User document or a plain object
// (tests exercise controllers with plain mocks), mirroring how the schema's
// own toJSON already strips salt/hashedPass for real documents.
function withAvatarUrl(user) {
  const { avatarFilename, ...plain } = typeof user.toJSON === 'function' ? user.toJSON() : user;
  return {
    ...plain,
    avatarUrl: avatarFilename ? storage.avatarUrl(plain._id, avatarFilename) : null,
  };
}

module.exports = {
  withAvatarUrl,

  register: (req, res) => {
    const { username, email, password } = req.body || {};

    if (!isNonEmptyString(username) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
      return res.status(400).json({ error: 'username, email and password are required' });
    }
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'username must be 3-30 characters' });
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'invalid email address' });
    }
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }

    const salt = encryption.generateSalt();
    const hashedPass = encryption.generateHashedPassword(salt, password);

    User.create({ username, email, salt, hashedPass, roles: ['User'] })
      .then((user) => {
        res.status(201).json({ token: auth.signToken(user), user: withAvatarUrl(user) });
      })
      .catch((err) => {
        res.status(400).json({ error: errorHandler.handleMongooseError(err) });
      });
  },

  login: (req, res) => {
    const { identifier, password } = req.body || {};

    if (!isNonEmptyString(identifier) || !isNonEmptyString(password)) {
      return res.status(400).json({ error: 'identifier and password are required' });
    }

    // The identifier is a username or an email; emails are stored lowercased
    User.findOne({ $or: [{ username: identifier }, { email: identifier.toLowerCase() }] })
      .then((user) => {
        if (!user || !user.authenticate(password)) {
          // Same message for both cases — no user enumeration
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json({ token: auth.signToken(user), user: withAvatarUrl(user) });
      })
      .catch(() => res.status(500).json({ error: 'Login failed' }));
  },

  me: (req, res) => {
    res.json({ user: withAvatarUrl(req.user) });
  },

  profile: (req, res) => {
    User.findOne({ username: req.params.username })
      .then((user) => {
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user: withAvatarUrl(user) });
      })
      .catch(() => res.status(500).json({ error: 'Failed to load profile' }));
  },

  // Used to find existing users to add to a circle. Returns only usernames —
  // never email — to keep this from becoming an enumeration surface.
  search: (req, res) => {
    const { q } = req.query || {};

    if (!isNonEmptyString(q) || q.trim().length < 2) {
      return res.status(400).json({ error: 'q must be at least 2 characters' });
    }

    // Escape regex metacharacters — q is user input, not a trusted pattern.
    const escaped = q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    User.find(
      { username: { $regex: escaped, $options: 'i' }, _id: { $ne: req.user._id } },
      'username'
    )
      .limit(10)
      .then((users) => res.json({ users }))
      .catch(() => res.status(500).json({ error: 'Search failed' }));
  },

  updateMe: (req, res) => {
    const { username, email } = req.body || {};

    if (username === undefined && email === undefined) {
      return res.status(400).json({ error: 'username or email is required' });
    }
    if (username !== undefined) {
      if (!isNonEmptyString(username) || username.length < 3 || username.length > 30) {
        return res.status(400).json({ error: 'username must be 3-30 characters' });
      }
    }
    if (email !== undefined) {
      if (!isNonEmptyString(email) || !EMAIL_RE.test(email) || email.length > 254) {
        return res.status(400).json({ error: 'invalid email address' });
      }
    }

    const user = req.user;
    if (username !== undefined) user.username = username;
    if (email !== undefined) user.email = email;

    user
      .save()
      .then((saved) => res.json({ user: withAvatarUrl(saved) }))
      .catch((err) => res.status(400).json({ error: errorHandler.handleMongooseError(err) }));
  },

  uploadAvatar: (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo was uploaded' });
    }

    const user = req.user;
    const previousFilename = user.avatarFilename;

    // A plain read-then-save would let two concurrent requests (multi-tab,
    // multi-device — this app explicitly supports both) each read the same
    // previousFilename and silently clobber one another, leaking the loser's
    // file forever. The conditional filter makes the write atomic: it only
    // succeeds if avatarFilename still matches what this request read.
    // Mongo's `field: null` matches both a null value and a missing field,
    // so `previousFilename ?? null` covers users who never set an avatar.
    User.findOneAndUpdate(
      { _id: user._id, avatarFilename: previousFilename ?? null },
      { avatarFilename: req.file.filename },
      { new: true }
    )
      .then((saved) => {
        if (!saved) {
          // Lost the race — another request already changed the avatar.
          // The new file multer just wrote is now orphaned; clean it up
          // rather than silently overwriting whatever the winner set.
          const filePath = storage.avatarPath(user._id, req.file.filename);
          fs.rm(filePath, { force: true }, (err) => {
            if (err) console.error(`Failed to remove orphaned avatar ${filePath}:`, err);
          });
          return res.status(409).json({ error: 'Profile changed elsewhere — please try again' });
        }

        // Only remove the old file once the new one is durably saved —
        // otherwise a failed save would leave the user with neither.
        if (previousFilename) {
          const filePath = storage.avatarPath(user._id, previousFilename);
          fs.rm(filePath, { force: true }, (err) => {
            if (err) console.error(`Failed to remove replaced avatar ${filePath}:`, err);
          });
        }
        res.json({ user: withAvatarUrl(saved) });
      })
      .catch((err) => {
        // multer already wrote the new file to disk before this handler ran
        // — clean it up so a failed save doesn't leave it orphaned.
        const filePath = storage.avatarPath(user._id, req.file.filename);
        fs.rm(filePath, { force: true }, (rmErr) => {
          if (rmErr) console.error(`Failed to remove orphaned avatar ${filePath}:`, rmErr);
        });
        res.status(400).json({ error: errorHandler.handleMongooseError(err) });
      });
  },

  removeAvatar: (req, res) => {
    const user = req.user;
    const previousFilename = user.avatarFilename;

    if (!previousFilename) {
      return res.json({ user: withAvatarUrl(user) });
    }

    // Same race as uploadAvatar — only clear the field (and only delete the
    // file) if it still matches what we read.
    User.findOneAndUpdate(
      { _id: user._id, avatarFilename: previousFilename },
      { avatarFilename: null },
      { new: true }
    )
      .then((saved) => {
        if (!saved) {
          return res.status(409).json({ error: 'Profile changed elsewhere — please try again' });
        }
        const filePath = storage.avatarPath(user._id, previousFilename);
        fs.rm(filePath, { force: true }, (err) => {
          if (err) console.error(`Failed to remove deleted avatar ${filePath}:`, err);
        });
        res.json({ user: withAvatarUrl(saved) });
      })
      .catch(() => res.status(500).json({ error: 'Failed to remove avatar' }));
  },
};
