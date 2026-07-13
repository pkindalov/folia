/**
 * Finds (and optionally deletes) folders under the uploads directory that
 * no longer have a matching record in MongoDB — e.g. an album folder left
 * behind after a disk delete failed partway through album removal.
 *
 * Usage:
 *   local:  npm run find-orphaned-uploads              (report only)
 *           npm run find-orphaned-uploads -- --delete  (report, then delete)
 *   docker: docker compose exec api npm run find-orphaned-uploads
 *           docker compose exec api npm run find-orphaned-uploads -- --delete
 */
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const env = process.env.NODE_ENV || 'development';
const settings = require('../server/config/settings')[env];

const shouldDelete = process.argv.includes('--delete');

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function folderSizeBytes(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    total += entry.isDirectory() ? folderSizeBytes(entryPath) : fs.statSync(entryPath).size;
  }
  return total;
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

async function findOrphanedAlbumFolders(uploadsDir, User, Album) {
  const ownerDirs = listDirs(uploadsDir).filter(
    (ownerId) => ownerId !== 'avatars' && mongoose.isValidObjectId(ownerId)
  );
  if (ownerDirs.length === 0) return [];

  const albumCandidates = [];
  for (const ownerId of ownerDirs) {
    const ownerDir = path.join(uploadsDir, ownerId);
    for (const albumId of listDirs(ownerDir)) {
      if (!mongoose.isValidObjectId(albumId)) continue;
      albumCandidates.push({ ownerId, albumId, dir: path.join(ownerDir, albumId) });
    }
  }

  const albumIds = [...new Set(albumCandidates.map((c) => c.albumId))];
  const [existingUsers, existingAlbums] = await Promise.all([
    User.find({ _id: { $in: ownerDirs } }, '_id'),
    Album.find({ _id: { $in: albumIds } }, '_id owner'),
  ]);
  const existingUserIds = new Set(existingUsers.map((u) => u._id.toString()));
  const albumOwnerById = new Map(existingAlbums.map((a) => [a._id.toString(), a.owner.toString()]));

  const orphans = [];
  for (const ownerId of ownerDirs) {
    // No matching user at all — the whole owner folder is orphaned,
    // regardless of whether it has any album subfolders left inside.
    if (!existingUserIds.has(ownerId)) {
      orphans.push(path.join(uploadsDir, ownerId));
    }
  }
  for (const { ownerId, albumId, dir } of albumCandidates) {
    if (!existingUserIds.has(ownerId)) continue; // already covered by the owner-level orphan above
    const actualOwner = albumOwnerById.get(albumId);
    if (actualOwner === undefined || actualOwner !== ownerId) orphans.push(dir);
  }
  return orphans;
}

async function findOrphanedAvatarFolders(uploadsDir, User) {
  const avatarsDir = path.join(uploadsDir, 'avatars');
  const userIds = listDirs(avatarsDir).filter((id) => mongoose.isValidObjectId(id));
  if (userIds.length === 0) return [];

  const existingUsers = await User.find({ _id: { $in: userIds } }, '_id');
  const existingUserIds = new Set(existingUsers.map((u) => u._id.toString()));

  return userIds.filter((id) => !existingUserIds.has(id)).map((id) => path.join(avatarsDir, id));
}

async function run() {
  const uploadsDir = path.resolve(settings.uploadsDir);
  if (!fs.existsSync(uploadsDir)) {
    console.log(`Uploads directory does not exist: ${uploadsDir}`);
    return;
  }

  await mongoose.connect(settings.db);
  const User = require('../server/data/User');
  const Album = require('../server/data/Album');

  const [orphanedAlbumFolders, orphanedAvatarFolders] = await Promise.all([
    findOrphanedAlbumFolders(uploadsDir, User, Album),
    findOrphanedAvatarFolders(uploadsDir, User),
  ]);
  const orphans = [...orphanedAlbumFolders, ...orphanedAvatarFolders];

  await mongoose.disconnect();

  if (orphans.length === 0) {
    console.log(`No orphaned folders found under ${uploadsDir}.`);
    return;
  }

  console.log(`Found ${orphans.length} orphaned folder(s) under ${uploadsDir}:\n`);
  let totalBytes = 0;
  for (const dir of orphans) {
    const size = folderSizeBytes(dir);
    totalBytes += size;
    console.log(`  ${dir}  (${formatBytes(size)})`);
  }
  console.log(`\nTotal reclaimable space: ${formatBytes(totalBytes)}`);

  if (!shouldDelete) {
    console.log('\nDry run only — re-run with --delete to remove these folders.');
    return;
  }

  console.log('\nDeleting...');
  for (const dir of orphans) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`  deleted ${dir}`);
  }
  console.log('Done.');
}

run().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
