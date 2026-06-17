import React, { useEffect, useState } from 'react';
import { 
  Container, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Box, Card, CardContent, Chip,
  CircularProgress, Alert, Button, Collapse, IconButton, TextField
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import server from '../environment';

export default function AttendanceHistory() {
  const [ownerName, setOwnerName] = useState(() => localStorage.getItem('meetingOwnerName') || '');
  const [nameInput, setNameInput] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedReports, setExpandedReports] = useState({});

  useEffect(() => {
    if (ownerName) fetchAttendanceReports(ownerName);
  }, []);

  const fetchAttendanceReports = async (name) => {
    if (!name) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${server}/api/v1/attendance/owner/${encodeURIComponent(name)}`);
      const data = await response.json();

      if (data.success) {
        setReports(data.data);
        if (data.count === 0) setError(null);
      } else {
        setError(data.message || 'Failed to fetch reports');
      }
    } catch (err) {
      console.error('Error fetching attendance reports:', err);
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    localStorage.setItem('meetingOwnerName', trimmed);
    setOwnerName(trimmed);
    setNameInput('');
    fetchAttendanceReports(trimmed);
  };

  const toggleExpand = (reportId) => {
    setExpandedReports(prev => ({ ...prev, [reportId]: !prev[reportId] }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'success';
      case 'Partial': return 'warning';
      case 'Absent': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleString();

  const calculateSummary = (participants) => {
    const present = participants.filter(p => p.status === 'Present').length;
    const partial = participants.filter(p => p.status === 'Partial').length;
    const absent = participants.filter(p => p.status === 'Absent').length;
    return { present, partial, absent, total: participants.length };
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        My Meeting Attendance Reports
      </Typography>

      {!ownerName && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0 }}>
            Enter the name you used in the meeting:
          </Typography>
          <TextField
            label="Your display name"
            variant="outlined"
            size="small"
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmitName(); }}
            sx={{ minWidth: 200 }}
          />
          <Button variant="contained" size="small" onClick={handleSubmitName}>View</Button>
        </Box>
      )}

      {loading && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Loading attendance reports...</Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
          <Button size="small" sx={{ ml: 2 }} onClick={() => fetchAttendanceReports(ownerName)}>Retry</Button>
        </Alert>
      )}

      {ownerName && !loading && !error && reports.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No attendance reports found for "{ownerName}".
          <Button size="small" sx={{ ml: 2 }} onClick={() => { localStorage.removeItem('meetingOwnerName'); setOwnerName(''); }}>Use a different name</Button>
        </Alert>
      )}

      {!loading && reports.length > 0 && (
        <Box>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Showing {reports.length} meeting report{reports.length !== 1 ? 's' : ''}
          </Typography>

          {reports.map((report) => {
            const summary = calculateSummary(report.participants);
            const isExpanded = expandedReports[report._id];

            return (
              <Card key={report._id} sx={{ mb: 3 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        Meeting: {report.meetingId}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Date: {formatDate(report.date)}
                      </Typography>
                      {report.startTime && report.endTime && (
                        <Typography variant="body2" color="text.secondary">
                          Duration: {formatDate(report.startTime)} - {formatDate(report.endTime)}
                        </Typography>
                      )}
                      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                        <Chip label={`${summary.present} Present`} color="success" size="small" />
                        <Chip label={`${summary.partial} Partial`} color="warning" size="small" />
                        <Chip label={`${summary.absent} Absent`} color="error" size="small" />
                        <Chip label={`${summary.total} Total`} variant="outlined" size="small" />
                      </Box>
                    </Box>
                    <IconButton onClick={() => toggleExpand(report._id)}>
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>

                  <Collapse in={isExpanded}>
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Participant Details:
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell><strong>User</strong></TableCell>
                              <TableCell align="center"><strong>Verified %</strong></TableCell>
                              <TableCell align="center"><strong>Total Time (s)</strong></TableCell>
                              <TableCell align="center"><strong>Verified Time (s)</strong></TableCell>
                              <TableCell align="center"><strong>Status</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {report.participants.map((participant, idx) => (
                              <TableRow key={idx}>
                                <TableCell>{participant.name}</TableCell>
                                <TableCell align="center">{participant.verifiedPercent}%</TableCell>
                                <TableCell align="center">{participant.totalTime || 'N/A'}</TableCell>
                                <TableCell align="center">{participant.verifiedTime || 'N/A'}</TableCell>
                                <TableCell align="center">
                                  <Chip label={participant.status} color={getStatusColor(participant.status)} size="small" />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>Attendance Criteria:</Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>✅ <strong>Present:</strong> Face detected ≥ 75% of time</Typography>
                        <Typography variant="body2" sx={{ mb: 0.5 }}>⚠️ <strong>Partial:</strong> Face detected ≥ 50% but &lt; 75% of time</Typography>
                        <Typography variant="body2">❌ <strong>Absent:</strong> Face detected &lt; 50% of time</Typography>
                      </Box>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Container>
  );
}
