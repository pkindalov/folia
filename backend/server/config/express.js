const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const env = process.env.NODE_ENV || 'development';
const settings = require('./settings')[env];

module.exports = (app) => {
  app.disable('x-powered-by');
  app.use(helmet());

  // Lock CORS to your frontend origin via CORS_ORIGIN once it exists
  app.use(cors({ origin: settings.corsOrigin }));

  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Serve persisted uploads (flipbook images, etc.)
  const uploadsPath = path.resolve(settings.uploadsDir);
  if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
  app.use('/uploads', express.static(uploadsPath, { dotfiles: 'ignore', index: false }));

  console.log('Express ready');
};
