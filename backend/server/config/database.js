const mongoose = require('mongoose');
const User = require('../data/User');

module.exports = (settings) => {
  mongoose.connect(settings.db);

  const db = mongoose.connection;

  db.once('open', () => {
    console.log('MongoDB ready');
    User.seedAdminUser();
  });

  db.on('error', (err) => console.log(`Database error: ${err}`));
};
