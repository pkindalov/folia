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
// `page` is optional and only meaningful for album_photos_added — the first
// photo of the uploaded batch, kept as a representative thumbnail/deep-link
// target for the single notification that batch produces (see
// pages-controller.js's upload handler: one notification per upload
// request, not per photo).
function notifyAlbumEvent({ type, album, actorUser, page }) {
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
              actor: actorUser._id,
              album: album._id,
              albumTitle: album.title,
              ...(page ? { page: page._id } : {}),
            }).then(() => Notification.pruneExcessForRecipient(recipientId))
          )
        );
      });
    })
    .catch((err) => console.error(`Failed to create/prune ${type} notifications`, err));
}

// Fire-and-forget: notifies an album's owner that someone reacted to one of
// its pages. Unlike notifyAlbumEvent, this always goes straight to a single
// recipient (the owner) rather than fanning out to a circle — reacting is
// available on any album the reactor can view (private, shared, or public),
// not just circle-shared ones. No-ops silently for a self-reaction (the
// owner reacting to their own page doesn't need telling about it).
function notifyPageReaction({ page, album, reactionType, reactorUser }) {
  const ownerId = album.owner.toString();
  if (ownerId === reactorUser._id.toString()) return;

  Notification.create({
    recipient: ownerId,
    type: 'page_reaction',
    actorUsername: reactorUser.username,
    actor: reactorUser._id,
    album: album._id,
    albumTitle: album.title,
    page: page._id,
    reactionType,
  })
    .then(() => Notification.pruneExcessForRecipient(ownerId))
    .catch((err) => console.error('Failed to create/prune page_reaction notification', err));
}

// Fire-and-forget: notifies an album's owner that someone loved the album
// itself (as opposed to notifyPageReaction, which is about one of its
// pages). Same single-recipient, self-reaction-skipping shape as
// notifyPageReaction — reacting to an album is available to anyone who can
// view it (private, shared, or public), not just circle-shared ones.
function notifyAlbumReaction({ album, reactorUser }) {
  const ownerId = album.owner.toString();
  if (ownerId === reactorUser._id.toString()) return;

  Notification.create({
    recipient: ownerId,
    type: 'album_reaction',
    actorUsername: reactorUser.username,
    actor: reactorUser._id,
    album: album._id,
    albumTitle: album.title,
  })
    .then(() => Notification.pruneExcessForRecipient(ownerId))
    .catch((err) => console.error('Failed to create/prune album_reaction notification', err));
}

// Fire-and-forget: notifies an album's owner that someone commented on one
// of its pages. Same single-recipient, self-action-skipping shape as
// notifyPageReaction — commenting is available on any album the commenter
// can view (private, shared, or public), not just circle-shared ones.
// commentText is snapshotted onto the notification (see Notification.js) so
// it keeps reading correctly even if the comment is later deleted.
function notifyPageComment({ page, album, commentText, commenterUser }) {
  const ownerId = album.owner.toString();
  if (ownerId === commenterUser._id.toString()) return;

  Notification.create({
    recipient: ownerId,
    type: 'page_comment',
    actorUsername: commenterUser.username,
    actor: commenterUser._id,
    album: album._id,
    albumTitle: album.title,
    page: page._id,
    commentText,
  })
    .then(() => Notification.pruneExcessForRecipient(ownerId))
    .catch((err) => console.error('Failed to create/prune page_comment notification', err));
}

module.exports = { notifyAlbumEvent, notifyPageReaction, notifyAlbumReaction, notifyPageComment };
