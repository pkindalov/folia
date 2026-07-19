// Pinned so the rendered glyphs never change out from under us — bump
// deliberately, after checking the new version still serves the same
// codepoint filenames used below.
const TWEMOJI_VERSION = '17.0.3';

function toCodepoint(emoji: string): string {
  return [...emoji].map((char) => char.codePointAt(0)!.toString(16)).join('-');
}

type EmojiProps = {
  emoji: string;
  className?: string;
};

/** Twemoji SVG for a single emoji character (decorative by default), sized to match the surrounding font-size. */
export default function Emoji({ emoji, className = '' }: EmojiProps) {
  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/jdecked/twemoji@${TWEMOJI_VERSION}/assets/svg/${toCodepoint(emoji)}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`inline-block w-[1em] h-[1em] ${className}`}
    />
  );
}
