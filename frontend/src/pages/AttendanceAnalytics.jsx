import React, { useEffect, useState } from 'react';
import {
  Container, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Box, Card, CardContent, Chip,
  CircularProgress, Alert, Button, Grid, TextField
} from '@mui/material';
import {
  PieChart, Pie, Cell, Tooltip, Legend, XAxis, YAxis,
  CartesianGrid, ResponsiveContainer, LineChart, Line
} from 'recharts';
import server from '../environment';

const COLORS = {
  Present: '#2e7d32',
  Partial: '#ed6c02',
  Absent: '#d32f2f'
};

export default function AttendanceAnalytics() {
  const [ownerName, setOwnerName] = useState(() => localStorage.getItem('meetingOwnerName') || '');
  const [nameInput, setNameInput] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ownerName) fetchReports(ownerName);
  }, []);

  const fetchReports = async (name) => {
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
    fetchReports(trimmed);
  };

  // Compute stats
  const totalMeetings = reports.length;
  let totalParticipants = 0;
  let totalPresent = 0;
  let totalPartial = 0;
  let totalAbsent = 0;
  let sumPercent = 0;
  const barData = [];
  const lineData = [];

  const sorted = [...reports].sort((a, b) => new Date(a.date) - new Date(b.date));

  sorted.forEach((report, idx) => {
    const participants = report.participants || [];
    totalParticipants += participants.length;
    const present = participants.filter(p => p.status === 'Present').length;
    const partial = participants.filter(p => p.status === 'Partial').length;
    const absent = participants.filter(p => p.status === 'Absent').length;
    totalPresent += present;
    totalPartial += partial;
    totalAbsent += absent;

    const meetingAvg = participants.length > 0
      ? Math.round(participants.reduce((s, p) => s + (p.verifiedPercent || 0), 0) / participants.length)
      : 0;
    sumPercent += meetingAvg;

    const shortId = report.meetingId && report.meetingId.length > 8
      ? report.meetingId.slice(0, 8) + '...'
      : (report.meetingId || `#${idx + 1}`);

    const dateStr = new Date(report.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    barData.push({
      name: shortId,
      meetingId: report.meetingId,
      date: dateStr,
      avgPercent: meetingAvg,
      present,
      partial,
      absent,
      total: participants.length
    });

    lineData.push({
      date: dateStr,
      meetingLabel: shortId,
      avgPercent: meetingAvg,
      participants: participants.length
    });
  });

  const avgAttendance = totalMeetings > 0 ? Math.round(sumPercent / totalMeetings) : 0;

  const distributionData = [
    { name: 'Present', value: totalPresent },
    { name: 'Partial', value: totalPartial },
    { name: 'Absent', value: totalAbsent }
  ];

  const goodMeetings = barData.filter(d => d.avgPercent >= 75).length;
  const hasData = reports.length > 0;

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 1 }}>
        Attendance Analytics
      </Typography>

      {/* Inline name input bar */}
      {!ownerName && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 2 }}>
          <Typography variant="body2" color="text.secondary">
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

      {ownerName && !hasData && !loading && !error && (
        <Alert severity="info" sx={{ mb: 3 }}>
          No attendance data found for "{ownerName}".
          <Button size="small" sx={{ ml: 2 }} onClick={() => { localStorage.removeItem('meetingOwnerName'); setOwnerName(''); }}>Use a different name</Button>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
          <Button size="small" sx={{ ml: 2 }} onClick={() => fetchReports(ownerName)}>Retry</Button>
        </Alert>
      )}

      {hasData && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Across {totalMeetings} meeting{totalMeetings !== 1 ? 's' : ''} · {totalParticipants} total participant{totalParticipants !== 1 ? 's' : ''}
        </Typography>
      )}

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Loading analytics...</Typography>
        </Box>
      ) : hasData ? (
        <>
          {/* Stat Cards */}
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#e8f5e9' }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#2e7d32' }}>{totalMeetings}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Meetings</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#e3f2fd' }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#1565c0' }}>{avgAttendance}%</Typography>
                  <Typography variant="body2" color="text.secondary">Avg Attendance Rate</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#fff3e0' }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#e65100' }}>{goodMeetings}/{totalMeetings}</Typography>
                  <Typography variant="body2" color="text.secondary">Meetings ≥ 75% Attendance</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ bgcolor: '#f3e5f5' }}>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', color: '#6a1b9a' }}>{totalParticipants}</Typography>
                  <Typography variant="body2" color="text.secondary">Total Participants</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Charts Row */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={5}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Attendance Distribution</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={distributionData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value">
                        {distributionData.map((entry, idx) => (
                          <Cell key={idx} fill={COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [value, name]} />
                      <Legend formatter={(value) => {
                        const item = distributionData.find(d => d.name === value);
                        const total = distributionData.reduce((s, d) => s + d.value, 0);
                        const pct = total && item ? ((item.value / total) * 100).toFixed(0) : 0;
                        return `${value} (${pct}%)`;
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={7}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>Attendance Trend Over Time</Typography>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="avgPercent" name="Avg Attendance %" stroke="#1565c0" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Detailed Table */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Meeting Details</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Meeting</strong></TableCell>
                      <TableCell><strong>Date</strong></TableCell>
                      <TableCell align="center"><strong>Participants</strong></TableCell>
                      <TableCell align="center"><strong>Avg %</strong></TableCell>
                      <TableCell align="center"><strong>Present</strong></TableCell>
                      <TableCell align="center"><strong>Partial</strong></TableCell>
                      <TableCell align="center"><strong>Absent</strong></TableCell>
                      <TableCell align="center"><strong>Verdict</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {barData.map((row, idx) => {
                      const verdict = row.avgPercent >= 75 ? 'Good' : row.avgPercent >= 50 ? 'Average' : 'Poor';
                      return (
                        <TableRow key={idx}>
                          <TableCell>{row.meetingId || '—'}</TableCell>
                          <TableCell>{row.date}</TableCell>
                          <TableCell align="center">{row.total}</TableCell>
                          <TableCell align="center">{row.avgPercent}%</TableCell>
                          <TableCell align="center">
                            <Chip label={row.present} color="success" size="small" sx={{ minWidth: 40 }} />
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={row.partial} color="warning" size="small" sx={{ minWidth: 40 }} />
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={row.absent} color="error" size="small" sx={{ minWidth: 40 }} />
                          </TableCell>
                          <TableCell align="center">
                            <Chip label={verdict} color={verdict === 'Good' ? 'success' : verdict === 'Average' ? 'warning' : 'error'} size="small" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      ) : null}
    </Container>
  );
}
