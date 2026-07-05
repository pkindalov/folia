type IconProps = {
  name: string;
  className?: string;
  filled?: boolean;
};

/** Material Symbols icon (decorative by default). */
export default function Icon({ name, className = '', filled = false }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
