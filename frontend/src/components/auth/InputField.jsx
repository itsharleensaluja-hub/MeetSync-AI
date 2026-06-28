import React, { useState, useRef, useEffect } from 'react';
import { Check, AlertCircle, Eye, EyeOff, User, Lock } from 'lucide-react';

const ICON_MAP = {
  User,
  Lock,
};

function InputField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  autoFocus,
  autoComplete,
  icon: Icon,
  error,
  success,
  touched,
  showPasswordToggle,
  showPassword,
  onTogglePassword,
}) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const hasValue = typeof value === 'string' && value.length > 0;
  const isFloating = focused || hasValue;
  const showError = error && touched;
  const showSuccess = success && !showError;

  const handleFocus = () => setFocused(true);

  const handleBlur = () => {
    setFocused(false);
    if (onBlur) onBlur();
  };

  const handleToggle = (e) => {
    e.preventDefault();
    if (onTogglePassword) onTogglePassword();
  };

  // Resolve icon - support both direct component and string name
  const ResolvedIcon = Icon && ICON_MAP[Icon.displayName || Icon.name || Icon] ? ICON_MAP[Icon.displayName || Icon.name || Icon] : Icon;

  return (
    <div className="field-group">
      <div className={`input-container ${showError ? 'has-error' : ''} ${showSuccess ? 'has-success' : ''}`}>
        {ResolvedIcon && (
          <ResolvedIcon size={20} className={`input-icon ${showError ? 'error' : ''}`} aria-hidden="true" />
        )}

        <input
          ref={inputRef}
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoComplete={autoComplete}
          className="input-field"
          aria-invalid={!!showError}
          aria-describedby={showError ? `${id}-error` : undefined}
          placeholder=" "
        />

        <label
          htmlFor={id}
          className={`floating-label ${isFloating ? 'float' : ''} ${showError ? 'error' : ''}`}
        >
          {label}
        </label>

        <div className="input-end">
          {showSuccess && <Check size={18} className="input-success-icon" aria-hidden="true" />}
          {showError && <AlertCircle size={18} className="input-error-icon" aria-hidden="true" />}
          {showPasswordToggle && (
            <button
              type="button"
              className="password-toggle-btn"
              onClick={handleToggle}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(e); }}}
              tabIndex={0}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
      </div>

      {showError && (
        <p id={`${id}-error`} className="input-error-msg" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default InputField;