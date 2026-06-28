import React from 'react';
import { motion } from 'framer-motion';
import WaveShape from './WaveShape';
import BlueprintIllustration from './BlueprintIllustration';

const BLOBS = [
  { width: 500, height: 500, top: '-10%', left: '-8%', bg: 'radial-gradient(circle, rgba(34,231,255,0.08), transparent 70%)' },
  { width: 400, height: 400, top: '45%', right: '-10%', bg: 'radial-gradient(circle, rgba(59,130,246,0.06), transparent 70%)' },
  { width: 450, height: 450, bottom: '-15%', left: '15%', bg: 'radial-gradient(circle, rgba(139,92,246,0.05), transparent 70%)' },
];

function AnimatedBackground({ prefersReducedMotion }) {
  const particles = React.useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      key: i,
      style: {
        left: `${((i * 97 + 13) % 100)}%`,
        top: `${((i * 53 + 7) % 100)}%`,
        width: `${2 + (i % 2)}px`,
        height: `${2 + (i % 2)}px`,
        opacity: 0.10 + (i % 3) * 0.05,
        animationDuration: `${20 + (i % 8) * 3}s`,
        animationDelay: `${(i * 1.2) % 12}s`,
      },
    }));
  }, []);

  return (
    <div className="auth-bg">
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className="glow-blob"
          style={{
            width: b.width,
            height: b.height,
            top: b.top,
            left: b.left,
            right: b.right,
            bottom: b.bottom,
            background: b.bg,
          }}
        />
      ))}
      {!prefersReducedMotion && particles.map(p => (
        <motion.div
          key={p.key}
          className="particle"
          style={p.style}
          initial={false}
        />
      ))}
      <WaveShape />
      <BlueprintIllustration />
      <div className="vignette" />
    </div>
  );
}

export default AnimatedBackground;