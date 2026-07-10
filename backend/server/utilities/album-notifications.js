const Circle = require('../data/Circle');
const Notification = require('../data/Notification');
const { circleRecipientIds } = require('./controller-helpers');

// Fire-and-forget: notifies every other member of the circle an album is
// shared with about an event on that album (newly shared, edited, deleted,
// a photo added, or a photo removed). Shared by albums-controller.js and
// pages-controller.js so all five album notification types are always
// created the same way. No-ops silently — not an error — for a
// private/public album (nobody but the owner/Admin has access, so there's
// nobody to notify) or one whose shared circle no longer exists.
function notifyAlbumEvent({ type, album, actorUser }) {
  Promise.resolve()
    .then(() => {
      if (album.visibility !== 'shared' || !album.sharedWithCircle) return null;

      return Circle.findById(album.sharedWithCircle).then((circle) => {
        if (!circle) return null;

        return Promise.all(
          circleRecipientIds(circle, actorUser._id).map((recipientId) =>
            Notification.create({
              recipient: recipientId,
              type,
              circle: circle._id,
              circleName: circle.name,
              actorUsername: actorUser.username,
              album: album._id,
              albumTitle: album.title,
            }).then(() => Notification.pruneExcessForRecipient(recipientId))
          )
        );
      });
    })
    .catch((err) => console.error(`Failed to create/prune ${type} notifications`, err));
}

module.exports = { notifyAlbumEvent };
