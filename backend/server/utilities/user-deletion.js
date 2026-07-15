const User = require('../data/User');
const Album = require('../data/Album');
const Page = require('../data/Page');
const Reaction = require('../data/Reaction');
const AlbumReaction = require('../data/AlbumReaction');
const Comment = require('../data/Comment');
const Circle = require('../data/Circle');
const Notification = require('../data/Notification');
const storage = require('./storage');
const { notifyCircleDeleted, markAllCircleInvitesRead } = require('./circle-notifications');

class UserNotFoundError extends Error {}

// Everything a deletion of this user would touch, without deleting
// anything — used both to preview a pending delete and, internally, by
// deleteUser to know what to cascade.
function planUserDeletion(userId) {
  return User.findById(userId).then((user) => {
    if (!user) throw new UserNotFoundError(`No user with id ${userId}`);

    return Promise.all([
      Album.find({ owner: userId }, '_id title'),
      Circle.find({ owner: userId }, '_id name owner members'),
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
// their pages/reactions/comments), owned circles (unsharing any album still
// pointing at one first, then notifying members and clearing invite
// notifications — same pattern, and same circle-notifications.js helpers,
// as circles-controller.js's own remove()), their own reactions and
// comments on other people's content, their membership in other people's
// circles, their notification inbox, and their upload + avatar folders on
// disk. A notification where this user is merely the *actor* (a
// reaction/comment/upload on someone else's album) is deliberately left
// alone — same intentional
// graceful-degradation as any other deleted-actor notification (see
// notifications-controller.js), not an oversight.
//
// Disk is removed before any DB write, same reasoning as
// albums-controller.js's remove(): if that throws, this rejects before
// touching the database, so the whole deletion is safely retryable instead
// of risking an orphaned folder with nothing left in Mongo to retry against.
function deleteUser(userId) {
  return planUserDeletion(userId).then(({ user, albumIds, circleIds, circles }) => {
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
      .then(() => Comment.deleteMany({ $or: [{ album: { $in: albumIds } }, { user: userId }] }))
      .then(() => Album.deleteMany({ owner: userId }))
      .then(() => Circle.deleteMany({ owner: userId }))
      .then(() => {
        // Same notifications circles-controller.js's remove() fires once its
        // own delete succeeds: tell every accepted member the circle is
        // gone, and clear out any still-unread invite for it. Fire-and-forget
        // (both helpers already catch their own errors) — this cascade must
        // still complete and the account still get deleted even if a
        // notification write fails.
        circles.forEach((circle) => {
          markAllCircleInvitesRead(circle._id);
          notifyCircleDeleted({
            circle,
            circleName: circle.name,
            actorUsername: user.username,
            actorId: userId.toString(),
          });
        });
      })
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
