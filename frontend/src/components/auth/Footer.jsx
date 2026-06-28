import React from 'react';
import { Shield } from 'lucide-react';

function Footer() {
  return (
    <footer className="auth-footer">
      <div className="security-badge">
        <Shield size={16} aria-hidden="true" />
        <span>Your data is protected with enterprise-grade encryption.</span>
      </div>
      <p className="copyright">© MeetSync AI</p>
    </footer>
  );
}

export default Footer;