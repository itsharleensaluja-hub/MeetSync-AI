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
import withAuth from '../utils/withAuth' // Higher-order component for authentication check
import { useNavigate } from 'react-router-dom'
import "../App.css";
import { Button, IconButton, TextField } from '@mui/material';
import RestoreIcon from '@mui/icons-material/Restore'; // History icon
import BarChartIcon from '@mui/icons-material/BarChart'; // Analytics icon
import { AuthContext } from '../contexts/AuthContext';

function HomeComponent() {

    let navigate = useNavigate();
    // State to store the meeting code entered by user
    const [meetingCode, setMeetingCode] = useState("");

    // Get function to save meeting to history
    const {addToUserHistory} = useContext(AuthContext);
    
    // Handle joining a video call
    let handleJoinVideoCall = async () => {
        // Save this meeting to user's history
        await addToUserHistory(meetingCode)
        // Navigate to the video meeting page with the meeting code as URL parameter
        navigate(`/${meetingCode}`)
    }

    return (
        <>
            {/* Navigation Bar */}
            <div className="navBar">

                <div style={{ display: "flex", alignItems: "center" }}>
                    <h2>MeetSync AI</h2>
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                    {/* History button - shows past meetings */}
                    <IconButton onClick={() => navigate("/history")}>
                        <RestoreIcon />
                    </IconButton>
                    <p>History</p>

                    {/* Analytics button - shows attendance dashboard */}
                    <IconButton onClick={() => navigate("/attendance-analytics")}>
                        <BarChartIcon />
                    </IconButton>
                    <p>Analytics</p>

                    {/* Logout button - clears token and redirects to auth page */}
                    <Button onClick={() => {
                        localStorage.removeItem("token") // Clear authentication token
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

                        <div style={{ display: 'flex', gap: "10px" }}>
                            {/* Input field for meeting code */}
                            <TextField onChange={e => setMeetingCode(e.target.value)} id="outlined-basic" label="Meeting Code" variant="outlined" />
                            {/* Join button */}
                            <Button onClick={handleJoinVideoCall} variant='contained'>Join</Button>
                        </div>
                    </div>
                </div>
                {/* Right panel with image */}
                <div className='rightPanel'>
                    <img srcSet='/logo3.png' alt="" />
                </div>
            </div>
        </>
    )
}

// Wrap component with authentication check
// If user is not logged in, they'll be redirected to /auth
export default withAuth(HomeComponent)