import type { ReactionType } from '../features/flipbooks';

export const REACTION_EMOJI: Record<ReactionType, string> = {
  like: '👍',
  love: '❤', // heart, no variation selector — matches Twemoji's "2764" asset name
  haha: '😆',
  wow: '😮',
  sad: '😢',
  angry: '😠',
};

// Translation-key lookup (not display text) — the caller resolves this
// through t() from the 'social' namespace.
export const REACTION_LABEL_KEY = {
  like: 'reactionLabels.like',
  love: 'reactionLabels.love',
  haha: 'reactionLabels.haha',
  wow: 'reactionLabels.wow',
  sad: 'reactionLabels.sad',
  angry: 'reactionLabels.angry',
} as const satisfies Record<ReactionType, string>;

export const REACTION_TEXT_COLOR: Record<ReactionType, string> = {
  like: 'text-reaction-like',
  love: 'text-reaction-love',
  haha: 'text-reaction-haha',
  wow: 'text-reaction-wow',
  sad: 'text-reaction-sad',
  angry: 'text-reaction-angry',
};
