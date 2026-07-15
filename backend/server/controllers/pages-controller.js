const mongoose = require('mongoose');
const fs = require('fs');
const Album = require('../data/Album');
const Page = require('../data/Page');
const Reaction = require('../data/Reaction');
const Comment = require('../data/Comment');
const storage = require('../utilities/storage');
const { notifyAlbumEvent, notifyPageReaction, notifyPageComment } = require('../utilities/album-notifications');
const { resolveCommentCounts, withCommentAuthors } = require('../utilities/album-comments');
const {
  isNonEmptyString,
  isOwnerOrAdmin,
  checkAlbumReadAccess,
  resolveUsernames,
} = require('../utilities/controller-helpers');

const env = process.env.NODE_ENV || 'development';
const settings = require('../config/settings')[env];

// Recomputes and persists pageCount from the real Page count — never
// hand-incremented, so it can't drift from what's actually on disk/in Mongo.
function syncPageCount(album) {
  return Page.countDocuments({ album: album._id }).then((pageCount) => {
    album.pageCount = pageCount;
    return album.save().then(() => pageCount);
  });
}

// The album can be deleted by a concurrent request between requireOwnedAlbum's
// findById and a later album.save() — mongoose then rejects the save with
// DocumentNotFoundError. A 404 reflects that better than a generic 500.
function respondToAlbumWriteError(res, err, message) {
  if (err instanceof mongoose.Error.DocumentNotFoundError) {
    return res.status(404).json({ error: 'Album not found' });
  }
  res.status(500).json({ error: message });
}

function removeFiles(ownerId, albumId, filenames) {
  for (const filename of filenames) {
    const filePath = storage.photoPath(ownerId, albumId, filename);
    fs.rm(filePath, { force: true }, (err) => {
      if (err) console.error(`Failed to remove orphaned upload ${filePath}:`, err);
    });
  }
}

function zeroFilledCounts() {
  return Object.fromEntries(Reaction.REACTION_TYPES.map((type) => [type, 0]));
}

// Caps how many reactors are resolved and shipped per page — the "who
// reacted" list is a convenience popover, not a full audit log, so a page
// with hundreds of reactions doesn't balloon every pages-list response.
// Applied per page (via $topN inside the $group below, which caps as it
// accumulates instead of collecting every reaction and slicing after), not
// as one global limit across the batch — a global limit would let one
// heavily-reacted page starve every other page's reactors list of its own
// fair share.
const MAX_REACTORS_PER_PAGE = 50;

// Batched reaction summary for a page of Page documents — three queries
// total (grouped counts + the viewer's own reactions + every reactor's
// username, each batched across all pages) instead of one set per page,
// same N+1-avoidance shape as resolveCoverImages in albums-controller.js.
// Returns a Map from page id (string) to
// { counts, total, viewerReaction, reactors }, reactors being up to
// MAX_REACTORS_PER_PAGE { username, type } entries, most recent first.
function resolveReactionSummaries(pages, viewerId) {
  const pageIds = pages.map((page) => page._id);
  if (pageIds.length === 0) return Promise.resolve(new Map());

  return Promise.all([
    Reaction.aggregate([
      { $match: { page: { $in: pageIds } } },
      { $group: { _id: { page: '$page', type: '$type' }, count: { $sum: 1 } } },
    ]),
    Reaction.find({ page: { $in: pageIds }, user: viewerId }, 'page type'),
    Reaction.aggregate([
      { $match: { page: { $in: pageIds } } },
      {
        $group: {
          _id: '$page',
          reactors: {
            $topN: {
              n: MAX_REACTORS_PER_PAGE,
              sortBy: { createdAt: -1 },
              output: { user: '$user', type: '$type' },
            },
          },
        },
      },
    ]),
  ]).then(([grouped, viewerReactions, reactorGroups]) => {
    const viewerReactionByPageId = new Map(
      viewerReactions.map((reaction) => [reaction.page.toString(), reaction.type])
    );

    const summaryByPageId = new Map(
      pageIds.map((pageId) => [
        pageId.toString(),
        { counts: zeroFilledCounts(), total: 0, viewerReaction: null, reactors: [] },
      ])
    );

    for (const { _id, count } of grouped) {
      const summary = summaryByPageId.get(_id.page.toString());
      summary.counts[_id.type] = count;
      summary.total += count;
    }

    for (const [pageId, summary] of summaryByPageId) {
      summary.viewerReaction = viewerReactionByPageId.get(pageId) ?? null;
    }

    const allReactorUserIds = reactorGroups.flatMap((group) =>
      group.reactors.map((reactor) => reactor.user)
    );

    return resolveUsernames(allReactorUserIds).then((usernames) => {
      let cursor = 0;
      for (const group of reactorGroups) {
        const summary = summaryByPageId.get(group._id.toString());
        summary.reactors = group.reactors.map((reactor) => ({
          username: usernames[cursor++],
          type: reactor.type,
        }));
      }
      return summaryByPageId;
    });
  });
}

