import React from 'react';

export interface OpenCodeIconProps {
  size?: number;
  color?: string;
  backgroundColor?: string;
}

/** Compact OpenCode mark for coding-session tabs and startup overlays. */
export const OpenCodeIcon: React.FC<OpenCodeIconProps> = ({
  size = 14,
  color = 'currentColor',
  backgroundColor = 'transparent',
}) => (
  <svg
    data-agent-icon="opencode"
    aria-hidden="true"
    focusable="false"
    width={size}
    height={size}
    viewBox="0 0 300 300"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="translate(30, 0)">
      <path d="M180 240H60V120H180V240Z" fill={backgroundColor} />
      <path
        d="M180 60H60V240H180V60ZM240 300H0V0H240V300Z"
        fill={color}
        fillRule="evenodd"
      />
    </g>
  </svg>
);
