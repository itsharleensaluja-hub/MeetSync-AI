/**
 * AUTHENTICATION PAGE - authentication.jsx
 * Modern sign-in / sign-up experience with polished interactions
 * No template patterns — custom visual identity, smooth motion, thoughtful UX
 */

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonIcon from '@mui/icons-material/Person';
import KeyIcon from '@mui/icons-material/Key';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { AuthContext } from '../contexts/AuthContext';
import { Snackbar } from '@mui/material';
import './authentication.css';

export default function Authentication() {
  const prefersReducedMotion = React.useMemo(
    () => typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
    []
  );

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formState, setFormState] = useState(0);
  const [open, setOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [fieldTouched, setFieldTouched] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0);

  const cardRef = useRef(null);
  const submitBtnRef = useRef(null);
  const tabIndicatorRef = useRef(null);
  const signInTabRef = useRef(null);
  const signUpTabRef = useRef(null);
  const formFieldsRef = useRef([]);

  const { handleRegister, handleLogin } = React.useContext(AuthContext);

  const validateField = useCallback((field, value) => {
    switch (field) {
      case 'name':
        return value.trim().length >= 2 ? '' : 'Name must be at least 2 characters';
      case 'username':
        return value.trim().length >= 3 ? '' : 'Username must be at least 3 characters';
      case 'password':
        if (value.length === 0) return '';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/[A-Z]/.test(value)) return 'Add an uppercase letter';
        if (!/[a-z]/.test(value)) return 'Add a lowercase letter';
        if (!/[0-9]/.test(value)) return 'Add a number';
        return '';
      default:
        return '';
    }
  }, []);

  const calculatePasswordStrength = useCallback((value) => {
    if (!value) return 0;
    let score = 0;
    if (value.length >= 8) score++;
    if (/[A-Z]/.test(value)) score++;
    if (/[a-z]/.test(value)) score++;
    if (/[0-9]/.test(value)) score++;
    if (/[^A-Za-z0-9]/.test(value)) score++;
    return Math.min(score, 4);
  }, []);

  const handleFieldChange = (field, e) => {
    const value = e.target.value;
    const errorMsg = validateField(field, value);
    
    setFieldErrors(prev => ({ ...prev, [field]: errorMsg }));
    
    switch (field) {
      case 'name': setName(value); break;
      case 'username': setUsername(value); break;
      case 'password': 
        setPassword(value);
        setPasswordStrength(calculatePasswordStrength(value));
        break;
    }
  };

  const handleFieldBlur = (field) => {
    setFieldTouched(prev => ({ ...prev, [field]: true }));
  };

  const switchTab = (newState) => {
    if (newState === formState) return;
    setFormState(newState);
    setError('');
    setFieldErrors({});
    setFieldTouched({});
    setPasswordStrength(0);
  };

  useEffect(() => {
    if (tabIndicatorRef.current && (signInTabRef.current || signUpTabRef.current)) {
      const activeTab = formState === 0 ? signInTabRef.current : signUpTabRef.current;
      if (activeTab) {
        const rect = activeTab.getBoundingClientRect();
        const containerRect = tabIndicatorRef.current.parentElement?.getBoundingClientRect();
        if (containerRect) {
          tabIndicatorRef.current.style.transform = `translateX(${rect.left - containerRect.left}px)`;
          tabIndicatorRef.current.style.width = `${rect.width}px`;
        }
      }
    }
  }, [formState]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (tabIndicatorRef.current && (signInTabRef.current || signUpTabRef.current)) {
        const activeTab = formState === 0 ? signInTabRef.current : signUpTabRef.current;
        if (activeTab) {
          const rect = activeTab.getBoundingClientRect();
          const containerRect = tabIndicatorRef.current.parentElement?.getBoundingClientRect();
          if (containerRect) {
            tabIndicatorRef.current.style.transform = `translateX(${rect.left - containerRect.left}px)`;
            tabIndicatorRef.current.style.width = `${rect.width}px`;
          }
        }
      }
    });
    if (tabIndicatorRef.current?.parentElement) {
      observer.observe(tabIndicatorRef.current.parentElement);
    }
    return () => observer.disconnect();
  }, [formState]);

  const handleCardMove = (e) => {
    if (prefersReducedMotion) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    card.style.transform = `perspective(1000px) rotateX(${((y - cy) / cy) * -3}deg) rotateY(${((x - cx) / cx) * 3}deg)`;
  };

  const handleCardLeave = () => {
    if (cardRef.current) cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
  };

  const handleBtnMove = (e) => {
    if (prefersReducedMotion) return;
    const btn = submitBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
  };

  const handleBtnLeave = () => {
    if (submitBtnRef.current) submitBtnRef.current.style.transform = '';
  };

  const handleAuth = async () => {
    const errors = {};
    if (!username) errors.username = 'Username is required';
    if (!password) errors.password = 'Password is required';
    if (formState === 1 && !name) errors.name = 'Name is required';
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFieldTouched({ username: true, password: true, name: true });
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (formState === 0) {
        await handleLogin(username, password);
      } else {
        const result = await handleRegister(name, username, password);
        setUsername('');
        setName('');
        setPassword('');
        setMessage(result);
        setOpen(true);
        setFormState(0);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) {
      handleAuth();
    }
  };

  const passwordRequirements = [
    { label: '8+ characters', test: (v) => v.length >= 8 },
    { label: 'Uppercase', test: (v) => /[A-Z]/.test(v) },
    { label: 'Lowercase', test: (v) => /[a-z]/.test(v) },
    { label: 'Number', test: (v) => /[0-9]/.test(v) },
  ];

  const strengthLabels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const strengthColors = ['#ff4d4d', '#ff4d4d', '#ffa726', '#66bb6a', '#00d4aa'];

  return (
    <div className="auth-page" data-reduced-motion={prefersReducedMotion}>
      
      <div className="auth-bg">
        <div className="dot-grid" aria-hidden="true"></div>
        <div className="scan-line" aria-hidden="true"></div>
        <div className="noise-overlay" aria-hidden="true"></div>
      </div>

      <Grid container component="main" className="auth-layout">
        {/* Form Panel */}
        <Grid item xs={12} className="form-panel">
          <div className="form-wrapper">
            <div className="form-card" ref={cardRef} onMouseMove={handleCardMove} onMouseLeave={handleCardLeave}>
              <div className="form-header">
                <div className="form-logo" aria-hidden="true">
                  <LockOutlinedIcon fontSize="inherit" />
                </div>
                <h2 className="form-title">
                  {formState === 0 ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="form-subtitle">
                  {formState === 0 
                    ? 'Sign in to start or join a meeting instantly'
                    : 'Create your account and run your first meeting in minutes'}
                </p>
              </div>

              <div className="tab-switcher" role="tablist" aria-label="Authentication mode">
                <div className="tab-track" ref={tabIndicatorRef}>
                  <div className="tab-indicator" />
                </div>
                <button
                  ref={signInTabRef}
                  role="tab"
                  aria-selected={formState === 0}
                  aria-controls="signin-panel"
                  id="signin-tab"
                  className={`tab-btn ${formState === 0 ? 'active' : ''}`}
                  onClick={() => switchTab(0)}
                  type="button"
                >
                  Sign In
                </button>
                <button
                  ref={signUpTabRef}
                  role="tab"
                  aria-selected={formState === 1}
                  aria-controls="signup-panel"
                  id="signup-tab"
                  className={`tab-btn ${formState === 1 ? 'active' : ''}`}
                  onClick={() => switchTab(1)}
                  type="button"
                >
                  Sign Up
                </button>
              </div>

              <form className="auth-form" onKeyDown={handleKeyDown} noValidate>
                <div id="signup-panel" role="tabpanel" aria-labelledby="signup-tab" hidden={formState !== 1}>
                  <div className="field-group" style={{ animationDelay: '0.02s' }}>
                    <TextField
                      fullWidth
                      required
                      id="name"
                      label="Full Name"
                      name="name"
                      value={name}
                      autoFocus={formState === 1}
                      onChange={(e) => handleFieldChange('name', e)}
                      onBlur={() => handleFieldBlur('name')}
                      autoComplete="name"
                      InputProps={{
                        startAdornment: (
                          <PersonIcon 
                            className={`input-icon ${fieldErrors.name && fieldTouched.name ? 'error' : ''}`}
                          />
                        ),
                        endAdornment: fieldTouched.name && !fieldErrors.name && name ? (
                          <CheckIcon className="input-success" sx={{ fontSize: 20, color: '#00d4aa' }} />
                        ) : fieldTouched.name && fieldErrors.name ? (
                          <CloseIcon className="input-error" sx={{ fontSize: 20, color: '#ff4d4d' }} />
                        ) : null,
                      }}
                      className={`text-field ${fieldTouched.name && fieldErrors.name ? 'has-error' : ''} ${fieldTouched.name && !fieldErrors.name && name ? 'has-success' : ''}`}
                      placeholder=" "
                    />
                  </div>
                </div>

                <div id="signin-panel" role="tabpanel" aria-labelledby="signin-tab" hidden={formState !== 0}>
                  <div className="field-group" style={{ animationDelay: '0.02s' }}>
                    <div style={{ height: 0, overflow: 'hidden' }} aria-hidden="true"> </div>
                  </div>
                </div>

                <div className="field-group" style={{ animationDelay: '0.04s' }}>
                  <TextField
                    fullWidth
                    required
                    id="username"
                    label="Username"
                    name="username"
                    value={username}
                    autoFocus={formState === 0}
                    onChange={(e) => handleFieldChange('username', e)}
                    onBlur={() => handleFieldBlur('username')}
                    autoComplete="username"
                    InputProps={{
                      startAdornment: (
                        <PersonIcon 
                          className={`input-icon ${fieldErrors.username && fieldTouched.username ? 'error' : ''}`}
                        />
                      ),
                      endAdornment: fieldTouched.username && !fieldErrors.username && username ? (
                        <CheckIcon className="input-success" sx={{ fontSize: 20, color: '#00d4aa' }} />
                      ) : fieldTouched.username && fieldErrors.username ? (
                        <CloseIcon className="input-error" sx={{ fontSize: 20, color: '#ff4d4d' }} />
                      ) : null,
                    }}
                    className={`text-field ${fieldTouched.username && fieldErrors.username ? 'has-error' : ''} ${fieldTouched.username && !fieldErrors.username && username ? 'has-success' : ''}`}
                    placeholder=" "
                  />
                </div>

                <div className="field-group password-field" style={{ animationDelay: '0.06s' }}>
                  <TextField
                    fullWidth
                    required
                    id="password"
                    label="Password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => handleFieldChange('password', e)}
                    onBlur={() => handleFieldBlur('password')}
                    autoComplete={formState === 0 ? 'current-password' : 'new-password'}
                    InputProps={{
                      startAdornment: (
                        <KeyIcon 
                          className={`input-icon ${fieldErrors.password && fieldTouched.password ? 'error' : ''}`}
                        />
                      ),
                      endAdornment: (
                        <Box
                          component="span"
                          className="password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowPassword(!showPassword); }}}
                          tabIndex={0}
                          role="button"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showPassword}
                        >
                          {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                        </Box>
                      ),
                    }}
                    className={`text-field ${fieldTouched.password && fieldErrors.password ? 'has-error' : ''} ${fieldTouched.password && !fieldErrors.password && password ? 'has-success' : ''}`}
                    placeholder=" "
                  />
                </div>

                {formState === 1 && password && (
                  <div className="password-strength" style={{ animationDelay: '0.08s' }} role="progressbar" aria-valuenow={passwordStrength} aria-valuemin={0} aria-valuemax={4} aria-label="Password strength">
                    <div className="strength-header">
                      <span className="strength-label">Password strength: {strengthLabels[passwordStrength]}</span>
                    </div>
                    <div className="strength-bar">
                      {[0,1,2,3].map((i) => (
                        <div
                          key={i}
                          className={`strength-segment ${i < passwordStrength ? 'filled' : ''}`}
                          style={{ backgroundColor: i < passwordStrength ? strengthColors[passwordStrength] : 'transparent' }}
                        />
                      ))}
                    </div>
                    <ul className="strength-requirements">
                      {passwordRequirements.map((req, i) => (
                        <li key={i} className={`req-item ${req.test(password) ? 'met' : ''}`}>
                          <span className={`req-icon ${req.test(password) ? 'met' : ''}`} aria-hidden="true">
                            {req.test(password) ? '✓' : '○'}
                          </span>
                          <span className="req-text">{req.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {error && (
                  <div className="form-error" role="alert" style={{ animationDelay: '0.1s' }}>
                    <CloseIcon className="error-icon" fontSize="small" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}

                <span className="btn-magnetic-wrap" ref={submitBtnRef} onMouseMove={handleBtnMove} onMouseLeave={handleBtnLeave}>
                  <Button
                    type="button"
                    fullWidth
                    variant="contained"
                    disabled={loading}
                    className="submit-btn"
                    onClick={handleAuth}
                    aria-busy={loading}
                  >
                    {loading ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true">
                          <span className="spinner-dot"></span>
                          <span className="spinner-dot"></span>
                          <span className="spinner-dot"></span>
                        </span>
                        <span className="btn-text">Please wait...</span>
                      </>
                    ) : (
                      <>
                        <span className="btn-text">
                          {formState === 0 ? 'Sign In' : 'Create Account'}
                        </span>
                        <ArrowForwardIcon className="btn-arrow" sx={{ ml: 1 }} aria-hidden="true" />
                      </>
                    )}
                  </Button>
                </span>

                <p className="form-switch" style={{ animationDelay: '0.12s' }}>
                  {formState === 0 ? (
                    <>No account? <button type="button" className="switch-link" onClick={() => switchTab(1)}>Sign Up</button></>
                  ) : (
                    <>Already have an account? <button type="button" className="switch-link" onClick={() => switchTab(0)}>Sign In</button></>
                  )}
                </p>
              </form>
            </div>
          </div>
        </Grid>
      </Grid>

      <Snackbar
        open={open}
        autoHideDuration={5000}
        message={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <CheckIcon sx={{ color: '#00d4aa', fontSize: 22 }} aria-hidden="true" />
            <span>{message}</span>
          </Box>
        }
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setOpen(false)}
        className="auth-snackbar"
      />
    </div>
  );
}