/**
 * HISTORY PAGE - history.jsx
 * Displays all past meetings the user has joined
 * Features:
 * - Fetches meeting history from backend on page load
 * - Displays meetings as cards with date and meeting code
 * - Home button to go back to dashboard
 * 
 * This page is protected (requires authentication)
 * Uses withAuth HOC to redirect to /auth if not logged in
 */

import React, { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom';
import withAuth from '../utils/withAuth';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import HomeIcon from '@mui/icons-material/Home';

import { IconButton, Box } from '@mui/material';

function History() {

    // Get function to fetch user's meeting history
    const { getHistoryOfUser } = useContext(AuthContext);

    // State to store list of meetings
    const [meetings, setMeetings] = useState([])

    const routeTo = useNavigate();

    // Fetch meeting history when component mounts
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await getHistoryOfUser();
                setMeetings(history);
            } catch {
                // IMPLEMENT SNACKBAR
            }
        }

        fetchHistory();
    }, [getHistoryOfUser])

    // Format date from ISO string to DD/MM/YYYY
    let formatDate = (dateString) => {

        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0")
        const year = date.getFullYear();

        return `${day}/${month}/${year}`

    }

    return (
        <div>

            <Box sx={{ px: 2, pt: 2 }}>
                <IconButton onClick={() => {
                    routeTo("/home")
                }}>
                    <HomeIcon />
                </IconButton >
            </Box>
            {
                (meetings.length !== 0) ? meetings.map((e, i) => {
                    return (

                        <>


                            <Card key={i} variant="outlined">


                                <CardContent>
                                    <Typography sx={{ fontSize: 14 }} color="text.secondary" gutterBottom>
                                        Code: {e.meetingCode}
                                    </Typography>

                                    <Typography sx={{ mb: 1.5 }} color="text.secondary">
                                        Date: {formatDate(e.date)}
                                    </Typography>

                                </CardContent>


                            </Card>


                        </>
                    )
                }) : <></>

            }

        </div>
    )
}

export default withAuth(History);
