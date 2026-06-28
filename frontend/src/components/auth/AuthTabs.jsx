import React, { useRef, useEffect } from 'react';

function AuthTabs({ activeTab, onChange }) {
  const indicatorRef = useRef(null);
  const signInRef = useRef(null);
  const signUpRef = useRef(null);

  const updateIndicator = () => {
    const activeEl = activeTab === 0 ? signInRef.current : signUpRef.current;
    const container = indicatorRef.current?.parentElement;
    if (activeEl && container) {
      const cr = activeEl.getBoundingClientRect();
      const pr = container.getBoundingClientRect();
      indicatorRef.current.style.transform = `translateX(${cr.left - pr.left}px)`;
      indicatorRef.current.style.width = `${cr.width}px`;
    }
  };

  useEffect(() => {
    updateIndicator();
  }, [activeTab]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => updateIndicator());
    if (indicatorRef.current?.parentElement) {
      observer.observe(indicatorRef.current.parentElement);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="tab-switcher" role="tablist" aria-label="Authentication mode">
      <div className="tab-track" ref={indicatorRef}>
        <div className="tab-indicator" />
      </div>
      <button
        ref={signInRef}
        role="tab"
        aria-selected={activeTab === 0}
        aria-controls="signin-panel"
        id="signin-tab"
        className={`tab-btn ${activeTab === 0 ? 'active' : ''}`}
        onClick={() => onChange(0)}
        type="button"
      >
        Sign In
      </button>
      <button
        ref={signUpRef}
        role="tab"
        aria-selected={activeTab === 1}
        aria-controls="signup-panel"
        id="signup-tab"
        className={`tab-btn ${activeTab === 1 ? 'active' : ''}`}
        onClick={() => onChange(1)}
        type="button"
      >
        Sign Up
      </button>
    </div>
  );
}

export default AuthTabs;