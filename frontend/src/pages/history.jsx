/**
 * MEETING HISTORY PAGE
 * Displays persisted meetings available to the authenticated user.
 */

import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import withAuth from '../utils/withAuth';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Typography
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';

function formatDate(dateString) {
    if (!dateString) return 'Date unavailable';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return date.toLocaleString();
}

function getParticipants(meeting) {
    const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
    if (participants.length > 0) {
        return participants.map(participant => participant.name || participant.user_id).filter(Boolean);
    }
    return meeting.user_id ? [meeting.user_id] : [];
}

function History() {
    const { getHistoryOfUser, getMeetingDetails } = useContext(AuthContext);
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedMeeting, setSelectedMeeting] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState('');
    const routeTo = useNavigate();

    useEffect(() => {
        let active = true;
        const fetchHistory = async () => {
            setLoading(true);
            setError('');
            try {
                const history = await getHistoryOfUser();
                if (active) {
                    const sorted = [...(Array.isArray(history) ? history : [])]
                        .sort((a, b) => new Date(b.endedAt || b.date) - new Date(a.endedAt || a.date));
                    setMeetings(sorted);
                }
            } catch (err) {
                if (active) setError('Unable to load meeting history. Please try again.');
            } finally {
                if (active) setLoading(false);
            }
        };
        fetchHistory();
        return () => { active = false; };
    }, [getHistoryOfUser]);

    const openSummary = async (meeting) => {
        setSelectedMeeting(meeting);
        setDetailsError('');
        if (!getMeetingDetails) return;
        setDetailsLoading(true);
        try {
            const details = await getMeetingDetails(meeting.meetingCode);
            setSelectedMeeting(details);
        } catch (err) {
            setDetailsError('Unable to load this meeting summary.');
        } finally {
            setDetailsLoading(false);
        }
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <IconButton onClick={() => routeTo('/home')} aria-label="Back to home">
                    <HomeIcon />
                </IconButton>
                <Typography variant="h4" component="h1" sx={{ ml: 1 }}>
                    Meeting History
                </Typography>
            </Box>

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress aria-label="Loading meeting history" />
                </Box>
            )}
            {!loading && error && <Alert severity="error">{error}</Alert>}
            {!loading && !error && meetings.length === 0 && (
                <Alert severity="info">No saved meetings yet. End a meeting to see its summary here.</Alert>
            )}
            {!loading && !error && meetings.map((meeting) => {
                const participants = getParticipants(meeting);
                const preview = meeting.summaryPreview || meeting.summary?.executiveSummary;
                return (
                    <Card key={meeting.meetingCode} variant="outlined" sx={{ mb: 2 }}>
                        <CardContent>
                            <Typography variant="h6">{meeting.title || 'Weekly Strategy Sync'}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {formatDate(meeting.endedAt || meeting.date)} · Meeting {meeting.meetingCode}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                                Participants: {participants.length > 0 ? participants.join(', ') : 'Not available'}
                            </Typography>
                            <Typography variant="body1" sx={{ mt: 1 }}>
                                {preview || 'Summary not available yet.'}
                            </Typography>
                            <Button
                                sx={{ mt: 2 }}
                                variant="contained"
                                onClick={() => openSummary(meeting)}
                            >
                                View Summary
                            </Button>
                        </CardContent>
                    </Card>
                );
            })}

            <Dialog
                open={Boolean(selectedMeeting)}
                onClose={() => setSelectedMeeting(null)}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>{selectedMeeting?.title || 'Meeting Summary'}</DialogTitle>
                <DialogContent dividers>
                    {detailsLoading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress aria-label="Loading meeting summary" />
                        </Box>
                    )}
                    {!detailsLoading && detailsError && <Alert severity="error">{detailsError}</Alert>}
                    {!detailsLoading && !detailsError && selectedMeeting && (
                        <>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                {formatDate(selectedMeeting.endedAt || selectedMeeting.date)}
                            </Typography>
                            {selectedMeeting.summary?.executiveSummary ? (
                                <Typography sx={{ mt: 2 }}>{selectedMeeting.summary.executiveSummary}</Typography>
                            ) : (
                                <Alert severity="info" sx={{ mt: 2 }}>A summary was not saved for this meeting.</Alert>
                            )}
                            {['keyDiscussionPoints', 'decisionsTaken', 'actionItems', 'risks', 'nextSteps'].map((field) => (
                                selectedMeeting.summary?.[field]?.length > 0 && (
                                    <Box key={field} sx={{ mt: 2 }}>
                                        <Typography variant="h6">
                                            {field.replace(/([A-Z])/g, ' $1').replace(/^./, value => value.toUpperCase())}
                                        </Typography>
                                        <ul>
                                            {selectedMeeting.summary[field].map((item, index) => (
                                                <li key={`${field}-${index}`}><Typography>{item}</Typography></li>
                                            ))}
                                        </ul>
                                    </Box>
                                )
                            ))}
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelectedMeeting(null)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default withAuth(History);
