/**
 * VIDEO MEET COMPONENT - VideoMeet.jsx (FINAL FIXED)
 */

import * as faceapi from '@vladmandic/face-api';
import {
  Modal,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Card,
  CardContent,
  Chip,
} from '@mui/material';
import { AuthContext } from '../contexts/AuthContext';

import React, { useEffect, useRef, useState, useContext } from 'react';
import io from 'socket.io-client';
import { Badge, IconButton, TextField } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import styles from '../styles/videoComponent.module.css';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import SentimentSatisfiedIcon from '@mui/icons-material/SentimentSatisfied';
import PanToolIcon from '@mui/icons-material/PanTool';
import server from '../environment';

const server_url = server;

let connections = {};
let iceCandidateQueue = {}; // Queue ICE candidates until remote description is set

const peerConfigConnections = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10
};

// tiny face detector options (recommended for webcam) [web:24]
const tinyOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.5,
});

// const waitForVideoReady = (videoEl, timeoutMs = 10000) =>
//   new Promise((resolve, reject) => {
//     const start = Date.now();
//     const check = () => {
//       if (
//         videoEl &&
//         videoEl.readyState >= 2 &&
//         videoEl.videoWidth > 0 &&
//         videoEl.videoHeight > 0
//       ) {
//         resolve(true);
//       } else if (Date.now() - start > timeoutMs) {
//         reject(new Error('Video not ready in time'));
//       } else {
//         requestAnimationFrame(check);
//       }
//     };
//     check();
//   });

