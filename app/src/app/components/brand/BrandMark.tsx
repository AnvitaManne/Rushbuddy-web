import React from 'react';

/** Navy >> mark from the RushBuddy LinkedIn identity. */
export function RushMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      aria-hidden
    >
      <rect width="40" height="40" fill="#0B2340" />
      <path
        d="M11 11 L21.5 20 L11 29"
        stroke="#F7F4EF"
        strokeWidth="3.4"
        fill="none"
        strokeLinejoin="miter"
      />
      <path
        d="M21 11 L31.5 20 L21 29"
        stroke="#F7F4EF"
        strokeWidth="3.4"
        fill="none"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
