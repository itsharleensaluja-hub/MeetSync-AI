/**
 * LANDING PAGE - landing.jsx
 * The first page users see when visiting the app
 * Features:
 * - Navigation bar with Login/Register buttons
 * - "Join as Guest" option (goes to a test meeting)
 * - Hero section with call-to-action
 * 
 * This page is public (no authentication required)
 */

import React from 'react'
import "../App.css"
import { Link, useNavigate } from 'react-router-dom'

export default function LandingPage() {

    const router = useNavigate();

    return (
        <div className='landingPageContainer'>
            {/* Navigation Bar */}
            <nav>
                <div className='navHeader'>
                    <h2>MeetSync AI</h2>
                </div>
                <div className='navlist'>
                    {/* Join as guest - goes to meeting join page */}
                    <p onClick={() => {
                        router("/join")
                    }}>Join as Guest</p>
                    
                    {/* Go to registration page */}
                    <p onClick={() => {
                        router("/auth")
                    }}>Register</p>
                    
                    {/* Go to login page */}
                    <div onClick={() => {
                        router("/auth")
                    }} role='button'>
                        <p>Login</p>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <div className="landingMainContainer">
                <div>
                    <h1><span style={{ color: "#FF9839" }}>Smart Meetings</span> for Modern Teams</h1>

                    <p>AI-powered attendance, real-time polling, and secure collaboration</p>
                    <div role='button'>
                        <Link to={"/auth"}>Get Started</Link>
                    </div>
                </div>
                <div>
                    {/* Hero image */}
                    <img src="/mobile.png" alt="" />
                </div>
            </div>

        </div>
    )
}
