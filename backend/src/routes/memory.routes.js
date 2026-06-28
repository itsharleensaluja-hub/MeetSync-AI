import { Router } from "express";
import { ThreadMemory } from "../models/threadMemory.model.js";

const router = Router();

router.get("/thread/:meetingCode", async (req, res) => {
    try {
        const { meetingCode } = req.params;
        const prefix = (meetingCode || '').split(/[/-]/)[0] || meetingCode;

        const allThreads = await ThreadMemory.find({}).sort({ lastMeetingEnded: -1 }).limit(10);
        let matched = allThreads.find(t => t.threadId.startsWith(prefix + '::'));

        if (!matched) {
            matched = allThreads.find(t => t.meetingCodes.includes(meetingCode));
        }

        if (matched) {
            return res.status(200).json({
                success: true,
                data: {
                    threadId: matched.threadId,
                    summary: matched.summary,
                    pendingActionItems: (matched.pendingActionItems || []).filter(a => !a._status_completed),
                    lastMeetingEnded: matched.lastMeetingEnded,
                    previousMeetingCount: (matched.meetingCodes || []).length,
                }
            });
        }
        return res.status(200).json({ success: true, data: null });
    } catch (error) {
        console.error("Error fetching thread memory:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch thread memory" });
    }
});

export default router;