export default function VideoMeetComponent() {
  // Refs
  const socketRef = useRef();
  const socketIdRef = useRef();
  const localVideoref = useRef();  // main in‑call video
  const lobbyVideoRef = useRef();  // lobby preview
  const modalVideoRef = useRef();  // enrollment video

  // Core states
  const [videoAvailable, setVideoAvailable] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(true);
  const [screen, setScreen] = useState(false);
  const [screenAvailable, setScreenAvailable] = useState(false);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [newMessages, setNewMessages] = useState(0);
  const [askForUsername, setAskForUsername] = useState(true);
  const [username, setUsername] = useState('');
  const [videos, setVideos] = useState([]);

  // Attendance states
  const { userId = 'guest' } = useContext(AuthContext) || {};
  const [showEnrollmentModal, setShowEnrollmentModal] = useState(false);
  const [faceDescriptor, setFaceDescriptor] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [attendanceReport, setAttendanceReport] = useState(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isMeetingOwner, setIsMeetingOwner] = useState(false);
  const [ownerReportReceived, setOwnerReportReceived] = useState(false);
  const [liveAttendance, setLiveAttendance] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  
  // Polls & Decisions state
  const [polls, setPolls] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [decisionText, setDecisionText] = useState('');

  // Reactions state
  const [reactions, setReactions] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Hand raise state
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHandUsers, setRaisedHandUsers] = useState([]);
  const [participantList, setParticipantList] = useState([]);

  // Transcript & Summary state
  const [transcript, setTranscript] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [transcriptLang, setTranscriptLang] = useState('en-US');
  const [aiSummary, setAiSummary] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [transcriptError, setTranscriptError] = useState('');
  const [transcriptLoading, setTranscriptLoading] = useState('');
  const [manualTranscriptText, setManualTranscriptText] = useState('');
  const mediaRecorderRef = useRef(null);
  const isRecordingRef = useRef(false);
  const flushTimerRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const transformersPipelineRef = useRef(null);
  const speechStreamRef = useRef(null);
  const speechWatchdogRef = useRef(null);
  const permissionsPromiseRef = useRef(null);

  // Ensure local video element gets srcObject whenever video is on
  useEffect(() => {
    if (video && localVideoref.current && window.localStream) {
      localVideoref.current.srcObject = window.localStream;
    }
  }, [video]);

  const EMOJIS = ['😂', '👍', '❤️', '😮', '😢', '🎉', '🔥', '👏'];
  
  // Generate unique user ID for this session
  const [uniqueUserId] = useState(() => {
    const stored = sessionStorage.getItem('uniqueUserId');
    if (stored) return stored;
    const id = `${username || 'user'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('uniqueUserId', id);
    return id;
  });

  // separate stream for modal so it never depends on others
  const modalStreamRef = useRef(null);

  // Extract just the room code from URL path (e.g., "/abc123" -> "abc123")
  const meetingCode = window.location.pathname.substring(1) || 'unknown-room';

  // Load face-api models from CDN [web:52]
  useEffect(() => {
    const loadModels = async () => {
      console.log('Loading face-api models from CDN...');
      const modelUrl =
        'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(modelUrl);
        await faceapi.nets.faceLandmark68Net.loadFromUri(modelUrl);
        await faceapi.nets.faceRecognitionNet.loadFromUri(modelUrl);
        console.log('All models loaded!');
        setModelsLoaded(true);
      } catch (err) {
        console.error('Failed to load models:', err);
      }
    };
    loadModels();
  }, []);
  
  // debug: stop other streams when enrollment modal opens
  useEffect(() => {
  if (showEnrollmentModal) {
    console.log('Stopping other camera streams before enrollment');

    if (window.localStream) {
      window.localStream.getTracks().forEach(t => t.stop());
      window.localStream = null;
    }
    getPermissions();
  }
}, [showEnrollmentModal]);


  // Always request a fresh camera stream for the enrollment modal
  useEffect(() => {
  if (!showEnrollmentModal) return;

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });

      modalStreamRef.current = stream;

      // VERY IMPORTANT: wait one frame so video exists
      requestAnimationFrame(() => {
        if (modalVideoRef.current) {
          modalVideoRef.current.srcObject = stream;

          modalVideoRef.current.onloadedmetadata = () => {
            modalVideoRef.current.play();
            console.log('Enrollment video ready');
          };
        }
      });
    } catch (err) {
      console.error('Enrollment camera error:', err);
      alert('Camera access failed');
    }
  };

  startCamera();

  return () => {
    if (modalStreamRef.current) {
      modalStreamRef.current.getTracks().forEach(t => t.stop());
      modalStreamRef.current = null;
    }
  };
}, [showEnrollmentModal]);


 // Face Enrollment (FIXED – FINAL)
const enrollFace = async () => {
  if (!modelsLoaded) {
    alert('AI model still loading...');
    return;
  }

  const videoEl = modalVideoRef.current;

  if (
    !videoEl ||
    !videoEl.srcObject ||
    videoEl.videoWidth === 0 ||
    videoEl.videoHeight === 0
  ) {
    alert('Camera not ready yet. Please wait 2 seconds.');
    return;
  }

  console.log('=== ENROLL DEBUG ===');
  console.log('readyState:', videoEl.readyState);
  console.log('videoWidth:', videoEl.videoWidth);
  console.log('videoHeight:', videoEl.videoHeight);
  console.log('====================');

  try {
    const detection = await faceapi
      .detectSingleFace(videoEl, tinyOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      alert('No face detected. Please look directly at the camera.');
      return;
    }

    const descriptor = Array.from(detection.descriptor);

    if (socketRef.current) {
      socketRef.current.emit('register-face', {
        meetingId: window.location.pathname.slice(1),
        userId: uniqueUserId,
        descriptor,
      });
    }

    setFaceDescriptor(descriptor);
    setShowEnrollmentModal(false);
    alert(`✅ Face registered for ${username}! Attendance tracking started.`);
  } catch (error) {
    console.error('Enrollment error:', error);
    alert('Error capturing face. Please try again.');
  }
};


  // Real-time verification using main local video
  useEffect(() => {
    if (!modelsLoaded || !faceDescriptor || !socketRef.current) {
      console.log('⏸️ Attendance tracking not started yet:', {
        modelsLoaded,
        hasFaceDescriptor: !!faceDescriptor,
        hasSocket: !!socketRef.current
      });
      return;
    }

    console.log('🎯 Starting attendance tracking for:', userId || username || 'guest');

    const interval = setInterval(async () => {
      const videoEl = localVideoref.current;
      const hasLiveVideo = window.localStream?.getVideoTracks().some(t => t.readyState === 'live');
      if (
        !videoEl ||
        !videoEl.srcObject ||
        !hasLiveVideo
      ) {
        console.log('⚠️ Video not ready — reporting 0 verified time');
        socketRef.current?.emit('verified-update', {
          meetingId: meetingCode,
          userId: uniqueUserId,
          userName: username,
          verifiedDelta: 0,
        });
        return;
      }

      try {
        const detection = await faceapi
          .detectSingleFace(localVideoref.current, tinyOptions)
          .withFaceLandmarks()
          .withFaceDescriptor();

        let verifiedDelta = 0;
        if (detection) {
          const distance = faceapi.euclideanDistance(
            detection.descriptor,
            faceDescriptor,
          );
          if (1 - distance > 0.6) {
            verifiedDelta = 10;
            console.log('✅ Face detected! Confidence:', (1 - distance).toFixed(2));
          } else {
            console.log('⚠️ Face detected but confidence too low:', (1 - distance).toFixed(2));
          }
        } else {
          console.log('❌ No face detected in frame');
        }

        console.log('📤 Sending verified-update:', {
          meetingId: meetingCode,
          userId: uniqueUserId,
          userName: username,
          verifiedDelta
        });

        socketRef.current.emit('verified-update', {
          meetingId: meetingCode,
          userId: uniqueUserId,
          userName: username,
          verifiedDelta,
        });
      } catch (e) {
        console.log('❌ Verification error:', e);
      }
    }, 10000);

    return () => {
      console.log('🛑 Stopping attendance tracking');
      clearInterval(interval);
    };
  }, [modelsLoaded, faceDescriptor, meetingCode, userId, username, socketRef.current]);

  // Show enrollment after username
  useEffect(() => {
    if (!askForUsername && modelsLoaded && !faceDescriptor) {
      setShowEnrollmentModal(true);
      
      // Request notification permission for owner
      if (isMeetingOwner && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('Notification permission:', permission);
        });
      }
    }
  }, [askForUsername, modelsLoaded, faceDescriptor, isMeetingOwner]);

  // === CORE WEBRTC & MEDIA FUNCTIONS ===
  const getPermissions = async () => {
    try {
      console.log('🎥 Requesting camera and microphone permissions...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      window.localStream = stream;
      
      // Enable audio and video tracks by default
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      console.log('✅ Got', audioTracks.length, 'audio track(s) and', videoTracks.length, 'video track(s)');
      
      audioTracks.forEach((track, idx) => {
        track.enabled = true;
        console.log(`🎤 Audio Track ${idx}:`, track.label, '- Enabled:', track.enabled);
      });
      videoTracks.forEach((track, idx) => {
        track.enabled = true;
        console.log(`🎥 Video Track ${idx}:`, track.label, '- Enabled:', track.enabled);
      });
      
      if (localVideoref.current) localVideoref.current.srcObject = stream;
      if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = stream;
      setVideoAvailable(true);
      setAudioAvailable(true);
      setAudio(true);  // Enable audio by default
      setVideo(true);  // Enable video by default
      console.log('✅ Media permissions granted and tracks enabled');
      console.log('🎤 Audio tracks:', stream.getAudioTracks().map(t => ({ label: t.label, enabled: t.enabled })));
      console.log('🎥 Video tracks:', stream.getVideoTracks().map(t => ({ label: t.label, enabled: t.enabled })));
      console.log('🔊 window.localStream set with', stream.getAudioTracks().length, 'audio tracks');
      attachLocalStreamToExistingConnections();
      if (navigator.mediaDevices.getDisplayMedia) setScreenAvailable(true);
    } catch (err) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        window.localStream = videoStream;
        videoStream.getVideoTracks().forEach(track => track.enabled = true);
        if (localVideoref.current) localVideoref.current.srcObject = videoStream;
        if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = videoStream;
        setVideoAvailable(true);
        setAudioAvailable(false);
      } catch (e) {
        setVideoAvailable(false);
        setAudioAvailable(false);
      }
    }
  };

  useEffect(() => {
    permissionsPromiseRef.current = getPermissions();
  }, []);

  // debug: get media when joining from lobby
  const getMedia = async () => {
    console.log('📡 Waiting for media permissions...');
    if (permissionsPromiseRef.current) {
      await permissionsPromiseRef.current;
    }
    if (!window.localStream) {
      console.error('❌ Media permissions denied. Cannot join meeting.');
      return;
    }
    console.log('✅ Media ready. Connecting to socket server...');
    console.log('🎤 Audio tracks:', window.localStream.getAudioTracks().length);
    connectToSocketServer();
  };

  const attachLocalStreamToExistingConnections = () => {
    if (!window.localStream) return;
    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      const senders = connections[id].getSenders();
      const hasAudio = senders.some(s => s.track?.kind === 'audio');
      const hasVideo = senders.some(s => s.track?.kind === 'video');
      if (hasAudio && hasVideo) continue;
      console.log(`🔗 Attaching late local tracks to ${id}`);
      window.localStream.getTracks().forEach(track => {
        const kind = track.kind;
        const existing = senders.find(s => s.track?.kind === kind);
        if (existing) {
          existing.replaceTrack(track);
        } else {
          connections[id].addTrack(track, window.localStream);
        }
      });
      if (connections[id].signalingState === 'stable') {
        connections[id].createOffer()
          .then(d => connections[id].setLocalDescription(d))
          .then(() => {
            socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
          })
          .catch(err => console.error('Error renegotiating after late track attach:', err));
      }
    }
  };

  const getUserMedia = () => {
    if ((video && videoAvailable) || (audio && audioAvailable)) {
      const constraints = {
        video: video && videoAvailable ? {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false,
        audio: audio && audioAvailable ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      };
      console.log('🎤 getUserMedia constraints:', constraints);
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then(getUserMediaSuccess)
        .catch(e => {
          console.error('❌ getUserMedia error:', e);
          alert('Failed to access camera/microphone: ' + e.message);
        });
    } else {
      try {
        if (localVideoref.current && localVideoref.current.srcObject) {
          localVideoref.current.srcObject
            .getTracks()
            .forEach(t => t.stop());
        }
      } catch (e) {
        console.log('Error stopping tracks:', e);
      }
    }
  };

  const getUserMediaSuccess = stream => {
    // Only stop and replace if we're getting a completely new stream
    const hasExistingStream = window.localStream && window.localStream.active;
    
    if (hasExistingStream) {
      console.log('🔄 Replacing existing stream');
      try {
        window.localStream.getTracks().forEach(t => t.stop());
      } catch (e) {
        console.error('Error stopping old tracks:', e);
      }
    }
    
    window.localStream = stream;
    
    // Log all tracks we received
    console.log('📦 getUserMediaSuccess - Received tracks:', {
      audio: stream.getAudioTracks().length,
      video: stream.getVideoTracks().length
    });
    
    // CRITICAL: Always enable tracks at the stream level for WebRTC transmission
    // The UI toggle only controls track.enabled, not stream capture
    stream.getAudioTracks().forEach((track, idx) => {
      track.enabled = true; // MUST be true for WebRTC transmission
      console.log(`🎤 Audio track ${idx}: ${track.label} - Enabled: ${track.enabled} - ReadyState: ${track.readyState}`);
    });
    
    stream.getVideoTracks().forEach((track, idx) => {
      track.enabled = true; // MUST be true initially
      console.log(`🎥 Video track ${idx}: ${track.label} - Enabled: ${track.enabled} - ReadyState: ${track.readyState}`);
    });
    
    if (stream.getAudioTracks().length === 0) {
      console.warn('⚠️ WARNING: No audio tracks in stream! Microphone may not be working.');
    }
    
    // Now set the UI state to match (audio and video should start as enabled)
    setAudio(true);
    setVideo(true);
    
    if (localVideoref.current) localVideoref.current.srcObject = stream;
    if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = stream;

    // Update existing peer connections with new stream tracks
    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      
      try {
        // For legacy browsers, try addStream
        if (connections[id].addStream) {
          connections[id].addStream(stream);
        } else {
          // Modern approach: add each track
          stream.getTracks().forEach(track => {
            connections[id].addTrack(track, stream);
          });
        }
        
        // Renegotiate the connection
        connections[id].createOffer().then(d => {
          connections[id].setLocalDescription(d).then(() => {
            socketRef.current.emit(
              'signal',
              id,
              JSON.stringify({ sdp: connections[id].localDescription }),
            );
          });
        });
      } catch (err) {
        console.error(`Error updating peer connection ${id}:`, err);
      }
    }
  };

  // Store the original camera stream to restore after screen share
  const cameraStreamRef = useRef(null);

  const getDislayMedia = () => {
    if (screen && navigator.mediaDevices.getDisplayMedia) {
      navigator.mediaDevices
        .getDisplayMedia({ video: true, audio: false }) // Screen share video only
        .then(getDislayMediaSuccess)
        .catch(e => {
          console.log('Screen share cancelled or error:', e);
          setScreen(false); // Reset screen state if user cancels
        });
    } else if (!screen && cameraStreamRef.current) {
      // Screen share turned OFF - restore camera stream
      restoreCameraStream();
    }
  };

  const restoreCameraStream = async () => {
    try {
      console.log('🎥 Restoring camera stream after screen share...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      
      window.localStream = stream;
      stream.getAudioTracks().forEach(t => { t.enabled = audio; });
      stream.getVideoTracks().forEach(t => { t.enabled = video; });
      
      if (localVideoref.current) localVideoref.current.srcObject = stream;
      
      // Update peer connections
      for (let id in connections) {
        if (id === socketIdRef.current) continue;
        try {
          const senders = connections[id].getSenders();
          stream.getTracks().forEach(track => {
            const sender = senders.find(s => s.track?.kind === track.kind);
            if (sender) {
              sender.replaceTrack(track);
            } else {
              connections[id].addTrack(track, stream);
            }
          });
        } catch (err) {
          console.error('Error restoring stream to peer:', err);
        }
      }
      console.log('✅ Camera restored with', stream.getAudioTracks().length, 'audio,', stream.getVideoTracks().length, 'video tracks');
    } catch (err) {
      console.error('Failed to restore camera:', err);
    }
  };

  const getDislayMediaSuccess = stream => {
    // Save current camera stream before replacing
    if (window.localStream) {
      cameraStreamRef.current = window.localStream;
      // Only stop VIDEO tracks, keep audio running
      window.localStream.getVideoTracks().forEach(t => t.stop());
    }
    
    // Create a new stream combining screen video + existing audio
    const combinedStream = new MediaStream();
    
    // Add screen share video track
    stream.getVideoTracks().forEach(track => {
      combinedStream.addTrack(track);
    });
    
    // Add existing audio track (microphone)
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getAudioTracks().forEach(track => {
        combinedStream.addTrack(track);
        console.log('🎤 Preserved audio track during screen share:', track.label);
      });
    }
    
    window.localStream = combinedStream;
    if (localVideoref.current) localVideoref.current.srcObject = combinedStream;
    
    // When screen share stops (user clicks browser stop button), restore camera
    stream.getVideoTracks()[0].onended = () => {
      console.log('🖥️ Screen share ended by user');
      setScreen(false);
      restoreCameraStream();
    };

    // Update peer connections with the combined stream (screen video + mic audio)
    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      try {
        const senders = connections[id].getSenders();
        combinedStream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
            console.log(`🔄 Replaced ${track.kind} track for peer ${id}`);
          } else {
            connections[id].addTrack(track, combinedStream);
            console.log(`➕ Added ${track.kind} track for peer ${id}`);
          }
        });
      } catch (err) {
        console.error('Error updating peer with screen share:', err);
      }
    }
    
    console.log('✅ Screen share started with', combinedStream.getAudioTracks().length, 'audio,', combinedStream.getVideoTracks().length, 'video tracks');
  };

  // Only start screen share when screen becomes true (not on mount or when turning off)
  const prevScreenRef = useRef(screen);
  useEffect(() => {
    if (screen === true && prevScreenRef.current === false) {
      getDislayMedia();
    }
    prevScreenRef.current = screen;
  }, [screen]);

  const gotMessageFromServer = async (fromId, message) => {
    const signal = JSON.parse(message);
    if (fromId !== socketIdRef.current) {
      if (signal.sdp) {
        const peerConnection = connections[fromId];
        if (!peerConnection) {
          console.warn(`⚠️ No peer connection for ${fromId}, ignoring signal`);
          return;
        }

        const currentState = peerConnection.signalingState;
        console.log(`📡 Received ${signal.sdp.type} from ${fromId}, current state: ${currentState}`);

        // Handle offer collision - determine who backs off
        const isPolite = socketIdRef.current < fromId; // Lower socket ID is "polite"
        const offerCollision = signal.sdp.type === 'offer' && (currentState === 'have-local-offer' || currentState === 'stable');
        
        const ignoreOffer = !isPolite && offerCollision && currentState === 'have-local-offer';
        if (ignoreOffer) {
          console.warn(`⏭️ Offer collision: I'm impolite, ignoring offer from ${fromId}`);
          return;
        }

        // If we have a local offer but received an offer and we're polite, rollback
        if (isPolite && offerCollision && currentState === 'have-local-offer') {
          console.log(`🔄 I'm polite, rolling back my offer to accept offer from ${fromId}`);
          try {
            await peerConnection.setLocalDescription({type: 'rollback'});
          } catch (e) {
            console.error('Rollback failed:', e);
          }
        }

        peerConnection
          .setRemoteDescription(new RTCSessionDescription(signal.sdp))
          .then(() => {
            console.log(`✅ Set remote ${signal.sdp.type} from ${fromId}, new state: ${peerConnection.signalingState}`);
            
            // Process queued ICE candidates now that remote description is set
            if (iceCandidateQueue[fromId] && iceCandidateQueue[fromId].length > 0) {
              console.log(`🧊 Processing ${iceCandidateQueue[fromId].length} queued ICE candidates for ${fromId}`);
              iceCandidateQueue[fromId].forEach(ice => {
                peerConnection.addIceCandidate(new RTCIceCandidate(ice))
                  .catch(err => console.error('❌ Error adding queued ICE candidate:', err));
              });
              iceCandidateQueue[fromId] = [];
            }
            
            if (signal.sdp.type === 'offer') {
              return peerConnection.createAnswer();
            }
          })
          .then(desc => {
            if (desc) {
              return peerConnection.setLocalDescription(desc);
            }
          })
          .then(() => {
            if (signal.sdp.type === 'offer') {
              console.log(`📤 Sending answer to ${fromId}`);
              socketRef.current.emit(
                'signal',
                fromId,
                JSON.stringify({
                  sdp: peerConnection.localDescription,
                }),
              );
            }
          })
          .catch(err => {
            console.error(`❌ Error handling ${signal.sdp.type} from ${fromId}:`, err);
          });
      }
      
      if (signal.ice) {
        const peerConnection = connections[fromId];
        if (peerConnection) {
          // Check if remote description is set
          if (peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
            // Remote description is set, add ICE candidate immediately
            peerConnection.addIceCandidate(new RTCIceCandidate(signal.ice))
              .then(() => console.log(`🧊 Added ICE candidate from ${fromId}`))
              .catch(err => console.error('❌ Error adding ICE candidate:', err));
          } else {
            // Remote description not set yet, queue the ICE candidate
            if (!iceCandidateQueue[fromId]) {
              iceCandidateQueue[fromId] = [];
            }
            iceCandidateQueue[fromId].push(signal.ice);
            console.log(`⏳ Queued ICE candidate from ${fromId} (waiting for remote description)`);
          }
        }
      }
    }
  };

  const connectToSocketServer = () => {
    const isProduction = server_url.includes('https');
    socketRef.current = io.connect(server_url, { 
      secure: isProduction,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });
    socketRef.current.on('signal', gotMessageFromServer);
    socketRef.current.on('connect', () => {
      console.log('🔌 Socket connected! Socket ID:', socketRef.current.id);
      console.log('🚪 Joining meeting room:', meetingCode);
      socketRef.current.emit('join-call', meetingCode, uniqueUserId, username || 'Anonymous', true);
      socketIdRef.current = socketRef.current.id;

      // Listen for owner assignment from server
      socketRef.current.on('you-are-owner', () => {
        console.log('👑 Server confirmed: You are the meeting owner');
        setIsMeetingOwner(true);
      });

      // Listen for live attendance updates (for dashboard)
      socketRef.current.on('live-attendance', (attendanceData) => {
        console.log('📊 Live attendance update received:', attendanceData);
        setLiveAttendance(attendanceData.participants || []);
      });

      // Listen for attendance reports
      socketRef.current.on('attendance-report', (report) => {
        console.log('📊 Attendance report received:', report);
        setAttendanceReport(report);
        setShowReportModal(true);
      });

      socketRef.current.on('owner-attendance-report', (report) => {
        console.log('👑 OWNER ATTENDANCE REPORT RECEIVED:', report);
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: gold; font-weight: bold');
        console.log('%c👑 YOU ARE THE MEETING OWNER', 'color: gold; font-size: 20px; font-weight: bold');
        console.log('%c📊 Attendance Report Summary:', 'color: gold; font-weight: bold');
        report.participants.forEach(p => {
          const emoji = p.status === 'Present' ? '✅' : p.status === 'Partial' ? '⚠️' : '❌';
          console.log(`${emoji} ${p.name}: ${p.verifiedPercent}% - ${p.status}`);
        });
        console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'color: gold; font-weight: bold');
        
        setAttendanceReport(report);
        setShowReportModal(true);
        setOwnerReportReceived(true);
      });

      socketRef.current.on('poll-created', (poll) => {
        setPolls(prev => [...prev, poll]);
      });
      socketRef.current.on('poll-updated', (updatedPoll) => {
        setPolls(prev => prev.map(p => p.id === updatedPoll.id ? updatedPoll : p));
      });
      socketRef.current.on('decision-added', (decision) => {
        setDecisions(prev => [...prev, decision]);
      });

      socketRef.current.on('reaction-received', (r) => {
        setReactions(prev => [...prev, r]);
        setTimeout(() => setReactions(prev => prev.filter(x => x.id !== r.id)), 2000);
      });

      socketRef.current.on('transcript-entry', ({ text, speaker, lang, timestamp }) => {
        setTranscript(prev => [...prev, { text, speaker, lang, timestamp }]);
      });

      socketRef.current.on('summary-generated', (summary) => {
        setAiSummary(summary);
        setGeneratingSummary(false);
        setShowSummaryModal(true);
      });

      socketRef.current.on('hand-raise-update', (users) => {
        setRaisedHandUsers(users || []);
      });

      socketRef.current.on('participant-list', (participants) => {
        setParticipantList(participants || []);
      });

      socketRef.current.on('chat-message', addMessage);
      socketRef.current.on('user-left', id => {
        console.log('👋 User left:', id);
        setVideos(v => v.filter(vid => vid.socketId !== id));
        // Clean up peer connection
        if (connections[id]) {
          connections[id].close();
          delete connections[id];
          console.log('🗑️ Removed peer connection for:', id);
        }
        // Clean up ICE candidate queue
        if (iceCandidateQueue[id]) {
          delete iceCandidateQueue[id];
          console.log('🗑️ Cleared ICE candidate queue for:', id);
        }
      });
      socketRef.current.on('user-joined', (id, clients) => {
        console.log('🎉 user-joined event received!');
        console.log('  Event ID:', id);
        console.log('  Clients array:', clients);
        console.log('  My socket ID:', socketIdRef.current);
        
        clients.forEach(socketListId => {
          // DON'T create peer connection to yourself!
          if (socketListId === socketIdRef.current) {
            console.log(`⏭️ Skipping self: ${socketListId}`);
            return;
          }
          
          // Don't recreate if connection already exists
          if (connections[socketListId]) {
            console.log(`⏭️ Connection already exists for: ${socketListId}`);
            return;
          }
          
          console.log(`🔗 Creating peer connection for: ${socketListId}`);
          
          connections[socketListId] = new RTCPeerConnection(
            peerConfigConnections,
          );
          console.log(`✅ Peer connection created for ${socketListId}`);
          
          // Monitor connection state
          connections[socketListId].onconnectionstatechange = () => {
            const state = connections[socketListId].connectionState;
            console.log(`🔌 Connection state for ${socketListId}: ${state}`);
            if (state === 'failed' || state === 'disconnected' || state === 'closed') {
              console.error(`❌ Connection ${state} for peer ${socketListId}`);
            } else if (state === 'connected') {
              console.log(`✅ Successfully connected to peer ${socketListId}!`);
            }
          };
          
          connections[socketListId].oniceconnectionstatechange = () => {
            const state = connections[socketListId].iceConnectionState;
            console.log(`🧊 ICE state for ${socketListId}: ${state}`);
          };
          
          connections[socketListId].onicecandidate = e => {
            if (e.candidate) {
              console.log(`🧊 Sending ICE candidate to ${socketListId}`);
              socketRef.current.emit(
                'signal',
                socketListId,
                JSON.stringify({ ice: e.candidate }),
              );
            } else {
              console.log(`🧊 All ICE candidates sent to ${socketListId}`);
            }
          };
          connections[socketListId].ontrack = e => {
            console.log(`📹 Received track from peer ${socketListId}:`, e.track.kind);
            console.log(`  ⬇️ Track details: ${e.track.label} - Enabled: ${e.track.enabled} - Muted: ${e.track.muted} - ReadyState: ${e.track.readyState}`);

            const remoteStream = e.streams && e.streams[0]
              ? e.streams[0]
              : new MediaStream([e.track]);

            console.log(`🎤 Remote stream now has ${remoteStream.getAudioTracks().length} audio, ${remoteStream.getVideoTracks().length} video tracks`);

            setVideos(prev => {
              const idx = prev.findIndex(v => v.socketId === socketListId);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], stream: remoteStream };
                return next;
              }
              return [...prev, { socketId: socketListId, stream: remoteStream }];
            });
          };
          if (window.localStream) {
            console.log(`✅ Adding localStream to new peer connection ${socketListId}`);
            console.log(`🎤 LocalStream has ${window.localStream.getAudioTracks().length} audio, ${window.localStream.getVideoTracks().length} video tracks`);
            
            // CRITICAL: Ensure audio tracks are ENABLED before adding to peer
            window.localStream.getAudioTracks().forEach(track => {
              track.enabled = true; // Force enable for transmission
              console.log(`🎤 FORCE ENABLED audio track: ${track.label}`);
            });
            
            window.localStream.getTracks().forEach(track => {
              console.log(`  ➡️ Adding ${track.kind} track: ${track.label} - Enabled: ${track.enabled} - ReadyState: ${track.readyState}`);
              const sender = connections[socketListId].addTrack(track, window.localStream);
              
              // Verify sender was created
              if (track.kind === 'audio') {
                console.log(`🔊 Audio sender created:`, sender ? 'YES' : 'NO');
                if (sender && sender.track) {
                  console.log(`🔊 Sender track enabled:`, sender.track.enabled);
                }
              }
            });
            
            console.log(`🔊 All tracks successfully added to peer ${socketListId}`);
            
            // CRITICAL: Create offer to negotiate the connection
            connections[socketListId].createOffer()
              .then(description => {
                return connections[socketListId].setLocalDescription(description);
              })
              .then(() => {
                console.log(`📤 Sending offer to peer ${socketListId}`);
                socketRef.current.emit(
                  'signal',
                  socketListId,
                  JSON.stringify({ sdp: connections[socketListId].localDescription })
                );
              })
              .catch(err => {
                console.error(`❌ Error creating offer for ${socketListId}:`, err);
              });
          } else {
            console.error('❌ ERROR: window.localStream is null! Cannot add stream to peer connection.');
          }
        });
      });
    });
  };

  const addMessage = (data, sender) => {
    setMessages(prev => [...prev, { sender, data }]);
    if (sender !== username) setNewMessages(prev => prev + 1);
  };

  const sendMessage = () => {
    if (message.trim()) {
      socketRef.current.emit('chat-message', message, username);
      setMessage('');
    }
  };

  const createPoll = () => {
    const validOptions = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) {
      alert('Please enter a question and at least 2 options');
      return;
    }
    socketRef.current.emit('create-poll', {
      meetingId: meetingCode,
      question: pollQuestion,
      options: validOptions
    });
    setPollQuestion('');
    setPollOptions(['', '']);
  };

  const votePoll = (pollId, optionIndex) => {
    socketRef.current.emit('vote-poll', {
      meetingId: meetingCode,
      pollId,
      optionIndex
    });
  };

  const addDecision = () => {
    if (!decisionText.trim()) return;
    socketRef.current.emit('add-decision', {
      meetingId: meetingCode,
      text: decisionText,
      proposedBy: username
    });
    setDecisionText('');
  };

  // ============= TRANSCRIPTION FUNCTIONS =============

  const startWebSpeech = async () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    // Web Speech API accesses the mic internally — no separate getUserMedia needed.
    // Using window.localStream directly avoids driver contention from two concurrent audio streams.
    speechStreamRef.current = null;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = transcriptLang;

    recognition.onaudiostart = () => console.log('🎤 Web Speech: audio started');
    recognition.onsoundstart = () => console.log('🎤 Web Speech: sound detected');
    recognition.onspeechstart = () => console.log('🎤 Web Speech: speech detected');
    recognition.onnomatch = () => console.log('🎤 Web Speech: no match');

    const rearmWatchdog = () => {
      clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = setTimeout(() => {
        if (isRecordingRef.current && recognitionRef.current === recognition) {
          console.error('❌ Web Speech: no results for 10s, switching to local model');
          recognitionRef.current = null;
          try { recognition.stop(); } catch (e) {}
          startTransformers();
        }
      }, 10000);
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            console.log('📝 Web Speech final:', text);
            const entry = { text, speaker: username || 'Anonymous', lang: 'auto', timestamp: Date.now() };
            setTranscript(prev => [...prev, entry]);
            socketRef.current?.emit('transcript-entry', { meetingId: meetingCode, ...entry });
          }
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
      rearmWatchdog();
    };

    recognition.onerror = (event) => {
      console.error('❌ Web Speech error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      if (event.error === 'network') {
        console.log('🔁 Web Speech network error — auto-fallback to Transformers.js');
        clearTimeout(speechWatchdogRef.current);
        recognitionRef.current = null;
        startTransformers();
        return;
      }

      setTranscriptError('Speech recognition error: ' + event.error + '. Try manual entry below.');
      setIsRecording(false);
      isRecordingRef.current = false;
    };

    recognition.onend = () => {
      console.log('🎤 Web Speech: ended');
      if (recognitionRef.current !== recognition) {
        console.log('🛑 Web Speech: ignoring stale instance onend');
        return;
      }
      if (isRecordingRef.current) {
        try {
          recognition.start();
          console.log('🎤 Web Speech: restarted');
          rearmWatchdog();
        } catch (e) {
          console.error('❌ Web Speech restart failed:', e.message);
        }
      }
    };

    try {
      recognition.start();
      console.log('🎤 Web Speech: started');
    } catch (e) {
      console.error('❌ Web Speech start failed:', e.message);
      return false;
    }

    rearmWatchdog();
    recognitionRef.current = recognition;
    return true;
  };

  const startTransformers = async () => {
    setTranscriptError('');
    if (!window.localStream || !window.localStream.getAudioTracks().length) {
      setTranscriptError('No microphone detected. Try manual entry below.');
      setIsRecording(false);
      isRecordingRef.current = false;
      return;
    }

    try {
      setTranscriptLoading('Loading speech model (~70MB)...');

      const { pipeline } = await import('@xenova/transformers');

      if (!transformersPipelineRef.current) {
        transformersPipelineRef.current = await pipeline(
          'automatic-speech-recognition',
          'Xenova/whisper-tiny.en',
          { quantized: true }
        );
      }

      setTranscriptLoading('');

      const pipe = transformersPipelineRef.current;

      const recorder = new MediaRecorder(window.localStream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onerror = () => {
        setTranscriptError('Audio recording error occurred.');
        setIsRecording(false);
        isRecordingRef.current = false;
        clearInterval(flushTimerRef.current);
      };

      recorder.start();

      flushTimerRef.current = setInterval(async () => {
        recorder.requestData();
        if (audioChunksRef.current.length === 0) return;
        const batch = audioChunksRef.current.splice(0);
        const blob = new Blob(batch, { type: recorder.mimeType });

        try {
          const arrayBuffer = await blob.arrayBuffer();
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const audioData = audioBuffer.getChannelData(0);

          const result = await pipe(audioData);
          if (result?.text?.trim()) {
            const text = result.text.trim();
            const entry = { text, speaker: username || 'Anonymous', lang: 'auto', timestamp: Date.now() };
            setTranscript(prev => [...prev, entry]);
            socketRef.current?.emit('transcript-entry', { meetingId: meetingCode, ...entry });
          }
        } catch (err) {
          console.error('Transformers transcription error:', err);
        }
      }, 5000);
    } catch (err) {
      console.error('❌ Transformers pipeline error:', err);
      setTranscriptLoading('');
      setTranscriptError('Failed to load speech model. Try manual entry below.');
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const startTranscription = async () => {
    setTranscriptError('');
    setIsRecording(true);
    isRecordingRef.current = true;

    const webSpeechStarted = await startWebSpeech();
    if (webSpeechStarted) {
      console.log('🎤 Using Web Speech API (Chrome/Edge)');
      return;
    }

    console.log('🎤 Using Transformers.js (Firefox/Safari)');
    startTransformers();
  };

  const stopTranscription = () => {
    setIsRecording(false);
    isRecordingRef.current = false;
    setInterimText('');

    if (speechWatchdogRef.current) {
      clearTimeout(speechWatchdogRef.current);
      speechWatchdogRef.current = null;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
      recognitionRef.current = null;
    }

    if (speechStreamRef.current) {
      speechStreamRef.current.getTracks().forEach(t => t.stop());
      speechStreamRef.current = null;
    }

    clearInterval(flushTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    mediaRecorderRef.current = null;
  };

  const toggleRecording = () => {
    if (isRecording) { stopTranscription(); }
    else { startTranscription(); }
  };

  const addManualEntry = () => {
    const text = manualTranscriptText.trim();
    if (!text) return;
    const entry = { text, speaker: username || 'Anonymous', lang: 'manual', timestamp: Date.now() };
    setTranscript(prev => [...prev, entry]);
    socketRef.current?.emit('transcript-entry', { meetingId: meetingCode, ...entry });
    setManualTranscriptText('');
  };

  const requestSummary = () => {
    if (transcript.length === 0 || generatingSummary) return;
    setGeneratingSummary(true);
    socketRef.current?.emit('generate-summary', {
      meetingId: meetingCode,
      transcriptEntries: transcript
    });
  };

  // ============= END TRANSCRIPTION =============

  const addPollOption = () => {
    setPollOptions(prev => [...prev, '']);
  };

  const removePollOption = (index) => {
    setPollOptions(prev => prev.filter((_, i) => i !== index));
  };

  const updatePollOption = (index, value) => {
    setPollOptions(prev => prev.map((opt, i) => i === index ? value : opt));
  };

  const hasVoted = (poll, userId) => {
    return poll.options.some(opt => opt.votes.includes(userId));
  };

  const getUserVoteIndex = (poll, userId) => {
    for (let i = 0; i < poll.options.length; i++) {
      if (poll.options[i].votes.includes(userId)) return i;
    }
    return -1;
  };

const handleVideo = async () => {
  if (video) {
    // TURNING OFF: stop local video tracks (releases camera, turns off LED)
    if (window.localStream) {
      window.localStream.getVideoTracks().forEach(track => {
        track.stop();
        window.localStream.removeTrack(track);
      });
    }
    // Replace video sender with null on all peer connections
    for (let id in connections) {
      if (id === socketIdRef.current) continue;
      const senders = connections[id].getSenders();
      const videoSender = senders.find(s => s.track?.kind === 'video');
      if (videoSender) {
        try { videoSender.replaceTrack(null); } catch (e) { console.error('replaceTrack(null) error:', e); }
      }
    }
    setVideo(false);
  } else {
    // TURNING ON: get fresh camera track, replace on all peers
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      const newTrack = stream.getVideoTracks()[0];
      if (!newTrack) { setVideo(false); return; }

      // Replace video track in local stream
      const local = window.localStream;
      if (local) {
        local.getVideoTracks().forEach(t => { local.removeTrack(t); t.stop(); });
        local.addTrack(newTrack);
      } else {
        window.localStream = stream;
      }

      // Replace video sender track on all peer connections
      for (let id in connections) {
        if (id === socketIdRef.current) continue;
        const senders = connections[id].getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          try { await videoSender.replaceTrack(newTrack); } catch (e) { console.error(e); }
        } else {
          connections[id].addTrack(newTrack, window.localStream || stream);
        }
      }

      // Force keyframe via renegotiation on all peers
      for (let id in connections) {
        if (id === socketIdRef.current) continue;
        const pc = connections[id];
        if (pc.signalingState !== 'stable') continue;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current.emit('signal', id, JSON.stringify({ sdp: pc.localDescription }));
        } catch (e) {
          console.error('Renegotiation error for', id, e);
        }
      }

      if (localVideoref.current) localVideoref.current.srcObject = window.localStream;
      setVideo(true);
    } catch (err) {
      console.error('Failed to re-acquire camera:', err);
      setVideo(false);
    }
  }
};


  // debug audio
  const handleAudio = () => {
    setAudio(prev => {
      const newState = !prev;
      console.log('🎤 Toggling audio:', prev ? 'OFF' : 'ON', '→', newState ? 'ON' : 'OFF');

      if (window.localStream) {
        const audioTracks = window.localStream.getAudioTracks();
        console.log('🎤 Found', audioTracks.length, 'audio track(s)');
        
        if (audioTracks.length === 0) {
          console.error('⚠️ No audio tracks found! Mic might not be permitted.');
          alert('No microphone detected. Please check browser permissions and rejoin the meeting.');
          return prev;
        }
        
        audioTracks.forEach((track, idx) => {
          track.enabled = newState;
          console.log(`🎤 Track ${idx}:`, track.label, '- Enabled:', track.enabled, '- ReadyState:', track.readyState, '- Muted:', track.muted);
        });
        
        // CRITICAL: Update all peer connection senders
        for (let id in connections) {
          if (id === socketIdRef.current) continue;
          const senders = connections[id].getSenders();
          const audioSender = senders.find(s => s.track?.kind === 'audio');
          if (audioSender && audioSender.track) {
            audioSender.track.enabled = newState;
            console.log(`📡 Updated sender for peer ${id}:`, audioSender.track.enabled);
          }
        }
        
        console.log(`✅ Audio ${newState ? 'ENABLED' : 'DISABLED'} - other participants ${newState ? 'CAN' : 'CANNOT'} hear you`);
      } else {
        console.error('⚠️ No localStream found!');
        alert('No media stream detected. Please rejoin the meeting.');
        return prev;
      }

      return newState;
    });
  };


  const handleScreen = () => {
    setScreen(prevScreen => {
      if (prevScreen) {
        // Turning OFF screen share - restore camera
        restoreCameraStream();
      }
      return !prevScreen;
    });
  };

  // Debug function to check WebRTC audio transmission
  window.checkAudioDebug = async () => {
    console.log('🔍 === AUDIO DEBUG REPORT ===');
    console.log('📊 Local Stream:', window.localStream ? 'EXISTS' : 'NULL');
    if (window.localStream) {
      const audioTracks = window.localStream.getAudioTracks();
      console.log(`🎤 Audio tracks: ${audioTracks.length}`);
      audioTracks.forEach((track, idx) => {
        console.log(`  Track ${idx}:`, {
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState,
          muted: track.muted
        });
      });
    }
    
    console.log('📡 Peer Connections:', Object.keys(connections).length);
    for (let id in connections) {
      const pc = connections[id];
      console.log(`\n🔗 Peer ${id}:`);
      const senders = pc.getSenders();
      console.log(`  Senders: ${senders.length}`);
      senders.forEach((sender, idx) => {
        if (sender.track) {
          console.log(`    ${idx}. ${sender.track.kind}: ${sender.track.label} - Enabled: ${sender.track.enabled}`);
        }
      });
      
      // Check WebRTC stats
      try {
        const stats = await pc.getStats();
        stats.forEach(report => {
          if (report.type === 'outbound-rtp' && report.kind === 'audio') {
            console.log(`  📤 Audio Outbound:`, {
              packetsSent: report.packetsSent,
              bytesSent: report.bytesSent,
              timestamp: new Date(report.timestamp).toLocaleTimeString()
            });
          }
        });
      } catch (e) {
        console.error('  Failed to get stats:', e);
      }
    }
    console.log('🔍 === END DEBUG ===');
  };
  
  console.log('💡 TIP: Run window.checkAudioDebug() in console to diagnose audio issues');

  const handleEndCall = () => {
    console.log('📞 Ending meeting...');
    socketRef.current?.emit('end-meeting', { meetingId: meetingCode });
    // Don't stop tracks or redirect yet - let user see the report first
    // They will be stopped when modal is closed
  };

  const connect = async () => {
    setAskForUsername(false);
    await getMedia();
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'chat') setNewMessages(0);
  };

  const toggleSidebar = () => {
    setSidebarOpen(prev => !prev);
  };

  const sendReaction = (emoji) => {
    socketRef.current.emit('send-reaction', {
      meetingId: meetingCode,
      emoji,
      from: username
    });
    setShowEmojiPicker(false);
  };

  const toggleEmojiPicker = () => {
    setShowEmojiPicker(prev => !prev);
  };

  const toggleHandRaise = () => {
    const newState = !handRaised;
    setHandRaised(newState);
    socketRef.current?.emit('raise-hand', {
      meetingId: meetingCode,
      userId: uniqueUserId,
      userName: username || 'Anonymous',
      raised: newState,
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return '#4CAF50';
      case 'Partial': return '#FF9800';
      case 'Absent': return '#F44336';
      default: return '#45464d';
    }
  };

  const getStatusEmoji = (status) => {
    switch (status) {
      case 'Present': return '✅';
      case 'Partial': return '⚠️';
      case 'Absent': return '❌';
      default: return '❓';
    }
  };

  const participantCount = 1 + videos.length;
  const gridCols = participantCount <= 1 ? 1
    : participantCount <= 4 ? 2
    : participantCount <= 9 ? 3
    : 4;

  return (
    <div>
      {askForUsername ? (
        <div className={styles.lobbyWrapper}>
          {/* TOP NAV */}
          <header className={styles.topNav}>
            <div className={styles.topNavLeft}>
              <div className={styles.logoIcon}>
                <PsychologyIcon />
              </div>
              <h1 className={styles.navTitle}>MeetSync AI</h1>
              <div className={styles.navDivider}></div>
              <span className={styles.navSubtitle}>Live Room</span>
            </div>
            <div className={styles.topNavRight}>
              <span style={{ fontSize: 12, color: '#8a8fa8' }}>Ready to join</span>
            </div>
          </header>

          <main className={styles.lobbyBody}>
            {/* LEFT: Join Card */}
            <div className={styles.lobbyCard}>
              <div className={styles.lobbyBrandBadge}>
                <PsychologyIcon />
              </div>
              <h2 className={styles.lobbyCardTitle}>Join Your Meeting</h2>
              <p className={styles.lobbyCardSub}>Enter your name to join the room</p>

              <div className={styles.lobbyCodeRow}>
                <span className={styles.lobbyCodeLabel}>Room</span>
                <span className={styles.lobbyCodeValue}>{meetingCode}</span>
              </div>

              <input
                className={styles.lobbyInput}
                placeholder="Your display name"
                value={username}
                onChange={e => setUsername(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && username.trim() && connect()}
              />

              <button className={styles.lobbyBtn} onClick={connect} disabled={!username.trim()}>
                <span>Enter Meeting Room</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            </div>

            {/* RIGHT: Video Preview */}
            <div className={styles.lobbyPreview}>
              <video
                ref={lobbyVideoRef}
                autoPlay
                muted
                playsInline
              />
              <div className={styles.lobbyPreviewLabel}>
                <span className={styles.lobbyPreviewDot}></span>
                Camera Preview
              </div>
            </div>
          </main>
        </div>
      ) : (
        <div className={styles.meetVideoContainer}>
          {/* TOP NAV */}
          <header className={styles.topNav}>
            <div className={styles.topNavLeft}>
              <div className={styles.logoIcon}>
                <PsychologyIcon />
              </div>
              <h1 className={styles.navTitle}>MeetSync AI</h1>
              <div className={styles.navDivider}></div>
              <span className={styles.navSubtitle}>Live Room</span>
            </div>
            <div className={styles.topNavRight}>
              <div className={styles.avatarStack}>
                {videos.slice(0, 2).map(v => (
                  <div key={v.socketId} className={styles.avatarImg} style={{ background: '#645efb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: 700 }}>
                    {(v.userName || 'U')[0].toUpperCase()}
                  </div>
                ))}
                {videos.length > 2 && (
                  <div className={styles.avatarCount}>+{videos.length - 2}</div>
                )}
              </div>
            </div>
          </header>

          <main className={styles.mainContent}>
            {/* VIDEO GRID */}
            <section className={styles.videoGrid}
              style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
              {/* Local video */}
              <div className={`${styles.videoTile} ${isMeetingOwner ? styles.speakerGlow : ''}`}>
                <video ref={localVideoref} autoPlay muted playsInline className={styles.videoElement}
                  style={{ display: (video && videoAvailable && window.localStream) ? 'block' : 'none' }} />
                {(!video || !videoAvailable || !window.localStream) && (
                  <div className={styles.avatarPlaceholder}>
                    <span>{(username || 'You')[0].toUpperCase()}</span>
                  </div>
                )}
                <div className={styles.videoLabel}>
                  {audio ? <MicIcon className={styles.micOff} /> : <MicOffIcon className={styles.micOff} />}
                  <span>You</span>
                </div>
                {isMeetingOwner && <div className={styles.ownerBadge}><span>👑</span> Owner</div>}
                {handRaised && <div className={styles.handIndicator}>✋</div>}
              </div>

              {/* Remote videos */}
              {videos.map((v, index) => (
                <div key={v.socketId} className={styles.videoTile}>
                  <video
                    ref={ref => {
                      if (ref && v.stream) {
                        ref.srcObject = v.stream;
                        ref.muted = false;
                        ref.volume = 1.0;
                        ref.setAttribute('playsinline', '');
                        ref.setAttribute('autoplay', '');
                        setTimeout(() => {
                          if (ref.paused) {
                            ref.play().catch(e => {
                              if (e.name === 'NotAllowedError') {
                                console.warn('⚠️ Click anywhere to enable audio/video');
                              } else if (e.name !== 'AbortError') {
                                console.error('Play error:', e.name);
                              }
                            });
                          }
                        }, 100);
                      }
                    }}
                    autoPlay
                    playsInline
                    className={styles.videoElement}
                  />
                  <div className={styles.videoLabel}>
                    <MicIcon />
                    <span>{v.userName || `User ${index + 1}`}</span>
                  </div>
                  {raisedHandUsers.some(u => u.socketId === v.socketId) && <div className={styles.handIndicator}>✋</div>}
                </div>
              ))}

              {videos.length === 0 && !(video && videoAvailable) && (
                <div className={styles.emptyState}>Waiting for participants...</div>
              )}
            </section>

            {/* RIGHT SIDEBAR */}
            <aside className={`${styles.sidebar} ${!sidebarOpen ? styles.sidebarClosed : ''}`}>
              <nav className={styles.sidebarTabs}>
                <button onClick={() => handleTabChange('chat')} className={`${styles.tabButton} ${activeTab === 'chat' ? styles.tabActive : ''}`}>
                  Chat {newMessages > 0 && <span className={styles.chatBadge}>{newMessages}</span>}
                </button>
                <button onClick={() => handleTabChange('attendance')} className={`${styles.tabButton} ${activeTab === 'attendance' ? styles.tabActive : ''}`}>
                  Attendance
                </button>
                <button onClick={() => handleTabChange('polls')} className={`${styles.tabButton} ${activeTab === 'polls' ? styles.tabActive : ''}`}>
                  Polls
                </button>
                <button onClick={() => handleTabChange('transcript')} className={`${styles.tabButton} ${activeTab === 'transcript' ? styles.tabActive : ''}`}>
                  Transcript
                </button>
                <button onClick={() => handleTabChange('participants')} className={`${styles.tabButton} ${activeTab === 'participants' ? styles.tabActive : ''}`}>
                  Participants {raisedHandUsers.length > 0 && <span className={styles.handBadge}>{raisedHandUsers.length}</span>}
                </button>
                <button onClick={() => handleTabChange('info')} className={`${styles.tabButton} ${activeTab === 'info' ? styles.tabActive : ''}`}>
                  Info
                </button>
              </nav>

              <div className={styles.tabContent}>
                {/* TAB 1: CHAT */}
                {activeTab === 'chat' && (
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div className={styles.chatMessages}>
                      {messages.length > 0 ? messages.map((m, i) => (
                        <div key={i} className={styles.chatMessage}>
                          <div className={`${styles.chatAvatar} ${m.sender === username ? styles.chatAvatarLocal : styles.chatAvatarRemote}`}>
                            {(m.sender || '?')[0].toUpperCase()}
                          </div>
                          <div className={styles.chatBubble}>
                            <p className={styles.chatSender}>
                              {m.sender}
                              <span className={styles.chatTime}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </p>
                            <p>{m.data}</p>
                          </div>
                        </div>
                      )) : (
                        <p style={{ color: '#45464d', textAlign: 'center', padding: '40px 0' }}>No messages yet</p>
                      )}
                    </div>
                    <div className={styles.chatInputArea}>
                      <TextField
                        fullWidth
                        size="small"
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && sendMessage()}
                        placeholder="Type a message..."
                        variant="outlined"
                      />
                      <Button variant="contained" onClick={sendMessage} sx={{ minWidth: '80px', flexShrink: 0 }}>
                        Send
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 2: ATTENDANCE */}
                {activeTab === 'attendance' && (
                  <div className={styles.attendancePanel}>
                    {isMeetingOwner ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#e2dfff', borderRadius: 12 }}>
                          <span style={{ fontSize: 20 }}>👑</span>
                          <span style={{ fontWeight: 700, fontSize: 14, color: '#3323cc' }}>Live Attendance Dashboard</span>
                        </div>
                        {liveAttendance.length === 0 ? (
                          <p style={{ color: '#45464d', textAlign: 'center', padding: '20px' }}>Waiting for participants to register faces...</p>
                        ) : (
                          liveAttendance.map((p, i) => {
                            const percent = p.totalTime > 0 ? Math.round((p.verifiedTime / p.totalTime) * 100) : 0;
                            const status = percent >= 75 ? 'Present' : percent >= 50 ? 'Partial' : 'Absent';
                            const color = getStatusColor(status);
                            return (
                              <div key={i} className={styles.attendanceCard} style={{ borderLeftColor: color }}>
                                <div className={styles.attendanceName}>
                                  <span>{p.userName || p.userId || 'Unknown'}</span>
                                  <span style={{ color, fontWeight: 700 }}>{getStatusEmoji(status)} {status}</span>
                                </div>
                                <div className={styles.attendanceStat}>
                                  <span>Total: {Math.floor(p.totalTime / 60)}m {p.totalTime % 60}s</span>
                                  <span>Verified: {Math.floor(p.verifiedTime / 60)}m {p.verifiedTime % 60}s</span>
                                </div>
                                <div className={styles.attendanceBar}>
                                  <div className={styles.attendanceBarFill} style={{ width: `${percent}%`, background: color }} />
                                </div>
                                <div style={{ textAlign: 'right', fontSize: 11, fontWeight: 700, color, marginTop: 4 }}>{percent}%</div>
                              </div>
                            );
                          })
                        )}
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <p style={{ fontSize: 14, color: '#45464d' }}>Attendance tracking is managed by the meeting owner.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: POLLS */}
                {activeTab === 'polls' && (
                  <div className={styles.pollsTab}>
                    {/* SECTION: Create Poll */}
                    <div className={styles.pollCreateForm}>
                      <p className={styles.subSectionTitle}>Create Poll</p>
                      <input
                        placeholder="Ask a question..."
                        value={pollQuestion}
                        onChange={e => setPollQuestion(e.target.value)}
                      />
                      {pollOptions.map((opt, idx) => (
                        <div key={idx} className={styles.pollOptionRow}>
                          <input
                            placeholder={`Option ${idx + 1}`}
                            value={opt}
                            onChange={e => updatePollOption(idx, e.target.value)}
                          />
                          {pollOptions.length > 2 && (
                            <button className={styles.pollRemoveOption} onClick={() => removePollOption(idx)}>×</button>
                          )}
                        </div>
                      ))}
                      <button className={styles.pollAddOption} onClick={addPollOption}>+ Add Option</button>
                      <button className={styles.pollCreateBtn} onClick={createPoll}>Launch Poll</button>
                    </div>

                    <div className={styles.subSectionDivider} />

                    {/* SECTION: Active Polls */}
                    <p className={styles.subSectionTitle}>Active Polls</p>
                    {polls.length === 0 ? (
                      <p className={styles.emptyStateSmall}>No polls yet. Create one above!</p>
                    ) : (
                      polls.map(poll => {
                        const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
                        const votedIdx = getUserVoteIndex(poll, socketIdRef.current);
                        return (
                          <div key={poll.id} className={styles.pollCard}>
                            <p className={styles.pollQuestion}>{poll.question}</p>
                            {votedIdx >= 0 ? (
                              /* RESULTS VIEW */
                              poll.options.map((opt, idx) => {
                                const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                                return (
                                  <div key={idx} className={styles.pollResultRow}>
                                    <span className={styles.pollResultText}>{opt.text}</span>
                                    <div className={styles.pollResultBar}>
                                      <div className={styles.pollResultBarFill} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={styles.pollResultPercent}>{pct}%</span>
                                  </div>
                                );
                              })
                            ) : (
                              /* VOTE VIEW */
                              poll.options.map((opt, idx) => (
                                <div key={idx} className={styles.pollOption} onClick={() => votePoll(poll.id, idx)}>
                                  <div className={styles.pollOptionDot}>
                                    <div className={styles.pollOptionDotInner} />
                                  </div>
                                  <span className={styles.pollOptionText}>{opt.text}</span>
                                </div>
                              ))
                            )}
                            <p className={styles.pollVoteCount}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</p>
                          </div>
                        );
                      })
                    )}

                    <div className={styles.subSectionDivider} />

                    {/* SECTION: Decisions */}
                    <p className={styles.subSectionTitle}>Decisions</p>
                    <div className={styles.decisionInput}>
                      <input
                        placeholder="Record a decision..."
                        value={decisionText}
                        onChange={e => setDecisionText(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && addDecision()}
                      />
                      <button className={styles.decisionAddBtn} onClick={addDecision}>Add</button>
                    </div>
                    {decisions.length === 0 ? (
                      <p className={styles.emptyStateSmall}>No decisions recorded yet.</p>
                    ) : (
                      decisions.map(dec => (
                        <div key={dec.id} className={styles.decisionItem}>
                          <div className={styles.decisionIcon}>✓</div>
                          <div className={styles.decisionContent}>
                            <p className={styles.decisionText}>{dec.text}</p>
                            <p className={styles.decisionMeta}>
                              {dec.proposedBy} · {new Date(dec.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* TAB 5: TRANSCRIPT */}
                {activeTab === 'transcript' && (
                  <div className={styles.transcriptPanel}>
                    <div className={styles.transcriptControls}>
                      <button
                        className={`${styles.recToggle} ${isRecording ? styles.recToggleRecording : ''}`}
                        onClick={toggleRecording}
                      >
                        {isRecording ? '🔴 Stop' : '⚪ Start'}
                      </button>
                      <select
                        className={styles.langSelect}
                        value={transcriptLang}
                        onChange={e => setTranscriptLang(e.target.value)}
                        disabled={isRecording}
                      >
                        <option value="en-US">English</option>
                        <option value="hi-IN">हिन्दी</option>
                        <option value="es-ES">Español</option>
                        <option value="fr-FR">Français</option>
                        <option value="de-DE">Deutsch</option>
                        <option value="zh-CN">中文</option>
                        <option value="ja-JP">日本語</option>
                        <option value="ar-SA">العربية</option>
                        <option value="pt-BR">Português</option>
                        <option value="ru-RU">Русский</option>
                      </select>
                    </div>
                    {transcriptLoading && (
                      <div style={{ background: '#fff3cd', color: '#856404', padding: '8px 10px', borderRadius: 8, fontSize: 12, marginBottom: 4 }}>
                        {transcriptLoading}
                      </div>
                    )}
                    {transcriptError && (
                      <div style={{ background: '#fdecea', color: '#b71c1c', padding: '8px 10px', borderRadius: 8, fontSize: 12, marginBottom: 4 }}>
                        {transcriptError}
                      </div>
                    )}
                    {transcriptError.includes('manual entry') && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                        <input
                          style={{ flex: 1, padding: '6px 10px', border: '1px solid #c6c6cd', borderRadius: 8, fontSize: 12, outline: 'none' }}
                          placeholder="Type what was said..."
                          value={manualTranscriptText}
                          onChange={e => setManualTranscriptText(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && addManualEntry()}
                        />
                        <button onClick={addManualEntry} style={{ padding: '6px 12px', border: 'none', borderRadius: 8, background: '#645efb', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Add
                        </button>
                      </div>
                    )}
                    <div className={styles.transcriptList}>
                      {transcript.length === 0 && !isRecording && (
                        <p className={styles.emptyStateSmall}>No transcript yet. Press "Start" to record.</p>
                      )}
                      {transcript.map((entry, i) => (
                        <div key={i} className={styles.transcriptEntry}>
                          <div className={styles.transcriptEntryMeta}>
                            <span className={styles.transcriptSpeaker}>{entry.speaker}</span>
                          </div>
                          <p className={styles.transcriptText}>{entry.text}</p>
                        </div>
                      ))}
                      {isRecording && interimText && (
                        <div className={styles.transcriptInterim}>
                          <span className={styles.transcriptSpeaker}>{username}</span>
                          <p className={styles.transcriptText}>{interimText}</p>
                        </div>
                      )}
                    </div>
                    <div className={styles.transcriptFooter}>
                      <span className={styles.entryCount}>{transcript.length} entries</span>
                      {aiSummary && (
                        <div className={styles.summaryCard}>
                          <p className={styles.summaryOverview}>{aiSummary.overview}</p>
                        </div>
                      )}
                      <button
                        className={styles.summaryButton}
                        onClick={requestSummary}
                        disabled={transcript.length === 0 || generatingSummary}
                      >
                        {generatingSummary ? 'Generating...' : 'Generate AI Summary'}
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 4: PARTICIPANTS */}
                {activeTab === 'participants' && (
                  <div className={styles.participantsPanel}>
                    <div className={styles.participantsHeader}>
                      <span>{participantList.length} Participant{participantList.length !== 1 ? 's' : ''}</span>
                    </div>
                    {participantList.map(p => {
                      const isLocal = p.userId === uniqueUserId;
                      return (
                        <div key={p.socketId || p.userId} className={styles.participantRow}>
                          <div className={styles.participantAvatar}>
                            {(p.userName || '?')[0].toUpperCase()}
                          </div>
                          <div className={styles.participantInfo}>
                            <span className={styles.participantName}>
                              {p.userName || 'Anonymous'}
                              {isLocal && <span className={styles.participantYou}>(You)</span>}
                            </span>
                          </div>
                          {p.hasRaisedHand && <span className={styles.participantHandIcon}>✋</span>}
                        </div>
                      );
                    })}
                    {participantList.length === 0 && (
                      <div className={styles.participantsEmpty}>No participants yet</div>
                    )}
                  </div>
                )}

                {/* TAB 5: INFO */}
                {activeTab === 'info' && (
                  <div className={styles.infoPanel}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Meeting Code</span>
                      <span className={styles.infoValue}>{meetingCode}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Participants</span>
                      <span className={styles.infoValue}>{videos.length + 1}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Your Name</span>
                      <span className={styles.infoValue}>{username || 'Anonymous'}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Connection</span>
                      <span className={styles.infoValue} style={{ color: '#4CAF50' }}>Connected</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Face Tracking</span>
                      <span className={styles.infoValue} style={{ color: faceDescriptor ? '#4CAF50' : '#FF9800' }}>
                        {faceDescriptor ? 'Active' : 'Not enrolled'}
                      </span>
                    </div>
                    <div style={{ marginTop: 16, padding: 12, background: '#f2f4f6', borderRadius: 12 }}>
                      <p style={{ fontSize: 12, color: '#45464d', fontWeight: 600, marginBottom: 8 }}>Tips</p>
                      <ul style={{ fontSize: 12, color: '#45464d', paddingLeft: 16, lineHeight: 1.8 }}>
                        <li>Enroll your face for AI attendance tracking</li>
                        <li>Owner receives attendance report when ending the meeting</li>
                        <li>Attendance is based on face detection percentage</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.sidebarFooter}>
                <div className={styles.searchIconWrapper}>
                  <SearchIcon className={styles.searchIcon} />
                  <input className={styles.searchInput} placeholder="Ask AI to find something..." type="text" />
                </div>
              </div>
            </aside>

            {/* Floating Reaction Overlay */}
            {reactions.length > 0 && (
              <div className={styles.reactionOverlay}>
                {reactions.map(r => (
                  <span key={r.id} className={styles.reactionFloat}>{r.emoji}</span>
                ))}
              </div>
            )}
          </main>

          {/* BOTTOM CONTROL BAR */}
          <footer className={styles.bottomBar}>
            <div className={styles.meetingInfo}>
              <p className={styles.meetingName}>Weekly Strategy Sync</p>
              <p className={styles.meetingMeta}>{videos.length + 1} Participants • Live</p>
            </div>
            <div className={styles.controlsCenter}>
              <button onClick={handleAudio} className={`${styles.controlButton} ${!audio ? styles.controlDisabled : ''}`} title={audio ? "Mute Microphone" : "Unmute Microphone"}>
                {audio ? <MicIcon /> : <MicOffIcon />}
              </button>
              <button onClick={handleVideo} className={`${styles.controlButton} ${!video ? styles.controlDisabled : ''}`} title="Toggle Video">
                {video ? <VideocamIcon /> : <VideocamOffIcon />}
              </button>
              {screenAvailable && (
                <button onClick={handleScreen} className={styles.controlButton} title="Share Screen">
                  {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </button>
              )}
              <button onClick={toggleEmojiPicker} className={styles.controlButton} title="Reactions" style={{ position: 'relative' }}>
                <SentimentSatisfiedIcon />
                {showEmojiPicker && (
                  <div className={styles.emojiPicker}>
                    {EMOJIS.map((emoji, i) => (
                      <button key={i} className={styles.emojiOption} onClick={() => sendReaction(emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </button>
              <button onClick={toggleHandRaise} className={`${styles.controlButton} ${handRaised ? styles.controlActive : ''}`} title={handRaised ? "Lower Hand" : "Raise Hand"}>
                <PanToolIcon />
              </button>
              <button onClick={handleEndCall} className={styles.leaveButton} title={isMeetingOwner ? "End Meeting & Generate Report" : "Leave Meeting"}>
                <CallEndIcon />
                <span>Leave</span>
              </button>
            </div>
            <div className={styles.controlsRight}>
              <div style={{ position: 'relative' }}>
                <button onClick={toggleSidebar} className={`${styles.controlButton} ${sidebarOpen ? styles.controlActive : ''}`} title="Toggle Sidebar">
                  <AnalyticsIcon />
                </button>
                {raisedHandUsers.length > 0 && (
                  <span className={styles.handBadge}>{raisedHandUsers.length}</span>
                )}
              </div>
              <button className={styles.controlButton} title="More">
                <MoreVertIcon />
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* ENROLLMENT MODAL */}
      <Modal open={showEnrollmentModal}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'white',
            p: 5,
            borderRadius: 4,
            boxShadow: 24,
            textAlign: 'center',
            width: { xs: '95%', sm: 550 },
            maxWidth: '650px',
          }}
        >
          <Typography
            variant="h5"
            gutterBottom
            fontWeight="bold"
            color="primary"
          >
            Verify Your Identity for Attendance
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Look directly at the camera and stay still
          </Typography>

          <video
            ref={modalVideoRef}
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              maxWidth: '500px',
              height: '380px',
              borderRadius: '20px',
              background: '#000',
              border: '8px solid #1976d2',
              objectFit: 'cover',
              margin: '20px 0',
            }}
          />

          <Typography
            variant="body1"
            sx={{
              mb: 4,
              fontWeight: 'bold',
              color: modelsLoaded ? 'green' : 'orange',
            }}
          >
            {modelsLoaded
              ? 'Ready — your face should be visible above'
              : 'Loading AI model... (first time may take 20 seconds)'}
          </Typography>

          <Button
            onClick={enrollFace}
            variant="contained"
            size="large"
            disabled={!modelsLoaded}
            sx={{ minWidth: '300px', py: 2, fontSize: '1.4rem' }}
          >
            {modelsLoaded ? 'CAPTURE MY FACE' : 'LOADING AI...'}
          </Button>
        </Box>
      </Modal>

      {/* Attendance Report Modal */}
      <Modal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bgcolor: 'white',
            p: 4,
            borderRadius: 2,
            maxWidth: 700,
            width: '90%',
            maxHeight: '80vh',
            overflow: 'auto',
          }}
        >
          <Typography variant="h5" textAlign="center" gutterBottom>
            📊 Attendance Report
          </Typography>
          {ownerReportReceived && (
            <Typography 
              variant="subtitle1" 
              textAlign="center" 
              gutterBottom
              sx={{ 
                color: 'primary.main', 
                fontWeight: 'bold',
                mb: 2,
                bgcolor: 'primary.light',
                p: 1,
                borderRadius: 1
              }}
            >
              👑 Meeting Owner Report
            </Typography>
          )}
          <Typography variant="body2" textAlign="center" color="text.secondary" gutterBottom>
            Meeting ID: {attendanceReport?.meetingId}
          </Typography>
          <Typography variant="body2" textAlign="center" color="text.secondary" sx={{ mb: 2 }}>
            Based on face detection during the meeting
          </Typography>
          
          <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>✅ Present:</strong> Face detected ≥ 75% of time
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>⚠️ Partial:</strong> Face detected ≥ 50% but &lt; 75% of time
            </Typography>
            <Typography variant="body2">
              <strong>❌ Absent:</strong> Face detected &lt; 50% of time
            </Typography>
          </Box>

          <Table>
            <TableHead>
              <TableRow>
                <TableCell>
                  <strong>User</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>Verified %</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>Status</strong>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {attendanceReport?.participants.map(p => (
                <TableRow key={p.userId}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell align="center">
                    {p.verifiedPercent}%
                  </TableCell>
                  <TableCell align="center">
                    <strong 
                      style={{
                        color: p.status === 'Present' ? 'green' 
                             : p.status === 'Partial' ? 'orange' 
                             : 'red'
                      }}
                    >
                      {p.status}
                    </strong>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button
            onClick={() => {
              setShowReportModal(false);
              // Clean up and redirect after closing report
              try {
                if (localVideoref.current?.srcObject) {
                  localVideoref.current.srcObject.getTracks().forEach(t => t.stop());
                }
              } catch (e) {
                console.error('Error stopping tracks:', e);
              }
              setTimeout(() => {
                window.location.href = '/';
              }, 300);
            }}
            variant="contained"
            sx={{ mt: 3, display: 'block', mx: 'auto' }}
          >
            Close & Exit Meeting
          </Button>
        </Box>
      </Modal>

      {/* AI Summary Modal */}
      <Modal open={showSummaryModal} onClose={() => setShowSummaryModal(false)}>
        <Box className={styles.summaryModal}>
          <Typography variant="h5" gutterBottom fontWeight="bold">
            📋 AI Meeting Summary
          </Typography>
          {aiSummary && (
            <>
              <Typography variant="body1" sx={{ mt: 2, mb: 2, lineHeight: 1.7 }}>
                {aiSummary.overview}
              </Typography>
              {aiSummary.keyTopics?.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>Key Topics</Typography>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
                    {aiSummary.keyTopics.map((topic, i) => (
                      <li key={i}><Typography variant="body2">{topic}</Typography></li>
                    ))}
                  </ul>
                </>
              )}
              {aiSummary.decisions?.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>⚡ Decisions Made</Typography>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
                    {aiSummary.decisions.map((d, i) => (
                      <li key={i}><Typography variant="body2" fontWeight={500}>{d}</Typography></li>
                    ))}
                  </ul>
                </>
              )}
              {aiSummary.actionItems?.length > 0 && (
                <>
                  <Typography variant="h6" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>✅ Action Items</Typography>
                  <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
                    {aiSummary.actionItems.map((a, i) => (
                      <li key={i}><Typography variant="body2">{a}</Typography></li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          <Button
            onClick={() => setShowSummaryModal(false)}
            variant="contained"
            sx={{ mt: 3, display: 'block', mx: 'auto' }}
          >
            Close
          </Button>
        </Box>
      </Modal>
    </div>
  );
}



