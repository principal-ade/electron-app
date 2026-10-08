import React from 'react';
import type { LucideProps } from 'lucide-react';

/** Dashed topic card with text lines inside. */
export const TopicsIcon = React.forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="2"
        strokeDasharray="2 2"
      />
      <path d="M8 9h8M8 12h8M8 15h5" />
    </svg>
  ),
);

TopicsIcon.displayName = 'TopicsIcon';
