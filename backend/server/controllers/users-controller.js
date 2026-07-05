const User = require('mongoose').model('User');
const encryption = require('../utilities/encryption');
const errorHandler = require('../utilities/error-handler');
const auth = require('../config/auth');

module.exports = {
  register: (req, res) => {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'password must be at least 6 characters' });
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
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    User.findOne({ username })
      .then((user) => {
        if (!user || !user.authenticate(password)) {
          return res.status(401).json({ error: 'Invalid username or password' });
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
};
