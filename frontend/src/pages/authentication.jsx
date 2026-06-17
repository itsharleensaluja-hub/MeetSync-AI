/**
 * AUTHENTICATION PAGE - authentication.jsx
 * Handles both login and registration
 * Features:
 * - Toggle between login (formState=0) and register (formState=1) forms
 * - Input fields for credentials
 * - Form validation and error handling
 * - Success messages using Snackbar
 * 
 * After successful login, user is redirected to /home
 * After successful registration, form switches back to login
 */

import * as React from 'react';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonIcon from '@mui/icons-material/Person';
import KeyIcon from '@mui/icons-material/Key';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { AuthContext } from '../contexts/AuthContext';
import { Snackbar } from '@mui/material';

export default function Authentication() {

    // Form input states
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [name, setName] = React.useState(""); // Only used for registration
    const [error, setError] = React.useState("");
    const [message, setMessage] = React.useState("");
    const [loading, setLoading] = React.useState(false);

    // formState: 0 = login form, 1 = register form
    const [formState, setFormState] = React.useState(0);

    // Control Snackbar visibility for success messages
    const [open, setOpen] = React.useState(false)

    // Get authentication functions from context
    const { handleRegister, handleLogin } = React.useContext(AuthContext);

    // Handle form submission for both login and register
    let handleAuth = async () => {
        setLoading(true);
        setError("");
        try {
            // Login flow (formState = 0)
            if (formState === 0) {
                await handleLogin(username, password)
            }
            // Registration flow (formState = 1)
            if (formState === 1) {
                let result = await handleRegister(name, username, password);
                console.log(result);
                // Reset form and show success message
                setUsername("");
                setMessage(result);
                setOpen(true); // Show success snackbar
                setFormState(0) // Switch back to login form
                setPassword("")
            }
        } catch (err) {

            console.log(err);
            let msg = err?.response?.data?.message || "An error occurred. Please try again.";
            setError(msg);
        } finally {
            setLoading(false);
        }
    }

    const inputStyles = {
        '& .MuiOutlinedInput-root': {
            borderRadius: '10px',
            background: '#0f1729',
            '& fieldset': { borderColor: '#2a3550' },
            '&:hover fieldset': { borderColor: '#645efb' },
            '&.Mui-focused fieldset': { borderColor: '#645efb' },
        },
        '& .MuiInputLabel-root': { color: '#8a8fa8' },
        '& .MuiInputBase-input': { color: 'white', ml: 1 },
        '& input:-webkit-autofill': { WebkitBoxShadow: '0 0 0 1000px #0f1729 inset' },
        '& .MuiInputLabel-root.Mui-focused': { color: '#645efb' },
        '& .MuiInputAdornment-root': { color: '#45464d' },
        mb: 1.5,
    };

    return (
        <Grid container component="main" sx={{ height: '100vh', background: '#131b2e' }}>
            {/* LEFT: Brand Panel */}
                <Grid
                    item
                    xs={false}
                    sm={4}
                    md={7}
                    sx={{
                        background: '#0f1729',
                        backgroundImage: 'radial-gradient(circle, rgba(100,94,251,0.08) 1px, transparent 1px)',
                        backgroundSize: '24px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Box sx={{ textAlign: 'center', zIndex: 1, px: 4 }}>
                        <Avatar sx={{ width: 72, height: 72, bgcolor: '#645efb', mx: 'auto', mb: 3 }}>
                            <PsychologyIcon sx={{ fontSize: 40 }} />
                        </Avatar>
                        <Typography variant="h3" sx={{ fontSize: 36, fontWeight: 600, color: 'white', letterSpacing: '-0.5px', mb: 1.5 }}>
                            MeetSync AI
                        </Typography>
                        <Typography sx={{ fontSize: 15, color: '#8a8fa8', lineHeight: 1.7, maxWidth: 360, mx: 'auto' }}>
                            Smart meetings with AI-powered attendance, real-time polling, and team collaboration.
                        </Typography>
                        <Box sx={{ mt: 5, display: 'flex', flexDirection: 'column', gap: 2.5, alignItems: 'flex-start', maxWidth: 280, mx: 'auto' }}>
                            {[
                                { text: 'AI Face Attendance Tracking' },
                                { text: 'Live Polls & Decision Tracking' },
                                { text: 'Secure Real-time Meetings' },
                            ].map((item, i) => (
                                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                    <CheckCircleOutlineIcon sx={{ color: '#645efb', fontSize: 20 }} />
                                    <Typography sx={{ fontSize: 14, color: '#c3c0ff' }}>{item.text}</Typography>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                </Grid>

            {/* RIGHT: Form Panel */}
            <Grid item xs={12} sm={8} md={5} sx={{
                background: '#1a2340',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderLeft: '1px solid rgba(255,255,255,0.05)',
            }}>
                <Box
                    sx={{
                        my: 6,
                        mx: 5,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        width: '100%',
                        maxWidth: 400,
                    }}
                >
                    <Box sx={{
                        width: '100%',
                        p: 4,
                        background: 'rgba(15,23,41,0.5)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: '20px',
                    }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                            <Avatar sx={{ width: 48, height: 48, bgcolor: '#645efb', mb: 2 }}>
                                <LockOutlinedIcon />
                            </Avatar>
                            <Typography variant="h5" sx={{ fontWeight: 600, color: 'white', textAlign: 'center' }}>
                                {formState === 0 ? 'Welcome Back' : 'Create Account'}
                            </Typography>
                            <Typography sx={{ fontSize: 14, color: '#8a8fa8', textAlign: 'center', mt: 0.5 }}>
                                {formState === 0 ? 'Sign in to start or join a meeting' : 'Register to get started with MeetSync AI'}
                            </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', p: 3, background: '#0f1729', borderRadius: '24px', mb: 3 }}>
                            <Box
                                onClick={() => { setFormState(0); setError(""); }}
                                sx={{
                                    flex: 1,
                                    py: 0.8,
                                    borderRadius: '21px',
                                    background: formState === 0 ? '#645efb' : 'transparent',
                                    color: formState === 0 ? 'white' : '#8a8fa8',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    fontWeight: 600,
                                    fontSize: 14,
                                    transition: 'all 0.2s ease',
                                    '&:hover': { background: formState === 0 ? '#7b75ff' : 'rgba(100,94,251,0.1)' },
                                }}
                            >
                                Sign In
                            </Box>
                            <Box
                                onClick={() => { setFormState(1); setError(""); }}
                                sx={{
                                    flex: 1,
                                    py: 0.8,
                                    borderRadius: '21px',
                                    background: formState === 1 ? '#645efb' : 'transparent',
                                    color: formState === 1 ? 'white' : '#8a8fa8',
                                    cursor: 'pointer',
                                    textAlign: 'center',
                                    fontWeight: 600,
                                    fontSize: 14,
                                    transition: 'all 0.2s ease',
                                    '&:hover': { background: formState === 1 ? '#7b75ff' : 'rgba(100,94,251,0.1)' },
                                }}
                            >
                                Sign Up
                            </Box>
                        </Box>

                        <Box component="form" noValidate sx={{ width: '100%' }}>
                            {formState === 1 ? <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="name"
                                label="Full Name"
                                name="name"
                                value={name}
                                autoFocus
                                onChange={(e) => setName(e.target.value)}
                                sx={inputStyles}
                                InputProps={{
                                    startAdornment: <PersonIcon sx={{ color: '#45464d', mr: 0.5 }} />,
                                }}
                            /> : <></>}

                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                id="username"
                                label="Username"
                                name="username"
                                value={username}
                                autoFocus={formState === 0}
                                onChange={(e) => setUsername(e.target.value)}
                                onFocus={(e) => { setTimeout(() => setUsername(e.target.value), 50); }}
                                autoComplete="username"
                                sx={inputStyles}
                                InputProps={{
                                    startAdornment: <PersonIcon sx={{ color: '#45464d', mr: 0.5 }} />,
                                }}
                            />
                            <TextField
                                margin="normal"
                                required
                                fullWidth
                                name="password"
                                label="Password"
                                value={password}
                                type="password"
                                onChange={(e) => setPassword(e.target.value)}
                                onFocus={(e) => { setTimeout(() => setPassword(e.target.value), 50); }}
                                autoComplete="current-password"
                                id="password"
                                sx={inputStyles}
                                InputProps={{
                                    startAdornment: <KeyIcon sx={{ color: '#45464d', mr: 0.5 }} />,
                                }}
                            />

                            {formState === 0 && (
                                <Box sx={{ textAlign: 'right', mt: 0.5, mb: 1 }}>
                                    <Link href="#" sx={{ color: '#8a8fa8', fontSize: 13, textDecoration: 'none', '&:hover': { color: '#645efb' } }}>
                                        Forgot password?
                                    </Link>
                                </Box>
                            )}

                            {error && (
                                <Box sx={{
                                    p: 1.5,
                                    borderRadius: '8px',
                                    background: 'rgba(255,77,77,0.08)',
                                    borderLeft: '3px solid #ff4d4d',
                                    mt: 1,
                                }}>
                                    <Typography sx={{ color: '#ff4d4d', fontSize: 13, lineHeight: 1.4 }}>{error}</Typography>
                                </Box>
                            )}

                            <Button
                                type="button"
                                fullWidth
                                variant="contained"
                                disabled={loading}
                                sx={{
                                    mt: 2.5,
                                    mb: 1,
                                    background: 'linear-gradient(135deg, #645efb 0%, #7b75ff 100%)',
                                    '&:hover': { background: 'linear-gradient(135deg, #7b75ff 0%, #8d87ff 100%)', boxShadow: '0 4px 20px rgba(100,94,251,0.3)' },
                                    '&.Mui-disabled': { background: '#3a3570', color: 'rgba(255,255,255,0.5)' },
                                    borderRadius: '12px',
                                    py: 1.5,
                                    fontWeight: 600,
                                    textTransform: 'none',
                                    fontSize: 15,
                                    height: 48,
                                    transition: 'all 0.2s ease',
                                }}
                                onClick={handleAuth}
                            >
                                {loading ? (
                                    <CircularProgress size={22} sx={{ color: 'white' }} />
                                ) : (
                                    formState === 0 ? "Sign In" : "Create Account"
                                )}
                            </Button>
                        </Box>

                        <Box sx={{ textAlign: 'center', mt: 2.5 }}>
                            <Typography sx={{ color: '#8a8fa8', fontSize: 13 }}>
                                {formState === 0 ? (
                                    <>Don't have an account?{' '}
                                        <Link onClick={() => { setFormState(1); setError(""); }} sx={{ color: '#645efb', cursor: 'pointer', textDecoration: 'none', fontWeight: 600, '&:hover': { color: '#8d87ff' } }}>
                                            Sign Up
                                        </Link>
                                    </>
                                ) : (
                                    <>Already have an account?{' '}
                                        <Link onClick={() => { setFormState(0); setError(""); }} sx={{ color: '#645efb', cursor: 'pointer', textDecoration: 'none', fontWeight: 600, '&:hover': { color: '#8d87ff' } }}>
                                            Sign In
                                        </Link>
                                    </>
                                )}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Grid>

            <Snackbar
                open={open}
                autoHideDuration={4000}
                message={message}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{
                    '& .MuiSnackbarContent-root': {
                        background: '#0f1729',
                        color: 'white',
                        borderRadius: '12px',
                        border: '1px solid rgba(100,94,251,0.2)',
                    }
                }}
            />

        </Grid>
    );
}
