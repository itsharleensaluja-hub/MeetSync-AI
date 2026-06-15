/**
 * ATTENDANCE ROUTES - attendance.routes.js
 * API endpoints for retrieving attendance reports
 */

import { Router } from "express";
import { Attendance } from "../models/attendance.model.js";

const router = Router();

/**
 * GET /api/v1/attendance/owner/:userId
 * Get all attendance reports where the user is the meeting owner
 */
router.get("/owner/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        
        const reports = await Attendance.find({
            $or: [
                { meetingOwner: userId },
                { meetingOwner: { $regex: `^${userId}_` } },
                { "participants.name": userId }
            ]
        })
            .sort({ date: -1 })
            .limit(50);
        
        return res.status(200).json({
            success: true,
            count: reports.length,
            data: reports
        });
    } catch (error) {
        console.error("Error fetching owner reports:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch attendance reports"
        });
    }
});

/**
 * GET /api/v1/attendance/meeting/:meetingId
 * Get attendance report for a specific meeting
 */
router.get("/meeting/:meetingId", async (req, res) => {
    try {
        const { meetingId } = req.params;
        
        const report = await Attendance.findOne({ meetingId })
            .sort({ date: -1 }); // Get most recent if multiple exist
        
        if (!report) {
            return res.status(404).json({
                success: false,
                message: "Attendance report not found"
            });
        }
        
        return res.status(200).json({
            success: true,
            data: report
        });
    } catch (error) {
        console.error("Error fetching meeting report:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch attendance report"
        });
    }
});

/**
 * GET /api/v1/attendance/user/:userId
 * Get all attendance records for a specific user (as a participant)
 */
router.get("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        
        const reports = await Attendance.find({
            "participants.userId": userId
        })
        .sort({ date: -1 })
        .limit(50);
        
        // Extract only the relevant participant data from each report
        const userAttendance = reports.map(report => ({
            meetingId: report.meetingId,
            meetingOwner: report.meetingOwner,
            date: report.date,
            startTime: report.startTime,
            endTime: report.endTime,
            myAttendance: report.participants.find(p => p.userId === userId)
        }));
        
        return res.status(200).json({
            success: true,
            count: userAttendance.length,
            data: userAttendance
        });
    } catch (error) {
        console.error("Error fetching user attendance:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch user attendance records"
        });
    }
});

export default router;
