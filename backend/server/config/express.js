const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

module.exports = (app) => {
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Serve persisted uploads (flipbook images, etc.)
  const uploadsPath = path.resolve(process.env.UPLOADS_DIR || 'uploads');
  if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
  app.use('/uploads', express.static(uploadsPath));

  console.log('Express ready');
};
