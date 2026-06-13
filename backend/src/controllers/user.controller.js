/**
 * USER CONTROLLER - user.controller.js
 * Handles all user-related operations:
 * - login: Authenticate user and generate token
 * - register: Create new user account
 * - getUserHistory: Get all past meetings for a user
 * - addToHistory: Save a meeting to user's history
 */

import httpStatus from "http-status";
import { User } from "../models/user.model.js"; // User database model
import bcrypt, { hash } from "bcrypt" // Password encryption

import crypto from "crypto" // Generate random tokens
import { Meeting } from "../models/meeting.model.js"; // Meeting database model

// LOGIN FUNCTION
// Validates credentials and returns a token for authenticated sessions
const login = async (req, res) => {

    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
        return res.status(400).json({ message: "Please Provide" })
    }

    try {
        // Find user in database
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User Not Found" })
        }

        // Compare provided password with hashed password in database
        let isPasswordCorrect = await bcrypt.compare(password, user.password)

        if (isPasswordCorrect) {
            // Generate a random session token
            let token = crypto.randomBytes(20).toString("hex");

            // Save token to user record (used for authenticated requests)
            user.token = token;
            await user.save();
            // Return token to frontend (stored in localStorage)
            return res.status(httpStatus.OK).json({ token: token })
        } else {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid Username or password" })
        }

    } catch (e) {
        return res.status(500).json({ message: `Something went wrong ${e}` })
    }
}


// REGISTER FUNCTION
// Creates a new user account with encrypted password
const register = async (req, res) => {
    const { name, username, password } = req.body;


    try {
        // Check if username is already taken
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({ message: "User already exists" });
        }

        // Hash password for security (never store plain text passwords)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user object
        const newUser = new User({
            name: name,
            username: username,
            password: hashedPassword
        });

        // Save to database
        await newUser.save();

        res.status(httpStatus.CREATED).json({ message: "User Registered" })

    } catch (e) {
        res.status(500).json({ message: `Something went wrong ${e}` })
    }

}


// GET USER HISTORY FUNCTION
// Retrieves all past meetings that the user has joined
const getUserHistory = async (req, res) => {
    const token = req.headers.authorization || req.query.token;

    try {
        // Find user by their session token
        const user = await User.findOne({ token: token });
        // Get all meetings associated with this user
        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid token" });
        }
        const meetings = await Meeting.find({ user_id: user.username })
        res.json(meetings)
    } catch (e) {
        res.status(500).json({ message: `Something went wrong ${e}` })
    }
}

// ADD TO HISTORY FUNCTION
// Saves a meeting code to the user's meeting history (called when joining a call)
const addToHistory = async (req, res) => {
    const { token, meeting_code } = req.body;

    try {
        // Find user by token
        const user = await User.findOne({ token: token });
        if (!user) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid token" });
        }

        // Create new meeting record
        const newMeeting = new Meeting({
            user_id: user.username,
            meetingCode: meeting_code
        })

        // Save to database
        await newMeeting.save();

        res.status(httpStatus.CREATED).json({ message: "Added code to history" })
    } catch (e) {
        res.status(500).json({ message: `Something went wrong ${e}` })
    }
}


export { login, register, getUserHistory, addToHistory }