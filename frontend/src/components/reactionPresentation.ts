import type { ReactionType } from '../features/flipbooks';

export const REACTION_EMOJI: Record<ReactionType, string> = {
  like: '👍',
  love: '❤', // heart, no variation selector — matches Twemoji's "2764" asset name
  haha: '😆',
  wow: '😮',
  sad: '😢',
  angry: '😠',
};

export const REACTION_LABEL: Record<ReactionType, string> = {
  like: 'Like',
  love: 'Love',
  haha: 'Haha',
  wow: 'Wow',
  sad: 'Sad',
  angry: 'Angry',
};

export const REACTION_TEXT_COLOR: Record<ReactionType, string> = {
  like: 'text-reaction-like',
  love: 'text-reaction-love',
  haha: 'text-reaction-haha',
  wow: 'text-reaction-wow',
  sad: 'text-reaction-sad',
  angry: 'text-reaction-angry',
};
