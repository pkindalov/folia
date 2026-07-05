const jwt = require('jsonwebtoken');
const User = require('mongoose').model('User');

const env = process.env.NODE_ENV || 'development';
const settings = require('./settings')[env];

module.exports = {
  // Verifies "Authorization: Bearer <token>" and attaches req.user
  isAuthenticated: (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing authentication token' });
    }

    let payload;
    try {
      payload = jwt.verify(token, settings.jwtSecret);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    User.findById(payload.sub)
      .then((user) => {
        if (!user) return res.status(401).json({ error: 'User no longer exists' });
        req.user = user;
        next();
      })
      .catch(() => res.status(500).json({ error: 'Authentication failed' }));
  },

  isInRole: (role) => (req, res, next) => {
    if (req.user && req.user.roles.includes(role)) return next();
    return res.status(403).json({ error: 'Forbidden' });
  },

  signToken: (user) =>
    jwt.sign({ sub: user._id.toString(), username: user.username }, settings.jwtSecret, {
      expiresIn: settings.jwtExpiresIn,
    }),
};
