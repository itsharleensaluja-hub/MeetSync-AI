import React from 'react';

function WaveShape() {
  return (
    <svg
      className="wave-shape"
      viewBox="0 0 1200 400"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="waveGradient" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#22E7FF" stopOpacity="0.03" />
          <stop offset="50%" stopColor="#22E7FF" stopOpacity="0.015" />
          <stop offset="100%" stopColor="#22E7FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0,300 C200,180 400,350 600,250 C800,150 1000,300 1200,200 L1200,400 L0,400 Z"
        fill="url(#waveGradient)"
      />
    </svg>
  );
}

export default WaveShape;