import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check, User, Lock } from 'lucide-react';
import { Snackbar } from '@mui/material';
import { AuthContext } from '../contexts/AuthContext';
import Logo from '../components/Logo';
import {
  AnimatedBackground,
  AuthTabs,
  InputField,
  AuthButton,
  LoginCard,
  BrandPanel,
  RememberMeRow,
  Footer,
} from '../components/auth';
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

  const logoAnimation = prefersReducedMotion
    ? {}
    : { y: [-6, 6, -6], scale: [1, 1.02, 1] };

  const stagger = (i) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.1 + i * 0.06, duration: 0.4, ease: 'easeOut' },
  });

  return (
    <div className="auth-page" data-reduced-motion={prefersReducedMotion}>
      <AnimatedBackground prefersReducedMotion={prefersReducedMotion} />

      <main className="auth-layout">
        <BrandPanel />

        <div className="auth-panel">
          <LoginCard>
            <div className="form-header">
              <motion.div
                className="form-logo"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
              >
                <motion.div
                  animate={logoAnimation}
                  transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Logo size={64} />
                </motion.div>
              </motion.div>

              <motion.h2
                className="form-title"
                {...stagger(0)}
              >
                {formState === 0 ? 'Welcome Back' : 'Create Account'}
              </motion.h2>

              <motion.p
                className="form-subtitle"
                {...stagger(1)}
              >
                {formState === 0 ? 'Continue where your meetings left off.' : 'Join thousands of professionals using MeetSync AI.'}
              </motion.p>

              <motion.div
                className="form-divider"
                {...stagger(1.5)}
              />
            </div>

            <motion.div {...stagger(2)}>
              <AuthTabs activeTab={formState} onChange={switchTab} />
            </motion.div>

            <form className="auth-form" onKeyDown={handleKeyDown} noValidate>
              <div id="signup-panel" role="tabpanel" aria-labelledby="signup-tab" hidden={formState !== 1}>
                <InputField
                  id="name"
                  label="Full Name"
                  type="text"
                  value={name}
                  icon={User}
                  onChange={(e) => handleFieldChange('name', e)}
                  onBlur={() => handleFieldBlur('name')}
                  autoFocus={formState === 1}
                  autoComplete="name"
                  error={fieldErrors.name}
                  success={!!(fieldTouched.name && !fieldErrors.name && name)}
                  touched={!!fieldTouched.name}
                />
              </div>

              <div id="signin-panel" role="tabpanel" aria-labelledby="signin-tab" hidden={formState !== 0}>
                <div style={{ height: 0, overflow: 'hidden' }} aria-hidden="true"> </div>
              </div>

              <InputField
                id="username"
                label="Username"
                type="text"
                value={username}
                icon={User}
                onChange={(e) => handleFieldChange('username', e)}
                onBlur={() => handleFieldBlur('username')}
                autoFocus={formState === 0}
                autoComplete="username"
                error={fieldErrors.username}
                success={!!(fieldTouched.username && !fieldErrors.username && username)}
                touched={!!fieldTouched.username}
              />

              <InputField
                id="password"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                icon={Lock}
                onChange={(e) => handleFieldChange('password', e)}
                onBlur={() => handleFieldBlur('password')}
                autoComplete={formState === 0 ? 'current-password' : 'new-password'}
                error={fieldErrors.password}
                success={!!(fieldTouched.password && !fieldErrors.password && password)}
                touched={!!fieldTouched.password}
                showPasswordToggle
                showPassword={showPassword}
                onTogglePassword={() => setShowPassword(!showPassword)}
              />

              {error && (
                <motion.div
                  className="form-error"
                  role="alert"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  <AlertCircle size={18} className="error-icon" aria-hidden="true" />
                  <span>{error}</span>
                </motion.div>
              )}

              <RememberMeRow />

              <AuthButton onClick={handleAuth} loading={loading} disabled={loading}>
                {formState === 0 ? 'Sign In' : 'Create Account'}
              </AuthButton>

              <Footer />
            </form>
          </LoginCard>
        </div>
      </main>

      <Snackbar
        open={open}
        autoHideDuration={5000}
        message={
          <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Check size={22} style={{ color: '#22E7FF' }} aria-hidden="true" />
            <span>{message}</span>
          </span>
        }
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={() => setOpen(false)}
        className="auth-snackbar"
      />
    </div>
  );
}