import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

function AuthButton({ onClick, loading, disabled, children }) {
  return (
    <motion.div
      className="btn-wrapper"
      whileTap={!disabled ? { scale: 0.98 } : {}}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <button
        type="button"
        className="auth-button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <span className="btn-spinner" aria-hidden="true">
              <span className="spinner-dot" />
              <span className="spinner-dot" />
              <span className="spinner-dot" />
            </span>
            <span>Please wait...</span>
          </>
        ) : (
          <>
            <span>{children}</span>
            <ArrowRight size={20} className="btn-arrow" aria-hidden="true" />
          </>
        )}
      </button>
    </motion.div>
  );
}

export default AuthButton;