/**
 * AUTH CONTEXT - AuthContext.jsx
 * Global state management for user authentication
 * Provides authentication functions to all components:
 * - handleRegister: Create new account
 * - handleLogin: Authenticate and get token
 * - getHistoryOfUser: Fetch user's meeting history
 * - addToUserHistory: Save meeting to history
 * 
 * Uses React Context API to make these functions available throughout the app
 */

import axios from "axios"; // HTTP client for API requests
import httpStatus from "http-status";
import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom"; // For programmatic navigation
import server from "../environment"; // Backend server URL

// Create authentication context
//Create a place where login-related data can be stored and accessed by the whole app
export const AuthContext = createContext({});

// Configure axios client with backend URL
// All requests will be sent to http://localhost:8000/api/v1/users
const client = axios.create({
    baseURL: `${server}/api/v1/users`
})


// AuthProvider component wraps the entire app (see App.js)
// Makes authentication functions available to all child components
export const AuthProvider = ({ children }) => {

    const authContext = useContext(AuthContext);

    // Store user data (currently not fully utilized)
    const [userData, setUserData] = useState(authContext);

    // Router for navigation after login/register
    const router = useNavigate();

    // REGISTER FUNCTION
    // Creates a new user account
    // Returns success message or throws error
    const handleRegister = async (name, username, password) => {
        try {
            let request = await client.post("/register", {
                name: name,
                username: username,
                password: password
            })


            if (request.status === httpStatus.CREATED) {
                return request.data.message;
            }
        } catch (err) {
            throw err;
        }
    }

    // LOGIN FUNCTION
    // Authenticates user and stores token in localStorage
    // Redirects to /home on success
    const handleLogin = async (username, password) => {
        try {
            let request = await client.post("/login", {
                username: username,
                password: password
            });

            console.log(username, password)
            console.log(request.data)

            if (request.status === httpStatus.OK) {
                // Store authentication token in browser localStorage
                // This token is sent with all future API requests
                localStorage.setItem("token", request.data.token);
                // Navigate to home page
                router("/home")
            }
        } catch (err) {
            throw err;
        }
    }

    // GET USER HISTORY FUNCTION
    // Fetches all meetings the user has joined
    // Used by the History page to display past meetings
    const getHistoryOfUser = async () => {
        try {
            let request = await client.get("/get_all_activity", {
                headers: {
                    Authorization: localStorage.getItem("token")
                }
            });
            return request.data
        } catch
         (err) {
            throw err;
        }
    }

    // ADD TO HISTORY FUNCTION
    // Saves a meeting code to the user's history when they join a call
    const addToUserHistory = async (meetingCode) => {
        try {
            let request = await client.post("/add_to_activity", {
                token: localStorage.getItem("token"),
                meeting_code: meetingCode
            });
            return request
        } catch (e) {
            throw e;
        }
    }


    // Package all authentication functions and data
    // These will be available via useContext(AuthContext) in any component
    const data = {
        userData, setUserData, addToUserHistory, getHistoryOfUser, handleRegister, handleLogin
    }

    // Provide authentication context to all child components
    return (
        <AuthContext.Provider value={data}>
            {children}
        </AuthContext.Provider>
    )

}
