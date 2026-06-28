import React, { useState } from 'react';
import { Check } from 'lucide-react';

function RememberMeRow() {
  const [checked, setChecked] = useState(false);

  return (
    <div className="remember-row">
      <label className="remember-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => setChecked(!checked)}
          className="native-checkbox"
          tabIndex={0}
        />
        <span className={`custom-checkbox ${checked ? 'checked' : ''}`} aria-hidden="true">
          {checked && <Check size={12} className="check-icon" />}
        </span>
        <span className="checkbox-label">Remember me</span>
      </label>
    </div>
  );
}

export default RememberMeRow;