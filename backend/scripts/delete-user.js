/**
 * Deletes a user account and everything that belongs to it: owned albums
 * (pages, reactions), owned circles (unsharing any album pointing at one
 * first), the user's own reactions on other people's content, their
 * membership in other people's circles, their notification inbox, and
 * their upload + avatar folders on disk.
 *
 * Usage:
 *   local:  node scripts/delete-user.js <userId>            (report only)
 *           node scripts/delete-user.js <userId> --confirm  (actually deletes)
 *   docker: docker compose exec api npm run delete-user -- <userId>
 *           docker compose exec api npm run delete-user -- <userId> --confirm
 */
const mongoose = require('mongoose');

const env = process.env.NODE_ENV || 'development';
const settings = require('../server/config/settings')[env];

const shouldConfirm = process.argv.includes('--confirm');
const userId = process.argv.slice(2).find((arg) => arg !== '--confirm');

if (!userId || !mongoose.isValidObjectId(userId)) {
  console.error('Usage: node scripts/delete-user.js <userId> [--confirm]');
  process.exit(1);
}

async function run() {
  await mongoose.connect(settings.db);
  const { deleteUser, planUserDeletion, UserNotFoundError } = require('../server/utilities/user-deletion');

  const plan = await planUserDeletion(userId).catch((err) => {
    if (err instanceof UserNotFoundError) return null;
    throw err;
  });

  if (!plan) {
    console.log(`No user with id ${userId}.`);
    await mongoose.disconnect();
    return;
  }

  // Refuse to delete an Admin from this ops script — losing the sole admin
  // account is a much worse failure mode than this script being slightly
  // less convenient; reassign the role first if this is really intended.
  if (plan.user.roles?.includes('Admin')) {
    console.error(`${plan.user.username} (${plan.user._id}) is an Admin — refusing to delete. Remove the Admin role first if this is intentional.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`User: ${plan.user.username} (${plan.user._id}) <${plan.user.email}>`);
  console.log(`Albums (${plan.albums.length}):`);
  for (const album of plan.albums) console.log(`  - ${album.title} (${album._id})`);
  console.log(`Circles owned (${plan.circles.length}):`);
  for (const circle of plan.circles) console.log(`  - ${circle.name} (${circle._id})`);
  console.log(
    'Also removed: this user\'s reactions on other people\'s content, their membership in ' +
      'other circles, their notification inbox, and their upload + avatar folders on disk.'
  );

  if (!shouldConfirm) {
    console.log('\nDry run only — re-run with --confirm to actually delete this user and everything above.');
    await mongoose.disconnect();
    return;
  }

  const result = await deleteUser(userId);
  console.log(
    `\nDeleted user ${result.deletedUser.username} (${result.deletedUser._id}), ` +
      `${result.deletedAlbumCount} album(s), ${result.deletedCircleCount} circle(s).`
  );
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
