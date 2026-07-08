const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const signedUrl = require('../utilities/signed-url');

const env = process.env.NODE_ENV || 'development';
const settings = require('./settings')[env];

// Every /uploads URL handed to a client was signed by storage.photoUrl at
// the moment an album/page read-access check passed — reject anything
// without a valid, unexpired signature over its own path rather than
// trusting the path's unguessability alone.
function requireValidUploadSignature(req, res, next) {
  const pathname = req.baseUrl + req.path;
  const { exp, sig } = req.query;
  if (!signedUrl.verify(pathname, exp, sig)) {
    return res.status(403).json({ error: 'This photo link has expired or is invalid.' });
  }
  next();
}

module.exports = (app) => {
  app.disable('x-powered-by');
  app.use(helmet());

  // Lock CORS to your frontend origin via CORS_ORIGIN once it exists
  app.use(cors({ origin: settings.corsOrigin }));

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Serve persisted uploads (flipbook photos, etc.). Every URL handed out
  // is signed (see storage.photoUrl) with an expiry, so a request must
  // carry a valid signature for that exact path before the file is served.
  const uploadsPath = path.resolve(settings.uploadsDir);
  if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
  app.use(
    '/uploads',
    requireValidUploadSignature,
    express.static(uploadsPath, { dotfiles: 'ignore', index: false })
  );

  console.log('Express ready');
};
