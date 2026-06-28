import React from 'react';
import { motion } from 'framer-motion';
import Logo from '../Logo';
import FeatureRow from './FeatureRow';
import { FileText, Link2, Search, CheckSquare, BarChart3, Shield } from 'lucide-react';

const FEATURES = [
  { icon: FileText, title: 'AI Meeting Summaries' },
  { icon: Link2, title: 'Cross Meeting Memory' },
  { icon: Search, title: 'Semantic Search' },
  { icon: CheckSquare, title: 'Action Items' },
  { icon: BarChart3, title: 'Analytics Dashboard' },
  { icon: Shield, title: 'Enterprise Security' },
];

function BrandPanel() {
  return (
    <motion.div
      className="brand-panel"
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
    >
      <div className="brand-content">
        <div className="brand-logo" aria-hidden="true">
          <Logo size={48} />
        </div>
        <motion.h1
          className="brand-heading"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          MeetSync AI
        </motion.h1>
        <motion.p
          className="brand-tagline"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          Meet beyond the meeting.
        </motion.p>
        <motion.div
          className="brand-divider"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        />
        <motion.div
          className="brand-features"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
        >
          {FEATURES.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.25 + index * 0.06 }}
            >
              <FeatureRow icon={feature.icon} title={feature.title} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}

export default BrandPanel;