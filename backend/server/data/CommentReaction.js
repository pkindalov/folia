const mongoose = require('mongoose');
const { REACTION_TYPES } = require('./Reaction');

const commentReactionSchema = new mongoose.Schema(
  {
    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      required: true,
      index: true,
    },
    // Denormalized from comment.page/comment.album so a page/album/user
    // delete can cascade-delete every reaction on every one of its comments
    // with a single query, same reasoning as Comment.album and Reaction.album.
    page: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Page',
      required: true,
      index: true,
    },
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
    type: {
      type: String,
      enum: REACTION_TYPES,
      required: '{PATH} is required',
    },
  },
  { timestamps: true }
);

// One reaction per user per comment — enforced in the database, not just in
// application code, same reasoning as Reaction's {page, user} index.
commentReactionSchema.index({ comment: 1, user: 1 }, { unique: true });

commentReactionSchema.method({
  toJSON: function () {
    const obj = this.toObject();
    delete obj.__v;
    return obj;
  },
});

const CommentReaction = mongoose.model('CommentReaction', commentReactionSchema);

module.exports = CommentReaction;
