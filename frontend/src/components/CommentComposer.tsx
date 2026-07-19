import { useState, type KeyboardEvent } from 'react';
import Icon from './Icon';
import { MAX_COMMENT_LENGTH } from '../features/flipbooks';

type CommentComposerProps = {
  onSubmit: (text: string) => Promise<void>;
  isPending: boolean;
  /** Mirrors CommentControl's variant — light = paper surface (AlbumSpread), dark = photo overlay (PhotoLightbox). */
  variant?: 'light' | 'dark';
  placeholder?: string;
  /** Focuses the textarea on mount — used for the inline reply composer, which only mounts once the viewer has already asked to reply. */
  autoFocus?: boolean;
};

const REMAINING_CHARACTERS_WARNING_THRESHOLD = 100;
const REMAINING_CHARACTERS_CRITICAL_THRESHOLD = 20;

/** Textarea + submit button for adding a comment, pinned at the bottom of CommentControl's panel (or, with a different placeholder, inline as a reply composer). */
export default function CommentComposer({
  onSubmit,
  isPending,
  variant = 'dark',
  placeholder = 'Add a comment…',
  autoFocus = false,
}: CommentComposerProps) {
  const isLight = variant === 'light';
  const [draftText, setDraftText] = useState('');

  // This composer's own in-flight submission, tracked directly off the
  // promise onSubmit returns rather than inferred from the shared isPending
  // prop's true→false transition: react-query can batch a fast-settling
  // mutation's pending and success dispatches into a single render, so
  // there's no guarantee this composer ever observes an intermediate
  // isPending=true frame to compare a later isPending=false against.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const disabled = isPending || isSubmitting;

  const trimmedText = draftText.trim();
  const canSubmit = trimmedText !== '' && !disabled;

  const submit = () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    onSubmit(trimmedText).then(
      () => {
        setIsSubmitting(false);
        setDraftText('');
      },
      () => {
        // Failure is already surfaced via the parent's own error banner —
        // keep the draft so the viewer doesn't lose what they typed.
        setIsSubmitting(false);
      }
    );
  };

  const onTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const remainingCharacters = MAX_COMMENT_LENGTH - draftText.length;
  const showRemainingCharacters = remainingCharacters <= REMAINING_CHARACTERS_WARNING_THRESHOLD;
  const remainingCharactersColor =
    remainingCharacters === 0
      ? 'text-error'
      : remainingCharacters <= REMAINING_CHARACTERS_CRITICAL_THRESHOLD
        ? 'text-secondary-container'
        : isLight
          ? 'text-on-surface-variant'
          : 'text-white/40';

  return (
    <div className="px-3 py-2">
      <div className="flex items-end gap-2">
        <textarea
          value={draftText}
          onChange={(event) => setDraftText(event.target.value)}
          onKeyDown={onTextareaKeyDown}
          rows={2}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder={placeholder}
          aria-label="Comment text"
          disabled={disabled}
          autoFocus={autoFocus}
          className={`flex-1 rounded-panel px-3 py-2 font-body text-sm border border-transparent focus:outline-none focus-visible:border-secondary resize-none disabled:opacity-60 ${
            isLight
              ? 'bg-surface-container-low text-on-surface placeholder-on-surface-variant'
              : 'bg-white/10 text-white placeholder-white/40'
          }`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          aria-label="Post comment"
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center disabled:opacity-40 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-secondary transition-colors ${
            isLight
              ? 'text-on-surface-variant hover:bg-surface-container-low hover:text-secondary'
              : 'text-white/80 hover:bg-white/10 hover:text-white'
          }`}
        >
          {disabled ? (
            <Icon name="progress_activity" className="text-xl animate-spin" />
          ) : (
            <Icon name="send" className="text-xl" />
          )}
        </button>
      </div>
      {showRemainingCharacters && (
        <p className={`font-ui text-[11px] text-right mt-1 ${remainingCharactersColor}`}>
          {remainingCharacters} left
        </p>
      )}
    </div>
  );
}
