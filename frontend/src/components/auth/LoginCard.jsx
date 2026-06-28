import React from 'react';
import { motion } from 'framer-motion';

function LoginCard({ children }) {
  return (
    <motion.div
      className="login-card"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
    >
      {children}
    </motion.div>
  );
}

export default LoginCard;