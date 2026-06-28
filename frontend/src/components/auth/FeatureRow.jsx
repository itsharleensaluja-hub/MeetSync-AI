import React from 'react';
import { FileText, Link2, Search, CheckSquare, BarChart3, Shield } from 'lucide-react';

const ICON_MAP = {
  FileText,
  Link2,
  Search,
  CheckSquare,
  BarChart3,
  Shield,
};

function FeatureRow({ icon: Icon, title }) {
  return (
    <div className="feature-row">
      <div className="feature-icon-wrap" aria-hidden="true">
        <Icon size={20} />
      </div>
      <h3 className="feature-title">{title}</h3>
    </div>
  );
}

export default FeatureRow;