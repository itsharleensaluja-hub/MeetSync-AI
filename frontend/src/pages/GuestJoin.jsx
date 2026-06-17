import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import "../App.css";
import { Button, TextField } from '@mui/material';

export default function GuestJoin() {

    const navigate = useNavigate();
    const [joinInput, setJoinInput] = useState("");

    const extractCode = (input) => {
        try {
            const url = new URL(input);
            return url.pathname.replace(/^\/|\/$/g, '');
        } catch {
            return input.trim();
        }
    };

    const handleJoin = () => {
        const code = extractCode(joinInput);
        if (code) navigate(`/${code}`);
    };

    return (
        <>
            <div className="navBar">
                <div style={{ display: "flex", alignItems: "center" }}>
                    <h2>MeetSync AI</h2>
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <Button onClick={() => navigate("/auth")}>
                        Sign In
                    </Button>
                </div>
            </div>

            <div className="meetContainer">
                <div className="leftPanel">
                    <div>
                        <h2>Join a Meeting</h2>

                        <div style={{ display: 'flex', gap: "10px", marginTop: '24px', alignItems: 'center' }}>
                            <TextField
                                onChange={e => setJoinInput(e.target.value)}
                                label="Paste link or enter code"
                                variant="outlined"
                                value={joinInput}
                                onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
                                sx={{ minWidth: 280 }}
                            />
                            <Button onClick={handleJoin} variant='contained'>Join</Button>
                        </div>
                    </div>
                </div>
                <div className='rightPanel'>
                    <img srcSet='/logo3.png' alt="" />
                </div>
            </div>
        </>
    )
}
