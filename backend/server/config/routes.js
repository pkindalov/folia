const controllers = require('../controllers');
const auth = require('./auth');

module.exports = (app) => {
  // Health / meta
  app.get('/api/health', controllers.home.health);

  // Auth
  app.post('/api/auth/register', controllers.users.register);
  app.post('/api/auth/login', controllers.users.login);

  // Users (protected)
  app.get('/api/users/me', auth.isAuthenticated, controllers.users.me);
  app.get('/api/users/:username', auth.isAuthenticated, controllers.users.profile);

  // 404 for unknown routes
  app.all('*', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Central error handler
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
};
