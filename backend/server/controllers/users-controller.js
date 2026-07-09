const User = require('mongoose').model('User');
const encryption = require('../utilities/encryption');
const errorHandler = require('../utilities/error-handler');
const auth = require('../config/auth');
const { isNonEmptyString } = require('../utilities/controller-helpers');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = {
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
        res.status(201).json({ token: auth.signToken(user), user });
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
        res.json({ token: auth.signToken(user), user });
      })
      .catch(() => res.status(500).json({ error: 'Login failed' }));
  },

  me: (req, res) => {
    res.json({ user: req.user });
  },

  profile: (req, res) => {
    User.findOne({ username: req.params.username })
      .then((user) => {
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ user });
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
};
