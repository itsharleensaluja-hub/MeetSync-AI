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
import CircularProgress from '@mui/material/CircularProgress';
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
                    background: 'linear-gradient(135deg, #0f1729 0%, #1a2340 50%, #131b2e 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Decorative circles */}
                <Box sx={{
                    position: 'absolute', width: 400, height: 400, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(100,94,251,0.08) 0%, transparent 70%)',
                    top: '-10%', left: '-10%',
                }} />
                <Box sx={{
                    position: 'absolute', width: 300, height: 300, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(100,94,251,0.06) 0%, transparent 70%)',
                    bottom: '5%', right: '5%',
                }} />
                <Box sx={{
                    position: 'absolute', width: 200, height: 200, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(100,94,251,0.04) 0%, transparent 60%)',
                    top: '40%', right: '15%',
                }} />

                <Box sx={{ textAlign: 'center', zIndex: 1, px: 4 }}>
                    <Avatar sx={{ width: 72, height: 72, bgcolor: '#645efb', mx: 'auto', mb: 3 }}>
                        <PsychologyIcon sx={{ fontSize: 40 }} />
                    </Avatar>
                    <h1 style={{ fontSize: 36, fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.5px' }}>
                        MeetSync AI
                    </h1>
                    <p style={{ fontSize: 16, color: '#8a8fa8', marginTop: 8, lineHeight: 1.6, maxWidth: 360, margin: '12px auto 0' }}>
                        Smart meetings with AI-powered attendance, real-time polling, and team collaboration.
                    </p>
                    <Box sx={{ mt: 5, display: 'flex', flexDirection: 'column', gap: 2.5, alignItems: 'flex-start', maxWidth: 280, mx: 'auto' }}>
                        {[
                            { icon: '✓', text: 'AI Face Attendance Tracking' },
                            { icon: '✓', text: 'Live Polls & Decision Tracking' },
                            { icon: '✓', text: 'Secure Real-time Meetings' },
                        ].map((item, i) => (
                            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(100,94,251,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#645efb', fontSize: 12, fontWeight: 700 }}>{item.icon}</Box>
                                <span style={{ fontSize: 14, color: '#c3c0ff' }}>{item.text}</span>
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
                        maxWidth: 380,
                    }}
                >
                    <Avatar sx={{ width: 52, height: 52, bgcolor: '#645efb', mb: 2 }}>
                        <LockOutlinedIcon />
                    </Avatar>

                    <h2 style={{ fontSize: 22, fontWeight: 700, color: 'white', margin: 0, textAlign: 'center' }}>
                        {formState === 0 ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <p style={{ fontSize: 14, color: '#8a8fa8', margin: '4px 0 24px', textAlign: 'center' }}>
                        {formState === 0 ? 'Sign in to start or join a meeting' : 'Register to get started with MeetSync AI'}
                    </p>

                    <Box sx={{ display: 'flex', gap: 1, mb: 3, background: '#0f1729', borderRadius: '12px', padding: 3 }}>
                        <Button
                            variant={formState === 0 ? "contained" : "text"}
                            onClick={() => { setFormState(0); setError(""); }}
                            sx={{
                                flex: 1,
                                background: formState === 0 ? '#645efb' : 'transparent',
                                color: formState === 0 ? 'white' : '#8a8fa8',
                                '&:hover': { background: formState === 0 ? '#7b75ff' : 'rgba(100,94,251,0.1)' },
                                borderRadius: '10px',
                                fontWeight: 700,
                                textTransform: 'none',
                                fontSize: 14,
                                py: 1,
                            }}
                        >
                            Sign In
                        </Button>
                        <Button
                            variant={formState === 1 ? "contained" : "text"}
                            onClick={() => { setFormState(1); setError(""); }}
                            sx={{
                                flex: 1,
                                background: formState === 1 ? '#645efb' : 'transparent',
                                color: formState === 1 ? 'white' : '#8a8fa8',
                                '&:hover': { background: formState === 1 ? '#7b75ff' : 'rgba(100,94,251,0.1)' },
                                borderRadius: '10px',
                                fontWeight: 700,
                                textTransform: 'none',
                                fontSize: 14,
                                py: 1,
                            }}
                        >
                            Sign Up
                        </Button>
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
                            autoComplete="username"
                            sx={inputStyles}
                            inputProps={{ onInput: (e) => setUsername(e.target.value) }}
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
                            autoComplete="current-password"
                            id="password"
                            sx={inputStyles}
                            inputProps={{ onInput: (e) => setPassword(e.target.value) }}
                            InputProps={{
                                startAdornment: <KeyIcon sx={{ color: '#45464d', mr: 0.5 }} />,
                            }}
                        />

                        {error && (
                            <Box sx={{
                                p: 1.5,
                                borderRadius: '8px',
                                background: 'rgba(186,26,26,0.1)',
                                borderLeft: '3px solid #ba1a1a',
                                mt: 1,
                            }}>
                                <p style={{ color: "#ba1a1a", fontSize: 13, margin: 0, lineHeight: 1.4 }}>{error}</p>
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
                                background: '#645efb',
                                '&:hover': { background: '#7b75ff' },
                                '&.Mui-disabled': { background: '#3a3570', color: 'rgba(255,255,255,0.5)' },
                                borderRadius: '10px',
                                py: 1.5,
                                fontWeight: 700,
                                textTransform: 'none',
                                fontSize: 15,
                                height: 48,
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
                        borderRadius: '10px',
                        border: '1px solid rgba(100,94,251,0.2)',
                    }
                }}
            />

        </Grid>
    );
}
