/**
 * Creates the Admin user or resets its password from ADMIN_PASSWORD.
 *
 * Usage:
 *   local:  ADMIN_PASSWORD=... npm run set-admin-password
 *   docker: docker compose exec api npm run set-admin-password
 *           (ADMIN_PASSWORD must be set in the root .env)
 */
const mongoose = require('mongoose');

const env = process.env.NODE_ENV || 'development';
const settings = require('../server/config/settings')[env];
const encryption = require('../server/utilities/encryption');

const password = process.env.ADMIN_PASSWORD;

if (!password || password.length < 8) {
  console.error('ADMIN_PASSWORD must be set and at least 8 characters.');
  process.exit(1);
}

async function run() {
  await mongoose.connect(settings.db);
  const User = require('../server/data/User');

  const salt = encryption.generateSalt();
  const hashedPass = encryption.generateHashedPassword(salt, password);

  const result = await User.findOneAndUpdate(
    { username: 'Admin' },
    {
      $set: { salt, hashedPass, roles: ['Admin'] },
      $setOnInsert: {
        username: 'Admin',
        email: process.env.ADMIN_EMAIL || 'admin@folia.local',
      },
    },
    { upsert: true, new: true }
  );

  console.log(`Admin password ${result ? 'set' : 'created'} successfully.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
