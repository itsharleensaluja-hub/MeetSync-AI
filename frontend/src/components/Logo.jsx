import React from 'react';

export default function Logo({ size = 44, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="-5 -5 110 110"
      fill="none"
      style={style}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22E7FF" />
          <stop offset="25%" stopColor="#00B4D8" />
          <stop offset="50%" stopColor="#5B5EFF" />
          <stop offset="75%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path
        d="M 14 84 C 14 12, 30 12, 50 74"
        stroke="url(#logoGrad)"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 50 74 C 70 12, 86 12, 86 84"
        stroke="url(#logoGrad)"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
