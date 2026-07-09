const mongoose = require('mongoose');

// Only one trigger exists today (a circle invite), but the type is still
// named explicitly rather than assumed — every query below filters by it.
const NOTIFICATION_TYPES = ['circle_invite'];

// Soft cap per recipient — this is a growing, unbounded top-level
// collection (unlike Circle.members, there's no schema-level array to
// validate), so the cap is enforced by pruning the oldest excess after
// each insert instead.
const MAX_NOTIFICATIONS_PER_USER = 200;

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: '{PATH} is required',
    },
    circle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Circle',
      required: true,
    },
    // Snapshots of the circle name and inviting owner's username at the
    // time the invite was sent — a notification is a record of what
    // happened, so it should keep reading correctly even if the circle is
    // later renamed or deleted, rather than needing DELETED_USER_LABEL-style
    // fallback handling like a live join would.
    circleName: {
      type: String,
      required: '{PATH} is required',
    },
    actorUsername: {
      type: String,
      required: '{PATH} is required',
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

notificationSchema.method({
  toJSON: function () {
    const obj = this.toObject();
    delete obj.__v;
    return obj;
  },
});

// Deletes the lowest-priority notifications for a recipient beyond the
// per-user cap: already-read ones are pruned before unread ones (an unread
// notification is still actionable and shouldn't disappear just because
// older read ones are sitting around), and within each group the oldest
// goes first. Best-effort and non-blocking by design (see
// circles-controller.js) — a failure here should never affect the request
// that triggered it.
notificationSchema.statics.pruneExcessForRecipient = function (recipientId) {
  return this.countDocuments({ recipient: recipientId }).then((count) => {
    const excess = count - MAX_NOTIFICATIONS_PER_USER;
    if (excess <= 0) return null;

    return this.find({ recipient: recipientId }, '_id')
      .sort({ read: -1, createdAt: 1 })
      .limit(excess)
      .then((lowestPriority) =>
        this.deleteMany({ _id: { $in: lowestPriority.map((doc) => doc._id) } })
      );
  });
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.MAX_NOTIFICATIONS_PER_USER = MAX_NOTIFICATIONS_PER_USER;
