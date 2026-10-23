/**
 * MEETING MODEL - meeting.model.js
 * Database schema for meeting history
 * Tracks which users have joined which meeting codes
 * Used to show "History" page on frontend
 */

import mongoose, { Schema } from "mongoose";

// Define the structure of a Meeting document in MongoDB
const meetingSchema = new Schema(
    {
        user_id: { type: String }, // Username of who joined the meeting
        meetingCode: { type: String, required: true }, // The meeting room code
        meetingOwner: { type: String }, // Username of who created the meeting
        title: { type: String, default: "Weekly Strategy Sync" },
        participants: [{
            user_id: { type: String },
            name: { type: String },
            joinedAt: { type: Date, default: Date.now }
        }],
        summary: { type: Object, default: null },
        summaryPreview: { type: String, default: "" },
        endedAt: { type: Date },
        date: { type: Date, default: Date.now, required: true } // When they joined
    }
)

// Create the Meeting model from the schema
const Meeting = mongoose.model("Meeting", meetingSchema);

export { Meeting };