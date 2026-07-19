const rateLimit = require('express-rate-limit');
const multer = require('multer');
const controllers = require('../controllers');
const auth = require('./auth');
const upload = require('./upload');
const avatarUpload = require('./avatar-upload');

// Slow down brute-force attempts on login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

// A regex scan over every username on every keystroke is cheap to abuse —
// generous enough for interactive typeahead, tight enough to bound load.
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many searches, try again shortly' },
});

// Bounds how much disk/CPU an authenticated user can burn by repeatedly
// uploading max-size avatars — legitimate use never needs more than a
// handful of changes in a short window.
const avatarUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads, try again later' },
});

module.exports = (app) => {
  // Health / meta
  app.get('/api/health', controllers.home.health);

  // Auth
  app.post('/api/auth/register', authLimiter, controllers.users.register);
  app.post('/api/auth/login', authLimiter, controllers.users.login);
  app.post('/api/auth/logout', auth.isAuthenticated, controllers.users.logout);

  // Users (protected)
  app.get('/api/users/me', auth.isAuthenticated, controllers.users.me);
  app.put('/api/users/me', auth.isAuthenticated, controllers.users.updateMe);
  app.delete('/api/users/me', auth.isAuthenticated, controllers.users.deleteMe);
  app.post(
    '/api/users/me/avatar',
    auth.isAuthenticated,
    avatarUploadLimiter,
    avatarUpload.single('avatar'),
    controllers.users.uploadAvatar
  );
  app.delete('/api/users/me/avatar', auth.isAuthenticated, controllers.users.removeAvatar);
  // Must come before /api/users/:username, or "search" would be parsed as a username.
  app.get('/api/users/search', auth.isAuthenticated, searchLimiter, controllers.users.search);
  app.get('/api/users/:username', auth.isAuthenticated, controllers.users.profile);

  // Albums
  app.get('/api/albums', auth.isAuthenticated, controllers.albums.list);
  app.post('/api/albums', auth.isAuthenticated, controllers.albums.create);
  // Must come before /api/albums/:id, or "public"/"archived"/"shared-with-me"
  // would be parsed as an id.
  app.get('/api/albums/public', auth.isAuthenticated, controllers.albums.listPublic);
  app.get('/api/albums/archived', auth.isAuthenticated, controllers.albums.listArchived);
  app.get(
    '/api/albums/shared-with-me',
    auth.isAuthenticated,
    controllers.albums.listSharedWithMe
  );
  app.get('/api/albums/:id', auth.isAuthenticated, controllers.albums.getOne);
  app.put('/api/albums/:id', auth.isAuthenticated, controllers.albums.update);
  app.delete('/api/albums/:id', auth.isAuthenticated, controllers.albums.remove);
  app.put(
    '/api/albums/:id/reaction',
    auth.isAuthenticated,
    controllers.pages.requireReadableAlbum,
    controllers.albums.setReaction
  );

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
  app.put(
    '/api/albums/:id/pages/:pageId/reaction',
    auth.isAuthenticated,
    controllers.pages.requireReadableAlbum,
    controllers.pages.setReaction
  );
  app.get(
    '/api/albums/:id/pages/:pageId/comments',
    auth.isAuthenticated,
    controllers.pages.requireReadableAlbum,
    controllers.pages.listComments
  );
  app.get(
    '/api/albums/:id/pages/:pageId/comments/:commentId/replies',
    auth.isAuthenticated,
    controllers.pages.requireReadableAlbum,
    controllers.pages.listReplies
  );
  app.post(
    '/api/albums/:id/pages/:pageId/comments',
    auth.isAuthenticated,
    controllers.pages.requireReadableAlbum,
    controllers.pages.addComment
  );
  app.delete(
    '/api/albums/:id/pages/:pageId/comments/:commentId',
    auth.isAuthenticated,
    controllers.pages.requireReadableAlbum,
    controllers.pages.deleteComment
  );
  app.put(
    '/api/albums/:id/pages/:pageId/comments/:commentId/reaction',
    auth.isAuthenticated,
    controllers.pages.requireReadableAlbum,
    controllers.pages.setCommentReaction
  );

  // Circles
  app.get('/api/circles', auth.isAuthenticated, controllers.circles.list);
  app.post('/api/circles', auth.isAuthenticated, controllers.circles.create);
  // Must come before /api/circles/:id, or "invites" would be parsed as an id.
  app.get('/api/circles/invites', auth.isAuthenticated, controllers.circles.listInvites);
  app.get('/api/circles/:id', auth.isAuthenticated, controllers.circles.getOne);
  app.put('/api/circles/:id', auth.isAuthenticated, controllers.circles.update);
  app.delete('/api/circles/:id', auth.isAuthenticated, controllers.circles.remove);
  app.post('/api/circles/:id/members', auth.isAuthenticated, controllers.circles.addMember);
  app.put(
    '/api/circles/:id/members/:userId',
    auth.isAuthenticated,
    controllers.circles.respondToInvite
  );
  app.delete(
    '/api/circles/:id/members/:userId',
    auth.isAuthenticated,
    controllers.circles.removeMember
  );

  // Notifications
  app.get('/api/notifications', auth.isAuthenticated, controllers.notifications.list);
  app.get(
    '/api/notifications/unread-count',
    auth.isAuthenticated,
    controllers.notifications.unreadCount
  );
  app.put(
    '/api/notifications/:id/read',
    auth.isAuthenticated,
    controllers.notifications.markRead
  );
  app.put(
    '/api/notifications/:id/unread',
    auth.isAuthenticated,
    controllers.notifications.markUnread
  );
  app.put(
    '/api/notifications/read-all',
    auth.isAuthenticated,
    controllers.notifications.markAllRead
  );
  app.put(
    '/api/notifications/unread-all',
    auth.isAuthenticated,
    controllers.notifications.markAllUnread
  );
  app.delete('/api/notifications/:id', auth.isAuthenticated, controllers.notifications.dismiss);
  app.delete('/api/notifications', auth.isAuthenticated, controllers.notifications.deleteAll);

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
