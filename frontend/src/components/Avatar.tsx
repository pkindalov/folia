type AvatarProps = {
  username: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-base',
  lg: 'w-28 h-28 text-4xl',
};

/** A user's avatar photo, or an initials circle when they have none. */
export default function Avatar({ username, avatarUrl, size = 'sm', className = '' }: AvatarProps) {
  const sizeClasses = SIZE_CLASSES[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className={`${sizeClasses} rounded-full object-cover border border-outline-variant ${className}`}
      />
    );
  }

  return (
    <span
      className={`${sizeClasses} rounded-full bg-secondary text-on-secondary font-ui flex items-center justify-center shrink-0 ${className}`}
      aria-hidden="true"
    >
      {username.charAt(0).toUpperCase()}
    </span>
  );
}
