/**
 * HOME PAGE - home.jsx
 * Dashboard shown after user logs in
 * Features:
 * - Navigation bar with History button and Logout
 * - Text field to enter meeting code
 * - Join button to enter a video call
 * 
 * This page is protected (requires authentication)
 * Uses withAuth HOC to redirect to /auth if not logged in
 */

import React, { useContext, useState } from 'react'
import withAuth from '../utils/withAuth'
import { useNavigate } from 'react-router-dom'
import "../App.css";
import { Button, IconButton, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore';
import BarChartIcon from '@mui/icons-material/BarChart';
import Logo from '../components/Logo';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { AuthContext } from '../contexts/AuthContext';

function HomeComponent() {

    let navigate = useNavigate();
    const [joinInput, setJoinInput] = useState("");
    const [createdCode, setCreatedCode] = useState("");
    const [copied, setCopied] = useState(false);
    const {addToUserHistory} = useContext(AuthContext);

    const generateCode = () => Math.random().toString(36).substring(2, 10);

    const extractCode = (input) => {
        try {
            const url = new URL(input);
            return url.pathname.replace(/^\/|\/$/g, '');
        } catch {
            return input.trim();
        }
    };

    const handleCreateMeeting = () => {
        setCreatedCode(generateCode());
        setCopied(false);
    };

    const handleCopyLink = async () => {
        const link = `${window.location.origin}/${createdCode}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    const handleStartMeeting = async () => {
        await addToUserHistory(createdCode);
        navigate(`/${createdCode}`);
    };

    let handleJoinVideoCall = async () => {
        const code = extractCode(joinInput);
        if (!code) return;
        await addToUserHistory(code);
        navigate(`/${code}`);
    };

    return (
        <>
            {/* Navigation Bar */}
            <div className="navBar">

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Logo size={32} />
                    <h2>MeetSync AI</h2>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                    {/* History button - shows past meetings */}
                    <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <IconButton onClick={() => navigate("/history")}>
                            <RestoreIcon />
                        </IconButton>
                        <p>History</p>
                    </div>

                    {/* Analytics button - shows attendance dashboard */}
                    <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                        <IconButton onClick={() => navigate("/attendance-analytics")}>
                            <BarChartIcon />
                        </IconButton>
                        <p>Analytics</p>
                    </div>

                    {/* Logout button - clears token and redirects to auth page */}
                    <Button onClick={() => {
                        localStorage.removeItem("token")
                        navigate("/auth")
                    }}>
                        Logout
                    </Button>
                </div>

            </div>

            {/* Main Content Area */}
            <div className="meetContainer">
                {/* Left panel with meeting code input */}
                <div className="leftPanel">
                    <div>
                        <h2>Start or join a meeting in seconds</h2>

                        {/* Create Meeting */}
                        <div style={{ marginBottom: '24px' }}>
                            <Button
                                onClick={handleCreateMeeting}
                                variant='contained'
                                sx={{ mb: 2 }}
                            >
                                Create Meeting
                            </Button>

                            {createdCode && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <TextField
                                            value={`${window.location.origin}/${createdCode}`}
                                            variant="outlined"
                                            size="small"
                                            InputProps={{ readOnly: true }}
                                            sx={{ flexGrow: 1 }}
                                        />
                                        <Button
                                            onClick={handleCopyLink}
                                            variant="outlined"
                                            size="small"
                                            startIcon={<ContentCopyIcon />}
                                            sx={{ minWidth: 100 }}
                                        >
                                            {copied ? 'Copied!' : 'Copy'}
                                        </Button>
                                    </div>
                                    <Button onClick={handleStartMeeting} variant="contained" color="primary">
                                        Start Meeting
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Join Meeting */}
                        <div style={{ display: 'flex', gap: "10px" }}>
                            <TextField
                                onChange={e => setJoinInput(e.target.value)}
                                id="outlined-basic"
                                label="Paste link or enter code"
                                variant="outlined"
                                value={joinInput}
                                onKeyDown={e => { if (e.key === 'Enter') handleJoinVideoCall(); }}
                            />
                            <Button onClick={handleJoinVideoCall} variant='contained'>Join</Button>
                        </div>
                    </div>
                </div>
                {/* Right panel with image */}
                <div className='rightPanel'>
                    <Logo size={200} />
                </div>
            </div>
        </>
    )
}

export default withAuth(HomeComponent)