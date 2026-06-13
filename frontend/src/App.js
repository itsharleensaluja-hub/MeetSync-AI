/**
 * FRONTEND ENTRY POINT - App.js
 * Main React application component that:
 * 1. Sets up routing for different pages
 * 2. Wraps app with AuthContext provider for global authentication state
 * 3. Defines all application routes
 * 
 * ROUTES:
 * / - Landing page (welcome screen)
 * /auth - Login/Register page
 * /home - Dashboard after login (create/join meeting)
 * /history - View past meetings
 * /:url - Video meeting room (dynamic meeting code)
 */

import './App.css';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import LandingPage from './pages/landing';
import Authentication from './pages/authentication';
import { AuthProvider } from './contexts/AuthContext';
import VideoMeetComponent from './pages/VideoMeet';
import HomeComponent from './pages/home';
import History from './pages/history';
import AttendanceHistory from './pages/AttendanceHistory';

function App() {
  return (
    <div className="App">

      <Router>
        {/* AuthProvider wraps entire app to provide authentication functions globally */}
        <AuthProvider>


          <Routes>
            {/* Landing page - first page users see */}
            <Route path='/' element={<LandingPage />} />

            {/* Authentication page - login/register */}
            <Route path='/auth' element={<Authentication />} />

            {/* Home dashboard - create or join meetings (requires login) */}
            <Route path='/home' element={<HomeComponent />} />
            
            {/* Meeting history page (requires login) */}
            <Route path='/history' element={<History />} />
            
            {/* Attendance history page (requires login) */}
            <Route path='/attendance-history' element={<AttendanceHistory />} />
            
            {/* Video meeting room - :url is the meeting code */}
            <Route path='/:url' element={<VideoMeetComponent />} />
          </Routes>
        </AuthProvider>

      </Router>
    </div>
  );
}

export default App;
