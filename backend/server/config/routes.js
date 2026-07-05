const rateLimit = require('express-rate-limit');
const controllers = require('../controllers');
const auth = require('./auth');

// Slow down brute-force attempts on login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

module.exports = (app) => {
  // Health / meta
  app.get('/api/health', controllers.home.health);

  // Auth
  app.post('/api/auth/register', authLimiter, controllers.users.register);
  app.post('/api/auth/login', authLimiter, controllers.users.login);

  // Users (protected)
  app.get('/api/users/me', auth.isAuthenticated, controllers.users.me);
  app.get('/api/users/:username', auth.isAuthenticated, controllers.users.profile);

  // 404 for unknown routes
  app.all('*', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Central error handler — never leak stack traces to clients
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
};
