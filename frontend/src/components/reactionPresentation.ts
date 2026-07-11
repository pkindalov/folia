import type { ReactionType } from '../features/flipbooks';

export const REACTION_ICON: Record<ReactionType, string> = {
  like: 'thumb_up',
  love: 'favorite',
  haha: 'sentiment_very_satisfied',
  wow: 'sentiment_excited',
  sad: 'sentiment_sad',
  angry: 'mood_bad',
};

export const REACTION_TEXT_COLOR: Record<ReactionType, string> = {
  like: 'text-reaction-like',
  love: 'text-reaction-love',
  haha: 'text-reaction-haha',
  wow: 'text-reaction-wow',
  sad: 'text-reaction-sad',
  angry: 'text-reaction-angry',
};
