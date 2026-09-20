// The velum mark: the "curtain rod" bar over a V chevron, drawn in the current
// text color, no background. The viewBox is cropped tight so the mark fills the
// box. Same geometry as src/app/icon.svg. Size via className (default 32px).
export default function Logo({ className = "h-8 w-8" }) {
  return (
    <svg
      viewBox="4 5 24 22"
      fill="none"
      role="img"
      aria-label="velum"
      className={className}
    >
      <path
        d="M7.5 8.95H24.5"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M9.5 13.7L16 22.95L22.5 13.7"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
