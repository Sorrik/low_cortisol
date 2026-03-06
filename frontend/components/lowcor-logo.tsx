export function LowCorLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Stylized "L" bolt — sporty, dynamic, minimal */}
      <rect x="4" y="4" width="32" height="32" rx="8" fill="currentColor" opacity="0.1" />
      <path
        d="M14 10L14 24L26 24"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 18L28 18L25 30"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />
    </svg>
  )
}
