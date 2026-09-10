export function RefillMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="mark"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <circle cx="16" cy="16" r="14" fill="#2D6A4F" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="#fff" strokeWidth="1.5" />
      <path
        d="M11 16 C11 11.5, 21 11.5, 21 16 C21 20.5, 11 20.5, 11 16"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="re">re</span>
      <span className="fill">fill</span>
      <span className="ka">ka</span>
    </span>
  );
}
