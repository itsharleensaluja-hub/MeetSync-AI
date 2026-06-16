/**
 * BACKEND ENTRY POINT - app.js
 * This is the main server file that:
 * 1. Sets up Express server
 * 2. Configures Socket.io for real-time video communication
 * 3. Connects to MongoDB database
 * 4. Defines API routes for user authentication and meeting history
 */

import express from "express";
import { createServer } from "node:http"; // HTTP server for Express

import { Server } from "socket.io"; // Real-time communication for video calls

import mongoose from "mongoose"; // MongoDB ODM for database operations
import { connectToSocket } from "./controllers/socketManager.js"; // Socket.io connection handler

import cors from "cors"; // Allow frontend to make requests from different origin
import dotenv from "dotenv";
import path from "path"; // For serving static files
import { fileURLToPath } from "url"; // For ES modules __dirname equivalent

dotenv.config(); // Load environment variables from .env file
import userRoutes from "./routes/users.routes.js"; // User authentication routes
import attendanceRoutes from "./routes/attendance.routes.js"; // Attendance report routes
import actionItemRoutes from "./routes/actionItem.routes.js"; // Action item routes

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express application
const app = express();
// Create HTTP server from Express app
const server = createServer(app);
// Initialize Socket.io with the HTTP server for real-time video call functionality
const io = connectToSocket(server);


// Set server port (from .env file or default to 8000)
app.set("port", (process.env.PORT || 8000))

// MIDDLEWARE CONFIGURATION
// Configure CORS to allow frontend requests from localhost:3000 and production
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://meettrack-ai.onrender.com',
  'https://meettrack-ai-1.onrender.com',
  process.env.FRONTEND_URL
].filter(Boolean);

console.log('✅ CORS Allowed Origins:', allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc)
    if (!origin) {
      console.log('✅ Allowing request with no origin (Postman/mobile)');
      return callback(null, true);
    }
    
    if (allowedOrigins.includes(origin)) {
      console.log('✅ CORS allowed for origin:', origin);
      callback(null, true);
    } else {
      console.log('⚠️ CORS blocked origin:', origin);
      // For debugging - allow all origins temporarily
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: "40kb" })); // Parse JSON request bodies up to 40kb
app.use(express.urlencoded({ limit: "40kb", extended: true })); // Parse URL-encoded data

// API ROUTES
// Test endpoint to verify server is running
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running', port: app.get("port") });
});

// All user-related endpoints (login, register, meeting history) are prefixed with /api/v1/users
app.use("/api/v1/users", userRoutes);
// All attendance-related endpoints (reports, owner reports) are prefixed with /api/v1/attendance
app.use("/api/v1/attendance", attendanceRoutes);
app.use("/api/v1/action-items", actionItemRoutes);

// SERVE FRONTEND STATIC FILES IN PRODUCTION
// This serves the React build files when deployed
if (process.env.NODE_ENV === 'production') {
  // Serve static files from frontend build directory
  const frontendBuildPath = path.join(__dirname, '../../frontend/build');
  console.log('🚀 Serving static files from:', frontendBuildPath);
  
  app.use(express.static(frontendBuildPath));
  
  // Handle client-side routing - serve index.html for all non-API routes
  // This ensures React Router works with direct URL access
  app.get('*', (req, res) => {
    // Don't intercept API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// START SERVER FUNCTION
const start = async () => {
  try {
    const connectionDb = await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Mongo Connected:", connectionDb.connection.host);

    const PORT = app.get("port");
    
    // Add error handler for port conflicts
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ ERROR: Port ${PORT} is already in use!`);
        console.log(`💡 Solution: Kill the process using port ${PORT}:`);
        console.log(`   Windows: netstat -ano | findstr :${PORT}`);
        console.log(`   Then: taskkill /F /PID <PID>`);
        console.log(`   Or use: npm run kill-port`);
        process.exit(1);
      } else {
        console.error("❌ Server error:", error);
        process.exit(1);
      }
    });

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server listening on port ${PORT}`);
      console.log(`✅ API Health Check: http://localhost:${PORT}/api/health`);
      console.log(`✅ Login endpoint: http://localhost:${PORT}/api/v1/users/login`);
    });

  } catch (error) {
    console.error("❌ Server failed to start:", error.message);
    process.exit(1);
  }
};


// Initialize and start the server
start();