/**
 * USER ROUTES - users.routes.js
 * Defines all API endpoints for user operations
 * All routes are prefixed with /api/v1/users (set in app.js)
 */

import { Router } from "express";
import { addToHistory, getMeetingDetails, getUserHistory, login, register } from "../controllers/user.controller.js";

const router = Router();

// API ENDPOINTS:
// POST /api/v1/users/login - Authenticate user and get token
router.route("/login").post(login)

// POST /api/v1/users/register - Create new user account
router.route("/register").post(register)

// POST /api/v1/users/add_to_activity - Save meeting to user's history
router.route("/add_to_activity").post(addToHistory)

// GET /api/v1/users/get_all_activity - Get user's meeting history
router.route("/get_all_activity").get(getUserHistory)

// GET /api/v1/users/meeting/:meetingCode - Get an authorized meeting summary
router.route("/meeting/:meetingCode").get(getMeetingDetails)

export default router;