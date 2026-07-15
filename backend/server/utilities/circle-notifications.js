const Notification = require('../data/Notification');
const { circleRecipientIds } = require('./controller-helpers');

// Notifies every accepted member (and the owner, if someone else — e.g. an
// Admin — is the one deleting) that the circle is gone. Excludes whoever
// performed the deletion; they don't need telling. Fire-and-forget: wrapped
// in a Promise so even the synchronous recipient-set computation can never
// propagate into the caller's response chain, and recipientIds are
// independent, so one failed create doesn't stop the others from going out.
function notifyCircleDeleted({ circle, circleName, actorUsername, actorId }) {
  Promise.resolve()
    .then(() => {
      const recipientIds = circleRecipientIds(circle, actorId);

      return Promise.all(
        recipientIds.map((recipientId) =>
          Notification.create({
            recipient: recipientId,
            type: 'circle_deleted',
            circle: circle._id,
            circleName,
            actorUsername,
            actor: actorId,
          }).then(() => Notification.pruneExcessForRecipient(recipientId))
        )
      );
    })
    .catch((err) => console.error('Failed to create/prune circle-deleted notifications', err));
}

// Used when the circle itself stops existing (deleted, or every pending
// invite on it revoked) — there is no longer a single recipient to scope to,
// so every still-unread invite notification for the circle is cleared.
function markAllCircleInvitesRead(circleId) {
  Notification.updateMany(
    { circle: circleId, type: 'circle_invite', read: false },
    { $set: { read: true, readAt: new Date() } }
  ).catch((err) => console.error('Failed to mark circle-invite notifications read', err));
}

module.exports = { notifyCircleDeleted, markAllCircleInvitesRead };