module.exports = {
  // Loads the album, checks the caller can modify it, and stashes it on
  // req.album — runs before multer so unauthorized requests never touch disk.
  requireOwnedAlbum: (req, res, next) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Album not found' });
    }

    Album.findById(id)
      .then((album) => {
        if (!album) return res.status(404).json({ error: 'Album not found' });
        if (!isOwnerOrAdmin(album, req.user)) {
          return res.status(403).json({ error: 'You do not own this album' });
        }
        req.album = album;
        next();
      })
      .catch(() => res.status(500).json({ error: 'Failed to load album' }));
  },

  // Same shape as requireOwnedAlbum, but for actions any viewer with read
  // access may take (reacting) rather than only the owner/an Admin.
  requireReadableAlbum: (req, res, next) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Album not found' });
    }

    Album.findById(id)
      .then((album) => {
        if (!album) return res.status(404).json({ error: 'Album not found' });
        return checkAlbumReadAccess(album, req.user).then((denied) => {
          if (denied) return res.status(denied.status).json({ error: denied.error });
          req.album = album;
          next();
        });
      })
      .catch(() => res.status(500).json({ error: 'Failed to load album' }));
  },

  list: (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const respondWithPages = (album) =>
      Page.find({ album: id })
        .sort('createdAt')
        .then((pages) =>
          Promise.all([
            resolveReactionSummaries(pages, req.user._id),
            resolveCommentCounts(pages),
          ]).then(([summaryByPageId, commentCountByPageId]) => {
            res.json({
              pages: pages.map((page) => ({
                ...page.toJSON(),
                url: storage.photoUrl(album.owner, album._id, page.filename),
                reactions: summaryByPageId.get(page._id.toString()),
                commentCount: commentCountByPageId.get(page._id.toString()) ?? 0,
              })),
            });
          })
        );

    Album.findById(id)
      .then((album) => {
        if (!album) return res.status(404).json({ error: 'Album not found' });
        return checkAlbumReadAccess(album, req.user).then((denied) => {
          if (denied) return res.status(denied.status).json({ error: denied.error });
          return respondWithPages(album);
        });
      })
      .catch(() => res.status(500).json({ error: 'Failed to load pages' }));
  },

  upload: (req, res) => {
    const album = req.album;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'No photos were uploaded' });
    }

    // req.album is a snapshot from requireOwnedAlbum's earlier load, taken
    // before multer wrote these files to disk — a concurrent album delete
    // could have removed the album (and its folder) in between, in which
    // case multer's destination callback would have silently recreated that
    // just-cleaned-up folder to write into. Re-checking here, right before
    // the Page rows are created, closes most of that window and stops a
    // dangling Page from being inserted against an album that's already
    // gone. Not atomic with the insert below — same as the other unguarded
    // races in this file (see setReaction) — but narrows it from "the
    // entire upload request" down to a single query.
    Album.exists({ _id: album._id })
      .then((stillExists) => {
        if (!stillExists) {
          removeFiles(album.owner, album._id, files.map((f) => f.filename));
          return res.status(404).json({ error: 'Album not found' });
        }

        // Not atomic with the insert below — two concurrent uploads to the same
        // album could both pass this check and land slightly over the cap.
        // Acceptable at this app's single-user scale; not worth locking for.
        return Page.countDocuments({ album: album._id }).then((existingCount) => {
          if (existingCount + files.length > settings.maxPhotosPerAlbum) {
            removeFiles(album.owner, album._id, files.map((f) => f.filename));
            return res.status(400).json({
              error: `An album can have at most ${settings.maxPhotosPerAlbum} photos`,
            });
          }

          return Page.insertMany(
            files.map((file) => ({
              album: album._id,
              filename: file.filename,
              mimeType: file.mimetype,
              size: file.size,
            }))
          )
            .then((pages) =>
              syncPageCount(album).then((pageCount) =>
                // Freshly inserted pages can't have any reactions or comments
                // yet, but resolving the summaries the same way
                // list()/setReaction() do (rather than hand-rolling a
                // zero-filled shape here) keeps this response's page objects
                // identical in shape everywhere the frontend's pageSchema is
                // used.
                Promise.all([
                  resolveReactionSummaries(pages, req.user._id),
                  resolveCommentCounts(pages),
                ]).then(([summaryByPageId, commentCountByPageId]) => {
                  // One notification per upload request, not per photo — a
                  // batch of 10 photos is one "new photos added" event. The
                  // first uploaded photo rides along as a representative
                  // thumbnail/deep-link target for that one notification.
                  notifyAlbumEvent({
                    type: 'album_photos_added',
                    album,
                    actorUser: req.user,
                    page: pages[0],
                  });
                  res.status(201).json({
                    pages: pages.map((page) => ({
                      ...page.toJSON(),
                      url: storage.photoUrl(album.owner, album._id, page.filename),
                      reactions: summaryByPageId.get(page._id.toString()),
                      commentCount: commentCountByPageId.get(page._id.toString()) ?? 0,
                    })),
                    pageCount,
                  });
                })
              )
            )
            .catch((err) => {
              removeFiles(album.owner, album._id, files.map((f) => f.filename));
              throw err;
            });
        });
      })
      .catch((err) => respondToAlbumWriteError(res, err, 'Failed to save photos'));
  },

  updateCaption: (req, res) => {
    const album = req.album;
    const { pageId } = req.params;
    if (!mongoose.isValidObjectId(pageId)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const { caption } = req.body || {};
    if (caption !== undefined && typeof caption !== 'string') {
      return res.status(400).json({ error: 'caption must be a string' });
    }
    if (typeof caption === 'string' && caption.trim().length > 500) {
      return res.status(400).json({ error: 'caption must be at most 500 characters' });
    }

    Page.findOne({ _id: pageId, album: album._id })
      .then((page) => {
        if (!page) return res.status(404).json({ error: 'Photo not found' });
        const nextCaption = caption ?? '';
        // Page.caption is trim: true, so compare trimmed — otherwise a
        // whitespace-only edit (stored value unchanged after Mongoose's
        // trim setter) would still read as "changed" and fire a spurious
        // notification.
        const captionChanged = nextCaption.trim() !== page.caption;
        page.caption = nextCaption;
        return page.save().then((saved) => {
          if (captionChanged) {
            notifyAlbumEvent({ type: 'album_photo_caption_updated', album, actorUser: req.user });
          }
          // A caption edit doesn't touch reactions or comments, but this
          // page can already carry other users' reactions/comments —
          // resolve the real summaries rather than zero-filled placeholders
          // so the response shape stays accurate ahead of the query
          // invalidation.
          return Promise.all([
            resolveReactionSummaries([saved], req.user._id),
            resolveCommentCounts([saved]),
          ]).then(([summaryByPageId, commentCountByPageId]) => {
            res.json({
              page: {
                ...saved.toJSON(),
                url: storage.photoUrl(album.owner, album._id, saved.filename),
                reactions: summaryByPageId.get(saved._id.toString()),
                commentCount: commentCountByPageId.get(saved._id.toString()) ?? 0,
              },
            });
          });
        });
      })
      .catch(() => res.status(500).json({ error: 'Failed to update caption' }));
  },

  setCover: (req, res) => {
    const album = req.album;
    const { pageId } = req.params;
    if (!mongoose.isValidObjectId(pageId)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    Page.findOne({ _id: pageId, album: album._id })
      .then((page) => {
        if (!page) return res.status(404).json({ error: 'Photo not found' });
        album.coverPage = page._id;
        return album.save().then((saved) => {
          res.json({
            album: {
              ...saved.toJSON(),
              coverImage: storage.photoUrl(album.owner, album._id, page.filename),
            },
          });
        });
      })
      .catch((err) => respondToAlbumWriteError(res, err, 'Failed to set cover photo'));
  },

  setReaction: (req, res) => {
    const album = req.album;
    const { pageId } = req.params;
    if (!mongoose.isValidObjectId(pageId)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const { type } = req.body || {};
    if (!Reaction.REACTION_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ error: `type must be one of: ${Reaction.REACTION_TYPES.join(', ')}` });
    }

    Page.findOne({ _id: pageId, album: album._id })
      .then((page) => {
        if (!page) return res.status(404).json({ error: 'Photo not found' });

        // Creates this user's reaction fresh. Used both for "no existing
        // reaction" (notify: true — this is a genuinely new reaction) and
        // as the fallback when a concurrent request deleted the reaction
        // out from under a switch (notify: false — from this user's
        // perspective it's still just a switch, and the owner shouldn't
        // get a notification purely because of an unrelated concurrent
        // delete's timing).
        const createReaction = (notify) =>
          Reaction.create({ page: page._id, album: album._id, user: req.user._id, type })
            .then(() => {
              if (notify) notifyPageReaction({ page, album, reactionType: type, reactorUser: req.user });
            })
            .catch((err) => {
              if (err.code !== 11000) throw err;
              // Two concurrent first-reactions from the same user can both
              // pass the findOne above before either writes — the unique
              // {page, user} index rejects the loser here. Reconcile
              // rather than silently dropping this request's intended
              // type: if the winner's stored reaction doesn't match what
              // this request asked for, update it to match (same as the
              // "switch an existing reaction" branch below) — no
              // additional notification, since the owner was already
              // notified once by the winner's write.
              // winner.save() below has the same theoretical
              // DocumentNotFoundError race as the switch branch above (a
              // third concurrent request), just one layer deeper — not
              // closed here, on the same "not worth it at this app's
              // scale" basis as the other unguarded races in this file
              // (see upload's page-count check).
              return Reaction.findOne({ page: page._id, user: req.user._id }).then((winner) => {
                if (!winner || winner.type === type) return;
                winner.type = type;
                return winner.save();
              });
            });

        return Reaction.findOne({ page: page._id, user: req.user._id })
          .then((existing) => {
            // Picking the same reaction again removes it (toggle-off).
            if (existing && existing.type === type) return existing.deleteOne();

            if (existing) {
              existing.type = type;
              return existing.save().catch((err) => {
                if (!(err instanceof mongoose.Error.DocumentNotFoundError)) throw err;
                // A concurrent request (e.g. this same user's toggle-off
                // from another tab/device) deleted this reaction between
                // the findOne above and this save — nothing left to
                // switch, so create it fresh with the intended type.
                return createReaction(false);
              });
            }

            return createReaction(true);
          })
          .then(() => resolveReactionSummaries([page], req.user._id))
          .then((summaryByPageId) => {
            res.json({ reactions: summaryByPageId.get(page._id.toString()) });
          });
      })
      .catch(() => res.status(500).json({ error: 'Failed to save reaction' }));
  },

  remove: (req, res) => {
    const album = req.album;
    const { pageId } = req.params;
    if (!mongoose.isValidObjectId(pageId)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    Page.findOne({ _id: pageId, album: album._id })
      .then((page) => {
        if (!page) return res.status(404).json({ error: 'Photo not found' });

        // Only remove the file once the record is confirmed gone — otherwise
        // a failed deleteOne would leave a DB record pointing at nothing.
        return page
          .deleteOne()
          .then(() => Reaction.deleteMany({ page: page._id }))
          .then(() => Comment.deleteMany({ page: page._id }))
          .then(() => {
            const filePath = storage.photoPath(album.owner, album._id, page.filename);
            fs.rm(filePath, { force: true }, (err) => {
              if (err) console.error(`Failed to remove deleted photo ${filePath}:`, err);
            });
          })
          .then(() => {
            // The deleted photo can no longer be the cover — clear it so
            // reads fall back to the (new) earliest remaining photo.
            if (album.coverPage && album.coverPage.toString() === page._id.toString()) {
              album.coverPage = null;
            }
          })
          .then(() => syncPageCount(album))
          .then((pageCount) => {
            notifyAlbumEvent({ type: 'album_photo_removed', album, actorUser: req.user });
            res.json({ deleted: true, pageCount });
          });
      })
      .catch((err) => respondToAlbumWriteError(res, err, 'Failed to delete photo'));
  },

  listComments: (req, res) => {
    const album = req.album;
    const { pageId } = req.params;
    if (!mongoose.isValidObjectId(pageId)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    Page.findOne({ _id: pageId, album: album._id })
      .then((page) => {
        if (!page) return res.status(404).json({ error: 'Photo not found' });

        return Comment.find({ page: page._id })
          .sort('createdAt')
          .then((comments) =>
            withCommentAuthors(comments).then((commentsWithAuthors) => {
              res.json({ comments: commentsWithAuthors });
            })
          );
      })
      .catch(() => res.status(500).json({ error: 'Failed to load comments' }));
  },

  addComment: (req, res) => {
    const album = req.album;
    const { pageId } = req.params;
    if (!mongoose.isValidObjectId(pageId)) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    const { text } = req.body || {};
    if (!isNonEmptyString(text)) {
      return res.status(400).json({ error: 'text is required' });
    }
    if (text.trim().length > Comment.MAX_COMMENT_LENGTH) {
      return res
        .status(400)
        .json({ error: `text must be at most ${Comment.MAX_COMMENT_LENGTH} characters` });
    }

    Page.findOne({ _id: pageId, album: album._id })
      .then((page) => {
        if (!page) return res.status(404).json({ error: 'Photo not found' });

        return Comment.create({
          page: page._id,
          album: album._id,
          user: req.user._id,
          text,
        }).then((comment) => {
          notifyPageComment({ page, album, commentText: comment.text, commenterUser: req.user });

          return Promise.all([withCommentAuthors([comment]), Comment.countDocuments({ page: page._id })]).then(
            ([[commentWithAuthor], commentCount]) => {
              res.status(201).json({ comment: commentWithAuthor, commentCount });
            }
          );
        });
      })
      .catch(() => res.status(500).json({ error: 'Failed to save comment' }));
  },

  deleteComment: (req, res) => {
    const album = req.album;
    const { pageId, commentId } = req.params;
    if (!mongoose.isValidObjectId(pageId) || !mongoose.isValidObjectId(commentId)) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    Page.findOne({ _id: pageId, album: album._id })
      .then((page) => {
        if (!page) return res.status(404).json({ error: 'Photo not found' });

        return Comment.findOne({ _id: commentId, page: page._id }).then((comment) => {
          if (!comment) return res.status(404).json({ error: 'Comment not found' });

          const isAuthor = comment.user.toString() === req.user._id.toString();
          if (!isAuthor && !isOwnerOrAdmin(album, req.user)) {
            return res.status(403).json({ error: 'You cannot delete this comment' });
          }

          return comment
            .deleteOne()
            .then(() => Comment.countDocuments({ page: page._id }))
            .then((commentCount) => {
              res.json({ deleted: true, commentCount });
            });
        });
      })
      .catch(() => res.status(500).json({ error: 'Failed to delete comment' }));
  },
};
