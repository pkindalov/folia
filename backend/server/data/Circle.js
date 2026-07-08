const mongoose = require('mongoose');

// A member starts 'pending' until they accept the invitation themselves —
// the owner adding someone is never enough on its own to grant access.
const MEMBER_STATUSES = ['pending', 'accepted'];

// Hard cap on membership size — an embedded array shouldn't grow unbounded.
const MAX_MEMBERS = 200;

const circleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: '{PATH} is required',
      trim: true,
      maxlength: [80, 'name must be at most 80 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [300, 'description must be at most 300 characters'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    members: {
      type: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
          },
          status: {
            type: String,
            enum: MEMBER_STATUSES,
            default: 'pending',
          },
          addedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      validate: {
        validator: (members) => members.length <= MAX_MEMBERS,
        message: `a circle cannot have more than ${MAX_MEMBERS} members`,
      },
      default: [],
    },
  },
  { timestamps: true }
);

circleSchema.method({
  // Shared by circles-controller.js (viewing a circle) and
  // albums-controller.js (viewing an album shared with a circle) — kept as
  // one definition so the two don't drift apart. A pending invitee does NOT
  // count — they must accept first before gaining any access.
  isOwnerOrMember: function (userId) {
    const id = userId.toString();
    return (
      this.owner.toString() === id ||
      this.members.some((member) => member.user.toString() === id && member.status === 'accepted')
    );
  },
  toJSON: function () {
    const obj = this.toObject();
    delete obj.__v;
    return obj;
  },
});

const Circle = mongoose.model('Circle', circleSchema);

module.exports = Circle;
module.exports.MEMBER_STATUSES = MEMBER_STATUSES;
module.exports.MAX_MEMBERS = MAX_MEMBERS;
