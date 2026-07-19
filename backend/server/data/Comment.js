const mongoose = require('mongoose');

const MAX_COMMENT_LENGTH = 1000;
// Portion size for listComments' newest-first pagination — mirrors
// ReactorsModal's server-side cap of 50, just paged instead of hard-capped.
const COMMENTS_PAGE_SIZE = 20;
// Sanity backstop for attachReplies (see album-comments.js): replies are
// never separately paginated, so without this a single heavily-replied
// comment could return an unbounded payload on every listComments call.
// Generous enough to never bite normal use, and not evenly distributed
// per top-level comment — it's a payload-size backstop, not a feature.
const MAX_REPLIES_PER_LOAD = 500;

const commentSchema = new mongoose.Schema(
  {
    page: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Page',
      required: true,
      index: true,
    },
    // Denormalized from page.album so a whole album's comments can be
    // cascade-deleted with a single query, same reasoning as Reaction.album.
    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Album',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: '{PATH} is required',
      trim: true,
      maxlength: MAX_COMMENT_LENGTH,
    },
    // Set only on a reply — the top-level comment it answers. Replies are
    // exactly one level deep (enforced in pages-controller.js's addComment,
    // not here): a reply's own parentComment is never itself set on
    // another comment that already has one.
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

// Ordered listing for a single photo's thread.
commentSchema.index({ page: 1, createdAt: 1 });

commentSchema.method({
  toJSON: function () {
    const obj = this.toObject();
    delete obj.__v;
    return obj;
  },
});

const Comment = mongoose.model('Comment', commentSchema);

module.exports = Comment;
module.exports.MAX_COMMENT_LENGTH = MAX_COMMENT_LENGTH;
module.exports.COMMENTS_PAGE_SIZE = COMMENTS_PAGE_SIZE;
module.exports.MAX_REPLIES_PER_LOAD = MAX_REPLIES_PER_LOAD;
