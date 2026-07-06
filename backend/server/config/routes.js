const rateLimit = require('express-rate-limit');
const multer = require('multer');
const controllers = require('../controllers');
const auth = require('./auth');
const upload = require('./upload');

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

  // Albums
  app.get('/api/albums', auth.isAuthenticated, controllers.albums.list);
  app.post('/api/albums', auth.isAuthenticated, controllers.albums.create);
  app.get('/api/albums/:id', auth.isAuthenticated, controllers.albums.getOne);
  app.put('/api/albums/:id', auth.isAuthenticated, controllers.albums.update);
  app.delete('/api/albums/:id', auth.isAuthenticated, controllers.albums.remove);

  // Album pages (photos)
  app.get('/api/albums/:id/pages', auth.isAuthenticated, controllers.pages.list);
  app.post(
    '/api/albums/:id/pages',
    auth.isAuthenticated,
    controllers.pages.requireOwnedAlbum,
    upload.array('photos'),
    controllers.pages.upload
  );
  app.put(
    '/api/albums/:id/pages/:pageId',
    auth.isAuthenticated,
    controllers.pages.requireOwnedAlbum,
    controllers.pages.updateCaption
  );
  app.put(
    '/api/albums/:id/pages/:pageId/cover',
    auth.isAuthenticated,
    controllers.pages.requireOwnedAlbum,
    controllers.pages.setCover
  );
  app.delete(
    '/api/albums/:id/pages/:pageId',
    auth.isAuthenticated,
    controllers.pages.requireOwnedAlbum,
    controllers.pages.remove
  );

  // 404 for unknown routes
  app.all('*', (req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Central error handler — never leak stack traces to clients
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }
    if (err.message === 'UNSUPPORTED_FILE_TYPE') {
      return res.status(400).json({ error: 'Only JPEG, PNG, WEBP and GIF photos are supported' });
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Photo is too large' });
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ error: 'Too many photos in one upload' });
      }
      return res.status(400).json({ error: 'Invalid photo upload' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
};
