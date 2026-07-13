const User = require('../data/User');
const Album = require('../data/Album');
const Page = require('../data/Page');
const Reaction = require('../data/Reaction');
const AlbumReaction = require('../data/AlbumReaction');
const Circle = require('../data/Circle');
const Notification = require('../data/Notification');
const storage = require('./storage');

class UserNotFoundError extends Error {}

// Everything a deletion of this user would touch, without deleting
// anything — used both to preview a pending delete and, internally, by
// deleteUser to know what to cascade.
function planUserDeletion(userId) {
  return User.findById(userId).then((user) => {
    if (!user) throw new UserNotFoundError(`No user with id ${userId}`);

    return Promise.all([
      Album.find({ owner: userId }, '_id title'),
      Circle.find({ owner: userId }, '_id name'),
    ]).then(([albums, circles]) => ({
      user,
      albums,
      circles,
      albumIds: albums.map((album) => album._id),
      circleIds: circles.map((circle) => circle._id),
    }));
  });
}

// Deletes a user and everything that belongs to them: owned albums (and
// their pages/reactions), owned circles (unsharing any album still pointing
// at one first, same pattern as circles-controller.js's own remove()),
// their own reactions on other people's content, their membership in other
// people's circles, their notification inbox, and their upload + avatar
// folders on disk. A notification where this user is merely the *actor* (a
// reaction/upload on someone else's album) is deliberately left alone —
// same intentional graceful-degradation as any other deleted-actor
// notification (see notifications-controller.js), not an oversight.
//
// Disk is removed before any DB write, same reasoning as
// albums-controller.js's remove(): if that throws, this rejects before
// touching the database, so the whole deletion is safely retryable instead
// of risking an orphaned folder with nothing left in Mongo to retry against.
function deleteUser(userId) {
  return planUserDeletion(userId).then(({ user, albumIds, circleIds }) => {
    try {
      storage.removeUserDir(userId);
      storage.removeAvatarDir(userId);
    } catch (err) {
      throw new Error(`Failed to remove upload folders for user ${userId}: ${err.message}`);
    }

    return Album.updateMany(
      { sharedWithCircle: { $in: circleIds } },
      { sharedWithCircle: null, visibility: 'private' }
    )
      .then(() => Circle.updateMany({ 'members.user': userId }, { $pull: { members: { user: userId } } }))
      .then(() => Page.deleteMany({ album: { $in: albumIds } }))
      .then(() => Reaction.deleteMany({ $or: [{ album: { $in: albumIds } }, { user: userId }] }))
      .then(() => AlbumReaction.deleteMany({ $or: [{ album: { $in: albumIds } }, { user: userId }] }))
      .then(() => Album.deleteMany({ owner: userId }))
      .then(() => Circle.deleteMany({ owner: userId }))
      .then(() => Notification.deleteMany({ recipient: userId }))
      .then(() => User.deleteOne({ _id: userId }))
      .then(() => ({
        deletedUser: { _id: user._id, username: user.username },
        deletedAlbumCount: albumIds.length,
        deletedCircleCount: circleIds.length,
      }));
  });
}

module.exports = { deleteUser, planUserDeletion, UserNotFoundError };
